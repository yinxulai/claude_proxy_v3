# Build image
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY tsconfig.server.json ./
COPY wrangler.toml ./
COPY src/ ./src/

# Build server (CommonJS for Node.js)
RUN npx tsc -p tsconfig.server.json
# RUN npm install -g pm2
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist/ ./dist/
COPY wrangler.toml ./

# Expose port
EXPOSE 8788

# Run the server
# CMD ["pm2", "start", "src/server.ts", "-i", "8"]
CMD ["npm", "run", "start"]
# CMD ["node", "dist/server.js"]
# CMD ["npm", "run", "dev"]
