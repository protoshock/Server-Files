#!/bin/sh
WORK_DIR="/usr/src/app"

cd "$WORK_DIR"

git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "New code available. Updating..."
  git pull
  node --expose-gc .
  # Additional commands to restart your application if needed
else
  echo "No new updates found."
  node --expose-gc .
fi

exec "$@"
