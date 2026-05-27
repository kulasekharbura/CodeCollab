# CodeCollab

CodeCollab is a real-time collaborative code editor built with React, Monaco, Node.js, Socket.io, MongoDB, and Redis.

## What is complete

- JWT auth with access + refresh token flow
- Session invalidation/logout backed by Redis with in-memory fallback
- Google OAuth authorization code flow (`/auth/google`, `/auth/google/callback`)
- Code file CRUD with protected routes
- Room creation and join-by-link
- Real-time collaborative editing and participant list
- Version-aware operation handling with resync path
- Live language switching and cursor events
- 30s autosave and health endpoint
- Docker Compose stack and CI/CD pipeline scaffold (lint, test, build, image push, deploy, health check)

## Environment variables

Backend (`backend/.env`):

- `PORT`
- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NODE_ENV`

Frontend (`frontend/.env`):

- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Local setup

1. Copy env templates:
   - `backend/.env.example` -> `backend/.env`
   - `frontend/.env.example` -> `frontend/.env`
2. Run full stack:
   - `docker compose up --build`
3. Open:
   - Frontend: `http://localhost:5173`
   - API health: `http://localhost:5000/health`

## Google OAuth setup

1. In Google Cloud Console create OAuth 2.0 Web Application credentials.
2. Add authorized redirect URI:
   - `http://localhost:5000/auth/google/callback`
3. Put credentials in backend env:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## API summary

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET|POST /files`
- `GET|PUT|DELETE /files/:id`
- `POST /rooms`
- `GET /rooms/:roomId`
- `POST /rooms/:roomId/close`
- `GET /health`

## Required GitHub secrets for deploy

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`
- `HEALTHCHECK_URL`
