#!/bin/sh
set -eu

pnpm -s lint
pnpm -s typecheck

# Worktrees share one test database, so only one test run may happen at a time.
lock="$(git rev-parse --git-common-dir)/test.lock"
waited=0
until mkdir "$lock" 2>/dev/null; do
  if [ "$waited" -eq 0 ]; then
    echo "Waiting for another test run to finish (lock: $lock)."
  fi
  waited=$((waited + 5))
  if [ "$waited" -eq 300 ]; then
    echo "Still waiting after 5 minutes. If no test run is going, remove the stale lock: rmdir \"$lock\""
  fi
  sleep 5
done
trap 'rmdir "$lock"' EXIT INT TERM

pnpm -s test
