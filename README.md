# AI Task Platform

A full-stack AI task processing platform built with React, Node.js/Express, Python workers, MongoDB, and Redis. Users can register/login, create text-processing tasks, and watch them run asynchronously with live status tracking and result/log viewing.

## Features
- JWT-based authentication with bcrypt password hashing
- Create tasks for **uppercase**, **lowercase**, **reverse**, and **word count** operations
- Asynchronous task processing via a Redis-backed queue and Python worker(s)
- Task lifecycle tracking: `pending → running → success | failed`
- Security hardening: Helmet, CORS allow-list, rate limiting, startup secret validation
- Containerized with multi-stage, non-root Docker images
- Kubernetes manifests (Kustomize) with probes, resource limits, and worker autoscaling (HPA)
- GitOps delivery with Argo CD and a GitHub Actions CI/CD pipeline

## Architecture at a glance

```
                 ┌────────────┐      ┌────────────┐
   Browser ────▶ │  frontend  │ ───▶ │  backend   │ ──▶ MongoDB (task state)
                 │ (nginx SPA)│      │ (Express)  │ ──▶ Redis (job queue)
                 └────────────┘      └────────────┘          │
                                                             ▼
                                                     ┌────────────┐
                                                     │  worker(s) │ ──▶ MongoDB
                                                     │  (Python)  │
                                                     └────────────┘
```

The frontend talks to the backend over **relative `/api` paths**. In production nginx (and the Ingress) proxy `/api` to the backend; in local dev Vite proxies it. This means the frontend image is environment-agnostic — no API URL is baked in.

## Project Structure
- `frontend/` — React + Vite + Tailwind SPA, served by nginx in production
- `backend/` — Express REST API, MongoDB (Mongoose), enqueues jobs to Redis
- `worker/` — Python consumer that pops jobs off the Redis list queue and writes results back to MongoDB
- `infra/k8s/` — Kubernetes manifests managed with Kustomize
- `infra/argocd/` — Argo CD `Application` for GitOps sync
- `.github/workflows/ci.yml` — lint → build/push images → bump image tags

## Quick Start (Docker Compose)
```bash
docker compose up --build
```

Then open:
- Frontend: http://localhost:5173
- Backend health: http://localhost:5000/api/health

## Local Development (without Docker)
See [SETUP.md](SETUP.md) for running each service directly with a local MongoDB and Redis.

## Deployment (Kubernetes + Argo CD + CI/CD)
See [infra/README.md](infra/README.md) for deploying to Kubernetes with Kustomize, wiring up Argo CD for GitOps, and how the CI/CD pipeline builds images and updates manifests.

## Free Render Deployment
The Render blueprint deploys the Node.js API and its inline queue worker as one free web service. Set `MONGO_URI` to a MongoDB Atlas M0 connection string; Render provides the free Redis instance and generates `JWT_SECRET`.

The inline worker is enabled by `RUN_INLINE_WORKER=true` in [render.yaml](render.yaml). The separate Python worker remains available for Docker Compose and Kubernetes deployments, where it can scale independently.

## Architecture Notes
See [ARCHITECTURE.md](ARCHITECTURE.md) for worker scaling, high-volume (100k tasks/day) handling, database indexing, Redis failure handling, and staging/production strategy.
