#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  prod)
    cp .env.local.prod .env.local
    echo "Switched to PROD env"
    ;;
  staging)
    cp .env.local.staging .env.local
    echo "Switched to STAGING env"
    ;;
  *)
    echo "Usage: $0 {prod|staging}"
    exit 1
    ;;
esac
