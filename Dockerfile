# Local-first CRM image. pg_dump/pg_restore (client 16) ship in the image for backups and recovery.
FROM node:22-alpine3.20
RUN apk add --no-cache postgresql16-client tzdata
WORKDIR /app
ENV HOME=/tmp NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && chmod -R a+rX /app && chmod -R a+rwX /app/.next
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "scripts/docker-entrypoint.sh"]
