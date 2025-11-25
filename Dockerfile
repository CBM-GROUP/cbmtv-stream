##############################
# 1. Build Stage
##############################
FROM node:20-alpine AS builder

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy project files
COPY . .

# Build-time arguments (from Dokploy build args)
ARG NEXT_PUBLIC_MEILISEARCH_URL
ARG NEXT_PUBLIC_MEILISEARCH_API_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Export environment variables for Next.js build
ENV NEXT_PUBLIC_MEILISEARCH_URL=${NEXT_PUBLIC_MEILISEARCH_URL}
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=${NEXT_PUBLIC_MEILISEARCH_API_KEY}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Optional: verify build-time env variables
RUN echo "MEILI URL: ${NEXT_PUBLIC_MEILISEARCH_URL}" && \
    echo "API BASE: ${NEXT_PUBLIC_API_BASE_URL}" && \
    echo "Google Client ID: ${NEXT_PUBLIC_GOOGLE_CLIENT_ID}"

# Build Next.js application
RUN pnpm run build


##############################
# 2. Production Stage
##############################
FROM node:20-alpine AS runner

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only necessary build outputs
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Runtime environment variables
ENV NEXT_PUBLIC_MEILISEARCH_URL=${NEXT_PUBLIC_MEILISEARCH_URL}
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=${NEXT_PUBLIC_MEILISEARCH_API_KEY}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}

# Expose port for Next.js
EXPOSE 3000

# Start Next.js server
CMD ["pnpm", "start"]
