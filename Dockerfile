# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build && npm run build:api

FROM node:24-alpine AS runtime-base
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
RUN mkdir -p /app/storage/documents /app/storage/exports && chown -R node:node /app
USER node
EXPOSE 4000

FROM runtime-base AS api
CMD ["node", "server/dist/server/src/server.js"]

FROM runtime-base AS worker
CMD ["node", "server/dist/server/src/worker.js"]

FROM build AS migrate
CMD ["npm", "run", "db:migrate:deploy"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
