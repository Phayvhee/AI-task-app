# AI Task Worker

A Python worker that consumes background jobs from a Redis list queue and processes them for the AI Task Platform.

## Overview

The worker processes tasks asynchronously by:
1. Blocking-popping (`BLPOP`) job payloads off the Redis queue (`tasks`)
2. Performing the requested text operation (uppercase, lowercase, reverse, wordcount)
3. Updating task status and results in MongoDB (`running` → `success`/`failed`)

It uses a lightweight custom list-based queue (`redis` + `pymongo`) rather than a job framework, which keeps the dependency surface small and matches how the backend enqueues jobs (`LPUSH` of a JSON payload).

## Setup

### Local Development

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables (or use defaults):
```bash
export REDIS_URL="redis://localhost:6379"
export MONGO_URI="mongodb://localhost:27017/ai-task-platform"
```

3. Run the worker:
```bash
python worker.py
```

### Docker

The worker runs automatically as part of the docker-compose stack:
```bash
docker-compose up -d
```

## Environment Variables

- `REDIS_URL`: Redis connection URL (default: `redis://localhost:6379`)
- `MONGO_URI`: MongoDB connection URI (default: `mongodb://localhost:27017/ai-task-platform`)
- `REDIS_TASK_QUEUE`: Redis list key to consume (default: `tasks`)
- `WORKER_HEARTBEAT_FILE`: Path the main loop touches each iteration (default: `/tmp/worker_heartbeat`)
- `WORKER_HEARTBEAT_MAX_AGE`: Max heartbeat age in seconds before the health check reports unhealthy (default: `60`)

## Task Operations

The worker supports the following operations:
- **uppercase**: Convert text to uppercase
- **lowercase**: Convert text to lowercase  
- **reverse**: Reverse the text
- **wordcount**: Count the number of words

## Task Flow

1. User creates a task via the backend API
2. Task is saved to MongoDB with status "pending"
3. Task is enqueued to Redis queue
4. Worker picks up the task and updates status to "running"
5. Worker processes the task and updates status to "success" or "failed"
6. Frontend polls task endpoint to get updated status and results

## Monitoring

View worker logs with:
```bash
docker-compose logs -f worker
```

## Health Check

The worker has no HTTP port, so liveness is tracked via a heartbeat file. The main loop touches `WORKER_HEARTBEAT_FILE` on every iteration, and `healthcheck.py` exits non-zero if that file is older than `WORKER_HEARTBEAT_MAX_AGE` seconds. In Kubernetes this backs an exec liveness probe:

```bash
python healthcheck.py   # exit 0 = healthy, exit 1 = stale/unhealthy
```

## Dependencies

- `redis` - Redis client (queue consumer)
- `pymongo` - MongoDB client (task state + results)
