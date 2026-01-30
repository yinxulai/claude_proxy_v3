# Build image
FROM node:20 AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source
COPY tsconfig.json ./
COPY tsconfig.server.json ./
COPY wrangler.toml ./
COPY src/ ./src/

# Build server (CommonJS for Node.js)
RUN ./node_modules/.bin/tsc -p tsconfig.server.json
# RUN npm install -g pm2
RUN npm run build

# Production image
FROM node:20

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copy built files
COPY --from=builder /app/dist/ ./dist/
COPY wrangler.toml ./

#ENV
ENV LOCAL_TOKEN_COUNTING=true

# Expose port
EXPOSE 8788

# Run the server
# CMD ["pm2", "start", "src/server.ts", "-i", "8"]
CMD ["npx", "tsx", "dist/server.js"]
# CMD ["npm", "run", "start"]
# CMD ["node", "dist/server.js"]
# CMD ["npm", "run", "dev"]
