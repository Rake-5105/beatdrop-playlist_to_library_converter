#!/usr/bin/env node

/**
 * Simple hardcoded test script for downloading tracks to localhost
 * No Render, no Netlify, just pure local testing
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const ytDlpWrap = require("yt-dlp-wrap").default;
const archiver = require("archiver");

const DOWNLOAD_DIR = path.join(os.homedir(), "Downloads", "sss-test");
const ZIP_OUTPUT = path.join(DOWNLOAD_DIR, "playlist.zip");

// Create download directory
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// HARDCODED TRACKS - Replace with actual YouTube video IDs
const TRACKS = [
  { videoId: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up" },
  // Add more here
];

const ytDlpBinaryPath = "yt-dlp"; // Uses system yt-dlp

console.log("🎵 Sound Switch Studio - Local Test Downloader");
console.log(`📁 Download directory: ${DOWNLOAD_DIR}`);
console.log(`🎬 Tracks to download: ${TRACKS.length}`);
console.log("");

async function downloadTrack(videoId, title) {
  return new Promise((resolve) => {
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(DOWNLOAD_DIR, `%(title)s.%(ext)s`);

    console.log(`⬇️  Downloading: ${title}`);

    const args = [
      sourceUrl,
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "192",
      "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "--add-header", "Accept-Language:en-US,en;q=0.9",
      "--add-header", "Referer:https://www.youtube.com/",
      "-o", outputPath,
      "--no-playlist",
      "--no-warnings",
    ];

    console.log(`   Command: yt-dlp ${args.slice(0, 3).join(" ")} [...]`);

    let stdout = "";
    let stderr = "";

    const proc = spawn(ytDlpBinaryPath, args);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(".");
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      console.log("");
      if (code === 0) {
        console.log(`✅  ${title} downloaded`);
        resolve(true);
      } else {
        console.error(`❌  Failed to download ${title}`);
        if (stderr) console.error(`   Error: ${stderr.slice(0, 200)}`);
        resolve(false);
      }
    });

    proc.on("error", (err) => {
      console.error(`❌  Error spawning yt-dlp: ${err.message}`);
      resolve(false);
    });
  });
}

async function createZip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ZIP_OUTPUT);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`\n✅  ZIP created: ${ZIP_OUTPUT} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on("error", (err) => {
      console.error(`❌  ZIP error: ${err.message}`);
      reject(err);
    });

    archive.pipe(output);

    // Add all mp3 files from download directory
    const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".mp3"));
    console.log(`📦  Zipping ${files.length} files...`);

    files.forEach((file) => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      archive.file(filePath, { name: file });
    });

    archive.finalize();
  });
}

async function main() {
  try {
    // Check if yt-dlp is available
    const version = await ytDlpWrap.getVersion();
    console.log(`✅  yt-dlp version: ${version}\n`);

    // Download all tracks
    let successCount = 0;
    for (const track of TRACKS) {
      const success = await downloadTrack(track.videoId, track.title);
      if (success) successCount++;
      console.log("");
    }

    console.log(`\n📊 Downloaded: ${successCount}/${TRACKS.length} tracks`);

    if (successCount > 0) {
      await createZip();
      console.log(`\n🎉 Done! Open: ${ZIP_OUTPUT}`);
    } else {
      console.log("\n⚠️  No tracks downloaded");
    }
  } catch (err) {
    console.error("Fatal error:", err.message);
    process.exit(1);
  }
}

main();
