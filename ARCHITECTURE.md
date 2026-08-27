# AI Task Platform Architecture

## Overview
The platform is composed of a React frontend, an Express backend, a Python worker, MongoDB for durable task storage, and Redis for asynchronous job queuing. Users authenticate with JWT tokens and submit text-processing tasks (uppercase, lowercase, reverse, word count).

### Request & processing flow
1. The frontend calls the backend over relative `/api` paths (nginx/Ingress proxy in prod, Vite proxy in dev).
2. On task creation the backend writes the task to MongoDB with status `pending` and pushes a JSON job onto a Redis list queue (`tasks`).
3. A worker pops the job (`BLPOP`), sets the task to `running`, performs the operation, and writes the result and final status (`success`/`failed`) back to MongoDB.
4. The frontend polls the task endpoint to reflect status transitions in near real time.

Decoupling the API from the worker via Redis keeps request latency low and lets processing scale independently of the API.

## Worker Scaling Strategy
The worker is stateless and competes for jobs on a shared Redis queue, so throughput scales horizontally simply by adding replicas — each job is delivered to exactly one worker via `BLPOP`. In Kubernetes the worker Deployment is fronted by a `HorizontalPodAutoscaler` (`infra/k8s/hpa.yaml`, min 2 / max 6) that scales on CPU utilization. For queue-driven scaling, the HPA can be pointed at a custom/external metric (Redis queue depth via KEDA or a metrics adapter) instead of CPU, which tracks bursty backlogs more directly than CPU does.

## Handling 100k tasks/day
100k tasks/day averages ~1.2 tasks/second, with bursts well above that. The architecture absorbs this because:
- **Redis buffers bursts** — the API enqueues in O(1) and never blocks on processing, so spikes queue up instead of failing requests.
- **Workers scale out** — add replicas (or let the HPA do it) until consumption keeps up with the enqueue rate.
- **MongoDB stays indexed** — see below; per-user reads stay fast as the collection grows.
- **Connection pooling** — Mongoose (backend) and the worker's Mongo client reuse pooled connections rather than reconnecting per job.
- **Idempotent, retry-safe jobs** — failed jobs are marked `failed` and can be requeued without corrupting state.

## Database Indexing Strategy
The Task model indexes `userId` + `createdAt` for efficient retrieval of a user's most recent tasks (the dashboard's primary query). Additional indexes on `status` or `operation` can be added if filtering/analytics become common. Indexing keeps the hot read path from doing collection scans as volume grows toward 100k+ documents/day.

## Redis Failure Handling
If Redis is unavailable when a task is created, the backend still persists the task to MongoDB as `pending` (durability is not lost). Workers use a bounded retry/backoff loop when connecting to Redis and continue once it recovers. A requeue path allows previously `pending` jobs to be pushed back onto the queue once Redis is healthy, so no work is silently dropped.

## Containerization
Each service ships as a **multi-stage, non-root** image:
- **frontend** — Node builder stage produces the static bundle; runtime is `nginx-unprivileged` (uid 101, port 8080) serving the SPA and proxying `/api`. The API base is empty at build time so the image is environment-agnostic.
- **backend** — installs prod dependencies, runs as a non-root user, exposes `/api/health` (liveness) and `/api/ready` (readiness, gated on the Mongo connection).
- **worker** — non-root runtime user; a `healthcheck.py` script backs an exec liveness probe by checking a heartbeat file the main loop touches each iteration.

`.dockerignore` files keep build contexts small and prevent secrets/`node_modules` from leaking into images.

## Kubernetes Topology
Manifests live in `infra/k8s`, composed with Kustomize into the `ai-task-platform` namespace:
- Deployments + Services for **frontend**, **backend**, **worker**, **mongo**, **redis**.
- **ConfigMap** for non-secret config (Mongo/Redis URLs, `NODE_ENV`) and **Secret** for `JWT_SECRET`.
- **Ingress** routing `/` → frontend and `/api` → backend on a single host.
- **PVCs** for MongoDB and Redis durability.
- **Probes** on every app Deployment (readiness gates traffic; liveness restarts wedged pods) and **resource requests/limits** for schedulable, bounded workloads.
- **HPA** autoscaling the worker.

## CI/CD
`.github/workflows/ci.yml` runs: **lint** (ESLint for frontend/backend, ruff for worker) on every push/PR → **build-and-push** images to GHCR tagged with the git SHA (on `main`) → **update-manifests**, which uses `kustomize edit set image` to pin the new tags and commits back to `infra/k8s`. The push trigger ignores `infra/**` so the tag-bump commit doesn't retrigger CI.

## GitOps Delivery (Argo CD)
An Argo CD `Application` (`infra/argocd/application.yaml`) watches `infra/k8s` and continuously syncs it to the cluster with `prune` + `selfHeal`, so the running state always matches git. When CI bumps an image tag, Argo detects the commit and rolls out the new version automatically — no imperative `kubectl apply` in the deploy path. Argo ignores the worker's `spec.replicas` so it doesn't conflict with the HPA.

## Staging and Production Deployment
Staging and production should use separate namespaces with environment-specific ConfigMaps/Secrets and Ingress hosts, expressed as Kustomize overlays over the shared base in `infra/k8s`. Each environment tracks its own git revision (e.g. staging follows `main`, production follows tagged releases) via distinct Argo CD `Application`s, giving a clear promotion path and independent rollback per environment.
