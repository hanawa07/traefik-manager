FROM python:3.12-slim

ARG APP_UID=10001
ARG APP_GID=10001
ARG TRAEFIK_MANAGER_VERSION=v1.36.7
ARG TRAEFIK_MANAGER_GIT_SHA=unknown
ARG TRAEFIK_MANAGER_BUILD_DATE=unknown
ARG TRAEFIK_MANAGER_IMAGE_SOURCE=https://github.com/hanawa07/traefik-manager

LABEL org.opencontainers.image.title="Traefik Manager Backend" \
  org.opencontainers.image.description="FastAPI backend for Traefik Manager" \
  org.opencontainers.image.source="${TRAEFIK_MANAGER_IMAGE_SOURCE}" \
  org.opencontainers.image.version="${TRAEFIK_MANAGER_VERSION}" \
  org.opencontainers.image.revision="${TRAEFIK_MANAGER_GIT_SHA}" \
  org.opencontainers.image.created="${TRAEFIK_MANAGER_BUILD_DATE}"

ENV TRAEFIK_MANAGER_COMPONENT=backend
ENV TRAEFIK_MANAGER_VERSION=${TRAEFIK_MANAGER_VERSION}
ENV TRAEFIK_MANAGER_GIT_SHA=${TRAEFIK_MANAGER_GIT_SHA}
ENV TRAEFIK_MANAGER_BUILD_DATE=${TRAEFIK_MANAGER_BUILD_DATE}
ENV TRAEFIK_MANAGER_IMAGE_SOURCE=${TRAEFIK_MANAGER_IMAGE_SOURCE}

WORKDIR /app

# 보안: 비루트 사용자 생성
RUN addgroup --system --gid ${APP_GID} appgroup \
  && adduser --system --uid ${APP_UID} --ingroup appgroup appuser

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# 데이터 디렉토리 권한 설정
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/data /traefik-config/dynamic \
  && chown -R appuser:appgroup /app /traefik-config

USER appuser

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
