FROM node:10.10.0-jessie

# Create app directory
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python-pip libpython-dev

# RUN apk update && apk add python g++ make && rm -rf /var/cache/apk/*

COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 8080
CMD [ "npm", "start" ]
