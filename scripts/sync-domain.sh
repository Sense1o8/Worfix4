#!/usr/bin/env bash
# Copies the shared, unit-tested domain module into the Cloud Functions package so the server
# runs EXACTLY the same rules as the web app's tests. Run before building/deploying functions.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf functions/src/domain && mkdir -p functions/src/domain
for f in types rewards permissions verification certificates fraud validation; do cp "web/src/lib/domain/$f.ts" "functions/src/domain/$f.ts"; done
echo "domain synced to functions/src/domain"
