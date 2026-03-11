// Hand gesture tracking using MediaPipe Hands
// Self-hosted assets in assets/mediapipe/

import { FilesetResolver, HandLandmarker } from '../assets/mediapipe/vision_bundle.mjs';

const FINGERTIP_INDICES = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky tips
const PALM_CENTER_INDEX = 9; // middle finger MCP as palm proxy
const GRAB_THRESHOLD = 0.14; // normalized distance threshold for grab detection (relaxed for mobile)
const GRAB_DEBOUNCE_MS = 350;
const GRAB_CONFIRM_FRAMES = 2; // require grab detected for N consecutive frames before firing
const SMOOTHING = 0.35; // cursor position smoothing factor (0 = no smooth, 1 = max smooth)

export class HandTracker {
  constructor(options = {}) {
    this.onHandMove = options.onHandMove || (() => {});
    this.onGrab = options.onGrab || (() => {});
    this.onRelease = options.onRelease || (() => {});
    this.onTrackingStart = options.onTrackingStart || (() => {});
    this.onTrackingEnd = options.onTrackingEnd || (() => {});

    this.handLandmarker = null;
    this.video = null;
    this.stream = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.isGrabbing = false;
    this.grabDebounce = false;
    this.smoothX = 0.5;
    this.smoothY = 0.5;
    this.handDetected = false;
    this.frameId = null;
    this.grabFrameCount = 0; // consecutive frames with grab detected
  }

  async init() {
    const wasmPath = new URL('../assets/mediapipe/wasm', import.meta.url).href;

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    // Try GPU first, fall back to CPU
    let delegate = 'GPU';
    try {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: new URL('../assets/mediapipe/hand_landmarker.task', import.meta.url).href,
          delegate
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
    } catch (gpuErr) {
      console.warn('GPU delegate failed, falling back to CPU:', gpuErr.message);
      delegate = 'CPU';
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: new URL('../assets/mediapipe/hand_landmarker.task', import.meta.url).href,
          delegate
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
    }

    return true;
  }

  async startCamera(previewEl) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      this.video = document.createElement('video');
      this.video.setAttribute('autoplay', '');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('muted', '');
      this.video.srcObject = this.stream;
      await this.video.play();

      // Show preview if element provided
      if (previewEl) {
        previewEl.srcObject = this.stream;
        previewEl.play();
      }

      this.running = true;
      this._trackingLoop();
      this.onTrackingStart();
      return true;
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err.message);
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.onTrackingEnd();
  }

  _trackingLoop() {
    if (!this.running || !this.video || !this.handLandmarker) return;

    if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
      this.lastVideoTime = this.video.currentTime;

      const results = this.handLandmarker.detectForVideo(this.video, performance.now());

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        this._processHand(landmarks);
        if (!this.handDetected) {
          this.handDetected = true;
        }
      } else {
        if (this.handDetected) {
          this.handDetected = false;
          this.onHandMove({ x: -1, y: -1, visible: false, grabbing: false });
        }
      }
    }

    this.frameId = requestAnimationFrame(() => this._trackingLoop());
  }

  _processHand(landmarks) {
    const palm = landmarks[PALM_CENTER_INDEX];

    // Mirror X for selfie view, map to screen coordinates
    const rawX = 1 - palm.x;
    const rawY = palm.y;

    // Smooth cursor movement
    this.smoothX = this.smoothX * SMOOTHING + rawX * (1 - SMOOTHING);
    this.smoothY = this.smoothY * SMOOTHING + rawY * (1 - SMOOTHING);

    const screenX = this.smoothX * window.innerWidth;
    const screenY = this.smoothY * window.innerHeight;

    // Detect grab gesture with multi-frame confirmation
    const rawGrab = this._detectGrab(landmarks);
    const wasGrabbing = this.isGrabbing;

    if (rawGrab) {
      this.grabFrameCount++;
    } else {
      this.grabFrameCount = 0;
    }

    // Only confirm grab after N consecutive frames
    this.isGrabbing = this.grabFrameCount >= GRAB_CONFIRM_FRAMES;

    // Emit hand position
    this.onHandMove({
      x: screenX,
      y: screenY,
      visible: true,
      grabbing: this.isGrabbing
    });

    // Emit grab/release events with debounce
    if (this.isGrabbing && !wasGrabbing && !this.grabDebounce) {
      this.grabDebounce = true;
      this.onGrab({ x: screenX, y: screenY });
      setTimeout(() => { this.grabDebounce = false; }, GRAB_DEBOUNCE_MS);
    }

    if (!this.isGrabbing && wasGrabbing) {
      this.onRelease({ x: screenX, y: screenY });
    }
  }

  _detectGrab(landmarks) {
    const palm = landmarks[PALM_CENTER_INDEX];
    let closedCount = 0;

    for (const tipIdx of FINGERTIP_INDICES) {
      const tip = landmarks[tipIdx];
      const dist = Math.sqrt(
        (tip.x - palm.x) ** 2 +
        (tip.y - palm.y) ** 2 +
        (tip.z - palm.z) ** 2
      );
      if (dist < GRAB_THRESHOLD) closedCount++;
    }

    // Require 3+ fingers close to palm for grab
    return closedCount >= 3;
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
