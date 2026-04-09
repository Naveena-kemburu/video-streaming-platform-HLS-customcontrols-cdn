# StreamFlow — HLS Video Streaming Platform

A production-grade HLS video streaming player built with hls.js, custom controls, adaptive bitrate switching, CDN integration via Cloudinary, and full keyboard accessibility.

## Live HLS Manifest URL

```
https://res.cloudinary.com/dxyb5omum/raw/upload/hls_output/master.m3u8
```

---

## Project Overview

This project implements a complete video delivery pipeline:

- FFmpeg transcodes a source video into 4 HLS renditions (360p, 480p, 720p, 1080p)
- HLS segments and manifests are hosted on Cloudinary's CDN
- A custom HTML/CSS/JS player built on hls.js handles adaptive bitrate streaming
- Docker + nginx serves the frontend application

---

## What We Did (Step by Step)

### 1. Video Transcoding with FFmpeg

Downloaded a sample 1080p MP4 video and ran FFmpeg commands from `transcoding.md` to generate HLS segments and manifests for 4 quality levels.

Commands were run in Command Prompt (single-line format for Windows):

```cmd
ffmpeg -i "C:\Users\PALLAVI\Downloads\input.mp4" -vf "scale=w=640:h=360:force_original_aspect_ratio=decrease" -c:a aac -ar 48000 -c:v h264 -profile:v main -crf 23 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 4 -hls_playlist_type vod -b:v 800k -maxrate 856k -bufsize 1200k -b:a 96k -hls_segment_filename hls_output/360p_%03d.ts hls_output/360p.m3u8
```

(Repeated for 480p, 720p, 1080p — see `transcoding.md` for all commands)

Output folder generated:
```
hls_output/
├── master.m3u8
├── 360p.m3u8 + 360p_000.ts, 360p_001.ts ...
├── 480p.m3u8 + 480p_000.ts ...
├── 720p.m3u8 + 720p_000.ts ...
└── 1080p.m3u8 + 1080p_000.ts ...
```

### 2. CDN Upload to Cloudinary

- Signed up at cloudinary.com (free tier, cloud name: `dxyb5omum`)
- Created folder `hls_output` in Media Library
- Uploaded all `.ts` segment files via the Cloudinary UI (drag and drop)
- `.m3u8` manifest files failed via UI (Cloudinary blocks them by default), so uploaded them via the API using `curl.exe`:

```cmd
curl.exe -u "API_KEY:API_SECRET" -X POST https://api.cloudinary.com/v1_1/dxyb5omum/raw/upload -F "file=@hls_output/master.m3u8" -F "folder=hls_output" -F "public_id=master"
```

Same command repeated for `360p.m3u8`, `480p.m3u8`, `720p.m3u8`, `1080p.m3u8`.

All files are publicly accessible via Cloudinary's CDN at:
```
https://res.cloudinary.com/dxyb5omum/raw/upload/hls_output/<filename>
```

### 3. Environment Configuration

Set the manifest URL in `.env`:
```
HLS_MANIFEST_URL=https://res.cloudinary.com/dxyb5omum/raw/upload/hls_output/master.m3u8
```

### 4. Docker Deployment

Started Docker Desktop, then ran:
```cmd
docker-compose up --build
```

App is accessible at `http://localhost:8080`.

---

## Quick Start

```cmd
# 1. Clone the repo
git clone <your-repo-url>

# 2. Copy env file
copy .env.example .env
# Edit .env and set HLS_MANIFEST_URL

# 3. Start Docker Desktop, then run:
docker-compose up --build

# 4. Open browser
http://localhost:8080
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `HLS_MANIFEST_URL` | Full URL to CDN-hosted `master.m3u8` |

---

## Player Features

- Adaptive bitrate streaming (auto quality switching via hls.js)
- Manual quality override (360p / 480p / 720p / 1080p / Auto)
- Live bitrate display
- Watch progress saved to localStorage — resumes on page reload
- Video marked as completed after 95% watched
- Playback speed control (0.5× to 2×)
- Fullscreen support
- Auto-hide controls
- Buffering spinner

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Toggle play/pause |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `→` | Seek forward 5s |
| `←` | Seek backward 5s |
| `↑` | Volume up |
| `↓` | Volume down |

---

## Project Structure

```
.
├── index.html          # Player UI
├── style.css           # Styles
├── player.js           # Player logic (hls.js + Media API)
├── Dockerfile          # nginx container
├── docker-compose.yml  # Service definition
├── nginx.conf          # nginx config
├── entrypoint.sh       # Runtime env injection
├── transcoding.md      # FFmpeg commands documentation
├── .env                # Your environment variables (not committed)
├── .env.example        # Template
└── README.md
```

---

## Architecture

```
input.mp4 (local)
    │
    ▼
FFmpeg Transcoding (4 renditions)
    │
    ▼
hls_output/ (.ts segments + .m3u8 manifests)
    │
    ▼
Cloudinary CDN (res.cloudinary.com/dxyb5omum)
    │
    ▼
hls.js (fetches manifest + segments)
    │
    ▼
HTML5 <video> via Media Source Extensions
    │
    ▼
Custom Controls UI (player.js)
```
