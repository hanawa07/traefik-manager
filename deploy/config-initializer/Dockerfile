FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b

ARG TRAEFIK_MANAGER_BUILD_DATE=unknown

# The release build date invalidates this layer so fixed Alpine packages are
# applied even when the pinned base digest has not moved yet.
RUN : "${TRAEFIK_MANAGER_BUILD_DATE}" && apk upgrade --no-cache
