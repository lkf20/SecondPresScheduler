#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-staging}"
# Allow "prod" to use .env.supabase.prod or .env.supabase.production
if [[ "$ENV" == "prod" ]]; then
  if [[ -f ".env.supabase.prod" ]]; then
    FILE=".env.supabase.prod"
  elif [[ -f ".env.supabase.production" ]]; then
    FILE=".env.supabase.production"
  else
    echo "Missing .env.supabase.prod or .env.supabase.production"
    exit 1
  fi
else
  FILE=".env.supabase.${ENV}"
  if [[ ! -f "$FILE" ]]; then
    echo "Missing $FILE"
    exit 1
  fi
fi

# shellcheck disable=SC1090
source "$FILE"

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "SUPABASE_PROJECT_REF not set in $FILE"
  exit 1
fi

supabase link --project-ref "$SUPABASE_PROJECT_REF"
echo "Linked to $ENV ($SUPABASE_PROJECT_REF)"
