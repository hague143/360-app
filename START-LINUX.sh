#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 24 LTS from https://nodejs.org/en/download first."
  exit 1
fi
node scripts/start-local.mjs
