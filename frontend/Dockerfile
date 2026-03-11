FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG FRONTEND_DOMAIN=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG FRONTEND_DOMAIN=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

# 보안: 비루트 사용자
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /app/.next/cache \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
