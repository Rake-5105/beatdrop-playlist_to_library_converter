/**
 * Sound Switch Studio - API Service Layer
 * 
 * Copyright © 2026 Rakesh Kannan C K. All rights reserved.
 * 
 * This file is part of Sound Switch Studio and is provided as-is
 * for personal and educational use only. Unauthorized copying,
 * distribution, or modification is strictly prohibited.
 * 
 * Backend credentials live in .env.local (copy .env.example).
 * Do not put secrets in VITE_* variables.
 */
//
// Start BOTH servers:  npm run dev:full
// ============================================================

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  source?: "spotify" | "youtube";
  externalUrl?: string;
  /** YouTube video ID used for real audio downloads */
  videoId?: string;
}

export interface ConversionResult {
  tracks: Track[];
  playlistName: string;
  totalCount: number;
  source: "spotify" | "youtube";
  isDemo?: boolean;
}

const RAW_BACKEND = import.meta.env.VITE_API_BASE_URL?.trim();
const IS_LOCALHOST =
  typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const BACKEND = RAW_BACKEND
  ? RAW_BACKEND.replace(/\/+$/, "")
  : IS_LOCALHOST
    ? "http://localhost:3001"
    : "";

console.log("🔧 Backend configuration:", {
  RAW_BACKEND,
  IS_LOCALHOST,
  BACKEND,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});

function getBackendBaseUrl(): string {
  if (BACKEND) {
    console.log("✅ Using backend:", BACKEND);
    return BACKEND;
  }
  const msg = "❌ CRITICAL: Frontend backend URL is not configured!\n\n" +
    "✅ TO FIX:\n" +
    "1. Go to Netlify Dashboard → Site Settings → Build & Deploy → Environment\n" +
    "2. Add environment variable:\n" +
    "   Key: VITE_API_BASE_URL\n" +
    "   Value: https://your-backend.onrender.com\n" +
    "3. Redeploy the site\n\n" +
    "Without this, the frontend cannot connect to the download backend.";
  console.error(msg);
  throw new Error(msg);
}

// ── Backend health check (cached 10 s so it never blocks twice) ──
let _backendOk: boolean | null = null;
let _backendCheckedAt = 0;
export async function isBackendRunning(): Promise<boolean> {
  const now = Date.now();
  if (_backendOk !== null && now - _backendCheckedAt < 10_000) return _backendOk;
  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) });
    _backendOk = res.ok;
  } catch {
    _backendOk = false;
  }
  _backendCheckedAt = Date.now();
  return _backendOk;
}

// ── Search YouTube for a track title+artist → returns videoId ─
export async function searchYouTube(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${getBackendBaseUrl()}/api/search?q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    return data.videos?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ── Download a single track (real audio via backend) ─────────
export function getDownloadUrl(videoId: string, format: string, title: string, quality = "best"): string {
  const backend = getBackendBaseUrl();
  return `${backend}/api/download?videoId=${encodeURIComponent(videoId)}&format=${encodeURIComponent(format)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
}

export async function downloadTrack(
  track: Track,
  format: string,
  onError?: (msg: string) => void,
  quality = "best"
): Promise<void> {
  let vid = track.videoId;

  // For Spotify tracks without a videoId, search YouTube first
  if (!vid && track.source === "spotify") {
    vid = (await searchYouTube(`${track.title} ${track.artist}`)) ?? undefined;
  }

  // For YouTube tracks, the track.id IS the videoId
  if (!vid && track.source === "youtube") {
    vid = track.id;
  }

  if (!vid) {
    onError?.(`Could not find "${track.title}" on YouTube.`);
    return;
  }

  const url = getDownloadUrl(vid, format, `${track.title} - ${track.artist}`, quality);
  const filename = `${track.title} - ${track.artist}.${format}`;

  try {
    // Fetch the file as a blob so every track actually downloads.
    // Using a.click() in a loop only triggers the last download because
    // browsers block rapid programmatic navigations.
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Release the blob URL after a tick so the browser can start the download
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    onError?.(`Failed to download "${track.title}": ${msg}`);
  }
}

// ── Download all tracks as one ZIP, with real-time SSE progress ──
export async function downloadAllTracks(
  tracks: Track[],
  format: string,
  onProgress: (done: number, total: number) => void,
  onError?: (msg: string, track: Track) => void,
  playlistName = "playlist",
  onStatusMessage?: (msg: string) => void,
  quality = "best"
): Promise<void> {
  try {
    console.log("🎬 downloadAllTracks START", { tracksCount: tracks.length, format, quality });
    
    // Phase 1: resolve YouTube videoIds IN PARALLEL (no bar movement, just status text)
    const RESOLVE_CONCURRENCY = 4;
    onProgress(0, 100);
    onStatusMessage?.("Finding tracks on YouTube…");

    const resolvedSlots: ({ videoId: string; title: string; artist: string } | null)[] =
      new Array(tracks.length).fill(null);
    let resolvedCount = 0;

    for (let i = 0; i < tracks.length; i += RESOLVE_CONCURRENCY) {
      const batch = tracks.slice(i, i + RESOLVE_CONCURRENCY);
      console.log(`🔍 Resolving batch ${i}-${i + batch.length - 1}`);
      
      await Promise.all(
        batch.map(async (track, j) => {
          const idx = i + j;
          try {
            let vid = track.videoId;
            console.log(`  [${idx}] Starting resolution for "${track.title}" (source: ${track.source})`);
            
            if (!vid && track.source === "spotify") {
              console.log(`  [${idx}] Searching YouTube for Spotify track...`);
              vid = (await searchYouTube(`${track.title} ${track.artist}`)) ?? undefined;
              if (vid) console.log(`  [${idx}] ✅ Found: ${vid}`);
              else console.log(`  [${idx}] ❌ Not found on YouTube`);
            }
            if (!vid && track.source === "youtube") {
              console.log(`  [${idx}] Using YouTube track ID directly`);
              vid = track.id;
            }
            if (!vid) {
              console.warn(`  [${idx}] ❌ Could not resolve: "${track.title}"`);
              onError?.(`Could not find "${track.title}" on YouTube — skipped.`, track);
              return;
            }
            resolvedSlots[idx] = { videoId: vid, title: track.title, artist: track.artist };
            resolvedCount++;
            console.log(`  [${idx}] ✅ Resolved (${resolvedCount}/${tracks.length})`);
            onStatusMessage?.(`Finding tracks… ${resolvedCount}/${tracks.length}`);
          } catch (err) {
            console.error(`  [${idx}] 🔥 Error during resolution:`, err);
            onError?.(`Error resolving "${track.title}": ${err instanceof Error ? err.message : String(err)}`, track);
          }
        })
      );
    }

    const resolved = resolvedSlots.filter(
      (x): x is { videoId: string; title: string; artist: string } => x !== null
    );
    console.log(`📦 Resolved ${resolved.length}/${tracks.length} tracks`);
    
    if (resolved.length === 0) {
      console.error("❌ NO TRACKS RESOLVED!");
      throw new Error("No tracks could be resolved to a YouTube video.");
    }

    // Phase 2: start background job — progress bar resets to 0 and goes to 100%
    onProgress(0, resolved.length);
    onStatusMessage?.(`Starting download of ${resolved.length} tracks… (this may take 10–15 minutes)`);
    console.log(`🚀 Sending download request for ${resolved.length} tracks`);

    const backend = getBackendBaseUrl();
    console.log(`📡 Backend URL: ${backend}`);
    console.log(`📤 POST /api/download-zip with:`, { tracksCount: resolved.length, format, quality, playlistName });
    
    const startRes = await fetch(`${backend}/api/download-zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: resolved, format, quality, playlistName }),
    });
    
    console.log(`📥 Response status:`, startRes.status, startRes.statusText);
    console.log(`📥 Response headers:`, {
      contentType: startRes.headers.get("content-type"),
      contentLength: startRes.headers.get("content-length"),
    });
    
    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error(`❌ POST failed, response body:`, errText);
      try {
        const err = JSON.parse(errText);
        throw new Error(err.error ?? "Failed to start ZIP job");
      } catch {
        throw new Error(`Failed to start ZIP job: ${errText || startRes.statusText}`);
      }
    }
    
    const responseText = await startRes.text();
    console.log(`📥 Raw response body:`, responseText);
    
    let jobId;
    try {
      const json = JSON.parse(responseText);
      jobId = json.jobId;
    } catch (e) {
      console.error(`❌ Failed to parse response as JSON:`, e);
      throw new Error(`Invalid response from server: ${responseText}`);
    }
    
    if (!jobId) {
      console.error(`❌ No jobId in response:`, responseText);
      throw new Error("Server did not return a jobId");
    }
    console.log(`✅ Job created:`, jobId);

    // Phase 2: SSE progress — bar goes 0 → 100% over actual downloads
    await new Promise<void>((resolve, reject) => {
      console.log(`🎧 Opening SSE connection: /api/progress/${jobId}`);
      const evtSource = new EventSource(`${backend}/api/progress/${jobId}`);

      evtSource.onmessage = async (e) => {
        let data: { type: string; done?: number; total?: number; track?: string; message?: string; remainingText?: string };
        try { data = JSON.parse(e.data); } catch { return; }

        console.log(`📊 SSE message:`, data.type);

        if (data.type === "progress" && data.done != null && data.total != null) {
          onProgress(data.done, data.total);
          const timeLabel = data.remainingText ? ` — ${data.remainingText}` : "";
          onStatusMessage?.(`Downloading ${data.done}/${data.total}: ${data.track ?? ""}${timeLabel}`);

        } else if (data.type === "zipping") {
          onProgress(resolved.length - 1, resolved.length);
          onStatusMessage?.("Building ZIP archive…");

        } else if (data.type === "done") {
          console.log(`✅ Download complete, fetching ZIP file...`);
          evtSource.close();
          onProgress(resolved.length, resolved.length);
          onStatusMessage?.("Preparing download…");

          try {
            const fileRes = await fetch(`${backend}/api/download-zip/file/${jobId}`);
            if (!fileRes.ok) throw new Error("ZIP file not available");
            const blob = await fileRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${playlistName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            resolve();
          } catch (err) {
            reject(err);
          }

        } else if (data.type === "error") {
          console.error(`❌ SSE error:`, data.message);
          evtSource.close();
          reject(new Error(data.message ?? "ZIP job failed"));
        }
      };

      evtSource.onerror = () => {
        console.error(`❌ SSE connection error`);
        evtSource.close();
        reject(new Error("Lost connection to download server"));
      };
    });
    
    console.log(`🎉 downloadAllTracks COMPLETE`);
  } catch (err) {
    console.error(`💥 downloadAllTracks ERROR:`, err);
    throw err;
  }
}


// ── Fetch Spotify playlist ────────────────────────────────────
export async function fetchSpotifyPlaylist(url: string): Promise<ConversionResult> {
  const res = await fetch(`${getBackendBaseUrl()}/api/playlist?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data as ConversionResult;
}

// ── Fetch YouTube playlist ────────────────────────────────────
export async function fetchYouTubePlaylist(url: string): Promise<ConversionResult> {
  const res = await fetch(`${getBackendBaseUrl()}/api/playlist?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(180_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data as ConversionResult;
}

// ── Orchestrator ─────────────────────────────────────────────
export async function convertPlaylist(url: string): Promise<ConversionResult> {
  const isSpotify = url.includes("spotify.com");
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  if (!isSpotify && !isYoutube) {
    throw new Error("Unsupported URL. Please provide a valid Spotify or YouTube playlist URL.");
  }

  try {
    if (isSpotify) return await fetchSpotifyPlaylist(url);
    return await fetchYouTubePlaylist(url);
  } catch (err) {
    // Surface a helpful message if the backend simply isn't running
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      throw new Error(
        "Backend server is not running. Start it with: npm run dev:full\n(or run 'npm run server' in a separate terminal)"
      );
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Request timed out. The playlist may be very large or the service is slow — please try again.");
    }
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms) return "";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
