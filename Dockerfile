##############################
# 1. Build Stage
##############################
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the full source code
COPY . .

# Build-time environment variables
# Dokploy will inject these at build time
ARG NEXT_PUBLIC_MEILISEARCH_URL
ARG NEXT_PUBLIC_MEILISEARCH_API_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Export env vars for Next.js build
ENV NEXT_PUBLIC_MEILISEARCH_URL=$NEXT_PUBLIC_MEILISEARCH_URL
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=$NEXT_PUBLIC_MEILISEARCH_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Optional: Debug environment variables (remove in production)
RUN echo "MEILI URL: $NEXT_PUBLIC_MEILISEARCH_URL" && \
    echo "API BASE: $NEXT_PUBLIC_API_BASE_URL" && \
    echo "Google Client ID: $NEXT_PUBLIC_GOOGLE_CLIENT_ID"

# Build Next.js app
RUN pnpm run build


##############################
# 2. Production Stage
##############################
FROM node:20-alpine AS runner

WORKDIR /app

# Enable PNPM
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only necessary build output from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Runtime environment variables
ENV NEXT_PUBLIC_MEILISEARCH_URL=$NEXT_PUBLIC_MEILISEARCH_URL
ENV NEXT_PUBLIC_MEILISEARCH_API_KEY=$NEXT_PUBLIC_MEILISEARCH_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Expose port
EXPOSE 3000

# Start Next.js server
CMD ["pnpm", "start"]
