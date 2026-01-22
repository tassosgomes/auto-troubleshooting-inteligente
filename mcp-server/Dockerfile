FROM node:20-alpine

RUN apk add --no-cache git openssh-client

RUN mkdir -p /home/node/.ssh \
	&& chmod 700 /home/node/.ssh \
	&& chown -R node:node /home/node/.ssh

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

RUN npm ci

COPY src ./src
COPY ssh_config /home/node/.ssh/config

RUN npm run build

ENV NODE_ENV=production

USER node

CMD ["node", "dist/index.js"]
