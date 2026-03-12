# BeatDrop

> **Spotify & YouTube Playlist → Local Audio Library Converter**

BeatDrop is a free, self-hosted, privacy-first tool that converts Spotify and YouTube playlists into a local audio library. Paste a playlist URL, choose your format, and download your music — no account, no ads, no data collection.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [How It Works](#how-it-works)
- [Supported Formats](#supported-formats)
- [FAQ](#faq)
- [Privacy Policy](#privacy-policy)
- [Terms of Service](#terms-of-service)
- [Legal Disclaimer](#legal-disclaimer)

---

## Features

- **Spotify & YouTube support** — Paste any public Spotify or YouTube playlist URL.
- **Multiple audio formats** — Export as MP3, WAV, FLAC, M4A, or AAC.
- **Unlimited playlist size** — No track limit; paginated API fetching handles playlists of any size.
- **Drag-and-drop reordering** — Reorder tracks in the preview before downloading.
- **Bulk or individual downloads** — Download all tracks as a ZIP or grab individual songs.
- **Conversion history** — Last 50 conversions saved locally in your browser (never sent to a server).
- **No account required** — No sign-up, no login, no database.
- **Zero data collection** — No analytics, no tracking, no cookies.
- **Dark / Light theme** — Full system-aware theme support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Node.js, Express 5 |
| Audio | yt-dlp, ffmpeg-static, @distube/ytdl-core |
| Spotify API | Client Credentials OAuth (metadata only) |
| YouTube API | YouTube Data API v3 (metadata) |
| Routing | React Router v6 |
| State | TanStack Query v5 |

---

## Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org)
- **npm** v9 or higher (bundled with Node.js)
- **yt-dlp** binary placed at `server/yt-dlp.exe` (Windows) or `server/yt-dlp` (Linux/macOS) — [Download](https://github.com/yt-dlp/yt-dlp/releases)
- A **Spotify Developer** account — [dashboard.spotify.com](https://developer.spotify.com/dashboard)
- A **Google Cloud** account with the **YouTube Data API v3** enabled — [console.cloud.google.com](https://console.cloud.google.com)

---

## Installation

```sh
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd sound-switch-studio

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env
```

Then fill in your credentials in `.env` (see [Environment Variables](#environment-variables)).

---

## Environment Variables

Copy `.env.example` to `.env` and set the following values:

```dotenv
# ── Spotify Developer Credentials ──────────────────────────────
# https://developer.spotify.com/dashboard → Create App
# Redirect URI: http://localhost:3001  (required by Spotify form, not used by this app)
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
VITE_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# ── YouTube Data API v3 ─────────────────────────────────────────
# https://console.cloud.google.com → Enable YouTube Data API v3 → Create API Key
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here

# ── Server-side Spotify credentials (never exposed to browser) ──
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# ── YouTube download cookies ────────────────────────────────────
# Prevents yt-dlp from being blocked as a bot.
# Set to the browser you are logged into YouTube with.
# Options: firefox | chrome | edge | brave | chromium | safari
YOUTUBE_COOKIES_BROWSER=firefox
```

> **Note:** The Spotify API is used for **playlist metadata only** (track names & artists). All audio is sourced from YouTube. The YouTube Data API has a free quota of 10,000 units/day — each playlist page costs ~1 unit.

---

## Running the App

```sh
# Run frontend + backend together (recommended)
npm run dev:full

# Frontend only (Vite dev server on port 8080)
npm run dev

# Backend only (Express server)
npm run server

# Production build
npm run build
```

The frontend is available at **http://localhost:8080**  
The backend API runs on **http://localhost:3001**

---

## How It Works

1. **Paste a URL** — Spotify playlist URL or YouTube playlist URL.
2. **Metadata fetch** — BeatDrop calls the Spotify or YouTube API to retrieve all track names and artists.
3. **YouTube matching** — Each Spotify track is automatically matched to a YouTube video by title + artist.
4. **Preview & reorder** — Browse the full track list and drag-and-drop to reorder if needed.
5. **Download** — Click Download. The backend streams each track through yt-dlp and ffmpeg, transcodes to your chosen format, and delivers the files directly to your browser. Nothing is stored on the server after delivery.

---

## Supported Formats

| Format | Extension | Notes |
|---|---|---|
| MP3 | `.mp3` | Most compatible, smaller file size |
| WAV | `.wav` | Lossless, large file size |
| FLAC | `.flac` | Lossless, compressed |
| M4A | `.m4a` | AAC in MPEG-4 container |
| AAC | `.aac` | Raw AAC stream |

---

## FAQ

**Is BeatDrop free?**  
Yes — 100% free, forever. No subscriptions, no premium tiers, no hidden fees.

**Do I need an account?**  
No. Simply paste a URL and convert. No sign-up or login of any kind.

**Is there a track limit?**  
No. Whether your playlist has 10 songs or 10,000, BeatDrop handles it using paginated API fetching.

**Where is my history stored?**  
Locally in your browser's `localStorage`. It never leaves your device and can be cleared anytime from the History page.

**Does BeatDrop store my music?**  
No. Audio is streamed directly to your browser. Once the transfer completes, no audio file remains on our servers.

**What if YouTube blocks the download?**  
Set `YOUTUBE_COOKIES_BROWSER` in your `.env` to the browser you're logged into YouTube with. This allows yt-dlp to use your real browser cookies to bypass bot detection.

---

## Privacy Policy

_Last updated: March 12, 2026_

- **No data collection.** BeatDrop does not collect, store, or transmit any personal data to any server.
- **No audio stored.** Audio files are never persisted on our servers. They are retrieved on-demand and streamed directly to your browser.
- **Local storage only.** Download history is saved in your browser's `localStorage` — it never leaves your device.
- **No cookies.** We do not use cookies, analytics, tracking pixels, or advertising of any kind.
- **Third-party APIs.** When loading a playlist, requests are made to the Spotify API and YouTube Data API, governed by their own privacy policies: [Spotify Privacy Policy](https://www.spotify.com/legal/privacy-policy/) · [Google / YouTube Privacy Policy](https://policies.google.com/privacy).

---

## Terms of Service

_Last updated: March 12, 2026_

### 1. Acceptance of Terms
By using BeatDrop ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.

### 2. User Responsibility
You are **solely and fully responsible** for all content you download. By using BeatDrop, you confirm that:
- You have the legal right to download the content you request.
- You will only download music for personal, non-commercial use unless you hold the appropriate licence.
- You understand that downloading copyrighted material without authorisation may violate the laws of your jurisdiction.
- You accept full legal liability for any copyright infringement resulting from your use of the Service.

### 3. No Music Storage
BeatDrop does not store, cache, host, or redistribute any audio files. Audio is retrieved from public third-party platforms (e.g. YouTube) and passed directly to your browser as a temporary stream. No audio file is ever written to or retained on our servers beyond the duration of your request.

### 4. Copyright & Intellectual Property
The Service is provided as a technical tool only. We make no representations about the legality of downloading any particular track in your jurisdiction. It is your responsibility to ensure your use complies with all applicable copyright laws, platform terms of service (including Spotify and YouTube), and any other relevant regulations.

### 5. Third-Party Platforms
BeatDrop uses official Spotify and YouTube APIs to retrieve playlist metadata. Your use of those platforms is governed by their respective terms of service. BeatDrop is **not affiliated with, endorsed by, or sponsored by Spotify, YouTube, or any other platform.**

### 6. Disclaimer of Warranties
The Service is provided "as is" without warranties of any kind. We make no guarantees regarding uptime, accuracy, or availability of third-party APIs.

### 7. Limitation of Liability
To the maximum extent permitted by law, BeatDrop and its operators shall not be liable for any indirect, incidental, consequential, or statutory damages arising from your use of the Service, including any liability arising from copyright infringement by the user.

### 8. Changes to Terms
We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.

---

## Legal Disclaimer

> BeatDrop is a self-hosted download assistant intended for **personal, lawful use only**. It does not store, host, cache, or distribute copyrighted audio content. All audio is retrieved on-demand from public third-party platforms and streamed directly to the requesting device.
>
> **You — the user — are solely responsible for how you use this service.** Downloading copyrighted content without the rights holder's permission may violate applicable law in your country. The developers of BeatDrop accept no liability for misuse.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

<p align="center">© 2026 BeatDrop — Made for music lovers everywhere.</p>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/529d1daf-d543-433c-844c-207e89edab26) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
