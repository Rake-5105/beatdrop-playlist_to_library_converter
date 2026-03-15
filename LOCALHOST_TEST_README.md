# Localhost Test Setup

Simple hardcoded local testing for Sound Switch Studio downloads.

## Quick Start

### 1. Edit Hardcoded Tracks

Edit `localhost-server.js` and replace the `HARDCODED_TRACKS` array:

```javascript
const HARDCODED_TRACKS = [
  {
    videoId: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up",
  },
  // Add more here! Format:
  // { videoId: "VIDEO_ID_HERE", title: "Song Title" },
];
```

To find video IDs:
- YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Video ID: `dQw4w9WgXcQ` (everything after `v=`)

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Localhost Server

```bash
node localhost-server.js
```

You should see:
```
╔════════════════════════════════════════╗
║  🎵 SSS - Localhost Test Server       ║
╚════════════════════════════════════════╝

📍 Server: http://localhost:3000
📁 Downloads: C:\Users\...\Downloads\sss-downloads
🎬 Tracks: 2
```

### 4. Open Test Page

Open `localhost.html` in your browser:
- File → Open → Select `localhost.html`
- Or: Right-click `localhost.html` → Open with → Browser

### 5. Test Download

1. Select audio format (MP3, M4A, etc.)
2. Select quality (192, 256, 320 kbps)
3. Click **⬇️ Download All**
4. Watch the progress and messages
5. Files will be saved to `C:\Users\YOUR_NAME\Downloads\sss-downloads`

## Troubleshooting

### ❌ "Cannot find module 'yt-dlp-wrap'"

```bash
npm install yt-dlp-wrap
```

### ❌ "yt-dlp: command not found"

Install yt-dlp:
```bash
# macOS/Linux
brew install yt-dlp

# Windows
choco install yt-dlp
# or download from: https://github.com/yt-dlp/yt-dlp/releases
```

### ❌ "Sign in to confirm you're not a bot"

YouTube is blocking that video. Try a different one - public music videos often work better.

### ❌ Downloads fail but localhost server is running

1. Try a different video/playlist
2. Check if yt-dlp is installed: `yt-dlp --version`
3. Check browser console (F12) for error messages
4. Check terminal where you ran `node localhost-server.js` for logs

## Files

- **localhost-server.js** - Express server with hardcoded routes
- **localhost.html** - Web interface
- **test-download.js** - Standalone test script (optional)

## Environment Setup

Everything is hardcoded - no `.env` files, no Render, no Netlify. Just:
1. Edit `localhost-server.js`
2. Run `node localhost-server.js`
3. Open `localhost.html`
4. Click download

Done!
