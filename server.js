// METAL ARENA — сервер: лобби + TDM + раунды + сетевое выживание с волнами и боссами.
// Запуск: node server.js   (нужен только Node.js, без сторонних библиотек)

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ARENA = 240, AX = 240, AZ = 170; // прямоугольная арена (должно совпадать с клиентом)
const VEHICLE_KEYS = ['racer','tank','intercep','armored','muscle','pickup','beetle','lambo'];
const VEHICLE_HP = { racer:100, tank:170, intercep:120, armored:200, muscle:115, pickup:140, beetle:105, lambo:95 };
const VEHICLE_ARMOR = { racer:1.0, tank:0.55, intercep:0.82, armored:0.50, muscle:0.85, pickup:0.70, beetle:0.90, lambo:1.0 };
function vehicleMaxHp(veh){ return VEHICLE_HP[veh] || 100; }
function vehicleArmor(veh){ return VEHICLE_ARMOR[veh] || 1; }

// ---------- Strict chat moderation ----------
// Server-side safety net: every risky/contact message becomes stars, never raw text.
const CHAT_BLOCK_RE = [
  /((https?:\/\/|www\.|\.com\b|\.ru\b|\.net\b|\.org\b|\.gg\b|t\.me\b|telegram\b|discord\b|whatsapp\b|viber\b|vk\.com\b|instagram\b|snapchat\b|tiktok\b|youtube\b|gmail\b|email\b|почт[ауы]|телеграм|дискорд|ватсап|вайбер|инстаграм|ютуб|т\.г\.|тг\b))/i,
  /(@[a-z0-9_]{3,}|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\+?\d[\d\s()\-]{6,}\d)/i,
  /\b(cocaine|coke|heroin|meth|weed|marijuana|lsd|mdma|ecstasy|opioid|fentanyl|drug[s]?|nude|porn|sex|xxx|onlyfans|casino|gambling|suicide|selfharm|kill\s*yourself|kys|nazi|hitler|terrorist|bomb\s*making)\b/i,
  /\b(fuck|shit|bitch|asshole|bastard|dick|pussy|cunt|slut|whore|retard|nigger|faggot)\b/i,
  /(кокаин|героин|метамфетамин|марихуана|травк|наркот|наркотик|наркота|снюс|меф|закладк|суицид|порн|секс|казино|ставк|террор|бомб|нацист|гитлер)/i,
  /(сука|сучка|бля|блять|блядь|еба|ебан|ебать|нахуй|пизд|хуй|хуе|мудак|гандон|долбоеб|долбоёб|мразь|шлюха|чмо|тварь|пидор|педик|ниггер)/i
];
const CHAT_HARD_TOKENS = [
  'cocaine','cokaine','cocain','coke','heroin','meth','weed','marijuana','fentanyl','drugs','drug','nude','porn','sex','xxx','onlyfans','casino','gambling','suicide','selfharm','killyourself','kys','nazi','hitler','terrorist','bombmaking',
  'telegram','discord','whatsapp','viber','instagram','snapchat','tiktok','youtube','gmail','email','tme','vkcom','www','http','dotcom',
  'fuck','shit','bitch','asshole','bastard','dick','pussy','cunt','slut','whore','retard','nigger','faggot',
  'кокаин','какаин','кокайн','героин','метамфетамин','марихуана','травка','наркотик','наркота','наркотики','закладка','меф','суицид','порно','секс','казино','ставки','террор','бомба','нацист','гитлер',
  'телеграм','телега','тг','дискорд','ватсап','вайбер','инстаграм','ютуб','почта','емейл','имейл',
  'блять','блядь','ебать','ебан','нахуй','пизд','хуй','мудак','гандон','долбоеб','долбоёб','мразь','шлюха','сука','чмо','тварь','пидор','педик','ниггер'
];
const RU_LAT_MAP = {'a':'а','b':'б','c':'с','e':'е','h':'н','k':'к','m':'м','o':'о','p':'р','r':'р','t':'т','x':'х','y':'у','0':'о','1':'и','3':'е','4':'а','5':'с','6':'б','7':'т','8':'в','9':'д','@':'а','$':'с','!':'и','|':'и'};
function normalizeChatForFilter(text){
  const src=(text||'').toString().toLowerCase().normalize('NFKD')
    .replace(/[ё]/g,'е')
    .replace(/[0]/g,'o').replace(/[1!|]/g,'i').replace(/[3]/g,'e').replace(/[4@]/g,'a').replace(/[5$]/g,'s').replace(/[7]/g,'t')
    .replace(/(.)\1{2,}/g,'$1$1');
  const compact=src.replace(/[^a-zа-я0-9]+/gi,'');
  let mixed=''; for (const ch of compact) mixed += RU_LAT_MAP[ch] || ch;
  return { compact, mixed };
}
function starMask(raw){ return '*'.repeat(Math.min(24, Math.max(6, String(raw||'').trim().length || 6))); }
function filterChatText(text){
  const raw=(text||'').toString().slice(0,120);
  if(!raw.trim()) return { text:'', changed:false };
  let changed=false;
  for (const re of CHAT_BLOCK_RE){ if(re.test(raw)){ changed=true; break; } }
  const n=normalizeChatForFilter(raw);
  if (CHAT_HARD_TOKENS.some(w=>n.compact.includes(w)||n.mixed.includes(w))) changed=true;
  return changed ? { text:starMask(raw), changed:true } : { text:raw, changed:false };
}



// ---------- HTTP: раздаём файлы игры ----------
const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const full = path.join(__dirname, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(full).toLowerCase();
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- Состояние ----------
let nextId = 1, nextLobby = 1, nextEnemy = 1;
const clients = new Map();  // socket -> { id, name, veh, colorIdx, kills, deaths, team, lobbyId, alive, x, z, yaw, hp }
const lobbies = new Map();  // lobbyId -> { id, name, host, maxPlayers, target, mode, state, members:Set<socket>, ... }
const AFK_LIMIT_MS = 2 * 60 * 1000;
const AFK_CHECK_MS = 5000;

function touchClient(client){ if(client) client.lastActivity = Date.now(); }
function touchClientByMotion(client, x, z, yaw){
  if(!client) return;
  const moved = client.lastMoveX == null || Math.hypot((x||0)-client.lastMoveX, (z||0)-client.lastMoveZ) > 0.35;
  let dy = Math.abs((yaw||0) - (client.lastMoveYaw||0));
  while(dy > Math.PI) dy -= Math.PI*2;
  const turned = Math.abs(dy) > 0.08;
  if(moved || turned){ client.lastMoveX = x||0; client.lastMoveZ = z||0; client.lastMoveYaw = yaw||0; touchClient(client); }
}

function socketById(id){ for (const [s,c] of clients) if (c.id===id) return s; return null; }
function clientById(id){ for (const c of clients.values()) if (c.id===id) return c; return null; }
function send(sock, obj){ if (sock && !sock.destroyed) sock.write(encodeFrame(JSON.stringify(obj))); }
function lobbyBroadcast(lobby, obj, except){ const f=encodeFrame(JSON.stringify(obj));
  for (const s of lobby.members) if (s!==except && !s.destroyed) s.write(f); }
function clamp(v,a,b){ v=parseInt(v,10); if(isNaN(v)) v=a; return Math.max(a,Math.min(b,v)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function dist2(a,b,c,d){ const x=a-c, z=b-d; return x*x+z*z; }
function cleanPlayerName(name){ return (name||'Player').toString().trim().slice(0,14) || 'Player'; }
function normPlayerName(name){ return cleanPlayerName(name).toLowerCase(); }
function purgeDeadClients(){
  for (const [s,c] of [...clients]){
    if (s.destroyed || c.disconnected){
      if (c.lobbyId!=null) removeFromLobby(s);
      clients.delete(s);
    }
  }
}
function nameTaken(name, exceptSock, onlyInLobby=false){
  purgeDeadClients();
  const n=normPlayerName(name);
  for (const [s,c] of clients){
    if (s===exceptSock || s.destroyed || c.disconnected || !c.nameReady) continue;
    if (onlyInLobby && c.lobbyId==null) continue;
    if (normPlayerName(c.name)===n) return true;
  }
  return false;
}
function resetClientStats(client){ client.kills=0; client.deaths=0; }

function scoreArchiveKey(client){ return normPlayerName(client && client.name); }
function archivePvpScore(lobby, client){
  // Только PvP/раунды: в survival статистика волн не должна жить после выхода.
  if (!lobby || lobby.mode==='survival' || !client || !client.name) return;
  lobby.scoreArchive = lobby.scoreArchive || new Map();
  const key = scoreArchiveKey(client);
  const prev = lobby.scoreArchive.get(key) || {};
  lobby.scoreArchive.set(key, {
    id:'left:'+key,
    name:client.name,
    kills:Math.max(prev.kills||0, client.kills||0),
    deaths:Math.max(prev.deaths||0, client.deaths||0),
    team:(client.team===0 || client.team===1) ? client.team : prev.team,
    colorIdx:client.colorIdx,
    veh:client.veh,
    left:true
  });
}
function restorePvpScore(lobby, client){
  if (!lobby || lobby.mode==='survival' || !client || !lobby.scoreArchive) return null;
  const key = scoreArchiveKey(client);
  const rec = lobby.scoreArchive.get(key);
  if (!rec) return null;
  lobby.scoreArchive.delete(key);
  client.kills = rec.kills || 0;
  client.deaths = rec.deaths || 0;
  return rec;
}

function lobbyListPayload(){
  const list=[];
  for (const l of lobbies.values()){
    list.push({
      id:l.id,
      name:l.name,
      count:l.members.size,
      max:l.maxPlayers,
      mode:l.mode,
      state:l.state,
      target:l.target,
      diff:l.diff || 1,
      wave:l.wave || 0
    });
  }
  return { type:'lobbies', list };
}
function sendLobbyListToMenu(){ const p=lobbyListPayload();
  for (const [s,c] of clients) if (c.lobbyId==null) send(s, p); }
function teamSizes(lobby, exceptId){ const n=[0,0];
  for (const s of lobby.members){ const c=clients.get(s); if (c.id===exceptId) continue; if (c.team===0||c.team===1) n[c.team]++; } return n; }
function roomPayload(lobby){
  const members=[];
  for (const s of lobby.members){
    const c=clients.get(s);
    members.push({ id:c.id, name:c.name, team:c.team, colorIdx:c.colorIdx, veh:c.veh, alive:!!c.alive, waitingNextWave:!!c.waitingNextWave, waitingNextRound:!!c.waitingNextRound, activeInWave:!!c.activeInWave });
  }
  return {
    type:'room',
    id:lobby.id,
    name:lobby.name,
    host:lobby.host,
    maxPlayers:lobby.maxPlayers,
    target:lobby.target,
    arena:lobby.arena || 'factory',
    diff:lobby.diff || 1,
    mode:lobby.mode,
    state:lobby.state,
    members
  };
}
function scorePayload(lobby){
  const teams=[0,0], players=[];
  const onlineNames=new Set();
  for (const s of lobby.members){
    const c=clients.get(s);
    if (!c) continue;
    onlineNames.add(normPlayerName(c.name));
    if (c.team===0||c.team===1) teams[c.team]+=c.kills;
    players.push({ id:c.id, name:c.name, kills:c.kills, deaths:c.deaths, team:c.team, colorIdx:c.colorIdx, veh:c.veh, left:false });
  }
  if (lobby.mode!=='survival' && lobby.scoreArchive){
    for (const rec of lobby.scoreArchive.values()){
      if (onlineNames.has(normPlayerName(rec.name))) continue;
      if (rec.team===0||rec.team===1) teams[rec.team]+=rec.kills||0;
      players.push({ ...rec, left:true });
    }
  }
  return { type:'score', teams, target:lobby.target, players };
}

function clearLobbyTimers(lobby){
  if (!lobby) return;
  if (lobby.timer) clearTimeout(lobby.timer);
  if (lobby.waveTimer) clearTimeout(lobby.waveTimer);
  if (lobby.aiTimer) clearInterval(lobby.aiTimer);
  if (lobby.stateTimer) clearInterval(lobby.stateTimer);
  lobby.timer=null;
  lobby.waveTimer=null;
  lobby.aiTimer=null;
  lobby.stateTimer=null;
}

function addToLobby(sock, client, lobby){
  client.lobbyId=lobby.id;
  lobby.members.add(sock);
  resetClientStats(client);
  const restoredScore = lobby.mode !== 'survival' ? restorePvpScore(lobby, client) : null;
  const prevTeams = lobby.mode !== 'survival' ? teamSizes(lobby, client.id) : [0,0];
  client.waitingNextRound=false;
  if (lobby.mode === 'survival') {
    client.team = null;
    if (lobby.state === 'playing' && lobby.wave > 0) {
      // Важное правило: кто зашёл во время волны, не может сразу ожить через перезаход.
      // Он зритель до следующей волны.
      client.alive=false;
      client.activeInWave=false;
      client.waitingNextWave=true;
      client.waitingNextRound=false;
      client.hp=0;
    } else {
      client.alive=true;
      client.activeInWave=true;
      client.waitingNextWave=false;
      client.waitingNextRound=false;
    }
  } else {
    client.activeInWave=false;
    client.waitingNextWave=false;
    if (restoredScore && (restoredScore.team===0 || restoredScore.team===1)) {
      client.team = restoredScore.team;
    } else {
      const n=prevTeams;
      client.team = n[0]<=n[1] ? 0 : 1; // в меньшую команду
    }
    // Если раунд уже идёт и в обеих командах уже были игроки, новый игрок ждёт следующий раунд.
    // Если одна команда пустая, можно сразу войти в текущий раунд, чтобы не было вечного ожидания.
    const fullRoundAlreadyRunning = lobby.mode==='rounds' && lobby.state==='playing' && lobby.roundActive && prevTeams[0]>0 && prevTeams[1]>0;
    client.waitingNextRound=!!fullRoundAlreadyRunning;
    client.alive=!client.waitingNextRound;
    if (client.waitingNextRound) client.hp=0;
  }
}
function removeFromLobby(sock){
  const client=clients.get(sock); if (!client || client.lobbyId==null) return;
  const lobby=lobbies.get(client.lobbyId); const leftId=client.id;
  if (lobby && lobby.mode!=='survival') archivePvpScore(lobby, client);
  client.lobbyId=null; client.team=null; client.alive=true; client.activeInWave=false; client.waitingNextWave=false; client.waitingNextRound=false; resetClientStats(client);
  if (!lobby) return;
  lobby.members.delete(sock);
  if (lobby.members.size===0){
    clearLobbyTimers(lobby);
    lobbies.delete(lobby.id); // пустое лобби удаляется
  } else {
    if (lobby.host===client.id){ lobby.host=clients.get([...lobby.members][0]).id; }
    lobbyBroadcast(lobby, { type:'playerLeft', id:leftId, name:client.name }); // убрать машину вышедшего у остальных
    lobbyBroadcast(lobby, roomPayload(lobby));
    lobbyBroadcast(lobby, scorePayload(lobby));
    if (lobby.mode==='rounds' && lobby.state==='playing') checkRound(lobby);
    if (lobby.mode==='survival' && lobby.state==='playing') checkSurvivalPlayers(lobby);
  }
  sendLobbyListToMenu();
}

// ---------- Создание лобби ----------
function createLobby(socket, client, m, forcedMode){
  if (!client.nameReady) client.name=cleanPlayerName(client.name||m.name);
  if (nameTaken(client.name, socket, true)){
    send(socket,{ type:'nameTaken', name:client.name, text:'This nickname is already taken. Choose another one.' });
    return;
  }
  const mode = forcedMode || (m.mode==='survival' ? 'survival' : m.mode==='rounds' ? 'rounds' : 'tdm');
  const target = mode==='rounds' ? clamp(m.target,1,15) : mode==='survival' ? clamp(m.target || m.waves,3,30) : clamp(m.target,3,200);
  const arena = ['factory','quarry','docks','junkyard'].includes(m.arena) ? m.arena : 'factory';
  const lobby={
    id:nextLobby++,
    name:(m.name||('Lobby '+client.name)).toString().slice(0,20),
    host:client.id,
    maxPlayers:clamp(m.maxPlayers,2,20),
    target,
    arena,
    diff:mode==='survival' ? clamp(m.diff || m.difficulty,1,5) : 1,
    mode,
    state:'lobby',
    members:new Set(),

    // rounds
    round:0,
    roundScores:[0,0],
    roundActive:false,
    timer:null,

    // survival
    wave:0,
    enemies:new Map(),
    scoreArchive:new Map(),
    waveTimer:null,
    aiTimer:null,
    stateTimer:null,
    lastAi:Date.now()
  };
  lobbies.set(lobby.id, lobby);
  addToLobby(socket, client, lobby);
  send(socket, roomPayload(lobby));
  send(socket, scorePayload(lobby));
  sendLobbyListToMenu();
  console.log(`+ лобби "${lobby.name}" #${lobby.id} mode=${lobby.mode} (хост ${client.name})`);
}

// ----- режим РАУНДЫ (на выбывание) -----
function startRound(lobby){
  if (lobby.timer){ clearTimeout(lobby.timer); lobby.timer=null; }
  const n=teamSizes(lobby);
  if (n[0]===0 || n[1]===0){ lobby.roundActive=false; lobbyBroadcast(lobby,{ type:'roundWait' }); return; } // нужны обе команды
  for (const s of lobby.members){ const c=clients.get(s); if(!c) continue; c.alive=true; c.waitingNextRound=false; c.hp=1; }
  lobby.round++; lobby.roundActive=true;
  lobbyBroadcast(lobby,{ type:'roundStart', round:lobby.round, scores:lobby.roundScores });
}
function roundWin(lobby, team){
  lobby.roundActive=false; lobby.roundScores[team]++;
  lobbyBroadcast(lobby,{ type:'roundEnd', winner:team, scores:lobby.roundScores });
  if (lobby.roundScores[team] >= lobby.target){
    lobby.state='lobby'; lobbyBroadcast(lobby,{ type:'gameover', winner:team, teams:lobby.roundScores }); sendLobbyListToMenu();
  } else { lobby.timer=setTimeout(()=>{ if (lobbies.has(lobby.id)) startRound(lobby); }, 3500); }
}
function checkRound(lobby){
  if (!lobby.roundActive) return;
  const alive=[0,0], total=[0,0];
  for (const s of lobby.members){ const c=clients.get(s); if (c.team!==0&&c.team!==1) continue; total[c.team]++; if (c.alive) alive[c.team]++; }
  if (total[0]===0 || total[1]===0) return;
  if (alive[0]===0 && alive[1]===0) return;
  if (alive[0]===0) roundWin(lobby, 1);
  else if (alive[1]===0) roundWin(lobby, 0);
}
// правило баланса: можно встать в команду T, только если она не больше другой
function setTeam(lobby, client, T){
  if (lobby.mode === 'survival') { client.team=null; return true; }
  T = T===1?1:0; const n=teamSizes(lobby, client.id);
  if (n[T] <= n[1-T]){ client.team=T; return true; }
  client.team = 1-T; return false; // «слишком много» — кидаем в меньшую
}

// ----- режим ВЫЖИВАНИЕ (сетевые волны + боссы + нормальный ИИ) -----
const BOT_RADIUS = 2.8;
const BOSS_RADIUS = 5.4;
const PLAYER_RADIUS = 3.0;

// Эти стены повторяют главные внутренние контейнерные укрытия из index.html.
// Это не физический движок, но боты теперь не лезут прямо через основные контейнерные блоки.
const SERVER_WALLS = [
  { x: 62,  z:-38, hw:18.4, hd:1.7 },
  { x:-60,  z: 42, hw:1.7,  hd:18.4 },
  { x: 44,  z: 58, hw:18.4, hd:1.7 },
  { x:-52,  z:-54, hw:1.7,  hd:18.4 },
  { x:  6,  z:-22, hw:18.4, hd:1.7 }
];

function clampNumber(v,a,b){ return Math.max(a, Math.min(b, v)); }
function angleToYaw(x,z){ return Math.atan2(x,z); }
function normalize2(x,z){ const d=Math.hypot(x,z)||1; return [x/d,z/d,d]; }
function enemyHp01(e){ return Math.max(0, Math.min(1, e.hp / e.maxHp)); }
function survivalAliveCount(lobby){ return lobby.enemies ? lobby.enemies.size : 0; }

function enemyPublic(e){
  return {
    id:e.id,
    name:e.name,
    x:e.x,
    z:e.z,
    yaw:e.yaw,
    hp:enemyHp01(e),
    boss:e.boss,
    bossType:e.bossType || null,
    role:e.role,
    veh:e.veh,
    colorIdx:e.colorIdx,
    radius:e.radius
  };
}

function resetSurvival(lobby){
  clearLobbyTimers(lobby);
  lobby.wave=0;
  lobby.enemies=new Map();
  lobby.lastAi=Date.now();
}

function startSurvival(lobby){
  if (!lobby || lobby.mode!=='survival') return;
  resetSurvival(lobby);
  lobby.state='playing';
  for (const s of lobby.members){
    const c=clients.get(s);
    c.kills=0; c.deaths=0; c.alive=true; c.team=null; c.activeInWave=true; c.waitingNextWave=false; c.hp=1;
  }
  lobbyBroadcast(lobby,{ type:'start', mode:'survival' });
  lobbyBroadcast(lobby, roomPayload(lobby));
  lobbyBroadcast(lobby, scorePayload(lobby));
  sendLobbyListToMenu();
  lobby.waveTimer=setTimeout(()=>spawnSurvivalWave(lobby.id), 1200);
}

function chooseNormalRole(wave){
  const r=Math.random();
  // На ранних волнах проще, дальше больше смешанных ролей.
  if (wave < 3) return r < 0.65 ? 'chaser' : r < 0.85 ? 'flanker' : 'shooter';
  if (r < 0.34) return 'chaser';
  if (r < 0.58) return 'flanker';
  if (r < 0.80) return 'shooter';
  return 'charger';
}

function chooseBossType(wave){
  const roll=(wave + Math.floor(Math.random()*3)) % 3;
  if (roll===0) return 'juggernaut';   // тяжёлый таран
  if (roll===1) return 'artillery';    // держит дистанцию и кидает ракеты
  return 'commander';                  // быстрее, агрессивнее, чаще меняет угол атаки
}

function roleStats(role, bossType){
  const stats={
    chaser:  { hp:1.00, speed:1.00, dmg:1.00, fire:1.00, range:55, preferred:5.0, veh:'racer'    },
    flanker: { hp:0.92, speed:1.16, dmg:0.92, fire:1.05, range:62, preferred:18,  veh:'intercep' },
    shooter: { hp:0.82, speed:0.78, dmg:0.88, fire:0.78, range:88, preferred:48,  veh:'racer'    },
    charger: { hp:1.12, speed:1.22, dmg:1.35, fire:1.25, range:45, preferred:4.5, veh:'intercep' }
  }[role] || { hp:1, speed:1, dmg:1, fire:1, range:60, preferred:7, veh:'racer' };

  if (!bossType) return stats;
  if (bossType==='juggernaut') return { hp:4.4, speed:0.62, dmg:2.15, fire:1.05, range:62, preferred:5.8, veh:'tank' };
  if (bossType==='artillery')  return { hp:2.7, speed:0.70, dmg:1.65, fire:0.55, range:112, preferred:70, veh:'tank' };
  return { hp:3.25, speed:0.92, dmg:1.85, fire:0.72, range:86, preferred:28, veh:'intercep' };
}

function spawnPointForEnemy(lobby, radius){
  // Несколько попыток, чтобы не родиться прямо внутри другого бота или стены.
  for (let i=0;i<30;i++){
    const side=(Math.random()*4)|0;
    let x,z;
    const ez=AZ - rand(9,18) - radius, ex=AX - rand(9,18) - radius;
    if (side===0){ x=rand(-AX+18, AX-18); z=-ez; }
    else if (side===1){ x=rand(-AX+18, AX-18); z=ez; }
    else if (side===2){ x=-ex; z=rand(-AZ+18, AZ-18); }
    else { x=ex; z=rand(-AZ+18, AZ-18); }
    const probe={x,z,radius};
    resolveArenaAndWalls(probe);
    let ok=true;
    for (const e of lobby.enemies.values()){
      const min=(e.radius||BOT_RADIUS)+radius+3;
      if (dist2(probe.x,probe.z,e.x,e.z) < min*min){ ok=false; break; }
    }
    if (ok) return { x:probe.x, z:probe.z };
  }
  return { x:(Math.random()*2-1)*(AX-20-radius), z:(Math.random()*2-1)*(AZ-20-radius) };
}

function spawnEnemy(lobby, boss=false){
  const wave=Math.max(1, lobby.wave || 1);
  const diff=lobby.diff || 1;
  const players=Math.max(1, lobby.members.size);
  const bossType=boss ? chooseBossType(wave) : null;
  const role=boss ? (bossType==='artillery' ? 'shooter' : bossType==='juggernaut' ? 'charger' : 'flanker') : chooseNormalRole(wave);
  const st=roleStats(role, bossType);

  // Важно: сложность растёт не только количеством, но и характеристиками.
  const power=1 + (wave-1)*0.075 + (diff-1)*0.13 + Math.max(0,players-1)*0.035;
  const baseHp=boss ? 260 : 68;
  const baseDmg=boss ? 13 : 4.6;
  const radius=boss ? BOSS_RADIUS : BOT_RADIUS;
  const pos=spawnPointForEnemy(lobby, radius);
  const id='enemy'+(nextEnemy++);
  const hp=Math.round(baseHp * st.hp * power * (boss ? 1.0 + wave*0.035 : 1.0));

  const enemy={
    id,
    name: boss ? (bossType==='juggernaut' ? 'БОСС-ТАРАН' : bossType==='artillery' ? 'БОСС-АРТИЛЛЕРИЯ' : 'БОСС-КОМАНДИР') :
      (role==='shooter' ? 'Стрелок' : role==='flanker' ? 'Флангер' : role==='charger' ? 'Таранщик' : 'Бот'),
    boss,
    bossType,
    role,
    veh:st.veh,
    colorIdx: boss ? (bossType==='artillery' ? 5 : bossType==='commander' ? 4 : 1) : (nextEnemy % 8),
    x:pos.x,
    z:pos.z,
    vx:0,
    vz:0,
    yaw:Math.random()*Math.PI*2,
    radius,
    speed:(boss ? 18 : 24) * st.speed * (1 + Math.min(0.45, wave*0.015 + diff*0.035)),
    hp,
    maxHp:hp,
    damage:baseDmg * st.dmg * power,
    fireRange:st.range,
    preferredRange:st.preferred,
    fireCd:rand(0.4, 1.8),
    hitCd:rand(0.15, 0.95),
    repathCd:rand(0.1, 1.2),
    strafeSide:Math.random()<0.5 ? -1 : 1,
    strafeCd:rand(0.8, 2.8),
    flankAngle:rand(-1.1,1.1),
    chargeCd:rand(1.8, 4.8),
    chargeTime:0,
    stuckCd:0
  };
  lobby.enemies.set(id, enemy);
  lobbyBroadcast(lobby,{ type:'enemySpawn', enemy:enemyPublic(enemy) });
}


function reviveSurvivalPlayersForWave(lobby){
  // Новая волна = все, кто был в лобби до старта волны, снова живые.
  // Это и умершие на прошлой волне, и те, кто зашёл во время прошлой волны и ждал.
  for (const s of lobby.members){
    const c=clients.get(s); if (!c) continue;
    c.alive=true;
    c.activeInWave=true;
    c.waitingNextWave=false;
    c.hp=1;
    send(s,{ type:'survivalRevive', wave:lobby.wave, total:lobby.target });
  }
}

function activeSurvivalAliveCount(lobby){
  let alive=0, active=0;
  for (const s of lobby.members){
    const c=clients.get(s); if (!c) continue;
    if (c.activeInWave) active++;
    if (c.activeInWave && c.alive && !c.waitingNextWave) alive++;
  }
  return { active, alive };
}

function spawnSurvivalWave(lobbyId){
  const lobby=lobbies.get(lobbyId);
  if (!lobby || lobby.mode!=='survival' || lobby.state!=='playing') return;
  if (lobby.wave >= lobby.target){ finishSurvival(lobby, true); return; }

  lobby.wave++;
  lobby.enemies.clear();
  reviveSurvivalPlayersForWave(lobby);

  const players=Math.max(1, lobby.members.size);
  const diff=lobby.diff || 1;
  const bossWave = lobby.wave % 5 === 0 || lobby.wave === lobby.target;

  // Больше не делаем 30+ тупых болванок. Количество растёт умеренно, а сила/роли растут заметнее.
  const softCap = Math.min(18, 8 + Math.ceil(players*1.4) + diff);
  let count = 4 + Math.floor(lobby.wave*0.55) + Math.ceil(players*0.65) + Math.floor(diff*0.9);
  if (bossWave) count = Math.max(3, count - 2);
  count = Math.max(3, Math.min(softCap, count));

  // На финальной длинной/сложной игре может быть 2 босса, но не толпа.
  const bossCount = bossWave ? (lobby.wave === lobby.target && lobby.target >= 12 && diff >= 3 ? 2 : 1) : 0;

  lobbyBroadcast(lobby,{ type:'wave', wave:lobby.wave, total:lobby.target, diff:lobby.diff, alive:count + bossCount, boss:bossCount>0 });
  for (let i=0;i<count;i++) spawnEnemy(lobby, false);
  for (let i=0;i<bossCount;i++) spawnEnemy(lobby, true);

  if (!lobby.aiTimer) lobby.aiTimer=setInterval(()=>tickSurvival(lobby.id), 80);
  if (!lobby.stateTimer) lobby.stateTimer=setInterval(()=>broadcastEnemyState(lobby.id), 120);
}

function broadcastEnemyState(lobbyId){
  const lobby=lobbies.get(lobbyId);
  if (!lobby || lobby.mode!=='survival' || lobby.state!=='playing') return;
  const enemies=[];
  for (const e of lobby.enemies.values()) enemies.push(enemyPublic(e));
  lobbyBroadcast(lobby,{ type:'enemyState', enemies });
}

function findTarget(lobby, enemy){
  let bestSock=null, bestClient=null, bestScore=Infinity;
  for (const s of lobby.members){
    const c=clients.get(s);
    if (!c || !c.alive || !c.activeInWave || c.waitingNextWave) continue;
    if (typeof c.x !== 'number' || typeof c.z !== 'number') continue;
    const d=Math.sqrt(dist2(enemy.x, enemy.z, c.x, c.z));
    // Флангеры и стрелки не всегда выбирают самого ближайшего, чтобы игроки не получали одну общую кучу.
    const noise=(enemy.role==='flanker' || enemy.role==='shooter') ? rand(-12,12) : rand(-3,3);
    const score=d+noise;
    if (score < bestScore){ bestScore=score; bestSock=s; bestClient=c; }
  }
  if (!bestClient){
    for (const s of lobby.members){
      const c=clients.get(s);
      if (!c || !c.alive || !c.activeInWave || c.waitingNextWave) continue;
      if (typeof c.x !== 'number' || typeof c.z !== 'number') continue;
      const d=Math.sqrt(dist2(enemy.x, enemy.z, c.x, c.z));
      if (d < bestScore){ bestScore=d; bestSock=s; bestClient=c; }
    }
  }
  return bestClient ? { sock:bestSock, client:bestClient, d:bestScore } : null;
}

function resolveCircleRect(e, wall){
  const r=e.radius || BOT_RADIUS;
  const cx=clampNumber(e.x, wall.x-wall.hw, wall.x+wall.hw);
  const cz=clampNumber(e.z, wall.z-wall.hd, wall.z+wall.hd);
  let dx=e.x-cx, dz=e.z-cz;
  let d=Math.hypot(dx,dz);
  if (d >= r) return;
  if (d < 0.0001){
    // Если центр попал внутрь прямоугольника, выталкиваем к ближайшей стороне.
    const left=Math.abs(e.x-(wall.x-wall.hw));
    const right=Math.abs((wall.x+wall.hw)-e.x);
    const top=Math.abs(e.z-(wall.z-wall.hd));
    const bottom=Math.abs((wall.z+wall.hd)-e.z);
    const m=Math.min(left,right,top,bottom);
    if (m===left){ dx=-1; dz=0; d=1; }
    else if (m===right){ dx=1; dz=0; d=1; }
    else if (m===top){ dx=0; dz=-1; d=1; }
    else { dx=0; dz=1; d=1; }
  }
  const push=(r-d)+0.05;
  e.x += (dx/d)*push;
  e.z += (dz/d)*push;
  e.vx *= 0.45;
  e.vz *= 0.45;
}

function resolveArenaAndWalls(e){
  const r=e.radius || BOT_RADIUS;
  e.x=clampNumber(e.x, -AX+r, AX-r);
  e.z=clampNumber(e.z, -AZ+r, AZ-r);
  for (const wall of SERVER_WALLS) resolveCircleRect(e, wall);
}

function resolveEnemyToEnemy(lobby){
  const arr=[...lobby.enemies.values()];
  for (let pass=0; pass<2; pass++){
    for (let i=0;i<arr.length;i++){
      const a=arr[i];
      for (let j=i+1;j<arr.length;j++){
        const b=arr[j];
        let dx=a.x-b.x, dz=a.z-b.z;
        let d=Math.hypot(dx,dz);
        const min=(a.radius||BOT_RADIUS)+(b.radius||BOT_RADIUS)+0.35;
        if (d >= min) continue;
        if (d < 0.001){ dx=rand(-1,1); dz=rand(-1,1); d=Math.hypot(dx,dz)||1; }
        const push=(min-d)*0.52;
        const nx=dx/d, nz=dz/d;
        const aWeight=a.boss ? 0.35 : 0.5;
        const bWeight=b.boss ? 0.35 : 0.5;
        a.x += nx*push*bWeight;
        a.z += nz*push*bWeight;
        b.x -= nx*push*aWeight;
        b.z -= nz*push*aWeight;
        a.vx += nx*push*0.9;
        a.vz += nz*push*0.9;
        b.vx -= nx*push*0.9;
        b.vz -= nz*push*0.9;
        resolveArenaAndWalls(a);
        resolveArenaAndWalls(b);
      }
    }
  }
}

function playerAvoidance(lobby, e){
  let ax=0, az=0;
  for (const s of lobby.members){
    const c=clients.get(s);
    if (!c || typeof c.x!=='number' || typeof c.z!=='number') continue;
    const min=(e.radius||BOT_RADIUS)+PLAYER_RADIUS;
    const dx=e.x-c.x, dz=e.z-c.z;
    const d=Math.hypot(dx,dz)||1;
    if (d < min){
      const f=(min-d)/min;
      ax += (dx/d)*f*2.1;
      az += (dz/d)*f*2.1;
    }
  }
  return [ax,az];
}

function wallAvoidance(e){
  let ax=0, az=0;
  const sense=(e.radius||BOT_RADIUS)+7;
  for (const w of SERVER_WALLS){
    const cx=clampNumber(e.x, w.x-w.hw, w.x+w.hw);
    const cz=clampNumber(e.z, w.z-w.hd, w.z+w.hd);
    let dx=e.x-cx, dz=e.z-cz;
    const d=Math.hypot(dx,dz)||1;
    if (d < sense){
      const f=(sense-d)/sense;
      ax += (dx/d)*f*2.6;
      az += (dz/d)*f*2.6;
    }
  }
  const r2=(e.radius||BOT_RADIUS)+8, ex=AX-r2, ez=AZ-r2;
  if (e.x > ex) ax -= (e.x-ex)/8;
  if (e.x < -ex) ax += (-ex-e.x)/8;
  if (e.z > ez) az -= (e.z-ez)/8;
  if (e.z < -ez) az += (-ez-e.z)/8;
  return [ax,az];
}

function enemySeparationVector(lobby, e){
  let sx=0, sz=0;
  for (const other of lobby.enemies.values()){
    if (other===e) continue;
    const min=(e.radius||BOT_RADIUS)+(other.radius||BOT_RADIUS)+5.5;
    let dx=e.x-other.x, dz=e.z-other.z;
    const d=Math.hypot(dx,dz)||1;
    if (d < min){
      const f=(min-d)/min;
      sx += (dx/d)*f*2.2;
      sz += (dz/d)*f*2.2;
    }
  }
  return [sx,sz];
}

function desiredMoveForEnemy(lobby, e, target, dt){
  const tx=target.client.x-e.x, tz=target.client.z-e.z;
  const [nx,nz,len]=normalize2(tx,tz);
  const px=-nz, pz=nx;
  e.strafeCd-=dt;
  if (e.strafeCd<=0){ e.strafeCd=rand(1.0,3.0); if (Math.random()<0.55) e.strafeSide*=-1; }

  let mx=0, mz=0;
  const preferred=e.preferredRange || 8;

  if (e.role==='shooter'){
    if (len > preferred+10){ mx=nx; mz=nz; }
    else if (len < preferred-12){ mx=-nx; mz=-nz; }
    else { mx=px*e.strafeSide; mz=pz*e.strafeSide; }
  } else if (e.role==='flanker'){
    const side=e.strafeSide;
    const flankDist=preferred + (e.boss ? 10 : 5);
    const goalX=target.client.x - nx*flankDist + px*side*(18 + (e.boss ? 14 : 6));
    const goalZ=target.client.z - nz*flankDist + pz*side*(18 + (e.boss ? 14 : 6));
    const [gx,gz]=normalize2(goalX-e.x, goalZ-e.z);
    mx=gx; mz=gz;
  } else if (e.role==='charger'){
    e.chargeCd-=dt;
    if (e.chargeTime>0){
      e.chargeTime-=dt;
      mx=nx; mz=nz;
    } else if (e.chargeCd<=0 && len<62){
      e.chargeCd=e.boss ? rand(4.2,6.8) : rand(3.0,5.2);
      e.chargeTime=e.boss ? 1.05 : 0.72;
      mx=nx; mz=nz;
    } else {
      mx=nx*0.72 + px*e.strafeSide*0.28;
      mz=nz*0.72 + pz*e.strafeSide*0.28;
    }
  } else {
    // Обычный преследователь больше не едет строго в центр игрока — немного смещается по дуге.
    if (len > preferred){
      mx=nx*0.88 + px*e.strafeSide*0.12;
      mz=nz*0.88 + pz*e.strafeSide*0.12;
    } else {
      mx=px*e.strafeSide; mz=pz*e.strafeSide;
    }
  }

  const [sepX,sepZ]=enemySeparationVector(lobby,e);
  const [wallX,wallZ]=wallAvoidance(e);
  const [plX,plZ]=playerAvoidance(lobby,e);
  mx += sepX + wallX + plX;
  mz += sepZ + wallZ + plZ;
  const [outX,outZ]=normalize2(mx,mz);
  return { x:outX, z:outZ, len, nx, nz };
}

function tickSurvival(lobbyId){
  const lobby=lobbies.get(lobbyId);
  if (!lobby || lobby.mode!=='survival' || lobby.state!=='playing') return;
  const now=Date.now();
  const dt=Math.min(0.12, Math.max(0.02, (now-(lobby.lastAi||now))/1000));
  lobby.lastAi=now;

  for (const e of lobby.enemies.values()){
    const target=findTarget(lobby, e);
    e.fireCd-=dt; e.hitCd-=dt; e.repathCd-=dt;
    if (!target) continue;

    const move=desiredMoveForEnemy(lobby, e, target, dt);
    const len=move.len;
    const chargeMul=e.chargeTime>0 ? (e.boss ? 1.85 : 1.65) : 1.0;
    const slowNear=(len < (e.preferredRange||6) && e.role!=='charger') ? 0.55 : 1.0;
    const maxSpeed=e.speed*chargeMul*slowNear;
    const steer=e.boss ? 0.16 : 0.22;

    e.vx = e.vx*(1-steer) + move.x*maxSpeed*steer;
    e.vz = e.vz*(1-steer) + move.z*maxSpeed*steer;
    const vlen=Math.hypot(e.vx,e.vz);
    if (vlen > maxSpeed){ e.vx=e.vx/vlen*maxSpeed; e.vz=e.vz/vlen*maxSpeed; }

    e.x += e.vx*dt;
    e.z += e.vz*dt;
    resolveArenaAndWalls(e);

    // Смотрит либо туда, куда едет, либо на цель, если стреляет с дистанции.
    if (e.role==='shooter' || (e.boss && e.bossType==='artillery')) e.yaw=angleToYaw(move.nx, move.nz);
    else if (Math.hypot(e.vx,e.vz)>0.4) e.yaw=angleToYaw(e.vx,e.vz);

    // Ближний урон. Таранщики и juggernaut больнее именно при сближении.
    const touchRange=(e.radius||BOT_RADIUS)+PLAYER_RADIUS+0.8;
    if (len < touchRange && e.hitCd <= 0){
      e.hitCd = e.boss ? 0.72 : e.role==='charger' ? 0.62 : 0.95;
      const ramMul = e.role==='charger' && e.chargeTime>0 ? 1.85 : 1.0;
      send(target.sock,{ type:'enemyDamage', target:target.client.id, amount:e.damage*ramMul, from:e.id });
    }

    // Дальний бой. Стрелки и артиллерия опасны на дистанции, но не все боты спамят выстрелами.
    const canShoot = len < (e.fireRange || 65) && e.fireCd <= 0;
    if (canShoot){
      let w='gun';
      if (e.bossType==='artillery') w=Math.random()<0.78 ? 'rocket' : 'gun';
      else if (e.boss) w=Math.random()<0.45 ? 'rocket' : 'gun';
      else if (e.role==='shooter') w=Math.random()<0.26 ? 'rocket' : 'gun';

      const rateMul=roleStats(e.role, e.bossType).fire || 1;
      e.fireCd = (w==='rocket' ? rand(1.6,2.7) : rand(0.9,1.9)) * rateMul;
      const ox=e.x+move.nx*((e.radius||BOT_RADIUS)+1.2), oy=1.78, oz=e.z+move.nz*((e.radius||BOT_RADIUS)+1.2);
      lobbyBroadcast(lobby,{ type:'enemyShot', id:e.id, w, x:ox, y:oy, z:oz, dx:move.nx, dy:0, dz:move.nz });

      // Серверный урон меньше и зависит от роли, чтобы не было мгновенной смерти от толпы.
      const accuracy=e.role==='shooter' ? 0.55 : e.boss ? 0.48 : 0.28;
      if (len < (e.fireRange||65)*0.82 && Math.random()<accuracy){
        const amount = w==='rocket' ? e.damage*0.65 : e.damage*0.24;
        send(target.sock,{ type:'enemyDamage', target:target.client.id, amount, from:e.id });
      }
    }
  }

  resolveEnemyToEnemy(lobby);
}

function handleSurvivalDamage(socket, client, lobby, m){
  if (!lobby || lobby.mode!=='survival' || lobby.state!=='playing') return;
  // Мёртвый или новый игрок, который ждёт следующую волну, не может наносить урон через перезаход/старые снаряды.
  if (!client.alive || !client.activeInWave || client.waitingNextWave) return;
  const id=String(m.target);
  const enemy=lobby.enemies.get(id);
  if (!enemy) return;
  const amount=Math.max(0, Math.min(500, Number(m.amount)||0));
  if (amount<=0) return;

  enemy.hp-=amount;
  if (enemy.hp>0){
    lobbyBroadcast(lobby,{ type:'enemyHp', id:enemy.id, hp:enemyHp01(enemy) });
    return;
  }

  lobby.enemies.delete(enemy.id);
  client.kills++;
  const left=survivalAliveCount(lobby);
  const deathMsg={ type:'enemyDeath', id:enemy.id, killer:client.id, boss:enemy.boss, alive:left };
  lobbyBroadcast(lobby, deathMsg);
  // Для старых версий index.html, если там было имя события enemyDead.
  lobbyBroadcast(lobby, { type:'enemyDead', id:enemy.id, killer:client.id, boss:enemy.boss, alive:left });
  lobbyBroadcast(lobby, scorePayload(lobby));

  if (left<=0){
    if (lobby.wave >= lobby.target) finishSurvival(lobby, true);
    else {
      lobby.waveTimer=setTimeout(()=>{ if (lobbies.has(lobby.id)) spawnSurvivalWave(lobby.id); }, 3000);
    }
  }
}

function checkSurvivalPlayers(lobby){
  if (!lobby || lobby.mode!=='survival' || lobby.state!=='playing') return;
  const now=activeSurvivalAliveCount(lobby);
  // Если все, кто реально начал текущую волну, умерли — выживание провалено.
  // Игроки, которые только что зашли и ждут следующей волны, не считаются живыми.
  if (now.active===0 || now.alive===0){
    setTimeout(()=>{
      const l=lobbies.get(lobby.id); if (!l || l.state!=='playing' || l.mode!=='survival') return;
      const again=activeSurvivalAliveCount(l);
      if (again.active===0 || again.alive===0) finishSurvival(l, false);
    }, 450);
  }
}

function finishSurvival(lobby, win){
  if (!lobby || lobby.mode!=='survival') return;
  clearLobbyTimers(lobby);
  lobby.enemies.clear();
  for (const s of lobby.members){
    const c=clients.get(s); if (!c) continue;
    c.alive=true; c.activeInWave=false; c.waitingNextWave=false; c.hp=1;
  }
  lobby.state='lobby';
  lobbyBroadcast(lobby,{ type:'survivalOver', win:!!win, wave:lobby.wave, total:lobby.target });
  lobbyBroadcast(lobby, roomPayload(lobby));
  sendLobbyListToMenu();
}

// ---------- WebSocket рукопожатие ----------
server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key']; if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  onConnect(socket, head);
});
function onConnect(socket, head){
  const client = {
    id: nextId++, name:'', nameReady:false, veh:'racer', colorIdx:(nextId-2)%8,
    kills:0, deaths:0, team:null, lobbyId:null, alive:true, activeInWave:false, waitingNextWave:false, waitingNextRound:false,
    x:0, z:0, yaw:0, hp:1, lastActivity:Date.now(), lastMoveX:null, lastMoveZ:null, lastMoveYaw:0
  };
  clients.set(socket, client);
  let buffer = (head && head.length) ? Buffer.from(head) : Buffer.alloc(0);
  let frame; while ((frame=decodeFrame(buffer))!==null){ buffer=buffer.slice(frame.totalLength);
    if (frame.opcode===0x1 && frame.payload!=null) handle(socket, client, frame.payload.toString('utf8')); }
  socket.on('data', chunk => { buffer=Buffer.concat([buffer,chunk]); let fr;
    while ((fr=decodeFrame(buffer))!==null){ buffer=buffer.slice(fr.totalLength);
      if (fr.opcode===0x8){ closeClient(socket); return; }
      if (fr.opcode===0x9){ socket.write(encodeFrame(fr.payload,0xA)); continue; }
      if (fr.opcode===0x1 && fr.payload!=null) handle(socket, client, fr.payload.toString('utf8')); } });
  socket.on('close', ()=>closeClient(socket));
  socket.on('error', ()=>closeClient(socket));
}

function handle(socket, client, raw){
  let m; try{ m=JSON.parse(raw); }catch(e){ return; }
  switch (m.type){
    case 'hello': { touchClient(client);
      // На hello больше не держим ник «занятым навсегда» из-за старого меню-сокета.
      // Проверка дубля делается при create/joinLobby, то есть именно при входе в игру с игроками.
      const wantedName=cleanPlayerName(m.name);
      client.name=wantedName;
      client.nameReady=true;
      client.veh=VEHICLE_KEYS.includes(m.veh)?m.veh:'racer';
      send(socket,{ type:'welcome', id:client.id, colorIdx:client.colorIdx, name:client.name });
      send(socket, lobbyListPayload());
      break; }

    case 'lobbies': send(socket, lobbyListPayload()); break;

    case 'disconnect':
      closeClient(socket);
      break;

    case 'create':
      touchClient(client);
      // ВАЖНО: теперь create с mode:'survival' тоже создаёт именно survival, а не TDM.
      createLobby(socket, client, m);
      break;

    case 'createSurvival':
      touchClient(client);
      // Отдельный тип для index.html, где кнопка выживания отправляет createSurvival.
      // Сервер принудительно ставит survival, поэтому командный бой тут не создастся.
      createLobby(socket, client, m, 'survival');
      break;

    case 'joinLobby': {
      touchClient(client);
      const lobby=lobbies.get(m.id); if (!lobby){ send(socket, lobbyListPayload()); break; }
      if (nameTaken(client.name, socket, true)){ send(socket,{ type:'nameTaken', name:client.name, text:'This nickname is already taken. Choose another one.' }); break; }
      if (lobby.members.size>=lobby.maxPlayers){ send(socket,{ type:'lobbyFull' }); break; }
      addToLobby(socket, client, lobby);
      lobbyBroadcast(lobby, roomPayload(lobby));
      lobbyBroadcast(lobby, scorePayload(lobby));
      if (lobby.state==='playing'){
        send(socket,{ type:'start', mode:lobby.mode });
        send(socket, scorePayload(lobby));
        if (lobby.mode==='rounds'){
          if (client.waitingNextRound){
            send(socket,{ type:'roundWaitJoin', round:lobby.round, text:'Ты зашёл во время раунда. Ждём следующий раунд.' });
          } else if (!lobby.roundActive) startRound(lobby);
        }
        if (lobby.mode==='survival'){
          send(socket,{ type:'wave', wave:lobby.wave, total:lobby.target, diff:lobby.diff, alive:survivalAliveCount(lobby), boss:false });
          for (const e of lobby.enemies.values()) send(socket,{ type:'enemySpawn', enemy:enemyPublic(e) });
          if (client.waitingNextWave || !client.activeInWave){
            send(socket,{ type:'survivalWait', wave:lobby.wave, next:Math.min(lobby.target, lobby.wave+1), reason:'join' });
          }
        }
      }
      sendLobbyListToMenu(); break;
    }

    case 'leaveLobby': touchClient(client); removeFromLobby(socket); send(socket, lobbyListPayload()); break;

    case 'team': { touchClient(client); const lobby=lobbies.get(client.lobbyId); if (lobby){ const ok=setTeam(lobby, client, m.team);
      if (!ok) send(socket,{ type:'teamFull' });
      if (lobby.mode==='rounds' && lobby.state==='playing' && lobby.roundActive){ client.alive=false; client.hp=0; client.waitingNextRound=true; send(socket,{type:'roundWaitJoin', round:lobby.round, text:'Смена команды во время раунда — вход со следующего раунда.'}); }
      lobbyBroadcast(lobby, roomPayload(lobby));
      if (lobby.mode==='rounds' && lobby.state==='playing' && !lobby.roundActive) startRound(lobby); } break; }

    case 'start': { touchClient(client); const lobby=lobbies.get(client.lobbyId);
      if (lobby && lobby.host===client.id){
        if (lobby.mode==='survival'){
          startSurvival(lobby);
        } else {
          // PvP modes require at least 2 players. Campaign/local survival can still be played alone on the client.
          if (lobby.members.size < 2){
            send(socket,{ type:'startDenied', text:'Need at least 2 players to start PvP.' });
            lobbyBroadcast(lobby, roomPayload(lobby));
            break;
          }
          lobby.state='playing';
          lobby.scoreArchive = new Map();
          for (const s of lobby.members){ const c=clients.get(s); c.kills=0; c.deaths=0; c.alive=true; c.waitingNextRound=false; }
          lobby.round=0; lobby.roundScores=[0,0]; lobby.roundActive=false;
          lobbyBroadcast(lobby,{ type:'start', mode:lobby.mode }); lobbyBroadcast(lobby, roomPayload(lobby));
          if (lobby.mode==='rounds') startRound(lobby);
          else lobbyBroadcast(lobby, scorePayload(lobby));
          sendLobbyListToMenu();
        }
      }
      break;
    }

    case 'state': { const lobby=lobbies.get(client.lobbyId);
      client.x=Number(m.x)||0; client.z=Number(m.z)||0; client.yaw=Number(m.yaw)||0; touchClientByMotion(client, client.x, client.z, client.yaw);
      const incomingHp=Math.max(0,Math.min(1,Number(m.hp)||0));
      if (client.hpLockUntil && Date.now()<client.hpLockUntil && incomingHp>client.hp) client.hp=client.hp;
      else client.hp=incomingHp;
      if (lobby && lobby.mode==='survival' && lobby.state==='playing' && (!client.activeInWave || client.waitingNextWave)){
        client.alive=false; client.hp=0;
        break;
      }
      if (lobby && lobby.mode==='rounds' && client.waitingNextRound){
        client.alive=false; client.hp=0;
        break;
      }
      if (client.hp>0) client.alive=true;
      if (lobby) lobbyBroadcast(lobby,{ type:'state', id:client.id, x:client.x, z:client.z, yaw:client.yaw, hp:client.hp, team:client.team }, socket);
      break;
    }

    case 'shot': { touchClient(client); const lobby=lobbies.get(client.lobbyId); if (lobby && !(lobby.mode==='rounds' && client.waitingNextRound))
      lobbyBroadcast(lobby,{ type:'shot', id:client.id, w:m.w, x:m.x, y:m.y, z:m.z, dx:m.dx, dy:m.dy, dz:m.dz }, socket); break; }

    case 'damage': { touchClient(client); const lobby=lobbies.get(client.lobbyId); if (!lobby) break;
      if (lobby.mode==='rounds' && client.waitingNextRound) break;
      if (lobby.mode==='survival') handleSurvivalDamage(socket, client, lobby, m);
      else {
        const targetSock=socketById(m.target), target=targetSock?clients.get(targetSock):null;
        const amount=Math.max(0, Math.min(200, Number(m.amount)||0));
        if (!target || target.lobbyId!==lobby.id || !lobby.members.has(targetSock)) break;
        if ((target.team===0||target.team===1) && (client.team===0||client.team===1) && target.team===client.team) break;
        const maxHp=vehicleMaxHp(target.veh);
        const prevHp=(typeof target.hp==='number' && target.hp>=0) ? target.hp : 1;
        target.hp=Math.max(0, Math.min(1, prevHp - (amount*vehicleArmor(target.veh))/maxHp));
        target.hpLockUntil=Date.now()+700;
        if (target.hp<=0) target.alive=false;
        lobbyBroadcast(lobby,{ type:'damage', from:client.id, target:target.id, amount, hp:target.hp });
      }
      break; }

    case 'death': { touchClient(client); const lobby=lobbies.get(client.lobbyId); if (!lobby) break;
      if (lobby.mode==='rounds' && client.waitingNextRound) break;
      client.deaths++; client.alive=false;
      if (lobby.mode==='survival'){
        client.waitingNextWave=true;
        // activeInWave остаётся true: этот игрок начал волну, но умер.
        lobbyBroadcast(lobby,{ type:'death', id:client.id, killer:m.killer });
        lobbyBroadcast(lobby, scorePayload(lobby));
        checkSurvivalPlayers(lobby);
        break;
      }
      const killer = m.killer!=null ? clients.get(socketById(m.killer)) : null;
      if (killer && killer.lobbyId===lobby.id && killer.id!==client.id && killer.team!==client.team) killer.kills++;
      lobbyBroadcast(lobby,{ type:'death', id:client.id, killer:m.killer });
      lobbyBroadcast(lobby, scorePayload(lobby));
      if (lobby.mode==='rounds'){
        checkRound(lobby);
      } else {
        const sp=scorePayload(lobby);
        const win = sp.teams[0]>=lobby.target ? 0 : sp.teams[1]>=lobby.target ? 1 : -1;
        if (win>=0){ lobby.state='lobby'; lobbyBroadcast(lobby,{ type:'gameover', winner:win, teams:sp.teams }); sendLobbyListToMenu(); }
      }
      break;
    }

    case 'chat': { touchClient(client); const lobby=lobbies.get(client.lobbyId);
      if (lobby){ const filtered=filterChatText(m.text); lobbyBroadcast(lobby,{ type:'chat', id:client.id, name:client.name, team:client.team, text:filtered.text }, socket); }
      break; }
  }
}


setInterval(()=>{
  const now=Date.now();
  for (const [sock,client] of [...clients]){
    if (!client || client.lobbyId==null || sock.destroyed || client.disconnected) continue;
    if ((now - (client.lastActivity||now)) > AFK_LIMIT_MS){
      const lobby=lobbies.get(client.lobbyId);
      send(sock,{ type:'afkKick', text:'You were kicked for being AFK for more than 2 minutes.' });
      if (lobby) lobbyBroadcast(lobby,{ type:'playerLeft', id:client.id, name:client.name });
      closeClient(sock);
    }
  }
}, AFK_CHECK_MS);

function closeClient(socket){
  const client=clients.get(socket); if (!client){ try{ socket.destroy(); }catch(e){} return; }
  client.disconnected=true;
  client.nameReady=false;
  removeFromLobby(socket);
  clients.delete(socket);
  console.log(`- ${client.name||'Player'} (#${client.id}) disconnected`);
  try{ socket.destroy(); }catch(e){}
}

// ---------- WebSocket кадры ----------
function decodeFrame(buf){
  if (buf.length<2) return null;
  const opcode=buf[0]&0x0f, masked=(buf[1]&0x80)!==0; let len=buf[1]&0x7f, offset=2;
  if (len===126){ if (buf.length<4) return null; len=buf.readUInt16BE(2); offset=4; }
  else if (len===127){ if (buf.length<10) return null; len=Number(buf.readBigUInt64BE(2)); offset=10; }
  let mask; if (masked){ if (buf.length<offset+4) return null; mask=buf.slice(offset,offset+4); offset+=4; }
  if (buf.length<offset+len) return null;
  let payload=buf.slice(offset,offset+len);
  if (masked){ const out=Buffer.allocUnsafe(len); for (let i=0;i<len;i++) out[i]=payload[i]^mask[i&3]; payload=out; }
  return { opcode, payload, totalLength:offset+len };
}
function encodeFrame(data, opcode=0x1){
  const payload=Buffer.isBuffer(data)?data:Buffer.from(data,'utf8'); const len=payload.length; let header;
  if (len<126){ header=Buffer.alloc(2); header[1]=len; }
  else if (len<65536){ header=Buffer.alloc(4); header[1]=126; header.writeUInt16BE(len,2); }
  else { header=Buffer.alloc(10); header[1]=127; header.writeBigUInt64BE(BigInt(len),2); }
  header[0]=0x80|opcode; return Buffer.concat([header,payload]);
}

server.listen(PORT, '0.0.0.0', () => {
  const nets=require('os').networkInterfaces(); const ips=[];
  for (const name of Object.keys(nets)) for (const ni of nets[name]) if (ni.family==='IPv4' && !ni.internal) ips.push(ni.address);
  console.log('=================================================');
  console.log('  🔥  METAL ARENA — сервер (TDM + раунды + волны)');
  console.log(`     Локально:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`     По сети:   http://${ip}:${PORT}   (давай этот адрес друзьям)`);
  console.log('=================================================');
});
