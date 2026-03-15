#!/bin/bash

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  🎵 SSS - Localhost Test Server       ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Starting server..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "❌ yt-dlp is not installed!"
    echo "Install with: brew install yt-dlp"
    exit 1
fi

# Start the server
node localhost-server.js
