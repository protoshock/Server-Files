#!/bin/sh
if [ "$exposeGC" == true ]; then
  exec node --expose-gc index.js
else
  exec node index.js
fi