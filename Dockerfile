##############################
# 1. Build Stage
##############################
FROM node:20-alpine AS builder

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy full app
COPY . .

# Build-time env vars from Dokploy
ARG NEXT_PUBLIC_MEILISEARCH_URL
ARG NEXT_PUBLIC_MEILISEARCH_API_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Export env vars so Next.js can access them during build
ENV NEXT_PUBLIC_MEILISEARCH_URL=$NEXT_PUBLIC_MEILISEARCH_URL
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=$NEXT_PUBLIC_MEILISEARCH_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Build Next.js app
RUN pnpm run build


##############################
# 2. Production Stage
##############################
FROM node:20-alpine AS runner

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy necessary output only
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["pnpm", "start"]
