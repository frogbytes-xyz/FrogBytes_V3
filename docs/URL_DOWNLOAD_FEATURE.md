# URL Download Feature Documentation

## Overview

The URL Download feature allows users to download videos from supported platforms (YouTube, Vimeo, etc.) by pasting a URL instead of uploading a file. The downloaded video then follows the same processing pipeline as file uploads: transcription → summarization → metadata collection.

## Features

- ✅ Download videos from 12+ platforms (YouTube, Vimeo, TikTok, Instagram, etc.)
- ✅ Automatic format conversion to MP4
- ✅ Video metadata extraction (title, duration, description)
- ✅ Progress tracking during download
- ✅ Telegram backup with source URL tracking
- ✅ Same processing pipeline as file uploads
- ✅ Comprehensive error handling

## System Requirements

### Required Dependencies

1. **yt-dlp**: Video download tool
   ```bash
   # Install via pip
   pip install yt-dlp
   
   # Or via brew (macOS)
   brew install yt-dlp
   
   # Or via apt (Ubuntu/Debian)
   sudo apt install yt-dlp
   ```

2. **FFmpeg** (optional, for format conversion):
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   ```

### Verification

Check if yt-dlp is installed:
```bash
yt-dlp --version
```

Should output version number (e.g., `2025.09.26`)

## Architecture

### File Structure

```
lib/video-download/
  ├── types.ts              # TypeScript type definitions
  ├── check-ytdlp.ts        # yt-dlp verification utility
  ├── validators.ts         # URL validation and platform detection
  └── downloader.ts         # Core download logic (yt-dlp wrapper)

app/api/upload/
  └── from-url/
      └── route.ts          # URL download API endpoint

components/
  └── FileUpload.tsx        # UI with file/URL tabs
```

### Data Flow

```
User pastes URL
    ↓
FileUpload component → /api/upload/from-url
    ↓
Validate URL → Download video (yt-dlp)
    ↓
Save to /tmp/uploads/{userId}/{fileId}.mp4
    ↓
Create upload record in database
    ↓
Telegram backup (with source URL)
    ↓
Return file ID
    ↓
Same flow as file upload: Transcribe → Summarize → Metadata → Learn page
```

## Supported Platforms

### Direct Platform Detection

The following platforms are automatically detected with branded icons:

- YouTube (`youtube.com`, `youtu.be`) - ▶️
- Vimeo (`vimeo.com`) - 🎞️
- Dailymotion (`dailymotion.com`) - 📺
- Twitch (`twitch.tv`) - 🎮
- Facebook (`facebook.com`) - 📘
- Twitter/X (`twitter.com`, `x.com`) - 🐦
- TikTok (`tiktok.com`) - 🎵
- Instagram (`instagram.com`) - 📸
- Reddit (`reddit.com`) - 🤖
- SoundCloud (`soundcloud.com`) - 🎧

### Generic Video Support

**Any valid video URL is accepted**, even from unknown platforms:
- University lecture platforms (Kaltura, Panopto, MediaSite) - 🎬
- Course platforms (Coursera, Udemy, LinkedIn Learning) - 🎬
- Private/embedded videos - 🌐
- yt-dlp supports **1500+ sites**

### Authentication Support 🔐

For platforms requiring login (university portals, private courses, member-only content):

1. **Automatic Detection**: System detects authentication errors
2. **Guided Login**: Step-by-step instructions appear
3. **Browser Cookies**: Uses your browser's login session
4. **Supported Browsers**: Chrome, Firefox, Edge, Safari, Brave, Opera
5. **Secure**: Your credentials never leave your browser

**Example**: `https://video.uva.nl/media/...` (requires UVA login)

**See**: [Cookie Authentication Documentation](../COOKIE_AUTH_FEATURE.md) for complete guide.

## Usage

### For Users

1. Navigate to `/upload` page
2. Click the "🔗 Paste URL" tab
3. Enter a video URL (e.g., `https://www.youtube.com/watch?v=...`)
4. Click "Download Video"
5. Wait for download to complete
6. Proceed with transcription and summarization as normal

### For Developers

#### Using the Downloader Service

```typescript
import { downloadVideo } from '@/lib/video-download/downloader'

const result = await downloadVideo(url, userId, {
  maxFileSize: 500 * 1024 * 1024, // 500MB limit
  onProgress: (progress) => {
    console.log(`Downloaded ${progress.percentage}%`)
  }
})

if (result.success) {
  console.log('File ID:', result.fileId)
  console.log('Path:', result.path)
  console.log('Metadata:', result.metadata)
} else {
  console.error('Error:', result.error)
}
```

#### URL Validation

```typescript
import { isValidVideoUrl } from '@/lib/video-download/validators'

const validation = isValidVideoUrl(url)

if (validation.isValid) {
  console.log('Platform:', validation.platform)
} else {
  console.error('Error:', validation.error)
}
```

## API Reference

### POST `/api/upload/from-url`

Download a video from a URL.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Video downloaded successfully",
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "Never-Gonna-Give-You-Up.mp4",
    "size": 52428800,
    "mimeType": "video/mp4",
    "path": "/tmp/uploads/{userId}/550e8400...mp4"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "This platform is not supported. Supported platforms: YouTube, Vimeo, ..."
  ]
}
```

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "yt-dlp not found" | yt-dlp not installed | Install yt-dlp: `pip install yt-dlp` |
| "Invalid URL format" | Malformed URL | Check URL format |
| "This platform is not supported" | Unsupported domain | Use a supported platform |
| "Video is too large" | File > 500MB | Try a shorter/lower quality video |
| "Video is private or unavailable" | Private/deleted video | Check video accessibility |
| "Failed to retrieve video information" | Network/auth issue | Check internet connection, video may require login |

### Error Categories

1. **Validation Errors** (400):
   - Invalid URL format
   - Unsupported platform
   - Missing URL parameter

2. **Download Errors** (500):
   - Network failures
   - yt-dlp execution errors
   - File system errors

3. **Authentication Errors** (401):
   - User not logged in

## Configuration

### Environment Variables

No new environment variables are required. The feature uses existing configuration:

- `TELEGRAM_BOT_TOKEN`: For Telegram backups
- `TELEGRAM_GROUP_ID`: Telegram group for storage
- `TELEGRAM_ARCHIVE_TOPIC_ID`: Archive topic ID

### Limits

- **Max File Size**: 500MB (configurable in `/api/upload/from-url/route.ts`)
- **Supported Formats**: Automatically converts to MP4
- **Timeout**: 5 minutes per download (Node.js default)

## Deployment

### Development

1. Ensure yt-dlp is installed:
   ```bash
   yt-dlp --version
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Test with a public video:
   - Navigate to `/upload`
   - Switch to "Paste URL" tab
   - Try: `https://www.youtube.com/watch?v=jNQXAC9IVRw` (test video)

### Production

1. **Install yt-dlp on server**:
   ```bash
   pip install yt-dlp
   ```

2. **Verify installation**:
   ```bash
   which yt-dlp
   yt-dlp --version
   ```

3. **Ensure disk space**:
   - Downloads are stored in `/tmp/uploads/`
   - Ensure sufficient space for video files

4. **Configure cleanup**:
   - Temp files are cleaned up after processing
   - Implement cron job to clean old files if needed

5. **Monitor logs**:
   - Check for yt-dlp errors
   - Monitor disk usage
   - Track download success rates

### Docker (if applicable)

Add to Dockerfile:

```dockerfile
# Install yt-dlp
RUN pip install yt-dlp

# Verify installation
RUN yt-dlp --version
```

## Testing

### Manual Testing

1. **YouTube Public Video**:
   - URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
   - Expected: Download succeeds, metadata extracted

2. **Vimeo Public Video**:
   - URL: `https://vimeo.com/148751763`
   - Expected: Download succeeds

3. **Invalid URL**:
   - URL: `https://example.com/video`
   - Expected: Error "This platform is not supported"

4. **Malformed URL**:
   - URL: `not-a-url`
   - Expected: Error "Invalid URL format"

5. **Private Video**:
   - URL: Private YouTube video
   - Expected: Error "Video is private or unavailable"

### Unit Tests (Future)

Create tests in `__tests__/lib/video-download/`:

```typescript
import { downloadVideo } from '@/lib/video-download/downloader'
import { isValidVideoUrl } from '@/lib/video-download/validators'

describe('URL Validation', () => {
  test('validates YouTube URLs', () => {
    const result = isValidVideoUrl('https://www.youtube.com/watch?v=test')
    expect(result.isValid).toBe(true)
    expect(result.platform).toBe('YouTube')
  })
  
  test('rejects unsupported domains', () => {
    const result = isValidVideoUrl('https://example.com/video')
    expect(result.isValid).toBe(false)
  })
})
```

## Troubleshooting

### yt-dlp not found

**Problem**: Error "yt-dlp not found in system PATH"

**Solution**:
```bash
# Check if yt-dlp is installed
which yt-dlp

# If not found, install it
pip install yt-dlp

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"
```

### Downloads fail with "403 Forbidden"

**Problem**: Some platforms block automated downloads

**Solution**:
- This is expected for some platforms
- Consider implementing cookie-based authentication (future enhancement)
- For now, inform users that some videos may not be downloadable

### Slow downloads

**Problem**: Large videos take a long time

**Solution**:
- This is normal for large files
- Progress tracking shows download status
- Consider setting a file size limit
- Inform users about estimated download times

### Telegram backup fails

**Problem**: Video uploaded but Telegram backup fails

**Solution**:
- This is non-blocking - upload still succeeds
- Check Telegram bot token and group ID
- Verify bot permissions in Telegram group
- Check server logs for specific error

## Future Enhancements

### Planned Features

1. **Authentication Support**:
   - Cookie-based login for private videos
   - Platform-specific auth (YouTube, Facebook, etc.)

2. **Quality Selection**:
   - Let users choose resolution
   - Audio-only option for podcasts

3. **Playlist Support**:
   - Download entire playlists
   - Batch processing queue

4. **Enhanced Progress**:
   - Real-time progress via WebSocket/SSE
   - ETA and speed display

5. **Browser Extension**:
   - One-click download from any video page
   - Auto-fill from current tab

## Support

For issues or questions:

1. Check this documentation
2. Review server logs
3. Test with a known working URL (YouTube test video)
4. Verify yt-dlp installation
5. Check network connectivity

## License

This feature uses yt-dlp which is public domain (Unlicense).

