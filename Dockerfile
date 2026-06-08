# Single image for both the web app and the worker. Railway runs two services
# from this image, differing only by start command (see railway.*.json).
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# System libraries @napi-rs/canvas needs to render PDF text to PNG.
RUN apt-get update && apt-get install -y --no-install-recommends \
      fontconfig fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install all workspace deps (in-container, so @napi-rs/canvas resolves its
# linux-gnu prebuilt and tsx is available for the worker).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --prod=false

# Bring in the rest (docs/API.md, scripts, etc.).
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present during `next build`. Railway passes service variables as
# build args of the same name.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID
ARG NEXT_PUBLIC_AGNIC_AUTH_URL
ARG NEXT_PUBLIC_AGNIC_TOPUP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID=$NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID \
    NEXT_PUBLIC_AGNIC_AUTH_URL=$NEXT_PUBLIC_AGNIC_AUTH_URL \
    NEXT_PUBLIC_AGNIC_TOPUP_URL=$NEXT_PUBLIC_AGNIC_TOPUP_URL

RUN pnpm -F @unisi/web build

EXPOSE 3000
# Default = web; the worker service overrides this with `pnpm -F @unisi/worker start`.
CMD ["pnpm", "-F", "@unisi/web", "start"]
