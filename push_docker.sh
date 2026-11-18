#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARBOR_REGISTRY="${HARBOR_REGISTRY:-192.168.6.120:5000}"
HARBOR_PROJECT="${HARBOR_PROJECT:-new-api}"
HARBOR_USERNAME="${HARBOR_USERNAME:-admin}"
IMAGE_NAME="${IMAGE_NAME:-new-api}"
IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
PLATFORM="${PLATFORM:-linux/amd64}"

HARBOR_REGISTRY="${HARBOR_REGISTRY#http://}"
HARBOR_REGISTRY="${HARBOR_REGISTRY#https://}"
HARBOR_REGISTRY="${HARBOR_REGISTRY%/}"
IMAGE="${HARBOR_REGISTRY}/${HARBOR_PROJECT}/${IMAGE_NAME}:${IMAGE_TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未找到 docker 命令。" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "错误：Docker 未运行或当前用户无权访问。" >&2
  exit 1
fi

if [[ -z "${HARBOR_PASSWORD:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "错误：非交互环境请通过 HARBOR_PASSWORD 提供 Harbor 密码。" >&2
    exit 1
  fi
  read -r -s -p "Harbor 密码: " HARBOR_PASSWORD
  printf '\n'
fi

printf '%s' "$HARBOR_PASSWORD" | docker login "$HARBOR_REGISTRY" \
  --username "$HARBOR_USERNAME" --password-stdin

echo "开始构建前后端镜像：$IMAGE（$PLATFORM）"
docker build --platform "$PLATFORM" --tag "$IMAGE" "$ROOT_DIR"

echo "开始推送镜像：$IMAGE"
docker push "$IMAGE"

echo "发布完成：$IMAGE"
echo "生产服务器执行：docker compose pull new-api && docker compose up -d new-api"
