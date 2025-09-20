# Use official Node LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies (use package-lock.json if present)
COPY package*.json ./
RUN npm ci --production

# Copy app source
COPY . .

# Expose a port optionally for health checks
EXPOSE 8080

# Start command
CMD ["npm", "start"]