/**
 * Sound Switch Studio - Backend Server
 * Copyright © 2026 Rakesh Kannan
 */

import express from "express";
import cors from "cors";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import archiver from "archiver";

// ── FILE-BASED LOGGING as backup ──
const logDir = path.join(os.tmpdir(), "sss-logs");
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `server-${Date.now()}.log`);

function fileLog(...args) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  try {
    fs.appendFileSync(logFile, msg);
  } catch (e) {
    // Ignore file write errors
  }
}

// ── UNBUFFERED console logging for Render ──
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function flushLog(...args) {
  fileLog(...args);
  originalLog(...args);
  // Aggressive flush
  if (process.stdout && process.stdout.write) {
    process.stdout.write("");
  }
  if (typeof process !== "undefined" && process.stderr) {
    process.stderr.write("");
  }
}

console.log = (...args) => {
  flushLog(...args);
};
console.warn = (...args) => {
  flushLog("[WARN]", ...args);
};
console.error = (...args) => {
  flushLog("[ERROR]", ...args);
};

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDlpWrap = require("yt-dlp-wrap").default;
const YoutubeSearchApi = require("youtube-search-api");
// Try to get FFmpeg path - prefer system ffmpeg from nixpacks, fallback to ffmpeg-static
let ffmpegPath = "ffmpeg"; // Default to system PATH
try {
  const ffmpegStatic = require("ffmpeg-static");
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    ffmpegPath = ffmpegStatic;
    console.log(`🎬 Using ffmpeg-static from node_modules: ${ffmpegPath}`);
  } else {
    console.log(`🎬 ffmpeg-static not available, using system ffmpeg`);
  }
} catch (e) {
  console.log(`🎬 ffmpeg-static not available, using system ffmpeg`);
}

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIGURED_FRONTEND_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.NETLIFY_URL,
  ...(process.env.FRONTEND_ORIGINS ?? "").split(","),
]
  .map((value) => value?.trim())
  .filter(Boolean);

// ── Spotify token cache (declared here so all routes can access it) ──
let _cachedSpotifyToken = null;
let _cachedSpotifyTokenExpiresAt = 0;

// ── yt-dlp binary ────────────────────────────────────────────
// Use platform-appropriate filename; on Linux Render the .exe won't exist but
// ensureYtDlp() will download the correct binary on first startup.
const ytDlpBinaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpBinaryDir = process.platform === "win32"
  ? __dirname
  : path.join(os.tmpdir(), "sound-switch-studio-bin");
fs.mkdirSync(ytDlpBinaryDir, { recursive: true });
const ytDlpBinaryPath = process.env.YT_DLP_BINARY_PATH || path.join(ytDlpBinaryDir, ytDlpBinaryName);
const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);

// Browser whose cookie store yt-dlp uses to bypass YouTube bot detection.
// Set YOUTUBE_COOKIES_BROWSER in .env → edge | chrome | firefox | brave
const VALID_BROWSERS = new Set(["brave", "chrome", "chromium", "edge", "firefox", "opera", "safari", "vivaldi", "whale"]);
const _rawBrowser = process.env.YOUTUBE_COOKIES_BROWSER?.trim();
const COOKIES_BROWSER = _rawBrowser && VALID_BROWSERS.has(_rawBrowser) ? _rawBrowser : null;

// NOTE: REMOVED browser-based cookie extraction
// Reason: Can't extract cookies from headless browser that was never logged in
// Solution: Using yt-dlp's multiple player clients + browser headers instead
console.log(`ℹ️  Using headless download method (no browser cookies)`);
console.log(`ℹ️  Using multiple YouTube player clients for reliability`);


// REMOVED: cookiesArg() function
// Reason: Can't extract cookies from headless browser that was never logged in
// Solution: Use browser-like headers and yt-dlp extractor args instead

async function ensureYtDlp() {
  try {
    const version = await ytDlpWrap.getVersion();
    console.log(`✅  yt-dlp ready (${version})`);
  } catch {
    console.log("⬇️  Downloading yt-dlp binary (one-time)...");

    const latestReleaseUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpBinaryName}`;
    const tempBinaryPath = `${ytDlpBinaryPath}.download`;
    try {
      if (fs.existsSync(tempBinaryPath)) fs.unlinkSync(tempBinaryPath);
    } catch {}

    await YTDlpWrap.downloadFile(latestReleaseUrl, tempBinaryPath);
    if (process.platform !== "win32") {
      fs.chmodSync(tempBinaryPath, 0o755);
    }

    fs.renameSync(tempBinaryPath, ytDlpBinaryPath);

    let version;
    let lastError;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        version = await ytDlpWrap.getVersion();
        break;
      } catch (error) {
        lastError = error;
        if (error?.code !== "ETXTBSY" || attempt === 4) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!version && lastError) throw lastError;
    console.log(`✅  yt-dlp downloaded (${version})`);
  }
}

async function checkFFmpeg() {
  return new Promise((resolve) => {
    console.log(`📦  FFmpeg path: ${ffmpegPath}`);
    console.log(`📦  FFmpeg exists: ${fs.existsSync(ffmpegPath)}`);
    
    if (!fs.existsSync(ffmpegPath)) {
      console.error(`❌  FFmpeg NOT FOUND at ${ffmpegPath}`);
      console.error(`⚠️  Audio conversion will FAIL! Install ffmpeg-static or ffmpeg.`);
      resolve(false);
      return;
    }

    // Check file permissions
    try {
      const stats = fs.statSync(ffmpegPath);
      console.log(`📦  FFmpeg file size: ${stats.size} bytes`);
      console.log(`📦  FFmpeg is file: ${stats.isFile()}`);
      console.log(`📦  FFmpeg permissions: ${(stats.mode & parseInt("0o777", 8)).toString(8)}`);
    } catch (e) {
      console.error(`❌  Could not stat FFmpeg: ${e.message}`);
    }

    const proc = spawn(ffmpegPath, ["-version"]);
    let output = "";
    let errors = "";
    proc.stdout.on("data", (chunk) => output += chunk.toString());
    proc.stderr.on("data", (chunk) => errors += chunk.toString());
    
    const timeout = setTimeout(() => {
      proc.kill();
      console.error(`❌  FFmpeg check timed out after 5 seconds`);
      resolve(false);
    }, 5000);
    
    proc.on("close", (code) => {
      clearTimeout(timeout);
      const fullOutput = output + errors;
      if (code === 0 && fullOutput) {
        const firstLine = fullOutput.split("\n")[0];
        console.log(`✅  FFmpeg ready (${firstLine.trim()})`);
        resolve(true);
      } else {
        console.error(`❌  FFmpeg check failed (exit ${code})`);
        if (fullOutput) console.error(`   Output: ${fullOutput.slice(0, 500)}`);
        resolve(false);
      }
    });
    
    proc.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`❌  FFmpeg spawn error: ${err.message}`);
      resolve(false);
    });
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      CONFIGURED_FRONTEND_ORIGINS.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Playlist fetcher (server-side — fast server-to-API) ───────
// GET /api/playlist?url=<spotify-or-youtube-url>
app.get("/api/playlist", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing query param: url" });
  }

  const isSpotify = url.includes("spotify.com");
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  if (!isSpotify && !isYoutube) {
    return res.status(400).json({ error: "URL must be a Spotify or YouTube playlist/track link." });
  }

  try {
    if (isSpotify) {
      const playlistMatch = url.match(/playlist\/([A-Za-z0-9]+)/);
      const trackMatch = url.match(/track\/([A-Za-z0-9]+)/);
      const playlistId = playlistMatch?.[1];
      const trackId = trackMatch?.[1];
      if (!playlistId && !trackId) {
        return res.status(400).json({ error: "Invalid Spotify URL. Use a playlist or track link." });
      }

      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Spotify credentials not configured on server." });
      }

      // Use cached token
      if (!_cachedSpotifyToken || Date.now() >= _cachedSpotifyTokenExpiresAt - 60_000) {
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        });
        const tokenData = await tokenRes.json();
        _cachedSpotifyToken = tokenData.access_token;
        _cachedSpotifyTokenExpiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
      }
      const token = _cachedSpotifyToken;
      const authHeaders = { Authorization: `Bearer ${token}` };

      const parsePage = (data) =>
        (data.items ?? [])
          .filter((i) => i.track && !i.track.is_local)
          .map((i) => ({
            id: i.track.id,
            title: i.track.name,
            artist: (i.track.artists ?? []).map((a) => a.name).join(", ") || "Unknown",
            thumbnail: i.track.album?.images?.[0]?.url ?? "",
            duration: (() => {
              const ms = i.track.duration_ms;
              if (!ms) return "";
              const s = Math.floor(ms / 1000);
              return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
            })(),
            source: "spotify",
            externalUrl: i.track.external_urls?.spotify,
          }));
      if (playlistId) {
        const TIMEOUT = AbortSignal.timeout(20_000);
        // Fetch metadata + first page in parallel
        const [metaRes, firstRes] = await Promise.all([
          fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, { headers: authHeaders, signal: TIMEOUT }),
          fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, { headers: authHeaders, signal: TIMEOUT }),
        ]);
        if (!metaRes.ok) return res.status(502).json({ error: `Spotify API error: ${metaRes.status}` });
        if (!firstRes.ok) return res.status(502).json({ error: `Spotify API error: ${firstRes.status}` });

        const [meta, firstPage] = await Promise.all([metaRes.json(), firstRes.json()]);
        const playlistName = meta.name ?? "Spotify Playlist";

        const tracks = parsePage(firstPage);
        let nextUrl = firstPage.next ?? null;
        while (nextUrl) {
          const pageRes = await fetch(nextUrl, { headers: authHeaders, signal: AbortSignal.timeout(20_000) });
          if (!pageRes.ok) break;
          const page = await pageRes.json();
          tracks.push(...parsePage(page));
          nextUrl = page.next ?? null;
        }

        console.log(`[playlist] Spotify "${playlistName}" — ${tracks.length} tracks`);
        return res.json({ tracks, playlistName, totalCount: tracks.length, source: "spotify" });
      }

      const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(20_000),
      });
      if (!trackRes.ok) {
        return res.status(502).json({ error: `Spotify API error: ${trackRes.status}` });
      }
      const track = await trackRes.json();
      const artist = (track.artists ?? []).map((a) => a.name).join(", ") || "Unknown";
      const oneTrack = [{
        id: track.id,
        title: track.name ?? "Unknown Title",
        artist,
        thumbnail: track.album?.images?.[0]?.url ?? "",
        duration: (() => {
          const ms = track.duration_ms;
          if (!ms) return "";
          const s = Math.floor(ms / 1000);
          return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        })(),
        source: "spotify",
        externalUrl: track.external_urls?.spotify,
      }];
      const playlistName = `${oneTrack[0].title} - ${artist}`;
      console.log(`[playlist] Spotify single "${playlistName}"`);
      return res.json({ tracks: oneTrack, playlistName, totalCount: 1, source: "spotify" });
    }

    // ── YouTube via yt-dlp (works with private/unlisted/any playlist) ──
    console.log(`[playlist] Fetching YouTube playlist via yt-dlp: ${url}`);

    const listId = (url.match(/[?&]list=([A-Za-z0-9_-]+)/) ?? [])[1] ?? "";
    if (!listId) {
      const singleTrack = await new Promise((resolve, reject) => {
        const args = [
          "--no-playlist",
          "--no-warnings",
          "--print", "%(id)s\t%(title)s\t%(uploader)s\t%(channel)s",
          url,
        ];
        let outBuf = "";
        let errBuf = "";
        const proc = spawn(ytDlpBinaryPath, args);
        proc.stdout.on("data", (chunk) => (outBuf += chunk.toString()));
        proc.stderr.on("data", (chunk) => (errBuf += chunk.toString()));
        const killTimer = setTimeout(() => {
          proc.kill();
          reject(new Error("yt-dlp timed out fetching video"));
        }, 90_000);
        proc.on("close", (code) => {
          clearTimeout(killTimer);
          const line = outBuf.split("\n").find((l) => l.trim());
          if (!line) {
            return reject(new Error(errBuf.trim() || `yt-dlp exited with code ${code}`));
          }
          const [id, title, uploader, channel] = line.split("\t");
          if (!id || id === "NA") {
            return reject(new Error("Could not extract YouTube video ID"));
          }
          resolve({
            id,
            title: title && title !== "NA" ? title : "Unknown Title",
            artist: (uploader && uploader !== "NA" ? uploader : null)
                 ?? (channel && channel !== "NA" ? channel : null)
                 ?? "Unknown",
            thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
            source: "youtube",
            externalUrl: `https://www.youtube.com/watch?v=${id}`,
            videoId: id,
          });
        });
      });
      const playlistName = singleTrack.title;
      return res.json({ tracks: [singleTrack], playlistName, totalCount: 1, source: "youtube" });
    }

    const isAutoMix = /^(RD|RDAMPL|RDEM|RDCLAK)/.test(listId);
    const autoMixSeed = (listId.match(/^RD([A-Za-z0-9_-]{11})$/) ?? [])[1] ?? "";

    const candidateUrls = isAutoMix
      ? [
          autoMixSeed ? `https://www.youtube.com/watch?v=${autoMixSeed}&list=${listId}&start_radio=1` : null,
          url,
          listId ? `https://www.youtube.com/playlist?list=${listId}` : null,
        ].filter(Boolean)
      : [url];

    const fetchPlaylistViaYtDlp = (targetUrl) =>
      new Promise((resolve, reject) => {
        const ytdlpArgs = [
          "--flat-playlist",
          "--no-warnings",
          "--print", "%(playlist_title)s\t%(id)s\t%(title)s\t%(uploader)s\t%(channel)s",
          ...(isAutoMix ? ["--playlist-end", "20"] : []),
          targetUrl,
        ];

        let playlistName = "YouTube Playlist";
        const tracks = [];
        let errBuf = "";

        const proc = spawn(ytDlpBinaryPath, ytdlpArgs);

        let remainder = "";
        proc.stdout.on("data", (chunk) => {
          const text = remainder + chunk.toString();
          const lines = text.split("\n");
          remainder = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            const [pTitle, id, title, uploader, channel] = line.split("\t");
            if (!id || id === "NA") continue;
            if (pTitle && pTitle !== "NA" && playlistName === "YouTube Playlist") playlistName = pTitle;
            tracks.push({
              id,
              title: title && title !== "NA" ? title : "Unknown Title",
              artist: (uploader && uploader !== "NA" ? uploader : null)
                   ?? (channel && channel !== "NA" ? channel : null)
                   ?? "Unknown",
              thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
              source: "youtube",
              externalUrl: `https://www.youtube.com/watch?v=${id}`,
              videoId: id,
            });
          }
        });

        proc.stderr.on("data", (d) => (errBuf += d.toString()));

        const killTimer = setTimeout(() => {
          proc.kill();
          reject(new Error("yt-dlp timed out fetching playlist"));
        }, 180_000);

        proc.on("close", (code) => {
          clearTimeout(killTimer);
          if (remainder.trim()) {
            const [pTitle, id, title, uploader, channel] = remainder.split("\t");
            if (id && id !== "NA") {
              if (pTitle && pTitle !== "NA" && playlistName === "YouTube Playlist") playlistName = pTitle;
              tracks.push({
                id,
                title: title && title !== "NA" ? title : "Unknown Title",
                artist: (uploader && uploader !== "NA" ? uploader : null)
                     ?? (channel && channel !== "NA" ? channel : null)
                     ?? "Unknown",
                thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
                source: "youtube",
                externalUrl: `https://www.youtube.com/watch?v=${id}`,
                videoId: id,
              });
            }
          }

          if (code !== 0 && tracks.length === 0) {
            return reject(new Error(errBuf.trim() || `yt-dlp exited with code ${code}`));
          }
          resolve({ playlistName, tracks });
        });
      });

    let playlistName = "YouTube Playlist";
    let tracks = [];
    let lastErr = null;
    for (const candidateUrl of candidateUrls) {
      try {
        const result = await fetchPlaylistViaYtDlp(candidateUrl);
        if (result.tracks.length > 0) {
          playlistName = result.playlistName;
          tracks = result.tracks;
          break;
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[playlist] candidate failed: ${candidateUrl} — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (tracks.length === 0) {
      throw (lastErr ?? new Error("Could not fetch tracks from the provided YouTube playlist URL."));
    }

    console.log(`[playlist] YouTube "${playlistName}" — ${tracks.length} tracks`);
    return res.json({ tracks, playlistName, totalCount: tracks.length, source: "youtube" });

  } catch (err) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      console.error("[playlist] timeout:", err.message);
      return res.status(504).json({ error: "Request to external API timed out. Please try again." });
    }
    console.error("[playlist]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Search YouTube for a track query ─────────────────────────
// GET /api/search?q=Song+Title+Artist
app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query param: q" });
  }
  try {
    const results = await YoutubeSearchApi.GetListByKeyword(q, false, 5, [
      { type: "video" },
    ]);
    const videos = (results.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail?.thumbnails?.[0]?.url ?? "",
      duration: item.length?.simpleText ?? "",
    }));
    return res.json({ videos });
  } catch (err) {
    console.error("[search]", err.message);
    return res.status(500).json({ error: "Search failed", detail: err.message });
  }
});

// ── Download audio via yt-dlp ─────────────────────────────────
// GET /api/download?videoId=xxx&format=mp3&quality=best&title=TrackName
app.get("/api/download", (req, res) => {
  const { videoId, format = "mp3", quality = "best", title = "track" } = req.query;

  if (!videoId || typeof videoId !== "string") {
    return res.status(400).json({ error: "Missing query param: videoId" });
  }

  // ── Security: whitelist YouTube video ID format ──────────────
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid videoId" });
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const safeTitle = String(title).replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim() || "track";
  const asciiTitle = safeTitle.replace(/[^\x20-\x7E]/g, "_").replace(/[<>:"/\\|?*]/g, "_");

  const codecMap = { mp3: "mp3", flac: "flac", wav: "wav", m4a: "m4a", aac: "m4a" };
  const codec = codecMap[String(format)] ?? "mp3";

  const qualityMap = { best: "0", "320k": "320K", "192k": "192K", "128k": "128K" };
  const audioQuality = qualityMap[String(quality)] ?? "0";

  // Use RFC 5987 encoding to safely support any Unicode title
  const encodedTitle = encodeURIComponent(`${safeTitle}.${codec}`);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiTitle}.${codec}"; filename*=UTF-8''${encodedTitle}`
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const args = [
    url,
    "-x",
    "--audio-format", codec,
    "--audio-quality", audioQuality,
    "--ffmpeg-location", ffmpegPath,
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    "--add-header", "Sec-Fetch-Dest:empty",
    "--add-header", "Sec-Fetch-Mode:cors",
    "--add-header", "Sec-Fetch-Site:cross-site",
    "--add-header", "Referer:https://www.youtube.com/",
    "--extractor-args", "youtube:consent_required=False,age_gate=False",
    "--ignore-errors",
    "-o", "-",
    "--no-playlist",
    "--no-warnings",
    "--quiet",
  ];

  console.log(`[download] "${safeTitle}" → ${codec} @ ${audioQuality}  (${videoId})`);

  const proc = spawn(ytDlpBinaryPath, args);
  proc.stdout.pipe(res);

  // ── Process timeout: kill after 5 minutes ────────────────────
  const killTimer = setTimeout(() => {
    proc.kill("SIGTERM");
    console.warn(`[download] Killed "${safeTitle}" — 5-min timeout`);
    if (!res.headersSent) res.status(504).json({ error: "Download timed out" });
    else res.end();
  }, 5 * 60 * 1000);

  let errBuf = "";
  proc.stderr.on("data", (chunk) => (errBuf += chunk.toString()));

  proc.on("error", (err) => {
    clearTimeout(killTimer);
    console.error("[yt-dlp spawn]", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  });

  proc.on("close", (code) => {
    clearTimeout(killTimer);
    if (code !== 0) console.error(`[yt-dlp exit ${code}]`, errBuf.slice(0, 300));
  });

  req.on("close", () => { clearTimeout(killTimer); proc.kill("SIGTERM"); });
});

// ── ZIP job store ─────────────────────────────────────────────
// jobs: Map<jobId, { status, done, total, lastTrack, zipPath, safePlaylist, clients, error }>
const jobs = new Map();
const ZIP_CONCURRENCY = 6;

function broadcast(jobId, data) {
  const job = jobs.get(jobId);
  if (!job) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  job.clients.forEach((c) => c.write(msg));
}

async function downloadToTempFile(videoId, codec, audioQuality, index) {
  const tmpBase = path.join(os.tmpdir(), `sss-${Date.now()}-${index}`);
  const tmpDir = path.dirname(tmpBase);
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[dl ${index}] === Starting download ===`);
  console.log(`[dl ${index}] URL: ${sourceUrl}`);
  console.log(`[dl ${index}] Output: ${tmpBase}.%(ext)s`);
  console.log(`[dl ${index}] Codec: ${codec}, Quality: ${audioQuality}`);
  console.log(`[dl ${index}] FFmpeg location: ${ffmpegPath}`);
  console.log(`[dl ${index}] Temp directory: ${tmpDir}`);

  const baseArgs = [
    sourceUrl,
    "--force-ipv4",
    "--socket-timeout", "30",
    "--retries", "10",
    "--fragment-retries", "10",
    // Try web player first (most reliable for auth bypass)
    "--extractor-args", "youtube:player_client=web;player_skip=javascript,config",
    // Disable age gate and consent checks
    "--extractor-args", "youtube:consent_required=False,age_gate=False",
    // Modern Chrome user agent
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Add HTTP headers to look like real browser
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    "--add-header", "Sec-Fetch-Dest:empty",
    "--add-header", "Sec-Fetch-Mode:cors",
    "--add-header", "Sec-Fetch-Site:cross-site",
    "--add-header", "Referer:https://www.youtube.com/",
    // Don't abort on unavailable format
    "--ignore-errors",
    "--ffmpeg-location", ffmpegPath,
    "-o", `${tmpBase}.%(ext)s`,
    "--no-playlist",
  ];

  const runOnce = (args, label) =>
    new Promise((resolve) => {
      console.log(`[dl ${index}] Running ${label}...`);
      console.log(`[dl ${index}] Binary: ${ytDlpBinaryPath}`);
      console.log(`[dl ${index}] Binary exists: ${fs.existsSync(ytDlpBinaryPath)}`);
      console.log(`[dl ${index}] Full args: ${JSON.stringify(args)}`);
      
      let proc;
      try {
        proc = spawn(ytDlpBinaryPath, args);
      } catch (spawnErr) {
        console.error(`[dl ${index}] ❌ SPAWN ERROR: ${spawnErr.message}`);
        return resolve({ ok: false, err: spawnErr.message, out: "" });
      }

      if (!proc) {
        console.error(`[dl ${index}] ❌ SPAWN returned null`);
        return resolve({ ok: false, err: "spawn returned null", out: "" });
      }

      console.log(`[dl ${index}] Process spawned (PID: ${proc.pid})`);
      
      let outBuf = "";
      let errBuf = "";
      const killTimer = setTimeout(() => {
        proc.kill("SIGTERM");
        console.error(`[dl ${index}] ${label} timeout (10m), killed`);
      }, 10 * 60 * 1000);
      
      proc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        outBuf += text;
        console.log(`[dl ${index}] stdout: ${text.trim()}`);
      });
      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        errBuf += text;
        console.warn(`[dl ${index}] stderr: ${text.trim()}`);
      });
      proc.on("error", (err) => {
        clearTimeout(killTimer);
        console.error(`[dl ${index}] ${label} spawn error: ${err.message}`);
        resolve({ ok: false, err: err.message, out: outBuf });
      });
      proc.on("close", (code) => {
        clearTimeout(killTimer);
        
        // ALWAYS log stderr - it contains FFmpeg errors even on exit 0
        if (errBuf) {
          console.warn(`[dl ${index}] ${label} STDERR output:`);
          console.warn(errBuf.slice(0, 2000)); // Log first 2000 chars
        }
        
        if (code === 0) {
          console.log(`[dl ${index}] ${label} exit 0 ✅ (but check stderr above for FFmpeg errors)`);
          resolve({ ok: true, err: errBuf, out: outBuf }); // Include errBuf!
        } else if (code === 1) {
          // yt-dlp exits 1 for non-fatal warnings (e.g. PO Token, format fallbacks).
          // The file may still have been written — let findOutput() decide.
          console.warn(`[dl ${index}] ${label} exit 1 (soft warning), will check for output file...`);
          resolve({ ok: true, warn: true, err: errBuf, out: outBuf });
        } else {
          // exit 2+ is a hard failure (e.g. no formats, network error, killed)
          const msg = errBuf.slice(-600) || `exit code ${code}`;
          console.error(`[dl ${index}] ${label} hard exit ${code}: ${msg}`);
          resolve({ ok: false, err: msg, out: outBuf });
        }
      });
    });

  const findOutput = () =>
    new Promise((resolve) => {
      const tmpDir = path.dirname(tmpBase);
      const tmpName = path.basename(tmpBase);
      const tryFind = (attempt = 0) => {
        try {
          const allFiles = fs.readdirSync(tmpDir);
          const matches = allFiles.filter((f) => f.startsWith(tmpName));
          console.log(`[dl ${index}] Attempt ${attempt + 1}/12: Looking for ${tmpName}* in ${tmpDir} — found ${matches.length} files`);
          if (matches.length > 0) {
            console.log(`[dl ${index}]   Candidates: ${matches.join(", ")}`);
          }

          const candidates = matches
            .filter((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"))
            .map((f) => path.join(tmpDir, f));

          const existing = candidates.filter((p) => {
            try {
              const stats = fs.statSync(p);
              const size = stats.size;
              console.log(`[dl ${index}]   stat ${path.basename(p)}: ${size} bytes`);
              if (size > 0) {
                return true;
              } else {
                console.warn(`[dl ${index}]   ZERO SIZE: ${path.basename(p)}`);
              }
            } catch (e) {
              console.warn(`[dl ${index}]   stat fail ${path.basename(p)}: ${e.message}`);
            }
            return false;
          });

          if (existing.length > 0) {
            const preferredExts = codec === "m4a" ? ["m4a", "aac"] : [codec];
            const preferred = existing.find((p) =>
              preferredExts.includes(path.extname(p).slice(1).toLowerCase())
            );
            const selected = preferred ?? existing[0];
            console.log(
              `[dl ${index}] ✅  Using: ${path.basename(selected)}${preferred ? " (preferred codec match)" : ""}`
            );
            return resolve(selected);
          }
          if (attempt >= 12) {
            console.warn(`[dl ${index}] ❌  Gave up after 12 retries for ${tmpName}*`);
            // List what files ARE in tmpDir for debugging
            try {
              const allInDir = fs.readdirSync(tmpDir).slice(0, 20);
              console.warn(`[dl ${index}]   Files in ${tmpDir}: ${allInDir.join(", ")}`);
            } catch (e) {
              console.warn(`[dl ${index}]   Could not list directory: ${e.message}`);
            }
            return resolve(null);
          }

          setTimeout(() => tryFind(attempt + 1), 250);
        } catch (e) {
          console.error(`[dl ${index}] Directory error: ${e.message}`);
          resolve(null);
        }
      };
      tryFind();
    });

  // Primary attempt: extract + convert audio to the requested codec
  const primaryArgs = [
    "-f", "bestaudio/best",
    "-x",
    "--audio-format", codec,
    "--audio-quality", audioQuality,
    "-q",
    "--no-warnings",
    ...baseArgs,
  ];
  let result = await runOnce(primaryArgs, `bestaudio→${codec}`);

  // Fallback: if primary hard-failed, retry without forced player client (let yt-dlp auto-pick)
  if (!result.ok) {
    console.warn(`[dl ${index}] ⚠️  Primary attempt hard-failed, trying fallback...`);
    const fallbackArgs = [
      "-f", "bestaudio/best",
      "-x",
      "--audio-format", codec,
      "--audio-quality", audioQuality,
      "--no-warnings",
      sourceUrl,
      "--force-ipv4",
      "--socket-timeout", "30",
      "--retries", "10",
      "--fragment-retries", "10",
      // Try android player client as fallback (different code path)
      "--extractor-args", "youtube:player_client=android",
      "--user-agent", "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "--add-header", "Accept-Language:en-US,en;q=0.9",
      "--add-header", "Sec-Fetch-Dest:empty",
      "--add-header", "Sec-Fetch-Mode:cors",
      "--add-header", "Sec-Fetch-Site:cross-site",
      "--ignore-errors",
      "-o", `${tmpBase}.%(ext)s`,
      "--no-playlist",
    ];
    result = await runOnce(fallbackArgs, `fallback→${codec}`);
  }

  if (!result.ok) {
    // Check if YouTube is blocking due to bot detection
    if (result.err && result.err.includes("Sign in to confirm you're not a bot")) {
      console.error(`[dl ${index}] ❌  YouTube REQUIRES AUTHENTICATION for this content`);
      console.error(`[dl ${index}] 📌 This is a YouTube API/authentication limitation`);
      console.error(`[dl ${index}] 🔧 Solutions:`);
      console.error(`[dl ${index}]    1. Try a different video/playlist`);
      console.error(`[dl ${index}]    2. Use Spotify playlists instead (if available)`);
      console.error(`[dl ${index}]    3. Provide YouTube authentication via cookies (advanced)`);
      return null;
    }
    console.error(`[dl ${index}] ❌  All download attempts failed`);
    if (result.err) console.error(`[dl ${index}] Error: ${result.err.slice(0, 500)}`);
    return null;
  }

  console.log(`[dl ${index}] Download succeeded (exit 0), now looking for output file...`);
  console.log(`[dl ${index}] Searching for: ${tmpBase}*`);
  const output = await findOutput();
  if (output) {
    console.log(`[dl ${index}] ✅  Download complete: ${path.basename(output)}`);
    return output;
  }

  // No file found despite exit 0 — this usually means YouTube blocked the download
  console.error(`[dl ${index}] ❌  No output file found after successful exit`);
  console.error(`[dl ${index}] 🔍 DIAGNOSTIC: yt-dlp said OK but produced nothing`);
  if (result.err && result.err.length > 0) {
    const lastErr = result.err.split('\n').filter(l => l.trim()).pop();
    console.error(`[dl ${index}] 📋 Last stderr: ${lastErr}`);
    // Check all error variations
    if (lastErr.includes("Sign in") || lastErr.includes("bot") || lastErr.includes("authentication")) {
      console.error(`[dl ${index}] 🔐 REASON: YouTube authentication required`);
      console.error(`[dl ${index}] ℹ️  This video/playlist requires authentication to access`);
    }
  }
  console.error(`[dl ${index}] 💡 Try: Different video, Spotify playlist, or provide YouTube auth`);
  return null;
}

async function runDownloadJob(jobId, tracks, codec, audioQuality) {
  try {
    console.log(`[job ${jobId.slice(0,6)}] 🎬 runDownloadJob START`);
    console.log(`[job ${jobId.slice(0,6)}] Received tracks:`, tracks);
    console.log(`[job ${jobId.slice(0,6)}] Tracks array length:`, Array.isArray(tracks) ? tracks.length : "NOT AN ARRAY");
    
    const job = jobs.get(jobId);
    if (!job) {
      console.error(`[job ${jobId.slice(0,6)}] ❌ Job not found in jobs map!`);
      throw new Error("Job not found");
    }
    
    const tmpFiles = new Array(tracks.length).fill(null);
    const jobStartTime = Date.now();
    console.log(`[job ${jobId.slice(0,6)}] Downloading ${tracks.length} tracks with ${ZIP_CONCURRENCY} parallel workers`);

    if (!Array.isArray(tracks) || tracks.length === 0) {
      console.error(`[job ${jobId.slice(0,6)}] ❌ CRITICAL: tracks is not an array or is empty!`);
      broadcast(jobId, { type: "error", message: "No tracks to download" });
      return;
    }

    for (let i = 0; i < tracks.length; i += ZIP_CONCURRENCY) {
      console.log(`[job ${jobId.slice(0,6)}] Batch ${i}-${Math.min(i + ZIP_CONCURRENCY - 1, tracks.length - 1)}`);
      if (!jobs.has(jobId)) {
        console.log(`[job ${jobId.slice(0,6)}] Job cancelled, returning`);
        return;
      }
      const batch = tracks.slice(i, i + ZIP_CONCURRENCY);
      console.log(`[job ${jobId.slice(0,6)}] Processing batch of ${batch.length} tracks`);
      
      await Promise.all(
        batch.map(async ({ videoId, title = "track", artist = "" }, j) => {
          const idx = i + j;
          console.log(`[job ${jobId.slice(0,6)}] Batch map - track ${idx}, videoId: ${videoId}`);
          
          if (!videoId) {
            console.warn(`[job ${jobId.slice(0,6)}] No videoId for track ${idx}, skipping`);
            return;
          }
          // Security: validate videoId before passing to yt-dlp
          if (!/^[A-Za-z0-9_-]{1,20}$/.test(videoId)) {
            console.warn(`[job ${jobId.slice(0,6)}] Skipped invalid videoId: ${videoId}`);
            return;
          }
          const safeTitle = `${String(title)} - ${String(artist)}`
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
          console.log(`[job ${jobId.slice(0,6)}] dl ${idx + 1}/${tracks.length} – ${safeTitle}`);
          const tmpPath = await downloadToTempFile(videoId, codec, audioQuality, `${jobId}-${idx}`);
          tmpFiles[idx] = tmpPath ? { tmpPath, safeTitle } : null;
          if (!tmpPath) console.warn(`[job ${jobId.slice(0,6)}] ⚠️  download returned null for: ${safeTitle}`);
          job.done++;
          job.lastTrack = safeTitle;

        // ── Remaining time estimate ───────────────────────────
        const elapsedSec = (Date.now() - jobStartTime) / 1000;
        const avgPerTrack = elapsedSec / job.done;
        const remainingSec = Math.round(avgPerTrack * (job.total - job.done));
        const remainingText = remainingSec > 60
          ? `~${Math.ceil(remainingSec / 60)} min remaining`
          : remainingSec > 5
            ? `~${remainingSec}s remaining`
            : job.done < job.total ? "almost done" : "";

        broadcast(jobId, { type: "progress", done: job.done, total: job.total, track: safeTitle, remainingText });
      })
    );
  }

  // Build the ZIP file
  broadcast(jobId, { type: "zipping", done: job.done, total: job.total });
  const zipPath = path.join(os.tmpdir(), `sss-zip-${jobId}.zip`);
  console.log(`[job ${jobId.slice(0,6)}] Creating ZIP: ${zipPath}`);
  
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 0 } });
  archive.pipe(output);
  
  archive.on("error", (err) => console.error(`[job ${jobId.slice(0,6)}] archiver error: ${err.message}`));
  output.on("error", (err) => console.error(`[job ${jobId.slice(0,6)}] output stream error: ${err.message}`));
  
  let addedCount = 0;
  for (let i = 0; i < tmpFiles.length; i++) {
    const entry = tmpFiles[i];
    if (!entry) {
      console.log(`[job ${jobId.slice(0,6)}] Track ${i + 1}: skipped (null entry)`);
      continue;
    }
    try {
      const exists = fs.existsSync(entry.tmpPath);
      if (!exists) {
        console.warn(`[job ${jobId.slice(0,6)}] Track ${i + 1}: ⚠️  tmp file missing: ${entry.tmpPath}`);
        continue;
      }
      const stats = fs.statSync(entry.tmpPath);
      const size = stats.size;
      console.log(`[job ${jobId.slice(0,6)}] Track ${i + 1}: found ${path.basename(entry.tmpPath)} (${size} bytes)`);
      
      const actualExt = path.extname(entry.tmpPath).slice(1) || codec;
      const zipName = `${String(i + 1).padStart(2, "0")} - ${entry.safeTitle}.${actualExt}`;
      console.log(`[job ${jobId.slice(0,6)}] Track ${i + 1}: adding to ZIP as "${zipName}"`);
      archive.file(entry.tmpPath, { name: zipName });
      addedCount++;
    } catch (e) {
      console.warn(`[job ${jobId.slice(0,6)}] Track ${i + 1}: ⚠️  could not add to ZIP: ${e.message}`);
    }
  }
  console.log(`[job ${jobId.slice(0,6)}] ZIP: ${addedCount}/${tmpFiles.length} tracks added`);
  
  if (addedCount === 0) {
    await archive.abort();
    return broadcast(jobId, { type: "error", message: "All track downloads failed — ZIP would be empty" });
  }
  
  // Set up close listener BEFORE finalize to avoid race condition (0-byte ZIP)
  const zipClosePromise = new Promise((resolve, reject) => {
    output.on("close", () => {
      const stats = fs.statSync(zipPath);
      console.log(`[job ${jobId.slice(0,6)}] ZIP closed, final size: ${stats.size} bytes`);
      resolve();
    });
    output.on("error", reject);
    archive.on("error", reject);
  });
  
  console.log(`[job ${jobId.slice(0,6)}] Finalizing archive...`);
  await archive.finalize();
  await zipClosePromise;
  
  for (const e of tmpFiles) {
    if (e?.tmpPath) {
      fs.unlink(e.tmpPath, (err) => {
        if (err) console.warn(`[job ${jobId.slice(0,6)}] Could not delete temp file: ${e.tmpPath}`);
      });
    }
  }

  job.zipPath = zipPath;
  job.status = "done";
  broadcast(jobId, { type: "done" });
  // close SSE connections
  job.clients.forEach((c) => c.end());
  job.clients = [];
  console.log(`[job ${jobId.slice(0,6)}] ✅  done → ${job.safePlaylist}.zip (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Auto-cleanup after 10 min
  setTimeout(() => {
    const j = jobs.get(jobId);
    if (j?.zipPath) fs.unlink(j.zipPath, () => {});
    jobs.delete(jobId);
  }, 10 * 60 * 1000);
  } catch (err) {
    console.error(`[job ${jobId.slice(0,6)}] 💥 UNHANDLED ERROR IN runDownloadJob:`, err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "error";
      job.error = err.message;
      broadcast(jobId, { type: "error", message: `Critical error: ${err.message}` });
      job.clients.forEach((c) => c.end());
    }
    throw err;
  }
}

// POST /api/download-zip – start job, return jobId immediately
app.post("/api/download-zip", (req, res) => {
  const { tracks = [], format = "mp3", quality = "best", playlistName = "playlist" } = req.body;
  if (!Array.isArray(tracks) || tracks.length === 0)
    return res.status(400).json({ error: "tracks array is required" });

  const codecMap = { mp3: "mp3", flac: "flac", wav: "wav", m4a: "m4a", aac: "m4a" };
  const codec = codecMap[String(format)] ?? "mp3";
  const qualityMap = { best: "0", "320k": "320K", "192k": "192K", "128k": "128K" };
  const audioQuality = qualityMap[String(quality)] ?? "0";
  const safePlaylist = String(playlistName).replace(/[<>:"/\\|?*]/g, "").trim() || "playlist";
  const jobId = crypto.randomUUID();

  console.log(`[job ${jobId.slice(0,6)}] === NEW REQUEST ===`);
  console.log(`[job ${jobId.slice(0,6)}] Tracks: ${tracks.length}, Codec: ${codec}, Quality: ${audioQuality}`);

  jobs.set(jobId, { status: "running", done: 0, total: tracks.length, lastTrack: "", zipPath: null, safePlaylist, clients: [], error: null });
  console.log(`[job ${jobId.slice(0,6)}] started – ${tracks.length} tracks → ${safePlaylist}.zip @ ${codec}/${audioQuality}`);

  runDownloadJob(jobId, tracks, codec, audioQuality).catch((err) => {
    console.error(`[job ${jobId.slice(0,6)}] 🔥 CAUGHT ERROR:`, err);
    const job = jobs.get(jobId);
    if (job) { job.status = "error"; job.error = err.message; }
    broadcast(jobId, { type: "error", message: err.message });
    jobs.get(jobId)?.clients.forEach((c) => c.end());
    console.error(`[job ${jobId.slice(0,6)}] error:`, err.message);
  }).finally(() => {
    console.log(`[job ${jobId.slice(0,6)}] runDownloadJob completed (success or error)`);
  });

  console.log(`[job ${jobId.slice(0,6)}] Job enqueued, returning jobId to frontend`);
  res.json({ jobId });
});

// GET /api/progress/:jobId – SSE stream of download progress
app.get("/api/progress/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // If already finished, reply immediately
  if (job.status === "done") {
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end(); return;
  }
  if (job.status === "error") {
    res.write(`data: ${JSON.stringify({ type: "error", message: job.error })}\n\n`);
    res.end(); return;
  }
  // Send current snapshot so client isn't blank if it connects mid-job
  if (job.done > 0) {
    res.write(`data: ${JSON.stringify({ type: "progress", done: job.done, total: job.total, track: job.lastTrack })}\n\n`);
  }

  job.clients.push(res);
  req.on("close", () => { job.clients = job.clients.filter((c) => c !== res); });
});

// GET /api/download-zip/file/:jobId – serve the finished ZIP
app.get("/api/download-zip/file/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done" || !job.zipPath)
    return res.status(404).json({ error: "ZIP not ready" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${job.safePlaylist}.zip"`);
  const stream = fs.createReadStream(job.zipPath);
  stream.pipe(res);
  stream.on("end", () => {
    fs.unlink(job.zipPath, () => {});
    jobs.delete(req.params.jobId);
  });
});

// ── Spotify token proxy (avoids CORS + hides client secret) ──
// POST /api/spotify/token  body: { clientId?, clientSecret? }
// Prefers server-side env vars (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)
// so the secret is never exposed in the browser bundle.

app.post("/api/spotify/token", async (req, res) => {
  // Use server env if available; fall back to values sent by the client
  const clientId = process.env.SPOTIFY_CLIENT_ID || req.body.clientId;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || req.body.clientSecret;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: "Spotify credentials not configured" });
  }

  // Return cached token if it still has >60 s remaining
  if (_cachedSpotifyToken && Date.now() < _cachedSpotifyTokenExpiresAt - 60_000) {
    return res.json({ access_token: _cachedSpotifyToken, expires_in: Math.floor((_cachedSpotifyTokenExpiresAt - Date.now()) / 1000) });
  }

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });
    const data = await tokenRes.json();
    if (data.access_token) {
      _cachedSpotifyToken = data.access_token;
      _cachedSpotifyTokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ensureYtDlp()
  .then(() => checkFFmpeg())
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`\n🎵  Sound Switch Studio backend → http://0.0.0.0:${PORT}\n`)
    );
  })
  .catch((err) => {
    console.error("❌  Failed to init:", err?.message ?? err);
    process.exit(1);
  });
