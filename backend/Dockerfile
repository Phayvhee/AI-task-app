FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN addgroup -S -g 10001 appgroup && adduser -S -u 10001 -G appgroup appuser
USER 10001

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
