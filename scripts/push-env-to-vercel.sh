#!/usr/bin/env bash
# Pushes every KEY="VALUE" pair from .env.local into Vercel project,
# for production / preview / development environments.
# Skips comments and empty lines. Removes existing values first to avoid duplicates.

set -uo pipefail

ENV_FILE="${1:-.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE not found"
  exit 1
fi

# Skip "preview" — newer Vercel CLI requires a specific branch name for preview env
# vars and the project has no git repo linked. Production + development is enough
# for `vercel deploy --prod` (production) and local `vercel dev` (development).
ENVIRONMENTS=("production" "development")

# Parse KEY="VALUE" pairs (handles quoted values with special chars)
while IFS= read -r line <&3 || [[ -n "$line" ]]; do
  # Skip blank lines and comments
  [[ -z "${line// }" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  # Match KEY="VALUE" — value may contain anything except unescaped "
  if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=\"(.*)\"[[:space:]]*(#.*)?$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
  else
    continue
  fi

  # Skip empty values (placeholders)
  if [[ -z "$value" ]]; then
    echo "  · skip $key (empty)"
    continue
  fi

  echo "→ $key"
  failed=0
  for env in "${ENVIRONMENTS[@]}"; do
    # Best-effort remove existing (silent if not present)
    npx vercel env rm "$key" "$env" -y </dev/null >/dev/null 2>&1 || true
    # Add fresh — --value bypasses interactive prompt; --yes confirms preview branches
    if ! npx vercel env add "$key" "$env" --value "$value" --yes </dev/null >/dev/null 2>&1; then
      echo "  ✗ failed: $env"
      failed=$((failed + 1))
    fi
  done
  if [[ $failed -eq 0 ]]; then
    echo "  ✓ pushed to production, development"
  fi
done 3< "$ENV_FILE"

echo ""
echo "✓ Done. Verify in Vercel dashboard → Settings → Environment Variables."
