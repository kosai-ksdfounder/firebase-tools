#!/usr/bin/env bash
set -e

echo "Running npm link..."
npm link

chmod +x ./lib/bin/firebase.js
