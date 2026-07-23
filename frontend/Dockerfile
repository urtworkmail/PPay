# ---- build the static React app ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Playwright is a devDependency used only by our manual verification scripts —
# skip its browser download during image build (not needed, and it's a slow
# fetch from an external CDN that has no business holding up a deploy).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- serve it + reverse-proxy the API, with automatic HTTPS ----
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
