FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Explicitly ensure scripts/ is present (migration and maintenance scripts for Render shell)
# Required for: node scripts/migrate-legacy-image-urls.js in Render Shell
COPY scripts ./scripts

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
