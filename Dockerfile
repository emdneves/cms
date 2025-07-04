FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application using production config
RUN npx tsc -p tsconfig.prod.json

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "dist/index.js"]
