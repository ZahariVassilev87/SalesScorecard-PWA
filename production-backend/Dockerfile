# Build React Admin assets
FROM node:18-alpine AS admin-builder
WORKDIR /build/admin-panel
COPY admin-panel/package*.json ./
RUN npm install
COPY admin-panel/ ./
RUN npm run build

# Runtime backend image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend code with correct ownership
COPY --chown=nodejs:nodejs . .

# Copy built React Admin SPA into backend public directory
COPY --from=admin-builder --chown=nodejs:nodejs /build/admin-panel/build /app/public/react-admin

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]