FROM oven/bun:1.2.8 AS deps

WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock ./

# Copy package.json files for ALL workspace packages — bun resolves the
# full workspace graph (workspaces: apps/*, packages/*) and fails on any
# package.json that is referenced but absent.
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/
COPY packages/company/package.json ./packages/company/
COPY packages/db/package.json ./packages/db/
COPY packages/device-agent/package.json ./packages/device-agent/
COPY packages/docs/package.json ./packages/docs/
COPY packages/email/package.json ./packages/email/
COPY packages/framework-editor-cli/package.json ./packages/framework-editor-cli/
COPY packages/integration-platform/package.json ./packages/integration-platform/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/kv/package.json ./packages/kv/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

# Copy app package.json files
COPY apps/app/package.json ./apps/app/
COPY apps/portal/package.json ./apps/portal/
COPY apps/api/package.json ./apps/api/
COPY apps/framework-editor/package.json ./apps/framework-editor/
COPY apps/browser-extension/security-questionnaire-ext/package.json ./apps/browser-extension/security-questionnaire-ext/

# Install all dependencies
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true bun install --ignore-scripts

# =============================================================================
# STAGE 2: Ultra-Minimal Migrator - Only Prisma
FROM deps AS app-builder

WORKDIR /app

# Copy all source code needed for build
COPY packages ./packages
COPY apps/app ./apps/app

# Bring in node_modules for build and prisma prebuild
COPY --from=deps /app/node_modules ./node_modules

# Pre-combine schemas and generate the Prisma client into
# node_modules/@prisma/client. The deps stage ran `bun install` with
# `--ignore-scripts` so packages/db's postinstall was skipped; we run
# it explicitly here so `next build` can resolve the generated runtime
# + types when it imports @prisma/client.
RUN cd packages/db && node scripts/combine-schemas.js \
                   && node scripts/generate-prisma-client-js.js

# Build workspace packages consumed from dist/ (same set as the API image)
RUN cd packages/db && bun run build \
  && cd ../auth && bun run build \
  && cd ../integration-platform && bun run build \
  && cd ../email && bun run build \
  && cd ../company && bun run build \
  && cd ../billing && bun run build

# Ensure Next build has required public env at build-time
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_IS_DUB_ENABLED
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_IS_DUB_ENABLED=$NEXT_PUBLIC_IS_DUB_ENABLED \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production \
    NEXT_OUTPUT_STANDALONE=true \
    NODE_OPTIONS=--max_old_space_size=6144

# Build the app
RUN cd apps/app && SKIP_ENV_VALIDATION=true bun run build:docker

# =============================================================================
# STAGE 4: App Production
FROM node:22-alpine AS app

WORKDIR /app

# Copy Next standalone output
COPY --from=app-builder /app/apps/app/.next/standalone ./
COPY --from=app-builder /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=app-builder /app/apps/app/public ./apps/app/public

EXPOSE 3000
CMD ["node", "apps/app/server.js"]
