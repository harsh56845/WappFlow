#!/usr/bin/env sh
# Run WappFlow on your Mac/PC so other devices on the same Wi‑Fi can open it.
cd "$(dirname "$0")/.." || exit 1
export HOST=0.0.0.0
export PORT="${PORT:-3000}"
echo "Starting WappFlow on all interfaces (port ${PORT})..."
exec npm start
