# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ---- base: pnpm を有効化した共通ベース ----
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps: 全依存をインストール（lockfile を厳守） ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: TypeScript をビルド ----
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- prod-deps: 本番用依存のみ ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---- runtime: 最終イメージ ----
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# 非 root ユーザーで実行
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
