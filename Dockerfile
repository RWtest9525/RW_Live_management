FROM mcr.microsoft.com/playwright:v1.50.0-noble

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7860

# Start the application
CMD ["node", "local-server.js"]
