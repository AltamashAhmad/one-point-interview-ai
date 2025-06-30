# Use Node.js version 18 as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your source code
COPY . .

# Expose the port that your server will listen on
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
