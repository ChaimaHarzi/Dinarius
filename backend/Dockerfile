FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
RUN mkdir -p uploads && chown node:node uploads

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
