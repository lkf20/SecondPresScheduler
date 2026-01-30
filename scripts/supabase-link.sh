#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-staging}"
FILE=".env.supabase.${ENV}"

if [[ ! -f "$FILE" ]]; then
  echo "Missing $FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$FILE"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF not set in $FILE"
  exit 1
fi

supabase link --project-ref "$SUPABASE_PROJECT_REF"
echo "Linked to $ENV ($SUPABASE_PROJECT_REF)"
