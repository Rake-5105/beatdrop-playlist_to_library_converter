#!/bin/bash
# Diagnostic script to test if yt-dlp binary works on Render

echo "=== Render Diagnostic Check ==="
echo ""
echo "Node version:"
node --version
echo ""
echo "npm version:"
npm --version
echo ""
echo "FFmpeg:"
which ffmpeg || echo "ffmpeg not in PATH"
ffmpeg -version 2>&1 | head -n 1 || echo "ffmpeg failed"
echo ""
echo "yt-dlp binary location:"
ls -lh node_modules/yt-dlp-wrap/bin/ 2>/dev/null || echo "yt-dlp not in expected location"
echo ""
echo "Temp directory:"
ls -la /tmp/ | head -n 10
echo ""
echo "=== End Diagnostic ==="
