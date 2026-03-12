# use the official docker image for node.js version 20
# this image already contains node.js runtime, npm, linux environment
FROM node:20 

# set /app as the working directory inside the container
# after that, all following cmds will run inside /app
WORKDIR /app

# copy package.json, package-lock.json into /app
COPY package*.json ./

# run this to downloads all dependencies defined in package.json into node_modules
RUN npm install

# copy all other files
COPY . .

# the container will use port 3000
EXPOSE 3000

# these cmds run when the container starts
CMD ["npm", "run", "dev"]