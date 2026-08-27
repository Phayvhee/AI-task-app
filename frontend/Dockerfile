# syntax=docker/dockerfile:1

# ----- Build stage -----
FROM node:20-alpine AS builder
WORKDIR /app

# API base URL is baked in at build time. Leave empty to use relative
# "/api" paths (served by nginx/ingress on the same origin).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ----- Runtime stage (non-root, unprivileged nginx on port 8080) -----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
