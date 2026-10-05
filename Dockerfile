# Stage 1: Build frontend
FROM node:22.23.1-alpine AS frontend
WORKDIR /app/client/portal

COPY client/portal/package.json client/portal/package-lock.json ./
RUN npm ci

COPY client/portal/ ./

ARG VITE_GOOGLE_AUTH_ENABLED=true
ENV VITE_GOOGLE_AUTH_ENABLED=$VITE_GOOGLE_AUTH_ENABLED

RUN npm run build

# Stage 2: Build backend
FROM golang:1.27.1 AS builder
WORKDIR /app

COPY go.mod go.sum ./

# proxy.golang.org intermittently resets HTTP/2 streams mid-zip from Cloud
# Build's egress, failing the deploy on whichever module was in flight
# ("stream error: stream ID N; INTERNAL_ERROR; received from peer"). The
# trigger builds with --no-cache, so every deploy refetches the whole module
# graph and gets hundreds of chances to hit it. HTTP/1.1 gives each fetch its
# own connection so there are no shared streams to reset, GOMAXPROCS caps how
# many run at once (go mod download sizes its worker pool from it), and the
# retry covers whatever still slips through.
ENV GODEBUG=http2client=0
RUN for i in 1 2 3; do \
      if GOMAXPROCS=4 go mod download; then break; fi; \
      echo "go mod download failed (attempt $i), retrying" >&2; \
      [ "$i" = 3 ] && exit 1; \
      sleep $((i * 5)); \
    done

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.version=$(cat version.txt)" -o /app/api ./cmd/api

# Stage 3: Main container 
FROM scratch
WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/api ./api
COPY --from=frontend /app/client/portal/dist ./static
COPY --from=frontend /app/client/portal/public/pwa-192x192.png ./client/portal/public/pwa-192x192.png

EXPOSE 8080
CMD ["./api"]
