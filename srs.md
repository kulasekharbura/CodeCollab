# Software Requirements Specification (SRS)

## Real-Time Collaborative Code Editor

**Document Version:** 1.0  
**Date:** May 2026  
**Status:** Draft  
**Prepared by:** Bura Kulasekhar  
**Institution / Organization:** IIEST shibpur

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) describes the functional and non-functional requirements for the Real-Time Collaborative Code Editor a web-based application that allows multiple users to write, edit, and review code simultaneously in shared sessions. This document is intended for developers, system architects, testers, and academic evaluators.

### 1.2 Scope

The system, referred to as CodeCollab, is a full-stack MERN application featuring:

- A browser-based code editor powered by the Monaco Editor engine
- Real-time multi-user collaboration using WebSocket communication
- Conflict resolution via Operational Transformation (OT)
- User authentication with JWT and Google OAuth 2.0
- Containerized deployment using Docker, orchestrated via Docker Compose
- A CI/CD pipeline using GitHub Actions with deployment to AWS EC2

The system is NOT intended to be a full IDE, cloud execution environment, or version control system.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term      | Definition                                                            |
| :-------- | :-------------------------------------------------------------------- |
| MERN      | MongoDB, Express.js, React, Node.js - the technology stack used       |
| OT        | Operational Transformation - algorithm for resolving concurrent edits |
| JWT       | JSON Web Token - stateless authentication token                       |
| OAuth     | Open Authorization - protocol for third-party login                   |
| WebSocket | Full-duplex communication protocol over a single TCP connection       |
| CI/CD     | Continuous Integration/ Continuous Deployment                         |
| Room      | A shared code session identified by a unique session ID               |
| Session   | A single user's authenticated browser interaction                     |

### 1.4 References

- IEEE Std 830-1998: Recommended Practice for SRS
- Socket.io Documentation: https://socket.io/docs
- Monaco Editor API: https://microsoft.github.io/monaco-editor/
- Operational Transformation (Jupiter Algorithm): Ellis & Gibbs, 1989

### 1.5 Overview

Section 2 provides the overall system description. Section 3 covers architecture. Sections 4 and 5 detail functional and non-functional requirements. Sections 6-12 cover interfaces, constraints, use cases, data, security, and deployment.

---

## 2. Overall Description

### 2.1 Product Perspective

CodeCollab is a standalone web application. It runs as a set of microservices inside Docker containers and is deployed on a cloud server. It is accessed through any modern web browser without requiring installation.

### 2.2 Product Functions

The core functions of CodeCollab are:

- User registration, login, and authentication
- Creating, saving, and loading code files
- Opening a shared room and inviting collaborators
- Real-time collaborative editing with conflict resolution
- Viewing live cursors of other users in the same room
- Syntax highlighting for multiple programming languages
- Basic code execution result display (future scope)
- CI/CD pipeline automation and containerized deployment

### 2.3 User Classes and Characteristics

| User Class      | Description                                                         |
| :-------------- | :------------------------------------------------------------------ |
| Guest           | Can view shared sessions (read-only). No login required.            |
| Registered User | Can create rooms, save files, invite collaborators. Requires login. |
| Room Owner      | Creates a room, controls access, can force-disconnect participants. |
| Collaborator    | Joins an existing room. Has edit access unless set to read-only.    |
| Admin (future)  | Manages users and monitors system health.                           |

### 2.4 Operating Environment

- **Frontend:** Any modern web browser (Chrome 90+, Firefox 85+, Edge 90+, Safari 14+)
- **Backend:** Node.js 18+ on Ubuntu 24.04 LTS (AWS EC2 t3.medium recommended)
- **Database:** MongoDB 6.0+, Redis 7.0+
- **Container:** Docker 24+, Docker Compose v2
- **CI/CD:** GitHub Actions (cloud-hosted runners)

### 2.5 Design and Implementation Constraints

- All communication between client and server must use HTTPS/WSS in production.
- The system must support a minimum of 50 concurrent users across all rooms during Phase 1.
- The Monaco Editor library is used as-is; custom IDE features are out of scope.
- All data at rest must be stored in MongoDB; no SQL databases will be used.

### 2.6 Assumptions and Dependencies

- Users have access to a stable internet connection.
- Google OAuth credentials are provisioned via the Google Developer Console.
- AWS EC2 instance and S3 bucket are provisioned before deployment.
- DNS and SSL certificates are managed externally (e.g., Certbot / Let's Encrypt).

---

## 3. System Architecture Overview

### 3.1 High-Level Architecture

The system is composed of four layers:

**Client Layer**
React single-page application. Hosts Monaco Editor, handles Socket.io events, renders live cursors, and communicates with the backend over REST and WebSocket.

**Gateway Layer**
Nginx reverse proxy handles SSL termination, rate limiting, and routes HTTP traffic to Express and WebSocket traffic to Socket.io.

**Service Layer**
Three Node.js services:

- Auth Service - handles login, registration, JWT issuance, and Google OAuth
- Code Service - manages CRUD operations for code files via REST
- Socket Service - manages rooms, broadcasts edits, applies OT, tracks cursor positions

**Data Layer**

- MongoDB stores users, code files, and room metadata
- Redis stores active room state, socket session maps, and rate limit counters

### 3.2 Technology Stack

| Layer            | Technology                                     | Purpose                          |
| :--------------- | :--------------------------------------------- | :------------------------------- |
| Frontend         | React 18, Monaco Editor, Socket.io-client      | UI and real-time editing         |
| Backend          | Node.js 18, Express 4, Socket.io 4             | API and WebSocket server         |
| Database         | MongoDB 6, Redis 7                             | Persistence and session cache    |
| Auth             | JWT (jsonwebtoken), Passport.js (Google OAuth) | Authentication                   |
| Containerization | Docker, Docker Compose                         | Local and production packaging   |
| CI/CD            | GitHub Actions                                 | Automated testing and deployment |
| Deployment       | AWS EC2, Nginx                                 | Production hosting               |
| Monitoring       | Winston (logging), /health endpoint            | Observability                    |

---

## 4. Functional Requirements

Requirements are labeled FR-XXX. Priority: H = High (must have), M = Medium (should have), L = Low (nice to have).

### 4.1 User Authentication

- **FR-001-User Registration (Priority: H):** The system shall allow new users to register using a unique email address and password. Passwords must be hashed using bcrypt before storage.
- **FR-002-User Login (Priority: H):** The system shall authenticate users via email and password, issuing a signed JWT upon success. Tokens shall expire after 24 hours.
- **FR-003-Google OAuth Login (Priority: H):** The system shall allow users to authenticate using their Google account via OAuth 2.0. On first login, a new user record shall be created automatically.
- **FR-004-Token Refresh (Priority: M):** The system shall support silent token refresh so users are not logged out mid-session.
- **FR-005-Logout (Priority: H):** The system shall provide a logout mechanism that invalidates the current session token on the client and clears the Redis session entry.

### 4.2 Code File Management

- **FR-010-Create File (Priority: H):** An authenticated user shall be able to create a new code file by specifying a filename and programming language. The file is persisted in MongoDB.
- **FR-011-Read File (Priority: H):** An authenticated user shall be able to retrieve their saved code files. The list view shall display filename, language, and last modified date.
- **FR-012-Update File (Priority: H):** The system shall auto-save the current file content to MongoDB at regular intervals (every 30 seconds) while a room session is active.
- **FR-013-Delete File (Priority: M):** An authenticated user shall be able to delete a file they own. Deletion is permanent and not recoverable in Phase 1.
- **FR-014-Fork File (Priority: L):** Any authenticated user viewing a shared file shall be able to fork it to create their own copy.

### 4.3 Room and Session Management

- **FR-020-Create Room (Priority: H):** An authenticated user shall be able to create a new collaborative room linked to one of their code files. The system shall generate a unique room ID (UUID).
- **FR-021-Join Room via Link (Priority: H):** Any user (including guests with read-only access) shall be able to join a room by visiting its unique URL. Authenticated users receive edit access; guests receive read-only access.
- **FR-022-Room Participant List (Priority: H):** The system shall display a live list of all users currently in the room, including their name and cursor color.
- **FR-023-Close Room (Priority: M):** The room owner shall be able to close the room. All connected participants are disconnected and notified.
- **FR-024-Reconnection (Priority: M):** If a user loses connection, the system shall attempt automatic reconnection for up to 30 seconds before showing a disconnection notice.

### 4.4 Real-Time Collaborative Editing

- **FR-030-Broadcast Edits (Priority: H):** When a user types in the editor, the edit operation (insert or delete with position and content) shall be broadcast to all other participants in the room within 100ms under normal network conditions.
- **FR-031-Operational Transformation (Priority: H):** The system shall apply Operational Transformation (OT) to all incoming operations to resolve conflicts that arise when two users edit the same position simultaneously. The editor state must converge to the same value for all participants.
- **FR-032-Live Cursor Tracking (Priority: H):** The cursor position of each participant shall be broadcast to all others in real time. Each participant's cursor shall be displayed with a distinct color and their username label.
- **FR-033-Syntax Highlighting (Priority: H):** The editor shall support syntax highlighting for at least the following languages: JavaScript, TypeScript, Python, Java, C++, HTML, CSS, and JSON.
- **FR-034-Language Switch (Priority: M):** The room owner shall be able to change the active language of a room. All participants' editors shall update to the new language mode.
- **FR-035-Read-Only Mode (Priority: M):** The room owner shall be able to set individual participants to read-only mode, preventing them from making edits.

### 4.5 Health and Monitoring

- **FR-040-Health Endpoint (Priority: H):** The server shall expose a (GET /health) endpoint that returns HTTP 200 with a JSON object containing service name, uptime, MongoDB connection status, and Redis connection status.
- **FR-041-Request Logging (Priority: M):** All HTTP requests shall be logged using Winston, including method, path, status code, and response time.

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **NFR-001-Edit Latency:** Edit operations from one user must be reflected on other users' screens within 100ms under normal conditions (< 100ms ping, no packet loss).
- **NFR-002-Concurrent Users:** The system must support at least 50 concurrent users across all rooms without degraded performance in Phase 1. The architecture must be horizontally scalable to 500+ users in Phase 2 (using Redis pub/sub for multi-node Socket.io).
- **NFR-003-API Response Time:** REST API endpoints must respond within 200ms for 95% of requests under normal load.
- **NFR-004-Auto-save Performance:** Auto-save must complete in the background without blocking the editor UI.

### 5.2 Reliability

- **NFR-010-Uptime:** The production system must target 99.5% monthly uptime.
- **NFR-011-Data Durability:** No code file data shall be lost if the server restarts. MongoDB must be configured with journaling enabled.
- **NFR-012-Graceful Degradation:** If Redis becomes unavailable, the system must fall back to in-memory session management and display a warning, rather than crashing.

### 5.3 Scalability

- **NFR-020-Horizontal Scaling:** The backend must be stateless (except for Redis-backed sessions) to allow horizontal scaling behind a load balancer.
- **NFR-021-Room Isolation:** Each room must be isolated so that heavy activity in one room does not affect latency or correctness in other rooms.

### 5.4 Security

- **NFR-030-Authentication on all protected routes:** All REST API routes except (/auth/register, /auth/login, and /health) must require a valid JWT.
- **NFR-031-Rate Limiting:** The API must enforce rate limiting: 100 requests per minute per IP using Redis-backed counters. Socket connections are limited to 5 concurrent connections per authenticated user.
- **NFR-032-Secure Communication:** All client-server communication in production must use HTTPS (TLS 1.2+) and WSS.
- **NFR-033-Input Validation:** All user-supplied inputs must be validated and sanitized server-side to prevent injection attacks.

### 5.5 Maintainability

- **NFR-040-Code Quality:** All JavaScript code must pass ESLint rules. Test coverage must be at least 60% for all backend services.
- **NFR-041-Documentation:** The project README must include a system architecture diagram, setup instructions, environment variable reference, and a section on trade-off decisions.
- **NFR-042-Containerization:** Every service must run in a Docker container. A single docker-compose up command must start the entire application locally.

### 5.6 Usability

- **NFR-050-Onboarding:** A new user must be able to register, create a room, and start editing within 2 minutes without reading documentation.
- **NFR-051-Browser Compatibility:** The frontend must function correctly on the latest stable versions of Chrome, Firefox, Edge, and Safari.

---

## 6. External Interface Requirements

### 6.1 User Interface

- The main editor page consists of: a file name bar, a language selector, a participants panel, and the Monaco Editor component occupying the central area.
- Cursor overlays from other users are rendered as colored carets with username badges.
- A top navigation bar provides access to the file list, room link sharing, and user settings.
- All UI interactions must provide visual feedback within 200ms (loading states, success/error toasts).

### 6.2 Hardware Interfaces

No direct hardware interface. The system is entirely software-based and cloud-hosted.

### 6.3 Software Interfaces

| Interface        | Protocol           | Description                     |
| :--------------- | :----------------- | :------------------------------ |
| MongoDB          | Mongoose ODM (TCP) | Persistent data storage         |
| Redis            | ioredis (TCP)      | Session state and rate limiting |
| Google OAuth 2.0 | HTTPS              | Third-party authentication      |
| AWS EC2          | SSH/Docker         | Deployment target               |
| GitHub Actions   | YAML/REST          | CI/CD automation                |

### 6.4 Communication Interfaces

| Channel      | Protocol           | Usage                            |
| :----------- | :----------------- | :------------------------------- |
| REST API     | HTTP/HTTPS (JSON)  | Auth, file CRUD, room management |
| WebSocket    | WS/WSS (Socket.io) | Real-time edit and cursor events |
| Health Check | HTTP GET           | Uptime monitoring                |

---

## 7. System Constraints

- The application must run without paid third-party services beyond AWS free tier and Google Cloud (OAuth only) in Phase 1.
- The codebase must use only open-source packages with MIT, Apache 2.0, or BSD licenses.
- The system must be deployable from a single (docker-compose.prod.yml) on a fresh Ubuntu 24.04 instance.
- No code execution engine (like a sandboxed compiler) is included in Phase 1 this is explicitly out of scope.

---

## 8. Use Cases

### UC-01: User Registers and Creates First Room

- **Actor:** New User
- **Precondition:** User has no existing account
- **Main Flow:**
  1. User navigates to the application URL
  2. User clicks "Sign Up" and enters email, password, and display name
  3. System validates input, creates user record, and issues a JWT
  4. User is redirected to the dashboard
  5. User clicks "New Room", enters a filename and selects a language
  6. System creates a MongoDB document and generates a room ID
  7. User is redirected to the editor with the room link displayed
- **Post-condition:** A room is active and shareable

### UC-02: Collaborator Joins a Room and Edits Code

- **Actor:** Collaborator (existing user)
- **Precondition:** A room link has been shared with the collaborator
- **Main Flow:**
  1. Collaborator opens the room URL
  2. System validates their JWT and connects them to the Socket.io room
  3. System sends the current document state to the new participant
  4. Collaborator's cursor appears in the owner's editor
  5. Collaborator types; the operation is sent to the server
  6. Server applies OT and broadcasts the transformed operation to all participants
  7. All editors reflect the same content
- **Alternative Flow (conflict):**
  - 5a. Owner and collaborator type at the same position simultaneously
  - 5b. Server receives both operations, applies OT to transform one against the other
  - 5c. Both operations are broadcast in transformed form
  - 5d. Both editors converge to the same final state

### UC-03: CI/CD Pipeline Deploys to Production

- **Actor:** Developer (automated)
- **Precondition:** Developer pushes code to the (main) branch on GitHub
- **Main Flow:**
  1. GitHub Actions workflow is triggered on push to (main)
  2. Workflow runs ESLint and Jest test suite
  3. If tests pass, Docker images are built and pushed to Docker Hub
  4. Workflow SSHes into AWS EC2 and runs (docker-compose pull && docker-compose up -d)
  5. Health check endpoint is polled; workflow fails if it does not return 200 within 60 seconds
  6. Deployment is marked as successful
- **Failure Flow:**
  - 2a. Tests fail → workflow stops; deployment does not proceed; developer is notified via GitHub notification

---

## 9. Data Requirements

### 9.1 Data Models

**User**

| Field        | Type            | Description                        |
| :----------- | :-------------- | :--------------------------------- |
| \_id         | ObjectId        | Primary key (auto-generated)       |
| email        | String (unique) | User email address                 |
| passwordHash | String          | bcrypt hash (null for OAuth users) |
| displayName  | String          | Name shown in editor               |
| provider     | String          | "local" or "google"                |
| createdAt    | Date            | Registration timestamp             |

**CodeFile**

| Field     | Type                 | Description                |
| :-------- | :------------------- | :------------------------- |
| \_id      | ObjectId             | Primary key                |
| ownerId   | ObjectId (ref: User) | Creator of the file        |
| filename  | String               | Display name               |
| language  | String               | Monaco language identifier |
| content   | String               | Full code content          |
| updatedAt | Date                 | Last save timestamp        |

**Room**

| Field        | Type                     | Description               |
| :----------- | :----------------------- | :------------------------ |
| roomId       | String (UUID)            | Unique share key          |
| fileId       | ObjectId (ref: CodeFile) | Associated code file      |
| ownerId      | ObjectId (ref: User)     | Room creator              |
| participants | Array                    | List of active socket IDs |
| isActive     | Boolean                  | Whether room is open      |
| createdAt    | Date                     | Room creation time        |

### 9.2 Redis Data Schema

| Key Pattern         | Type             | TTL  | Description              |
| :------------------ | :--------------- | :--- | :----------------------- |
| room:{roomId}:state | String (JSON)    | None | Current document state   |
| room:{roomId}:users | Hash             | None | socket_id → user info    |
| ratelimit:{ip}      | String (counter) | 60s  | Request count per IP     |
| session:{userId}    | String           | 24h  | JWT invalidation support |

---

## 10. Security Requirements

- **SR-001-Password Hashing:** All passwords must be hashed using bcrypt with a minimum cost factor of 12 before storage.
- **SR-002-JWT Security:** JWT tokens must be signed with HS256 using a secret of at least 32 random bytes, stored in environment variables only.
- **SR-003-HTTPS Enforcement:** In production, Nginx must redirect all HTTP (port 80) requests to HTTPS (port 443). WSS must be used for all WebSocket connections.
- **SR-004-CORS Policy:** The Express server must restrict CORS to the production frontend domain. Wildcard origins are not permitted in production.
- **SR-005-XSS Prevention:** User-supplied content rendered in the editor is handled by Monaco Editor (sandboxed). User-supplied content in any other UI context must be escaped.
- **SR-006-Secrets Management:** No secrets (API keys, DB passwords, JWT secrets) may be committed to the repository. All secrets are injected via .env files excluded by .gitignore, and via GitHub Actions Secrets for CI/CD.

---

## 11. DevOps & Deployment Requirements

### 11.1 Containerization

- Every service (frontend, backend, MongoDB, Redis) must have its own Dockerfile.
- Images must use official base images pinned to specific versions (e.g., node:18-alpine).
- Multi-stage builds must be used for the React frontend to minimize final image size.
- docker-compose.yml must start the full stack locally with one command: docker-compose up --build

### 11.2 CI/CD Pipeline (GitHub Actions)

The pipeline must consist of the following stages in order:

1. **Lint** - Run ESLint on all JS files. Fail fast if any errors are found.
2. **Test** - Run Jest unit and integration tests. Fail fast if coverage drops below 60%.
3. **Build** - Build Docker images for frontend and backend.
4. **Push** - Push tagged images to Docker Hub (latest) and (git-sha tags).
5. **Deploy** - SSH into EC2, pull new images, restart services with Docker Compose.
6. **Health Check** - Poll GET /health on the production server; fail pipeline if non-200.

### 11.3 Environment Configuration

| Variable             | Service  | Description                |
| :------------------- | :------- | :------------------------- |
| MONGO_URI            | Backend  | MongoDB connection string  |
| REDIS_URL            | Backend  | Redis connection string    |
| JWT_SECRET           | Backend  | JWT signing secret         |
| GOOGLE_CLIENT_ID     | Backend  | Google OAuth client ID     |
| GOOGLE_CLIENT_SECRET | Backend  | Google OAuth client secret |
| VITE_API_URL         | Frontend | Backend API base URL       |
| VITE_SOCKET_URL      | Frontend | Socket.io server URL       |

### 11.4 Monitoring

- The (GET/health) endpoint must return within 200ms and reflect live DB connection status.
- Winston must log all errors to a rotating file log at /var/log/codecollab/error.log.
- CPU and memory utilization of the EC2 instance must be monitored via AWS CloudWatch basic metrics.

---

## 12. Assumptions and Dependencies

| Assumption / Dependency                                      | Impact if Violated                                |
| :----------------------------------------------------------- | :------------------------------------------------ |
| MongoDB Atlas or self-hosted MongoDB is available            | Core data persistence fails                       |
| Redis instance is accessible                                 | Real-time sessions and rate limiting fall back    |
| Google OAuth credentials are valid and not rate-limited      | Google login unavailable; local login still works |
| AWS EC2 instance has ports 80 and 443 open in security group | Production inaccessible                           |
| GitHub Actions runners have Docker and SSH access            | CI/CD pipeline cannot deploy                      |
| Client browsers support WebSocket (all modern browsers do)   | Real-time collaboration unavailable               |

---

## 13. Glossary

| Term                            | Definition                                                                                                                             |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| Operational Transformation (OT) | A concurrency control algorithm that transforms simultaneous edit operations to ensure all clients converge to the same document state |
| Room                            | A collaborative session tied to one code file, identified by a UUID                                                                    |
| Socket.io Room                  | A server-side channel that groups WebSocket connections so messages can be broadcast to all members efficiently                        |
| JWT                             | A signed, base64-encoded token used for stateless user authentication                                                                  |
| Reverse Proxy                   | A server (Nginx) that sits in front of application servers, routing traffic, handling SSL, and providing rate limiting                 |
| Docker Compose                  | A tool for defining and running multi-container Docker applications via a YAML configuration file                                      |
| CI/CD                           | Automated workflow that runs tests, builds Docker images, and deploys to production on every code push                                 |
| Monaco Editor                   | The open-source code editor engine that powers Visual Studio Code, used as the editing component in this project                       |

---

_End of Document - SRS v1.0 - Real-Time Collaborative Code Editor_
