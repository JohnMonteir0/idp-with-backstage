# The application repository owns the actual Backstage build and dependencies.
ARG BASE_IMAGE=backstage-app:build
FROM ${BASE_IMAGE}
COPY --chown=1000:1000 global-bundle.pem /app/certs/global-bundle.pem
