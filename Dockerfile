FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and data
COPY src/ ./src/
COPY data/ ./data/

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm ci --only=production && npm cache clean --force

# Create directories and set permissions
RUN mkdir -p temp logs && \
    chown -R node:node /app

USER node

EXPOSE 4444

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4444/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

CMD ["node", "dist/app.js"]