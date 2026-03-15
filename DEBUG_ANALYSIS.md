# Playlist Download Issue - Debugging Guide

## Problem Summary
Downloads fail with: **"All track downloads failed — ZIP would be empty"**

This occurs when **all tracks failed to download**, resulting in zero files being added to the ZIP. The downloads appear to complete (client shows progress), but no actual audio files are created.

## Root Cause Analysis

### The Issue Explained
1. **Client** sends track list with YouTube videoIds to server
2. **Server** uses yt-dlp + FFmpeg to download audio
3. **Audio files** should be created in system temp directory
4. **ZIP creation** fails because NO files were found in temp directory
5. **Error message** is shown to user

### Critical Failure Point
The error occurs at [server/index.js](server/index.js#L668):
```javascript
if (addedCount === 0) {
    await archive.abort();
    return broadcast(jobId, { type: "error", message: "All track downloads failed — ZIP would be empty" });
}
```

**This means:** Every single track download returned `null` or the audio files weren't found.

## How to Debug (Using Enhanced Logging)

### Step 1: Start the server and check startup logs
```
npm run dev
```

**Look for:**
✅ `✅  yt-dlp ready (...)` — yt-dlp installed correctly
✅ `✅  FFmpeg ready (...)` — FFmpeg installed correctly

**If you see:**
❌ `❌  FFmpeg NOT FOUND at ...` → **FFmpeg is not installed** (most likely cause!)
❌ `❌  FFmpeg check failed` → FFmpeg exists but is broken

### Step 2: Request a download and check download logs

When you start a playlist download, the server will show detailed logs for EACH track:

```
[dl job-id-1] === Starting download ===
[dl job-id-1] URL: https://www.youtube.com/watch?v=...
[dl job-id-1] Output: /tmp/sss-1234567890-job-id-1.%(ext)s
[dl job-id-1] Codec: mp3, Quality: 0
[dl job-id-1] FFmpeg location: /path/to/ffmpeg
[dl job-id-1] Temp directory: /tmp
```

### Step 3: Look for the actual download attempt

You'll see output like:
```
[dl job-id-1] Running bestaudio→mp3...
[dl job-id-1] Full args: ["https://www.youtube.com/watch?v=XXXXX", "-x", "--audio-format", "mp3", ...]
```

**Then watch the stdout/stderr for the download:**
```
[dl job-id-1] stdout: [download] Downloading video information...
[dl job-id-1] stdout: [ffmpeg] Destination: /tmp/sss-1234567890-job-id-1.mp3
[dl job-id-1] stderr: [some warnings are normal]
[dl job-id-1] bestaudio→mp3 exit 0 ✅
```

### Step 4: Check if file was found

After download succeeds, it searches for the output file:
```
[dl job-id-1] Download succeeded, now looking for output file...
[dl job-id-1] Attempt 1/12: Looking for sss-1234567890-job-id-1* in /tmp — found 1 files
[dl job-id-1] Candidates: sss-1234567890-job-id-1.mp3
[dl job-id-1]   stat sss-1234567890-job-id-1.mp3: 2500000 bytes
[dl job-id-1] ✅  Using: sss-1234567890-job-id-1.mp3
```

### Step 5: Most Common Failure Scenarios

#### ❌ Scenario 1: Zero-size file
```
[dl job-id-1] stat sss-1234567890-job-id-1.mp3: 0 bytes
[dl job-id-1] ZERO SIZE: sss-1234567890-job-id-1.mp3
[dl job-id-1] Attempt 2/12: Looking for sss-1234567890-job-id-1* in /tmp — found 1 files
[dl job-id-1] ❌  Gave up after 12 retries
```
**Cause:** FFmpeg conversion failed or video has no audio
**Solution:** Check FFmpeg logs in stderr for error messages

#### ❌ Scenario 2: File not found at all
```
[dl job-id-1] Download succeeded, now looking for output file...
[dl job-id-1] Attempt 1/12: Looking for sss-1234567890-job-id-1* in /tmp — found 0 files
...
[dl job-id-1] Attempt 12/12: Looking for sss-1234567890-job-id-1* in /tmp — found 0 files
[dl job-id-1] ❌  Gave up after 12 retries
[dl job-id-1] Files in /tmp: [list of other files]
[dl job-id-1] ❌  No output file found after successful exit
```
**Cause:** Output not created where expected OR FFmpeg crashed silently
**Solution:** Check FFmpeg stderr output closely

#### ❌ Scenario 3: FFmpeg not available
```
[dl job-id-1] Running bestaudio→mp3...
[dl job-id-1] stderr: ffmpeg: NOT FOUND
[dl job-id-1] bestaudio→mp3 hard exit 1
```
**Cause:** FFmpeg path is wrong or not in PATH
**Solution:** Check FFmpeg startup logs (Step 1)

#### ❌ Scenario 4: All downloads have same issue
If ALL tracks show the same error pattern (e.g., all have 0 bytes or none found):
- **Most likely:** FFmpeg is broken or not available
- **Less likely:** All videos have issues (would be random failures)
- **Check:** The startup FFmpeg check log from Step 1

## Solutions to Try (In Order)

### Solution 1: Verify FFmpeg is Installed
```powershell
# On Windows
ffmpeg -version

# On Mac
brew install ffmpeg

# On Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

If `ffmpeg -version` fails:
1. Install FFmpeg from https://ffmpeg.org/download.html
2. If installed but not in PATH, reinstall the npm package:
   ```
   npm install ffmpeg-static --force
   ```

### Solution 2: Clear temp files and restart
```powershell
# Windows - delete temp files
Remove-Item $env:TEMP\sss-* -Force

# Linux/Mac
rm /tmp/sss-* /var/tmp/sss-*
```

Then restart the server.

### Solution 3: Check disk space
Failed audio conversion might be due to low disk space:
```powershell
# Windows
Get-Volume

# Linux/Mac
df -h /tmp
```

### Solution 4: Manual FFmpeg test
Try converting a download manually:
```
yt-dlp -f bestaudio -x --audio-format mp3 --ffmpeg-location "C:\path\to\ffmpeg.exe" "https://www.youtube.com/watch?v=VIDEOIC" -o "test.mp3"
```

Check if `test.mp3` is created with content.

### Solution 5: Check yt-dlp can find audio formats
```
yt-dlp -F "https://www.youtube.com/watch?v=VIDEOID" | grep audio
```

If no audio formats shown, the video might be restricted.

## Log Location
Server logs are printed to STDOUT. If running in:
- **Development:** Check terminal running `npm run dev`
- **Production:** Check application logs / console
- **Docker:** `docker logs [container-name]`

## Checking Specific Track Failures
The enhanced logging shows each track's progress. Look for the pattern:
- `[dl job-id-INDEX]` where INDEX is the track number
- Search logs for "❌" symbols to find specific failures
- Each track shows download URL, arguments, exit code, and file search results

## Next Steps After Debugging

1. **Collect all server logs** from a failed download attempt
2. **Share the logs** showing:
   - FFmpeg startup check (Step 1)
   - One track's complete download attempt (Step 2-4)
   - Any error messages in stdout/stderr
3. **Include:**
   - Your operating system
   - FFmpeg installation method
   - Server deployment method (local dev, Docker, Heroku, etc.)

## Additional Resources

- [FFmpeg Installation](https://ffmpeg.org/download.html)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg-static npm](https://www.npmjs.com/package/ffmpeg-static)

