# Use Node.js 20 slim image for smaller footprint and compatibility with latest dependencies
FROM node:20-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (if available).
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
# If you have a package-lock.json, speed up installs with `npm ci`.
RUN npm install --only=production

# Copy local code to the container image.
COPY . .

# Ensure the app listens on the port provided by Cloud Run
ENV PORT 3000
EXPOSE 3000

# Run the web service on container startup.
CMD [ "npm", "start" ]
