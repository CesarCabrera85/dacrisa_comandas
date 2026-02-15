FROM node:20-alpine

WORKDIR /app

# Install dependencies for argon2
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
