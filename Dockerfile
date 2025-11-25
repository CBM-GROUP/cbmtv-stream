##############################
# 1. Build Stage
##############################
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# BUILD ARG VARIABLES
ARG NEXT_PUBLIC_MEILISEARCH_URL
ARG NEXT_PUBLIC_MEILISEARCH_API_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# EXPORT THEM FOR NEXT.JS BUILD
ENV NEXT_PUBLIC_MEILISEARCH_URL=$NEXT_PUBLIC_MEILISEARCH_URL
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=$NEXT_PUBLIC_MEILISEARCH_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Debug print (you can remove later)
RUN echo "MEILI URL IS: $NEXT_PUBLIC_MEILISEARCH_URL" && \
    echo "API URL IS: $NEXT_PUBLIC_API_BASE_URL"

# Build Next.js
RUN pnpm run build


##############################
# 2. Runner Stage
##############################
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["pnpm", "start"]
