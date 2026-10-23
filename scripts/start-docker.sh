#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  --down) node scripts/start.mjs stop ;;
  ""|--build) node scripts/start.mjs ;;
  *) echo "Usage: bash scripts/start-docker.sh [--build|--down]" >&2; exit 1 ;;
esac
