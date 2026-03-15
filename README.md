# Sound Switch Studio 🎵

Download your Spotify and YouTube playlists as audio files.

---

## Quick Start

### 1. Install Requirements

**yt-dlp:**
```bash
# Windows
choco install yt-dlp

# macOS
brew install yt-dlp

# Linux
sudo apt-get install yt-dlp
```

**FFmpeg:**
```bash
# Windows
choco install ffmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

**Node.js:**
- Download: https://nodejs.org (v16+)

### 2. Setup Project

```bash
git clone https://github.com/Rake-5105/sound-switch-studio.git
cd sound-switch-studio
npm install
```

### 3. Create .env File

```env
VITE_API_BASE_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

### 4. Run Project

**Terminal 1 (Backend):**
```bash
node server/index.js
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Open: http://localhost:5173

---

## Features

✅ Download Spotify playlists  
✅ Download YouTube videos  
✅ Multiple audio formats (MP3, M4A, OPUS, WAV)  
✅ Adjustable quality (128-320 kbps)  
✅ Batch downloads with ZIP  
✅ Real-time progress tracking  
✅ Dark/Light theme  

---

## Localhost Testing (No Deployment)

Edit `localhost-server.js` and add your videos:

```javascript
const HARDCODED_TRACKS = [
  { videoId: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up" },
  { videoId: "jNQXAC9IVRw", title: "Me at the zoo" }
];
```

Then run:
```bash
node localhost-server.js
```

Open `localhost.html` in your browser.

---

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/search-spotify` - Search Spotify
- `POST /api/search-youtube` - Search YouTube
- `POST /api/download-zip` - Download tracks as ZIP

---

## Troubleshooting

**"yt-dlp: command not found"**
```bash
choco install yt-dlp        # Windows
brew install yt-dlp         # macOS
sudo apt-get install yt-dlp # Linux
```

**"ffmpeg not found"**
```bash
choco install ffmpeg        # Windows
brew install ffmpeg         # macOS
sudo apt-get install ffmpeg # Linux
```

**"Cannot find module 'express'"**
```bash
npm install
```

**"Port 3000 already in use"**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

**"All track downloads failed"**
- Try a different video (YouTube may require login)
- Use Spotify playlist instead
- Check internet connection

---

## Project Structure

```
├── src/                # React frontend
├── server/             # Express backend
├── localhost.html      # Test page
├── localhost-server.js # Dev server
├── .env               # Environment variables
└── package.json       # Dependencies
```

---

## Deployment (Optional)

### Netlify (Frontend)
1. Push code to GitHub
2. Connect GitHub to Netlify
3. Set `VITE_API_BASE_URL` to your backend URL

### Render (Backend)
1. Create new Web Service
2. Connect GitHub repository
3. Set environment variables:
   - Add any needed API keys (Spotify, YouTube)
4. Deploy

---

## Known Limitations

⚠️ YouTube requires authentication for some videos  
⚠️ Audio quality limited to ~192 kbps on YouTube  
⚠️ Large playlists (100+ tracks) may timeout on free hosting  
⚠️ Downloads are for personal use only  

---

## License & Copyright

Copyright © 2026 Rakesh Kannan. All rights reserved.

This tool is for personal and educational use. Users are responsible for copyright compliance.

Powered by: yt-dlp, FFmpeg, React, Express, Tailwind CSS
