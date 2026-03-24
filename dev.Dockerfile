FROM golang:1.24.11
WORKDIR /app

# Install dev tools: air (hot reload), swag (swagger), task (taskfile runner)
RUN go install github.com/air-verse/air@v1.61.5 && \
    go install github.com/swaggo/swag/cmd/swag@latest && \
    go install github.com/go-task/task/v3/cmd/task@latest

# Install golang-migrate
RUN curl -L https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz | tar xvz && \
    mv migrate /usr/local/bin/migrate

COPY go.mod go.sum ./
RUN go mod download

COPY scripts/dev.entrypoint.sh /dev.entrypoint.sh
RUN chmod +x /dev.entrypoint.sh

CMD ["/dev.entrypoint.sh"]
