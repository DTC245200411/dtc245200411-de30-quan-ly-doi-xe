#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
export DOCKER_HOST=unix:///var/run/docker.sock
dc() {
  if [ "${BASE_ONLY:-0}" = 1 ]; then docker compose -f compose.yaml "$@"
  elif [ -f compose.logging.yaml ]; then docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml "$@"
  elif [ -f compose.monitoring.yaml ]; then docker compose -f compose.yaml -f compose.monitoring.yaml "$@"
  else docker compose -f compose.yaml "$@"; fi
}
