// ============================================================
// API SERVICE LAYER
//
// Set your credentials in a .env file (copy .env.example):
//   VITE_SPOTIFY_CLIENT_ID=your_client_id
//   VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
//   VITE_YOUTUBE_API_KEY=your_youtube_api_key  (optional)
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

const BACKEND = "http://localhost:3001";
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET as string | undefined;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

// ── Backend health check ──────────────────────────────────────
export async function isBackendRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Spotify token via backend proxy (avoids CORS) ────────────
async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  try {
    // Server reads credentials from its own .env (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).
    // We still send them as a fallback in case the server env vars aren't set yet.
    const res = await fetch(`${BACKEND}/api/spotify/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: SPOTIFY_CLIENT_ID,
        clientSecret: SPOTIFY_CLIENT_SECRET,
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Search YouTube for a track title+artist → returns videoId ─
export async function searchYouTube(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BACKEND}/api/search?q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    return data.videos?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ── Download a single track (real audio via backend) ─────────
export function getDownloadUrl(videoId: string, format: string, title: string, quality = "best"): string {
  return `${BACKEND}/api/download?videoId=${encodeURIComponent(videoId)}&format=${encodeURIComponent(format)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(title)}`;
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
  // Phase 1: resolve YouTube videoIds IN PARALLEL (no bar movement, just status text)
  const RESOLVE_CONCURRENCY = 4;
  onProgress(0, 100);
  onStatusMessage?.("Finding tracks on YouTube…");

  const resolvedSlots: ({ videoId: string; title: string; artist: string } | null)[] =
    new Array(tracks.length).fill(null);
  let resolvedCount = 0;

  for (let i = 0; i < tracks.length; i += RESOLVE_CONCURRENCY) {
    const batch = tracks.slice(i, i + RESOLVE_CONCURRENCY);
    await Promise.all(
      batch.map(async (track, j) => {
        const idx = i + j;
        let vid = track.videoId;
        if (!vid && track.source === "spotify") {
          vid = (await searchYouTube(`${track.title} ${track.artist}`)) ?? undefined;
        }
        if (!vid && track.source === "youtube") vid = track.id;
        if (!vid) {
          onError?.(`Could not find "${track.title}" on YouTube — skipped.`, track);
          return;
        }
        resolvedSlots[idx] = { videoId: vid, title: track.title, artist: track.artist };
        resolvedCount++;
        onStatusMessage?.(`Finding tracks… ${resolvedCount}/${tracks.length}`);
      })
    );
  }

  const resolved = resolvedSlots.filter(
    (x): x is { videoId: string; title: string; artist: string } => x !== null
  );
  if (resolved.length === 0) throw new Error("No tracks could be resolved to a YouTube video.");

  // Phase 2: start background job — progress bar resets to 0 and goes to 100%
  onProgress(0, resolved.length);
  onStatusMessage?.(`Starting download of ${resolved.length} tracks…`);

  const startRes = await fetch(`${BACKEND}/api/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tracks: resolved, format, quality, playlistName }),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({ error: startRes.statusText }));
    throw new Error(err.error ?? "Failed to start ZIP job");
  }
  const { jobId } = await startRes.json();

  // Phase 2: SSE progress — bar goes 0 → 100% over actual downloads
  await new Promise<void>((resolve, reject) => {
    const evtSource = new EventSource(`${BACKEND}/api/progress/${jobId}`);

    evtSource.onmessage = async (e) => {
      let data: { type: string; done?: number; total?: number; track?: string; message?: string };
      try { data = JSON.parse(e.data); } catch { return; }

      if (data.type === "progress" && data.done != null && data.total != null) {
        onProgress(data.done, data.total);
        onStatusMessage?.(`Downloading ${data.done}/${data.total}: ${data.track ?? ""}`);

      } else if (data.type === "zipping") {
        onProgress(resolved.length - 1, resolved.length);
        onStatusMessage?.("Building ZIP archive…");

      } else if (data.type === "done") {
        evtSource.close();
        onProgress(resolved.length, resolved.length);
        onStatusMessage?.("Preparing download…");

        try {
          const fileRes = await fetch(`${BACKEND}/api/download-zip/file/${jobId}`);
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
        evtSource.close();
        reject(new Error(data.message ?? "ZIP job failed"));
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      reject(new Error("Lost connection to download server"));
    };
  });
}


// ── Fetch Spotify playlist ────────────────────────────────────
export async function fetchSpotifyPlaylist(url: string): Promise<ConversionResult> {
  const match = url.match(/playlist\/([A-Za-z0-9]+)/);
  const playlistId = match?.[1];

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error(
      "Spotify credentials not set. Add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET to your .env file, then restart the server."
    );
  }

  const token = await getSpotifyToken();
  if (!token) {
    throw new Error("Failed to get Spotify token. Check your Client ID and Client Secret.");
  }
  if (!playlistId) {
    throw new Error("Invalid Spotify playlist URL. Make sure it contains /playlist/...");
  }

  const tracks: Track[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  let playlistName = "Spotify Playlist";

  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Spotify API error: ${metaRes.status}`);
  const meta = await metaRes.json();
  playlistName = meta.name ?? playlistName;

  // Paginate — no limit
  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Spotify API error while paginating: ${res.status}`);
    const data = await res.json();

    for (const item of data.items ?? []) {
      const t = item.track;
      if (!t || t.is_local) continue;
      tracks.push({
        id: t.id,
        title: t.name,
        artist: t.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
        thumbnail: t.album?.images?.[0]?.url ?? "",
        duration: formatMs(t.duration_ms),
        source: "spotify",
        externalUrl: t.external_urls?.spotify,
        // videoId resolved at download time via /api/search
      });
    }
    nextUrl = data.next ?? null;
  }

  return { tracks, playlistName, totalCount: tracks.length, source: "spotify" };
}

// ── Fetch YouTube playlist ────────────────────────────────────
export async function fetchYouTubePlaylist(url: string): Promise<ConversionResult> {
  const match = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  const playlistId = match?.[1];

  if (!YOUTUBE_API_KEY) {
    throw new Error(
      "YouTube API key not set. Add VITE_YOUTUBE_API_KEY to your .env file, then restart the server."
    );
  }
  if (!playlistId) {
    throw new Error("Invalid YouTube playlist URL. Make sure it contains ?list=...");
  }

  const tracks: Track[] = [];
  let pageToken: string | undefined;
  let playlistName = "YouTube Playlist";

  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`
  );
  if (!metaRes.ok) throw new Error(`YouTube API error: ${metaRes.status}`);
  const meta = await metaRes.json();
  if (meta.error) throw new Error(`YouTube API: ${meta.error.message}`);
  playlistName = meta.items?.[0]?.snippet?.title ?? playlistName;

  // Paginate — no limit
  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}${pageParam}`
    );
    if (!res.ok) throw new Error(`YouTube API error while paginating: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`YouTube API: ${data.error.message}`);

    for (const item of data.items ?? []) {
      const s = item.snippet;
      const videoId = s?.resourceId?.videoId;
      if (!videoId) continue;
      tracks.push({
        id: videoId,
        title: s.title,
        artist: s.videoOwnerChannelTitle ?? "Unknown",
        thumbnail: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? "",
        source: "youtube",
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId, // Already have it for YouTube tracks
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { tracks, playlistName, totalCount: tracks.length, source: "youtube" };
}

// ── Orchestrator ─────────────────────────────────────────────
export async function convertPlaylist(url: string): Promise<ConversionResult> {
  const backend = await isBackendRunning();
  if (!backend) {
    throw new Error(
      "Backend server is not running. Start it with: npm run dev:full\n(or run 'npm run server' in a separate terminal)"
    );
  }

  const isSpotify = url.includes("spotify.com");
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  if (isSpotify) return fetchSpotifyPlaylist(url);
  if (isYoutube) return fetchYouTubePlaylist(url);

  throw new Error("Unsupported URL. Please provide a valid Spotify or YouTube playlist URL.");
}

// ── Helpers ───────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms) return "";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
