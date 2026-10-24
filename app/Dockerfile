FROM node:24.22.0-alpine3.23
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
