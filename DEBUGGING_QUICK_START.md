# Download Debugging - Quick Start

## What I Found
Your playlist downloads fail because **no audio files are being created**, likely due to **FFmpeg not being available** or misconfigured.

## What I Fixed
I've added **comprehensive logging** to help identify the exact problem:

✅ **FFmpeg startup check** - Server now verifies FFmpeg works on startup
✅ **Detailed download logs** - Shows every step of the download process  
✅ **File search debugging** - Shows why files aren't found
✅ **Process output capture** - Logs yt-dlp and FFmpeg stdout/stderr

## Next Steps (Do This Now)

### 1. Start the server and look at startup logs
```powershell
npm run dev
```

You should see something like:
```
📦  FFmpeg path: C:\path\to\ffmpeg.exe
📦  FFmpeg exists: true
✅  FFmpeg ready (ffmpeg version ...)
```

**If you see ❌ instead of ✅**, FFmpeg is not installed or broken → Install FFmpeg

### 2. Try a test download
Download one or two tracks from a playlist and **save all server logs**.

### 3. Share the logs
Look for patterns like:
- `[dl ...]` entries showing download progress
- `stdout: ...` showing yt-dlp output
- `stderr: ...` showing error messages
- Whether files are found or not

### 4. Check the debugging guide
Read [DEBUG_ANALYSIS.md](DEBUG_ANALYSIS.md) for detailed explanations of:
- What each log message means
- Common failure scenarios
- Solutions for each issue

## Most Common Fix
If you see "FFmpeg NOT FOUND", install it:
```powershell
# Windows - Install ffmpeg-static package
npm install ffmpeg-static --force

# Or install FFmpeg manually from:
# https://ffmpeg.org/download.html
```

Then restart the server and try again.

## Key Section in Code
The enhanced logging is in [server/index.js](server/index.js):
- Lines 56-103: FFmpeg check on startup
- Lines 437-481: Detailed download logging
- Lines 485-532: File search logging with debug info

The error occurs at [line 668](server/index.js#L668) when ZIP is empty.
