#!/bin/sh
cd /usr/src
rm -rf app
echo "Getting Repo Code"
git clone https://git.furgiz.eu.org/Gizzy/Edited-Protoshock-Server.git app
cd app
npm install
node -expose-gc rewrite.mjs

exec "$@"
