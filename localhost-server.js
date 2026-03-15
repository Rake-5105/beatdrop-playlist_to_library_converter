#!/usr/bin/env node

/**
 * Sound Switch Studio - Localhost Test Server
 * 
 * Copyright © 2026 Rakesh Kannan C K. All rights reserved.
 * 
 * This file is part of Sound Switch Studio and is provided as-is
 * for personal and educational use only. Unauthorized copying,
 * distribution, or modification is strictly prohibited.
 * 
 * Simple hardcoded localhost server for testing downloads.
 * Just works - no environment variables, no complex logic.
 */
 */

const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const { SSE } = require("express-sse");

const app = express();
const PORT = 3000;

const DOWNLOAD_DIR = path.join(os.homedir(), "Downloads", "sss-downloads");

// Create download directory if it doesn't exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

console.log(`📁 Downloads will be saved to: ${DOWNLOAD_DIR}`);

// ============================================
// HARDCODED TRACKS - Edit these
// ============================================
const HARDCODED_TRACKS = [
  {
    videoId: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up",
  },
  // Add more here! Example:
  // { videoId: "jNQXAC9IVRw", title: "Me at the zoo" },
];

// ============================================
// Routes
// ============================================

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", tracks: HARDCODED_TRACKS.length });
});

// Get playlist info
app.get("/api/playlist", (req, res) => {
  res.json({
    name: "Test Playlist",
    tracks: HARDCODED_TRACKS,
    count: HARDCODED_TRACKS.length,
  });
});

// Download playlist
app.post("/api/download-zip", (req, res) => {
  const { codec = "mp3", audioQuality = "192" } = req.body || {};
  const jobId = `job-${Date.now()}`;
  const zipPath = path.join(DOWNLOAD_DIR, `playlist-${jobId}.zip`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendSSE = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  (async () => {
    try {
      sendSSE("start", {
        message: "Starting download",
        total: HARDCODED_TRACKS.length,
      });

      const downloadedFiles = [];
      let successCount = 0;

      // Download each track
      for (let i = 0; i < HARDCODED_TRACKS.length; i++) {
        const track = HARDCODED_TRACKS[i];
        const index = i + 1;

        sendSSE("progress", {
          current: i,
          total: HARDCODED_TRACKS.length,
          message: `Downloading: ${track.title}`,
        });

        const file = await downloadTrack(
          track.videoId,
          track.title,
          codec,
          audioQuality
        );

        if (file) {
          downloadedFiles.push(file);
          successCount++;
          sendSSE("track_done", {
            index,
            title: track.title,
            file: path.basename(file),
          });
        } else {
          sendSSE("track_error", {
            index,
            title: track.title,
          });
        }
      }

      if (downloadedFiles.length === 0) {
        sendSSE("error", { message: "❌ No tracks downloaded" });
        res.end();
        return;
      }

      // Create ZIP
      sendSSE("zipping", {
        message: `Creating ZIP with ${downloadedFiles.length} files`,
      });

      await createZipFromFiles(downloadedFiles, zipPath);

      sendSSE("complete", {
        message: "✅ Download complete",
        file: `playlist-${jobId}.zip`,
        size: fs.statSync(zipPath).size,
        tracks: downloadedFiles.length,
      });

      res.end();
    } catch (err) {
      console.error("Download error:", err.message);
      sendSSE("error", { message: err.message });
      res.end();
    }
  })();
});

// Download individual track (direct)
app.post("/api/download-single", (req, res) => {
  const { videoId, title, codec = "mp3", audioQuality = "192" } = req.body;

  if (!videoId || !title) {
    return res.status(400).json({ error: "Missing videoId or title" });
  }

  res.setHeader("Content-Disposition", `attachment; filename="${title}.mp3"`);
  res.setHeader("Content-Type", "audio/mpeg");

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-x",
    "--audio-format",
    codec,
    "--audio-quality",
    audioQuality,
    "--user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "--add-header",
    "Referer:https://www.youtube.com/",
    "-o",
    "-",
    "--no-playlist",
    "--no-warnings",
    "--quiet",
  ];

  console.log(`📥 Streaming: ${title}`);

  const proc = spawn("yt-dlp", args);
  proc.stdout.pipe(res);

  proc.on("error", (err) => {
    console.error(`Error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  });

  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
    }
  });
});

// ============================================
// Helper Functions
// ============================================

function downloadTrack(videoId, title, codec, audioQuality) {
  return new Promise((resolve) => {
    const tempFile = path.join(DOWNLOAD_DIR, `${Date.now()}-${videoId}.mp3`);

    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      "-x",
      "--audio-format",
      codec,
      "--audio-quality",
      audioQuality,
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "--add-header",
      "Referer:https://www.youtube.com/",
      "-o",
      tempFile.replace(".mp3", ""),
      "--no-playlist",
      "--no-warnings",
    ];

    const proc = spawn("yt-dlp", args);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Find the actual output file
        const dir = path.dirname(tempFile);
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.startsWith(path.basename(tempFile.replace(".mp3", "").replace(/-\d+$/, ""))));

        if (files.length > 0) {
          const actualFile = path.join(dir, files[0]);
          resolve(actualFile);
        } else {
          console.error(`File not found for: ${title}`);
          resolve(null);
        }
      } else {
        console.error(`Failed to download ${title}`);
        if (stderr.includes("Sign in")) {
          console.error("  → YouTube blocked (authentication required)");
        }
        resolve(null);
      }
    });

    proc.on("error", (err) => {
      console.error(`Spawn error: ${err.message}`);
      resolve(null);
    });
  });
}

function createZipFromFiles(files, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");

    output.on("close", () => {
      console.log(`✅ ZIP created: ${zipPath}`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    files.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    archive.finalize();
  });
}

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🎵 SSS - Localhost Test Server       ║
╚════════════════════════════════════════╝

📍 Server: http://localhost:${PORT}
📁 Downloads: ${DOWNLOAD_DIR}
🎬 Tracks: ${HARDCODED_TRACKS.length}

Endpoints:
  GET  /api/health          - Health check
  GET  /api/playlist        - Get playlist info
  POST /api/download-zip    - Download all tracks as ZIP (SSE)
  POST /api/download-single - Download single track

Edit HARDCODED_TRACKS in this file to change what downloads!
`);
});
