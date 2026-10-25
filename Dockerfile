FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir data && chown node:node data
COPY --chown=node:node src ./src
USER node
VOLUME ["/app/data"]
CMD ["node", "src/index.js"]
