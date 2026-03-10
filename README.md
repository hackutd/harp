# HARP - Hacker Applications & Review Platform

> **Work in Progress** - This project is under active development.

Hackathon management system with Go backend and React frontend.

## Quick Start

### Prerequisites

- <a href="https://docs.docker.com/get-docker/" target="_blank">Docker</a>

### Setup

```bash
# Start all services (database, auth, backend, frontend)
docker compose -f docker-compose.dev.yml up --build
```

This starts:

| Service      | URL                                 |
| ------------ | ----------------------------------- |
| Frontend     | `http://localhost:3000`               |
| Backend API  | `http://localhost:8080/v1`            |
| SuperTokens  | `localhost:3567`                      |
| PostgreSQL   | `localhost:5432`                      |
| Swagger Docs | `http://localhost:8080/v1/swagger/`   |
| Debug Vars   | `http://localhost:8080/v1/debug/vars` |

The backend runs database migrations automatically on startup. Both the frontend and backend support hot reload via mounted volumes.

## Tech Stack

**Backend:** Go, Chi, PostgreSQL, SuperTokens, SendGrid

**Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui

**Deployment:** GCP (GCR, GCS), multi-stage Docker (scratch), Neon DB
