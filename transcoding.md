# Video Transcoding with FFmpeg

This document explains the FFmpeg commands used to transcode a source video into multiple HLS renditions for adaptive bitrate streaming.

## Prerequisites

- FFmpeg installed: `ffmpeg -version`
- A source video file (e.g., `input.mp4`) in 1080p or higher resolution

## Transcoding Script

```bash
SOURCE="input.mp4"
OUTPUT_DIR="hls_output"
mkdir -p $OUTPUT_DIR
```

---

### 360p Rendition

```bash
ffmpeg -i $SOURCE \
  -vf "scale=w=640:h=360:force_original_aspect_ratio=decrease" \
  -c:a aac -ar 48000 \
  -c:v h264 -profile:v main \
  -crf 23 \
  -sc_threshold 0 \
  -g 48 -keyint_min 48 \
  -hls_time 4 \
  -hls_playlist_type vod \
  -b:v 800k -maxrate 856k -bufsize 1200k \
  -b:a 96k \
  -hls_segment_filename $OUTPUT_DIR/360p_%03d.ts \
  $OUTPUT_DIR/360p.m3u8
```

**Key flags:**
- `-vf "scale=w=640:h=360:force_original_aspect_ratio=decrease"` — Scales the video to 640x360 while preserving the original aspect ratio (adds no padding, just constrains dimensions).
- `-c:a aac -ar 48000` — Encodes audio using AAC codec at a 48kHz sample rate, the standard for HLS.
- `-c:v h264 -profile:v main` — Encodes video using H.264 with the "main" profile, which is broadly compatible with most devices and browsers.
- `-crf 23` — Constant Rate Factor: controls quality. Lower = better quality, larger file. 23 is a good default balance.
- `-sc_threshold 0` — Disables scene-change detection for keyframe insertion, ensuring keyframes only appear at fixed intervals (important for HLS segment alignment).
- `-g 48 -keyint_min 48` — Sets the GOP (Group of Pictures) size to 48 frames. With 24fps video, this means a keyframe every 2 seconds. Must align with `-hls_time` for clean segment cuts.
- `-hls_time 4` — Target segment duration in seconds. Each `.ts` file will be approximately 4 seconds long.
- `-hls_playlist_type vod` — Marks the playlist as Video on Demand (VOD), adding `#EXT-X-ENDLIST` at the end of the manifest so the player knows the stream is finite.
- `-b:v 800k -maxrate 856k -bufsize 1200k` — Target video bitrate of 800kbps, with a max of 856kbps and a buffer size of 1200kbps to handle bitrate spikes.
- `-b:a 96k` — Audio bitrate of 96kbps, appropriate for 360p.
- `-hls_segment_filename $OUTPUT_DIR/360p_%03d.ts` — Naming pattern for segment files (e.g., `360p_000.ts`, `360p_001.ts`).

---

### 480p Rendition

```bash
ffmpeg -i $SOURCE \
  -vf "scale=w=842:h=480:force_original_aspect_ratio=decrease" \
  -c:a aac -ar 48000 \
  -c:v h264 -profile:v main \
  -crf 23 \
  -sc_threshold 0 \
  -g 48 -keyint_min 48 \
  -hls_time 4 \
  -hls_playlist_type vod \
  -b:v 1400k -maxrate 1498k -bufsize 2100k \
  -b:a 128k \
  -hls_segment_filename $OUTPUT_DIR/480p_%03d.ts \
  $OUTPUT_DIR/480p.m3u8
```

**Key flags:**
- `-vf "scale=w=842:h=480:..."` — Scales to 480p (SD widescreen). Width 842 maintains 16:9 aspect ratio.
- `-b:v 1400k -maxrate 1498k -bufsize 2100k` — Higher bitrate for better quality at 480p.
- `-b:a 128k` — Slightly higher audio bitrate for improved audio quality.

---

### 720p Rendition

```bash
ffmpeg -i $SOURCE \
  -vf "scale=w=1280:h=720:force_original_aspect_ratio=decrease" \
  -c:a aac -ar 48000 \
  -c:v h264 -profile:v main \
  -crf 23 \
  -sc_threshold 0 \
  -g 48 -keyint_min 48 \
  -hls_time 4 \
  -hls_playlist_type vod \
  -b:v 2800k -maxrate 2996k -bufsize 4200k \
  -b:a 128k \
  -hls_segment_filename $OUTPUT_DIR/720p_%03d.ts \
  $OUTPUT_DIR/720p.m3u8
```

**Key flags:**
- `-vf "scale=w=1280:h=720:..."` — HD resolution (720p), standard for mid-tier streaming quality.
- `-b:v 2800k -maxrate 2996k -bufsize 4200k` — Bitrate suitable for HD content without excessive file size.

---

### 1080p Rendition

```bash
ffmpeg -i $SOURCE \
  -vf "scale=w=1920:h=1080:force_original_aspect_ratio=decrease" \
  -c:a aac -ar 48000 \
  -c:v h264 -profile:v main \
  -crf 23 \
  -sc_threshold 0 \
  -g 48 -keyint_min 48 \
  -hls_time 4 \
  -hls_playlist_type vod \
  -b:v 5000k -maxrate 5350k -bufsize 7500k \
  -b:a 192k \
  -hls_segment_filename $OUTPUT_DIR/1080p_%03d.ts \
  $OUTPUT_DIR/1080p.m3u8
```

**Key flags:**
- `-vf "scale=w=1920:h=1080:..."` — Full HD resolution.
- `-b:v 5000k -maxrate 5350k -bufsize 7500k` — High bitrate for full HD quality.
- `-b:a 192k` — Higher audio bitrate for premium audio quality at 1080p.

---

### Master Playlist Generation

```bash
echo -e "#EXTM3U\n#EXT-X-VERSION:3" > $OUTPUT_DIR/master.m3u8
echo -e "#EXT-X-STREAM-INF:BANDWIDTH=928000,RESOLUTION=640x360\n360p.m3u8" >> $OUTPUT_DIR/master.m3u8
echo -e "#EXT-X-STREAM-INF:BANDWIDTH=1592000,RESOLUTION=842x480\n480p.m3u8" >> $OUTPUT_DIR/master.m3u8
echo -e "#EXT-X-STREAM-INF:BANDWIDTH=3004000,RESOLUTION=1280x720\n720p.m3u8" >> $OUTPUT_DIR/master.m3u8
echo -e "#EXT-X-STREAM-INF:BANDWIDTH=5384000,RESOLUTION=1920x1080\n1080p.m3u8" >> $OUTPUT_DIR/master.m3u8
```

**Explanation:**
- `#EXTM3U` — Required header for all M3U8 files.
- `#EXT-X-VERSION:3` — Declares HLS protocol version 3.
- `#EXT-X-STREAM-INF:BANDWIDTH=...,RESOLUTION=...` — Describes each variant stream. `BANDWIDTH` is in bits per second and is used by the player to select the initial quality level based on available network bandwidth.
- Each line following `#EXT-X-STREAM-INF` is the relative path to that rendition's media playlist.

---

## Output Structure

```
hls_output/
├── master.m3u8       # Master playlist (entry point for hls.js)
├── 360p.m3u8         # 360p media playlist
├── 360p_000.ts       # 360p video segments
├── 360p_001.ts
├── ...
├── 480p.m3u8
├── 480p_000.ts
├── ...
├── 720p.m3u8
├── 720p_000.ts
├── ...
├── 1080p.m3u8
├── 1080p_000.ts
└── ...
```

## Upload to CDN

After transcoding, upload the entire `hls_output/` directory to your CDN provider (Cloudinary or Cloudflare R2/B2). Ensure:
1. All files are publicly accessible.
2. CORS is configured to allow `GET` and `HEAD` from your app's origin.
3. The `master.m3u8` URL is set as `VITE_HLS_MANIFEST_URL` in your `.env` file.
