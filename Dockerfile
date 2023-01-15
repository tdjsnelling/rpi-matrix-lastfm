FROM node:16
WORKDIR /app
COPY package.json ./package.json
COPY src ./src
RUN yarn install
CMD ["node", "src/index.js"]