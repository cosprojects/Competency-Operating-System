# AXIONA Beta 1 — production image.
# Публичная сборка: docker build --build-arg RELEASE_BUILD=release:build .
# Черновой preview: по умолчанию release:build:draft.

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run db:generate
ARG RELEASE_BUILD=release:build:draft
RUN npm run ${RELEASE_BUILD}
RUN npm run web:build

FROM node:24-bookworm-slim AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/apps/web/.next ./.next
EXPOSE 3000
CMD ["node", "/app/node_modules/next/dist/bin/next", "start", "-p", "3000"]
