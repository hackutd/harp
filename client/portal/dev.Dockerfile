FROM node:22.23.1-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
