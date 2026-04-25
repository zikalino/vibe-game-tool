FROM node:22-alpine

# Install build tools required by better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/

# Data directory is mounted as a volume at runtime
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
