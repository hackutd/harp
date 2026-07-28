# Stage 1: Build frontend
FROM node:22.23.1-alpine AS frontend
WORKDIR /app/client/web

COPY client/web/package.json client/web/package-lock.json ./
RUN npm ci

COPY client/web/ ./

ARG VITE_GOOGLE_AUTH_ENABLED=true
ENV VITE_GOOGLE_AUTH_ENABLED=$VITE_GOOGLE_AUTH_ENABLED

ARG VITE_CONTACT_EMAIL=hello@hackutd.co
ENV VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL

RUN npm run build

# Stage 2: Build backend
FROM golang:1.24.13 AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.version=$(cat version.txt)" -o /app/api ./cmd/api

# Stage 3: Main container 
FROM scratch
WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/api ./api
COPY --from=frontend /app/client/web/dist ./static
COPY --from=frontend /app/client/web/public/pwa-192x192.png ./client/web/public/pwa-192x192.png

EXPOSE 8080
CMD ["./api"]
