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

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDlpWrap = require("yt-dlp-wrap").default;
const YoutubeSearchApi = require("youtube-search-api");
const ffmpegPath = require("ffmpeg-static");

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
console.log(`🍪  Cookie browser: ${COOKIES_BROWSER ?? "(none — set YOUTUBE_COOKIES_BROWSER in .env)"}`);
if (_rawBrowser && !COOKIES_BROWSER) console.warn(`⚠️  Invalid YOUTUBE_COOKIES_BROWSER value: "${_rawBrowser}" — ignoring`);

function cookiesArg() {
  return COOKIES_BROWSER ? ["--cookies-from-browser", COOKIES_BROWSER] : [];
}

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
    return res.status(400).json({ error: "URL must be a Spotify or YouTube playlist link." });
  }

  try {
    if (isSpotify) {
      const match = url.match(/playlist\/([A-Za-z0-9]+)/);
      const playlistId = match?.[1];
      if (!playlistId) return res.status(400).json({ error: "Invalid Spotify playlist URL." });

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

    // ── YouTube via yt-dlp (works with private/unlisted/any playlist) ──
    console.log(`[playlist] Fetching YouTube playlist via yt-dlp: ${url}`);

    // Cap auto-generated mixes (RD...) at 100 tracks — they can be endless
    const listId = (url.match(/[?&]list=([A-Za-z0-9_-]+)/) ?? [])[1] ?? "";
    const isAutoMix = /^(RD|RDAMPL|RDEM|RDCLAK)/.test(listId);

    const ytdlpArgs = [
      "--flat-playlist",
      "--no-warnings",
      "--print", "%(playlist_title)s\t%(id)s\t%(title)s\t%(uploader)s\t%(channel)s",
      ...(isAutoMix ? ["--playlist-end", "50"] : []),
      url,
    ];

    const { playlistName, tracks } = await new Promise((resolve, reject) => {
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

      proc.on("close", (code) => {
        // flush remainder
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

      setTimeout(() => { proc.kill(); reject(new Error("yt-dlp timed out fetching playlist")); }, 180_000);
    });

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
    ...cookiesArg(),
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
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const baseArgs = [
    sourceUrl,
    "--force-ipv4",
    "--socket-timeout", "30",
    "--retries", "8",
    "--fragment-retries", "8",
    "--extractor-args", "youtube:player_client=android,web",
    ...cookiesArg(),
    "-o", `${tmpBase}.%(ext)s`,
    "--no-playlist",
  ];

  const runOnce = (args, label) =>
    new Promise((resolve) => {
      console.log(`[dl ${index}] Running ${label}: ${ytDlpBinaryPath} ${args.slice(0, 5).join(" ")} ...`);
      const proc = spawn(ytDlpBinaryPath, args);
      let outBuf = "";
      let errBuf = "";
      const killTimer = setTimeout(() => {
        proc.kill("SIGTERM");
        console.error(`[dl ${index}] ${label} timeout (10m), killed`);
      }, 10 * 60 * 1000);
      proc.stdout.on("data", (chunk) => (outBuf += chunk.toString()));
      proc.stderr.on("data", (chunk) => (errBuf += chunk.toString()));
      proc.on("error", (err) => {
        clearTimeout(killTimer);
        console.error(`[dl ${index}] ${label} spawn error: ${err.message}`);
        resolve({ ok: false, err: err.message, out: outBuf });
      });
      proc.on("close", (code) => {
        clearTimeout(killTimer);
        if (code === 0) {
          console.log(`[dl ${index}] ${label} exit 0 - checking output...`);
          if (outBuf) console.log(`[dl ${index}] stdout: ${outBuf.slice(0, 200)}`);
          resolve({ ok: true, err: "", out: outBuf });
        } else {
          const msg = errBuf.slice(-600) || `exit code ${code}`;
          console.error(`[dl ${index}] ${label} exit ${code}: ${msg}`);
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
              }
            } catch (e) {
              console.warn(`[dl ${index}]   stat fail ${path.basename(p)}: ${e.message}`);
            }
            return false;
          });

          if (existing.length > 0) {
            console.log(`[dl ${index}] ✅  Using: ${path.basename(existing[0])}`);
            return resolve(existing[0]);
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

  const bestaudioArgs = [
    "-f", "bestaudio/best",
    "-q",
    "--no-warnings",
    ...baseArgs,
  ];
  const result = await runOnce(bestaudioArgs, "bestaudio");
  if (!result.ok) {
    console.error(`[dl ${index}] ❌  bestaudio failed: ${result.err}`);
    return null;
  }

  console.log(`[dl ${index}] bestaudio succeeded, now looking for output file...`);
  const output = await findOutput();
  if (output) {
    console.log(`[dl ${index}] ✅  Download complete: ${path.basename(output)}`);
    return output;
  }

  console.error(`[dl ${index}] ❌  No output file found after successful exit`);
  return null;
}

async function runDownloadJob(jobId, tracks, codec, audioQuality) {
  const job = jobs.get(jobId);
  const tmpFiles = new Array(tracks.length).fill(null);
  const jobStartTime = Date.now();

  for (let i = 0; i < tracks.length; i += ZIP_CONCURRENCY) {
    if (!jobs.has(jobId)) return; // cancelled
    const batch = tracks.slice(i, i + ZIP_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ videoId, title = "track", artist = "" }, j) => {
        const idx = i + j;
        if (!videoId) return;
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

  jobs.set(jobId, { status: "running", done: 0, total: tracks.length, lastTrack: "", zipPath: null, safePlaylist, clients: [], error: null });
  console.log(`[job ${jobId.slice(0,6)}] started – ${tracks.length} tracks → ${safePlaylist}.zip @ ${codec}/${audioQuality}`);

  runDownloadJob(jobId, tracks, codec, audioQuality).catch((err) => {
    const job = jobs.get(jobId);
    if (job) { job.status = "error"; job.error = err.message; }
    broadcast(jobId, { type: "error", message: err.message });
    jobs.get(jobId)?.clients.forEach((c) => c.end());
    console.error(`[job ${jobId.slice(0,6)}] error:`, err.message);
  });

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
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`\n🎵  Sound Switch Studio backend → http://0.0.0.0:${PORT}\n`)
    );
  })
  .catch((err) => {
    console.error("❌  Failed to init yt-dlp:", err?.message ?? err);
    process.exit(1);
  });
