# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/client/web

COPY client/web/package.json client/web/package-lock.json ./
RUN npm ci

COPY client/web/ ./

ARG VITE_GOOGLE_AUTH_ENABLED=true
ENV VITE_GOOGLE_AUTH_ENABLED=$VITE_GOOGLE_AUTH_ENABLED

RUN npm run build

# Stage 2: Build backend
FROM golang:1.24 AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/api ./cmd/api

# Stage 3: Main container 
FROM scratch
WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/api ./api
COPY --from=frontend /app/client/web/dist ./static

EXPOSE 8080
CMD ["./api"]
