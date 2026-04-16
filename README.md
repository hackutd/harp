# HARP - Hacker Applications & Review Platform

> **Work in Progress** - This project is under active development.

Hackathon management system with Go backend and React frontend.

## Quick Start

### Prerequisites

- <a href="https://docs.docker.com/get-docker/" target="_blank">Docker</a>

### Setup

There are two ways to run the dev environment, depending on how you want to handle SuperTokens auth:

#### Option 1: Cloud SuperTokens (default)

Uses a managed SuperTokens instance. Requires `SUPERTOKENS_CONNECTION_URI` and `SUPERTOKENS_API_KEY` in your `.env` file.

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Service      | URL                                 |
| ------------ | ----------------------------------- |
| Frontend     | `http://localhost:3000`               |
| Backend API  | `http://localhost:8080/v1`            |
| PostgreSQL   | `localhost:5432`                      |
| Swagger Docs | `http://localhost:8080/v1/swagger/`   |
| Debug Vars   | `http://localhost:8080/v1/debug/vars` |

#### Option 2: Local SuperTokens

Runs a self-hosted SuperTokens instance in Docker. No API key needed.

```bash
docker compose -f docker-compose.local-st.yml up --build
```

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
