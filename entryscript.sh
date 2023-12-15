#!/bin/sh
if [ "$EXPOSE_GC" == "true" ]; then
  exec node --expose-gc index.js
else
  exec node index.js
fi