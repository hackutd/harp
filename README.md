# HARP - Hacker Applications & Review Platform

> **Work in Progress** - This project is under active development.

Hackathon management system with Go backend and React frontend.

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker (for PostgreSQL)

### Setup

```bash
# Start database
docker-compose up -d

# Run migrations
task migrate-up

# Start backend (port 8080)
air

# Start frontend (port 3000)
cd client/web && npm install && npm run dev
```

## Tech Stack

**Backend:** Go, Chi, PostgreSQL, SuperTokens, SendGrid

**Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui
