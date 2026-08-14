# Static SPA image: builds the Vite bundle and serves it through nginx, which also reverse-proxies
# /api to the backend service (frontend/src/api/client.ts always calls a same-origin relative
# /api path, so something in front of both has to route it, see DEPLOYMENT.md). Audit finding
# P1-10: the frontend previously had no containerization story at all.
#
# VITE_KEYCLOAK_URL is a build-time value (Vite bakes VITE_* vars into the bundle), pass it with
# --build-arg; everything else the app needs is resolved at request time through the reverse
# proxy, not baked in.

FROM node:26-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/dist /usr/share/nginx/html

# BACKEND_URL is substituted into nginx.conf.template at container start by nginx's own
# docker-entrypoint.d/20-envsubst-on-templates.sh (built into the base image), no custom
# entrypoint needed.
ENV BACKEND_URL=http://backend:8080

EXPOSE 80
