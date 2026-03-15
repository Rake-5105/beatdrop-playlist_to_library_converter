# Sound Switch Studio 🎵

Convert your Spotify and YouTube playlists to downloadable audio files.

**Copyright © 2026 Rakesh Kannan C K. All rights reserved.**

---

## Table of Contents

- [Features](#features)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Localhost Testing](#localhost-testing)
- [Troubleshooting](#troubleshooting)
- [Known Issues & Limitations](#known-issues--limitations)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Development](#development)
- [License](#license)

---

## Features

✅ **Spotify Integration**
- Convert Spotify playlists to audio files
- Automatic fallback to YouTube if Spotify audio unavailable
- Full playlist metadata support

✅ **YouTube Downloads**
- Download audio from YouTube videos
- Multiple audio format support (MP3, M4A, OPUS, etc.)
- Adjustable quality (128 kbps - 320 kbps)

✅ **Batch Processing**
- Download entire playlists with one click
- Parallel downloads (up to 6 concurrent)
- Real-time progress tracking via Server-Sent Events (SSE)

✅ **ZIP Creation**
- Automatic ZIP archive generation
- Browser download support
- Preserves metadata

✅ **Modern UI**
- React + TypeScript frontend
- Tailwind CSS styling
- Real-time progress updates
- Dark/Light theme toggle

---

## System Requirements

### Minimum

- **OS**: Windows 10+, macOS 10.14+, Linux (Ubuntu/Debian/CentOS)
- **Node.js**: v16.0.0 or higher
- **npm/Yarn**: Latest version
- **RAM**: 2GB minimum
- **Disk Space**: 500MB for dependencies + storage for downloads

### Recommended

- **OS**: Windows 11, macOS 12+, Ubuntu 20.04+
- **Node.js**: v18.0.0 or higher
- **RAM**: 4GB+
- **Disk Space**: 2GB+
- **Internet**: Stable connection (>5 Mbps)

### Required External Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **yt-dlp** | YouTube/audio downloader | [Installation Guide](#yt-dlp-installation) |
| **FFmpeg** | Audio codec/format conversion | [Installation Guide](#ffmpeg-installation) |
| **Git** | Version control (development) | https://git-scm.com/ |

---

## Installation

### 1. Prerequisites Installation

#### yt-dlp Installation

**Windows (Chocolatey):**
```powershell
choco install yt-dlp
```

**Windows (Manual):**
1. Download from: https://github.com/yt-dlp/yt-dlp/releases
2. Extract to: `C:\Program Files\yt-dlp\`
3. Add to PATH

**macOS:**
```bash
brew install yt-dlp
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install yt-dlp
```

**Verify installation:**
```bash
yt-dlp --version
```

#### FFmpeg Installation

**Windows (Chocolatey):**
```powershell
choco install ffmpeg
```

**Windows (Manual):**
1. Download from: https://www.gyan.dev/ffmpeg/builds/
2. Extract to: `C:\Program Files\ffmpeg\`
3. Add `C:\Program Files\ffmpeg\bin` to PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

### 2. Clone Repository

```bash
git clone https://github.com/Rake-5105/sound-switch-studio.git
cd sound-switch-studio
```

### 3. Install Node Dependencies

```bash
npm install
# or
yarn install
# or
bun install
```

**Key Dependencies:**
- **express** - Web server framework
- **yt-dlp-wrap** - YouTube downloading wrapper
- **ffmpeg-static** - FFmpeg binary for Node
- **archiver** - ZIP file creation
- **react** - Frontend UI framework
- **vite** - Build tool
- **axios** - HTTP client
- **tailwindcss** - CSS framework

### 4. Environment Setup

Create `.env` file in project root:

```env
# Frontend API Configuration
VITE_API_BASE_URL=http://localhost:3000

# Backend Settings
NODE_ENV=development
PORT=3000

# Spotify API (Optional)
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# YouTube (Optional - for browser-based cookies)
YOUTUBE_COOKIES_BROWSER=chrome

# CORS Settings
FRONTEND_URL=http://localhost:5173
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Spotify API Setup:**
1. Go to: https://developer.spotify.com/dashboard
2. Create new app
3. Accept terms
4. Copy Client ID and Secret
5. Add to `.env`

### 5. Build Frontend (Optional)

```bash
npm run build
```

This creates optimized production build in `dist/` folder.

---

## Configuration

### Backend Configuration

Edit `server/index.js`:

```javascript
// Server listening port
const PORT = process.env.PORT || 3000;

// Parallel download concurrency
const ZIP_CONCURRENCY = 6; // Downloads 6 tracks simultaneously

// Audio quality options
const AUDIO_QUALITY = "192"; // Can be: 128, 192, 256, 320

// Output codec
const CODEC = "mp3"; // Can be: mp3, m4a, opus, vorbis, wav
```

### Frontend Configuration

Edit `src/lib/api.ts`:

```typescript
// API endpoint
const BACKEND = process.env.VITE_API_BASE_URL || "http://localhost:3000";

// Request timeout
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Storage keys
const STORAGE_KEY = "sss_settings";
```

### Render Deployment

If deploying to Render, create `render.yaml`:

```yaml
services:
  - type: web
    name: sound-switch-studio-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SPOTIFY_CLIENT_ID
        value: ${SPOTIFY_CLIENT_ID}
      - key: SPOTIFY_CLIENT_SECRET
        value: ${SPOTIFY_CLIENT_SECRET}
```

And `nixpacks.toml` for system dependencies:

```toml
[build]
providers = ["nixpacks"]

[[nixpacks.install]]
apt-get = ["ffmpeg"]
```

---

## Usage

### Development Mode

**Terminal 1 - Backend Server:**
```bash
npm run dev:server
# or
node server/index.js
```

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev:frontend
# or
npm run dev
```

Open: http://localhost:5173

### Production Mode

**Build frontend:**
```bash
npm run build
```

**Start server:**
```bash
npm start
# or
NODE_ENV=production node server/index.js
```

Server will serve static files from `dist/` folder.

### API Endpoints

**Backend runs on:** `http://localhost:3000`

#### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "ffmpeg": "available"
}
```

#### POST `/api/search-spotify`
Search for playlist on Spotify.

**Request:**
```json
{
  "query": "EDM Hits 2024"
}
```

**Response:**
```json
{
  "playlists": [
    {
      "id": "37i9d...",
      "name": "EDM Hits",
      "tracks": 50,
      "image": "https://..."
    }
  ]
}
```

#### POST `/api/search-youtube`
Search for playlist on YouTube.

**Request:**
```json
{
  "query": "lofi hip hop beats"
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "2nR1...",
      "title": "Lofi Hip Hop",
      "duration": "3:45"
    }
  ]
}
```

#### POST `/api/download-zip`
Download multiple tracks as ZIP (Server-Sent Events).

**Request:**
```json
{
  "tracks": [
    { "videoId": "dQw4w9...", "title": "Song Name" }
  ],
  "codec": "mp3",
  "audioQuality": "192"
}
```

**Response:** Streaming SSE events
```
data: {"type":"progress","current":1,"total":5}
data: {"type":"track_done","title":"Song 1"}
data: {"type":"zipping","message":"Creating ZIP..."}
data: {"type":"complete","file":"playlist.zip"}
```

---

## Localhost Testing

Quick testing without Render/Netlify:

### Setup

1. **Edit hardcoded tracks** in `localhost-server.js`:
```javascript
const HARDCODED_TRACKS = [
  { videoId: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up" },
  { videoId: "jNQXAC9IVRw", title: "Me at the zoo" }
];
```

2. **Start server:**
```bash
node localhost-server.js
```

3. **Open test page:**
- Right-click `localhost.html` → Open with Browser
- Or drag-drop to browser

4. **Click download** and watch progress

**Downloads saved to:** `C:\Users\YOUR_NAME\Downloads\sss-downloads`

---

## Troubleshooting

### Common Issues

#### ❌ "yt-dlp: command not found"

**Windows:**
```powershell
# Check if installed
yt-dlp --version

# If not, install:
choco install yt-dlp

# Or add to PATH manually
setx PATH "%PATH%;C:\Program Files\yt-dlp"
```

**macOS/Linux:**
```bash
which yt-dlp
brew install yt-dlp  # macOS
sudo apt-get install yt-dlp  # Linux
```

#### ❌ "ffmpeg not found"

```bash
# Verify installation
ffmpeg -version

# Install if missing
choco install ffmpeg        # Windows
brew install ffmpeg         # macOS
sudo apt-get install ffmpeg # Linux
```

#### ❌ "Cannot find module 'express'"

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

#### ❌ "CORS error" or "API not responding"

1. Check if backend is running: `http://localhost:3000/api/health`
2. Check `VITE_API_BASE_URL` in browser console (F12)
3. Verify `.env` file exists with correct `PORT`
4. Check firewall isn't blocking port 3000

**Windows Firewall:**
```powershell
# Allow Node.js through firewall
netsh advfirewall firewall add rule name="Node.js" dir=in action=allow program="C:\Program Files\nodejs\node.exe"
```

#### ❌ "All track downloads failed — ZIP would be empty"

**Most likely cause:** YouTube is blocking downloads (authentication required)

**Solutions:**
1. Try a different video (some require login)
2. Use Spotify playlist instead
3. Check YouTube hasn't changed their API

#### ❌ Downloads timeout or hang

**Solutions:**
1. Check internet connection
2. Try lower quality (128 kbps instead of 320)
3. Increase timeout in API: `--socket-timeout 60` (in seconds)
4. Try different video

#### ❌ "Port 3000 already in use"

```bash
# Windows: Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

---

## Known Issues & Limitations

### YouTube-Specific Issues

⚠️ **YouTube 2024+ Restrictions:**
- YouTube now requires authentication for many videos
- Some music videos blocked by copyright claims
- Age-restricted content cannot be downloaded
- Live streams not supported
- Premium YouTube Music requires subscription

**Workaround:** Use Spotify playlists when possible

### Audio Quality Limitations

⚠️ **Quality depends on source:**
- YouTube audio maxes out at ~192 kbps
- Spotify limits quality
- Some videos have no audio stream available

### Performance Concerns

⚠️ **Large playlists (100+ tracks):**
- Memory usage increases significantly
- Download time can be 30+ minutes
- ZIP file size grows quickly
- Free tier hosting (Render) may timeout

**Recommendation:** Download playlists in batches of 10-20 tracks

### Browser Compatibility

✅ **Fully Supported:**
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Limited Support:**
- IE 11 (not supported)
- Mobile browsers (downloads may not work as expected)

### Deployment Limitations

⚠️ **Render Free Tier:**
- Spins down after 15 minutes of inactivity
- Limited memory (512MB)
- Limited disk space
- May timeout on large playlists

⚠️ **Netlify Free Tier:**
- Limited build time (300 minutes/month)
- Function timeout (10 seconds)
- SSE streams may disconnect

### Copyright & Legal

⚠️ **Copyright Notice:**
- Downloads are for personal use only
- Users are responsible for copyright compliance
- Do not distribute copyrighted content
- Some content may be protected by DMCA

This tool is provided as-is for educational purposes.

---

## API Reference

### Error Responses

**400 Bad Request:**
```json
{
  "error": "Missing required parameter: videoId"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limited. Try again in 60 seconds"
}
```

**500 Server Error:**
```json
{
  "error": "FFmpeg not found. Install ffmpeg to continue"
}
```

---

## Architecture

### Frontend Stack
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **HTTP Client:** Axios
- **State:** React Context + Hooks

### Backend Stack
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Download:** yt-dlp-wrap
- **Audio Processing:** FFmpeg
- **Archive:** Archiver
- **Real-time:** Server-Sent Events (SSE)

### Deployment
- **Frontend:** Netlify (static hosting)
- **Backend:** Render (Node.js free tier)
- **Storage:** Local filesystem (temporary)

### Key Processes

1. **Playlist Resolution:**
   - Search YouTube/Spotify API
   - Extract track metadata
   - Generate video IDs

2. **Download Pipeline:**
   - Spawn yt-dlp process per track
   - Parallel processing (max 6 concurrent)
   - Real-time progress via SSE
   - Metadata preservation

3. **Audio Processing:**
   - Extract audio stream with FFmpeg
   - Convert to desired format
   - Apply quality settings
   - Output to temp directory

4. **Archive Creation:**
   - Collect all downloaded files
   - Create ZIP with archiver
   - Clean up temp files
   - Return ZIP for download

---

## Development

### Project Structure

```
sound-switch-studio/
├── src/
│   ├── App.tsx                 # Main app component
│   ├── main.tsx               # React entry point
│   ├── index.css              # Global styles
│   ├── App.css                # App styles
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── HeroSection.tsx
│   │   ├── ConvertSection.tsx
│   │   ├── PlaylistPreview.tsx
│   │   ├── HowItWorksSection.tsx
│   │   ├── FaqSection.tsx
│   │   ├── Footer.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ui/                # shadcn components
│   ├── pages/
│   │   ├── Index.tsx
│   │   ├── About.tsx
│   │   ├── Privacy.tsx
│   │   ├── Terms.tsx
│   │   └── NotFound.tsx
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   ├── utils.ts           # Utilities
│   │   └── history.ts         # Download history
│   └── hooks/
│       ├── use-toast.ts
│       └── use-mobile.tsx
├── server/
│   └── index.js               # Express backend
├── public/
│   └── robots.txt
├── .env                       # Environment variables
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── package.json              # Dependencies
└── README.md                 # This file
```

### Adding Features

**1. New API Endpoint:**

```javascript
// server/index.js
app.post("/api/my-feature", async (req, res) => {
  try {
    const { param } = req.body;
    // Your logic here
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**2. New Frontend Component:**

```typescript
// src/components/MyComponent.tsx
import React from "react";

export function MyComponent() {
  return <div>My Component</div>;
}
```

**3. New Page:**

```typescript
// src/pages/MyPage.tsx
export default function MyPage() {
  return <main>My Page</main>;
}
```

### Testing

```bash
# Run localhost version
node localhost-server.js

# Test single download
node test-download.js

# Check health
curl http://localhost:3000/api/health
```

### Building for Production

```bash
# Build frontend
npm run build

# Output in: dist/
# Deploy to Netlify or any static host

# Build backend (if needed)
npm run build:server
```

---

## License

**Copyright © 2026 Rakesh Kannan C K. All rights reserved.**

This project is provided as-is for personal and educational use only. Unauthorized copying, distribution, or modification is strictly prohibited.

### Third-Party Licenses

This project uses several open-source libraries:

- **yt-dlp** - Public Domain (https://github.com/yt-dlp/yt-dlp)
- **FFmpeg** - LGPL 2.1+ (https://ffmpeg.org)
- **React** - MIT (https://reactjs.org)
- **Express** - MIT (https://expressjs.com)
- **Tailwind CSS** - MIT (https://tailwindcss.com)

### Disclaimer

This tool is for personal use only. Users are responsible for:
- Verifying copyright compliance
- Following YouTube Terms of Service
- Following Spotify Terms of Service
- Complying with local laws regarding digital content

The author is not responsible for misuse or copyright violations.

---

## Support & Feedback

For issues, suggestions, or questions:

1. Check **Troubleshooting** section above
2. Review error logs in terminal
3. Visit: https://github.com/Rake-5105/sound-switch-studio/issues

---

**Last Updated:** March 2026
**Version:** 1.0.0
**Author:** Rakesh Kannan C K
**Twitter:** [@RakeshKannan](https://twitter.com/rakeshkannan)
**GitHub:** [@Rake-5105](https://github.com/Rake-5105)

**Copyright © 2026 Rakesh Kannan C K. All rights reserved.**
