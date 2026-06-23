FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || true
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
