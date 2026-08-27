# AI Task Platform - Setup Guide

## Prerequisites
- Node.js v18+
- Python 3.9+
- MongoDB running on localhost:27017
- Redis running on localhost:6379

## Local Development Setup

### 1. Backend Setup
```bash
cd backend
npm install
# Ensure .env file exists with JWT_SECRET
cat .env
# If .env is missing, create it with required variables
npm run dev  # or `npm start` for production
```

**Required .env variables:**
- `JWT_SECRET` - Secret key for signing JWTs. **Required in production** — the server refuses to start without it when `NODE_ENV=production`; in dev it falls back to an insecure default with a warning.
- `MONGO_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `FRONTEND_URL` - Frontend URL for CORS
- `PORT` - Server port (default: 5000)

### 2. Frontend Setup
```bash
cd frontend
npm install
# Ensure .env file exists with VITE_API_URL
cat .env
npm run dev  # or `npm run build` for production
```

**Optional .env variable:**
- `VITE_API_URL` - Backend API base URL. Leave it empty to use relative `/api` paths (recommended). In dev, Vite proxies `/api` to the backend (see `vite.config.js`, override with `VITE_API_PROXY`); in production nginx/Ingress proxy it.

### 3. Worker Setup
```bash
cd worker
pip3 install -r requirements.txt
# Ensure MongoDB and Redis are running
python3 worker.py
```

**Required environment variables:**
- `REDIS_URL` - Redis connection string (default: redis://localhost:6379)
- `MONGO_URI` - MongoDB connection string

### 4. MongoDB Setup
MongoDB should be running on localhost:27017 without authentication for local development:
```bash
mongod --dbpath=/path/to/data
```

### 5. Redis Setup
Redis should be running on localhost:6379:
```bash
redis-server
```

## Docker Deployment

To run the entire stack in Docker:
```bash
docker compose up --build -d
```

This starts all five services on the `ai-task-network`:
- **mongodb** (`mongo:7.0`, root creds `admin`/`password` for local only) — port 27017
- **redis** (`redis:7.2-alpine`) — port 6379
- **backend** (Express API) — http://localhost:5000
- **frontend** (nginx-served SPA, proxies `/api` to backend) — http://localhost:5173
- **worker** (Python queue consumer)

Verify it's up:
```bash
curl http://localhost:5000/api/health   # {"status":"ok"}
open http://localhost:5173
```

> These credentials and the `JWT_SECRET` in `docker-compose.yml` are for local development only. For real deployments, supply secrets via the Kubernetes `Secret` (see `infra/`), not committed files.

## Troubleshooting

### "Invalid Token" Error
1. Make sure backend is running and has loaded .env variables
2. Verify JWT_SECRET in backend/.env is set
3. Clear browser localStorage and login again
4. Restart backend: `npm run dev`

### MongoDB Connection Failed
1. Ensure MongoDB is running: `mongod --version` to check if installed
2. For local development, use `mongodb://127.0.0.1:27017/ai-task-platform` (no auth)
3. Check MONGO_URI in backend/.env

### Redis Connection Failed
1. Ensure Redis is running: `redis-cli ping` should return `PONG`
2. Check REDIS_URL in .env files

### Worker Not Processing Tasks
1. Ensure Redis is running
2. Ensure MongoDB is accessible
3. Run worker with: `python3 worker.py`
4. Check logs for connection errors
