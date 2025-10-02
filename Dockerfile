FROM node:16
WORKDIR /app
COPY package.json ./package.json
RUN yarn install
COPY src ./src
CMD ["node", "src/new_marquee.js"]
