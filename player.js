/**
 * StreamFlow — HLS Video Player
 * Custom player built on hls.js + HTML5 Media API
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Manifest URL: injected at build time via env, or falls back to a public demo stream
  const MANIFEST_URL =
    (typeof window.__HLS_MANIFEST_URL__ !== 'undefined' && window.__HLS_MANIFEST_URL__) ||
    'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'; // public Mux test stream

  const STORAGE_KEY_PROGRESS  = 'video-progress';
  const STORAGE_KEY_COMPLETED = 'video-completed';
  const COMPLETION_THRESHOLD  = 0.95; // 95%
  const PROGRESS_SAVE_INTERVAL = 2;   // seconds between localStorage saves
  const SEEK_STEP   = 5;              // seconds per arrow key
  const VOLUME_STEP = 0.1;
  const HIDE_CONTROLS_DELAY = 3000;   // ms

  // ── DOM Refs ─────────────────────────────────────────────────────────────────
  const video          = document.getElementById('video-player');
  const container      = document.getElementById('video-container');
  const statusBanner   = document.getElementById('status-banner');
  const bufferingOverlay = document.getElementById('buffering-overlay');
  const centerFlash    = document.getElementById('center-flash');
  const centerFlashIcon = document.getElementById('center-flash-icon');

  const playPauseBtn   = document.getElementById('play-pause-button');
  const muteBtn        = document.getElementById('mute-button');
  const progressBar    = document.getElementById('progress-bar');
  const progressPlayed = document.getElementById('progress-played');
  const progressBuffered = document.getElementById('progress-buffered');
  const volumeSlider   = document.getElementById('volume-slider');
  const qualitySelector = document.getElementById('quality-selector');
  const speedSelector  = document.getElementById('playback-speed-selector');
  const fullscreenBtn  = document.getElementById('fullscreen-button');
  const currentTimeEl  = document.getElementById('current-time');
  const durationEl     = document.getElementById('duration');
  const bitrateDisplay = document.getElementById('current-bitrate-display');
  const completionBadge = document.getElementById('completion-badge');

  // ── State ────────────────────────────────────────────────────────────────────
  let hls = null;
  let lastSavedTime = 0;
  let hideControlsTimer = null;
  let isSeeking = false;
  let isCompleted = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';

  // ── Utility ──────────────────────────────────────────────────────────────────
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function setStatus(msg, type = '') {
    statusBanner.textContent = msg;
    statusBanner.className = 'status-banner' + (type ? ` ${type}` : '');
  }

  function showCenterFlash(svgPath) {
    centerFlashIcon.innerHTML = `<path d="${svgPath}"/>`;
    centerFlash.classList.remove('flash');
    // Force reflow to restart animation
    void centerFlash.offsetWidth;
    centerFlash.classList.add('flash');
  }

  const PLAY_PATH  = 'M8 5v14l11-7z';
  const PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

  // ── Controls Visibility ───────────────────────────────────────────────────────
  function showControls() {
    container.classList.remove('hide-controls');
    resetHideTimer();
  }

  function resetHideTimer() {
    clearTimeout(hideControlsTimer);
    if (!video.paused) {
      hideControlsTimer = setTimeout(() => {
        container.classList.add('hide-controls');
      }, HIDE_CONTROLS_DELAY);
    }
  }

  container.addEventListener('mousemove', showControls);
  container.addEventListener('mouseenter', showControls);
  container.addEventListener('mouseleave', () => {
    if (!video.paused) container.classList.add('hide-controls');
  });
  container.addEventListener('touchstart', () => {
    if (container.classList.contains('hide-controls')) {
      showControls();
    }
  }, { passive: true });

  // ── Play / Pause ──────────────────────────────────────────────────────────────
  function togglePlayPause() {
    if (video.paused || video.ended) {
      video.play().catch(err => setStatus('Playback error: ' + err.message, 'error'));
    } else {
      video.pause();
    }
  }

  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  // Click on video area toggles play/pause
  container.addEventListener('click', (e) => {
    if (e.target === container || e.target === video) {
      togglePlayPause();
    }
  });

  video.addEventListener('play', () => {
    playPauseBtn.querySelector('.icon-play').classList.add('hidden');
    playPauseBtn.querySelector('.icon-pause').classList.remove('hidden');
    playPauseBtn.setAttribute('aria-label', 'Pause');
    resetHideTimer();
  });

  video.addEventListener('pause', () => {
    playPauseBtn.querySelector('.icon-play').classList.remove('hidden');
    playPauseBtn.querySelector('.icon-pause').classList.add('hidden');
    playPauseBtn.setAttribute('aria-label', 'Play');
    showControls();
    clearTimeout(hideControlsTimer);
  });

  // ── Progress Bar ──────────────────────────────────────────────────────────────
  video.addEventListener('timeupdate', () => {
    if (isSeeking) return;

    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    progressBar.value = pct;
    progressBar.setAttribute('aria-valuenow', pct.toFixed(1));
    progressPlayed.style.width = pct + '%';
    currentTimeEl.textContent = formatTime(video.currentTime);

    // Save progress to localStorage (throttled)
    if (Math.abs(video.currentTime - lastSavedTime) >= PROGRESS_SAVE_INTERVAL) {
      localStorage.setItem(STORAGE_KEY_PROGRESS, video.currentTime.toString());
      lastSavedTime = video.currentTime;
    }

    // Completion check
    if (!isCompleted && video.duration && (video.currentTime / video.duration) >= COMPLETION_THRESHOLD) {
      isCompleted = true;
      localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
      completionBadge.classList.remove('hidden');
      setStatus('Video marked as completed.', 'success');
    }
  });

  video.addEventListener('durationchange', () => {
    durationEl.textContent = formatTime(video.duration);
    progressBar.setAttribute('aria-valuemax', '100');
  });

  // Buffered progress
  video.addEventListener('progress', updateBuffered);
  function updateBuffered() {
    if (!video.duration || !video.buffered.length) return;
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    progressBuffered.style.width = ((bufferedEnd / video.duration) * 100) + '%';
  }

  // Seeking
  progressBar.addEventListener('mousedown', () => { isSeeking = true; });
  progressBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });

  progressBar.addEventListener('input', () => {
    const time = (progressBar.value / 100) * video.duration;
    progressPlayed.style.width = progressBar.value + '%';
    currentTimeEl.textContent = formatTime(time);
  });

  progressBar.addEventListener('change', () => {
    video.currentTime = (progressBar.value / 100) * video.duration;
    isSeeking = false;
  });

  progressBar.addEventListener('mouseup', () => { isSeeking = false; });
  progressBar.addEventListener('touchend', () => { isSeeking = false; }, { passive: true });

  // ── Volume ────────────────────────────────────────────────────────────────────
  volumeSlider.addEventListener('input', () => {
    video.volume = parseFloat(volumeSlider.value);
    video.muted = video.volume === 0;
    volumeSlider.setAttribute('aria-valuenow', volumeSlider.value);
    updateMuteIcon();
  });

  function updateMuteIcon() {
    const muted = video.muted || video.volume === 0;
    muteBtn.querySelector('.icon-vol-high').classList.toggle('hidden', muted);
    muteBtn.querySelector('.icon-vol-mute').classList.toggle('hidden', !muted);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
      volumeSlider.value = 0.5;
    }
    updateMuteIcon();
  });

  video.addEventListener('volumechange', () => {
    volumeSlider.value = video.muted ? 0 : video.volume;
    updateMuteIcon();
  });

  // ── Playback Speed ────────────────────────────────────────────────────────────
  speedSelector.addEventListener('change', (e) => {
    e.stopPropagation();
    video.playbackRate = parseFloat(speedSelector.value);
  });

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const el = container.requestFullscreen || container.webkitRequestFullscreen;
      if (el) el.call(container);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  }

  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });

  function onFullscreenChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenBtn.querySelector('.icon-fullscreen').classList.toggle('hidden', isFs);
    fullscreenBtn.querySelector('.icon-exit-fullscreen').classList.toggle('hidden', !isFs);
    fullscreenBtn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ── Buffering State ───────────────────────────────────────────────────────────
  video.addEventListener('waiting', () => bufferingOverlay.classList.add('visible'));
  video.addEventListener('playing', () => bufferingOverlay.classList.remove('visible'));
  video.addEventListener('canplay', () => bufferingOverlay.classList.remove('visible'));

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────────
  container.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', (e) => {
    // Only handle if not focused on an input/select/button
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    handleKeydown(e);
  });

  function handleKeydown(e) {
    switch (e.code) {
      case 'Space':
      case 'KeyK':
        e.preventDefault();
        togglePlayPause();
        showCenterFlash(video.paused ? PLAY_PATH : PAUSE_PATH);
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.currentTime + SEEK_STEP, video.duration || 0);
        showControls();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(video.currentTime - SEEK_STEP, 0);
        showControls();
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(video.volume + VOLUME_STEP, 1);
        volumeSlider.value = video.volume;
        showControls();
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(video.volume - VOLUME_STEP, 0);
        volumeSlider.value = video.volume;
        showControls();
        break;
      case 'KeyM':
        e.preventDefault();
        video.muted = !video.muted;
        updateMuteIcon();
        break;
      case 'KeyF':
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }

  // ── Quality Selector ──────────────────────────────────────────────────────────
  qualitySelector.addEventListener('change', (e) => {
    e.stopPropagation();
    if (!hls) return;
    const val = parseInt(qualitySelector.value, 10);
    hls.currentLevel = val; // -1 = auto ABR
  });

  function populateQualitySelector(levels) {
    // Clear existing options except Auto
    qualitySelector.innerHTML = '<option value="-1">Auto</option>';
    levels.forEach((level, index) => {
      const label = level.height ? `${level.height}p` : `Level ${index}`;
      const opt = document.createElement('option');
      opt.value = index;
      opt.textContent = label;
      qualitySelector.appendChild(opt);
    });
  }

  function updateBitrateDisplay(levelIndex) {
    if (!hls || !hls.levels || levelIndex < 0) {
      bitrateDisplay.textContent = 'Auto';
      return;
    }
    const level = hls.levels[levelIndex];
    if (!level) return;
    const kbps = Math.round(level.bitrate / 1000);
    const label = level.height ? `${level.height}p` : `L${levelIndex}`;
    bitrateDisplay.textContent = `${label} · ${kbps}k`;
  }

  // ── Resume Progress ───────────────────────────────────────────────────────────
  function restoreProgress() {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY_PROGRESS));
    if (!isNaN(saved) && saved > 0 && saved < video.duration) {
      video.currentTime = saved;
      setStatus(`Resumed from ${formatTime(saved)}`);
    }
    if (isCompleted) {
      completionBadge.classList.remove('hidden');
    }
  }

  // ── HLS Initialization ────────────────────────────────────────────────────────
  function initPlayer() {
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(MANIFEST_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setStatus(`Manifest loaded — ${data.levels.length} quality levels available.`, 'success');
        populateQualitySelector(data.levels);
        restoreProgress();
        // Autoplay muted (browser policy), user can unmute
        video.muted = true;
        updateMuteIcon();
        video.play().catch(() => {
          setStatus('Click play to start the video.');
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        updateBitrateDisplay(data.level);
        // Keep quality selector in sync when ABR switches automatically
        if (hls.autoLevelEnabled) {
          qualitySelector.value = '-1';
        } else {
          qualitySelector.value = data.level;
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        updateBuffered();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setStatus('Network error — attempting to recover…', 'error');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setStatus('Media error — attempting to recover…', 'error');
              hls.recoverMediaError();
              break;
            default:
              setStatus('Fatal playback error. Please reload.', 'error');
              hls.destroy();
              break;
          }
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = MANIFEST_URL;
      video.addEventListener('loadedmetadata', () => {
        restoreProgress();
        video.play().catch(() => setStatus('Click play to start.'));
      });
      setStatus('Using native HLS playback (Safari).');
    } else {
      setStatus('HLS is not supported in this browser.', 'error');
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  setStatus('Loading player…');
  initPlayer();

})();
