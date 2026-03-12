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
const PORT = 3001;

// ── yt-dlp binary ────────────────────────────────────────────
const ytDlpBinaryPath = path.join(__dirname, "yt-dlp.exe");
const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);

// Browser whose cookie store yt-dlp uses to bypass YouTube bot detection.
// Set YOUTUBE_COOKIES_BROWSER in .env → edge | chrome | firefox | brave
const COOKIES_BROWSER = process.env.YOUTUBE_COOKIES_BROWSER || "firefox";
console.log(`🍪  Cookie browser: ${COOKIES_BROWSER}`);

function cookiesArg() {
  return ["--cookies-from-browser", COOKIES_BROWSER];
}

async function ensureYtDlp() {
  try {
    const version = await ytDlpWrap.getVersion();
    console.log(`✅  yt-dlp ready (${version})`);
  } catch {
    console.log("⬇️  Downloading yt-dlp binary (one-time)...");
    await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
    const version = await ytDlpWrap.getVersion();
    console.log(`✅  yt-dlp downloaded (${version})`);
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
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

function downloadToTempFile(videoId, codec, audioQuality, index) {
  const tmpBase = path.join(os.tmpdir(), `sss-${Date.now()}-${index}`);
  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-x", "--audio-format", codec, "--audio-quality", audioQuality,
    "--ffmpeg-location", ffmpegPath,
    ...cookiesArg(),
    "-o", `${tmpBase}.%(ext)s`,
    "--no-playlist", "--no-warnings", "--quiet",
  ];
  return new Promise((resolve) => {
    const proc = spawn(ytDlpBinaryPath, args);
    let errBuf = "";
    // Kill if still running after 5 min
    const killTimer = setTimeout(() => {
      proc.kill("SIGTERM");
      console.warn(`[dl ${index}] 5-min timeout, killed`);
    }, 5 * 60 * 1000);
    proc.stderr.on("data", (chunk) => (errBuf += chunk.toString()));
    proc.on("error", (err) => { clearTimeout(killTimer); console.error(`[dl ${index}] spawn:`, err.message); resolve(null); });
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      if (code !== 0) { console.error(`[dl ${index}] exit ${code}:`, errBuf.slice(-400)); resolve(null); return; }
      const tmpDir = path.dirname(tmpBase);
      const tmpName = path.basename(tmpBase);
      try {
        const match = fs.readdirSync(tmpDir).find((f) => f.startsWith(tmpName));
        resolve(match ? path.join(tmpDir, match) : null);
      } catch { resolve(null); }
    });
  });
}

async function runDownloadJob(jobId, tracks, codec, audioQuality) {
  const job = jobs.get(jobId);
  const tmpFiles = new Array(tracks.length).fill(null);

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
        job.done++;
        job.lastTrack = safeTitle;
        broadcast(jobId, { type: "progress", done: job.done, total: job.total, track: safeTitle });
      })
    );
  }

  // Build the ZIP file
  broadcast(jobId, { type: "zipping", done: job.done, total: job.total });
  const zipPath = path.join(os.tmpdir(), `sss-zip-${jobId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 0 } });
  archive.pipe(output);
  archive.on("error", (err) => console.error("[archiver]", err.message));
  for (let i = 0; i < tmpFiles.length; i++) {
    const entry = tmpFiles[i];
    if (!entry) continue;
    const actualExt = path.extname(entry.tmpPath).slice(1) || codec;
    archive.file(entry.tmpPath, { name: `${String(i + 1).padStart(2, "0")} - ${entry.safeTitle}.${actualExt}` });
  }
  await archive.finalize();
  await new Promise((r) => output.on("close", r));
  for (const e of tmpFiles) { if (e?.tmpPath) fs.unlink(e.tmpPath, () => {}); }

  job.zipPath = zipPath;
  job.status = "done";
  broadcast(jobId, { type: "done" });
  // close SSE connections
  job.clients.forEach((c) => c.end());
  job.clients = [];
  console.log(`[job ${jobId.slice(0,6)}] done → ${job.safePlaylist}.zip`);

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
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

ensureYtDlp()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`\n🎵  Sound Switch Studio backend → http://localhost:${PORT}\n`)
    );
  })
  .catch((err) => {
    console.error("❌  Failed to init yt-dlp:", err.message);
    process.exit(1);
  });
