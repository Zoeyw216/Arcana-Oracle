/**
 * AnimationEngine - 3D floating card animation for a tarot card web app.
 *
 * Cards orbit along an elliptical path, bob vertically, wobble gently,
 * and can be selected (fly to a target position) or highlighted on hover.
 *
 * All transforms use translate3d / rotateX / rotateY / rotateZ for GPU
 * acceleration.  A single requestAnimationFrame loop drives every card.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Attempt a cubic-bezier-ish ease-in-out via a simple polynomial. */
function easeCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function randomBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// ---------------------------------------------------------------------------
// Per-card state
// ---------------------------------------------------------------------------

class CardState {
  /**
   * @param {HTMLElement} el
   * @param {number}      baseAngle  – starting angle on the ellipse (radians)
   */
  constructor(el, baseAngle) {
    this.el = el;

    // Orbit
    this.baseAngle = baseAngle;   // target angle (redistributed on remove)
    this.currentAngle = baseAngle;

    // Vertical bob
    this.bobAmplitude = randomBetween(3, 6);   // px (reduced to prevent overlap)
    this.bobFrequency = randomBetween(0.5, 1.0); // Hz
    this.bobPhase = randomBetween(0, Math.PI * 2);

    // Wobble / tilt
    this.wobbleAmplitude = randomBetween(1, 3);  // degrees (reduced)
    this.wobbleFreqX = randomBetween(0.3, 0.7);
    this.wobbleFreqY = randomBetween(0.25, 0.6);
    this.wobblePhaseX = randomBetween(0, Math.PI * 2);
    this.wobblePhaseY = randomBetween(0, Math.PI * 2);

    // Highlight
    this.highlighted = false;
    this.highlightPhase = 0; // used for pulse glow

    // Selection flight
    this.selecting = false;
    this.selectStartTime = 0;
    this.selectDuration = 700; // ms
    this.selectStartPos = { x: 0, y: 0, z: 0 };
    this.selectStartRot = { rx: 0, ry: 0, rz: 0 };
    this.selectTargetPos = { x: 0, y: 0 };
    this.selectResolve = null;

    // Cached computed position so we can read it when starting selection
    this.lastPos = { x: 0, y: 0, z: 0 };
    this.lastRot = { rx: 0, ry: 0, rz: 0 };
  }
}

// ---------------------------------------------------------------------------
// AnimationEngine
// ---------------------------------------------------------------------------

export class AnimationEngine {
  /**
   * @param {HTMLElement} containerEl – the element that holds all card elements
   */
  constructor(containerEl) {
    this.container = containerEl;

    // Apply 3-D context styles once
    this.container.style.perspective = '1200px';
    this.container.style.transformStyle = 'preserve-3d';

    /** @type {CardState[]} */
    this.cards = [];

    // Ellipse radii – computed from container on first frame
    this.radiusX = 0;
    this.radiusY = 0;
    this._radiiSet = false;

    // Global orbit speed (radians / second)
    this.orbitSpeed = 0.5;

    // rAF handle
    this._rafId = null;
    this._running = false;
    this._lastTimestamp = null;

    // Optional hand-tracking cursor influence
    this._hoverX = 0;
    this._hoverY = 0;

    // Bind once so we can cancel
    this._tick = this._tick.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Register a card element for animation.
   *
   * @param {HTMLElement} cardEl
   * @param {number}      index  – 0-based index among all cards
   * @param {number}      total  – total number of cards being added
   */
  addCard(cardEl, index, total) {
    const baseAngle = (2 * Math.PI * index) / total;
    const state = new CardState(cardEl, baseAngle);

    // Make sure the element can be transformed without causing layout shifts
    cardEl.style.position = 'absolute';
    cardEl.style.willChange = 'transform';

    this.cards.push(state);
  }

  /** Start (or resume) the animation loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTimestamp = null;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Pause the animation loop. */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Visually highlight a card (glow / pulse).
   * @param {HTMLElement} cardEl
   */
  highlightCard(cardEl) {
    const state = this._findState(cardEl);
    if (state) {
      state.highlighted = true;
      state.highlightPhase = 0;
    }
  }

  /**
   * Remove the highlight effect from a card.
   * @param {HTMLElement} cardEl
   */
  unhighlightCard(cardEl) {
    const state = this._findState(cardEl);
    if (state) {
      state.highlighted = false;
      cardEl.style.filter = '';
      cardEl.style.boxShadow = '';
    }
  }

  /**
   * Animate a card flying from its current orbit position to `targetPos`.
   *
   * @param   {HTMLElement}          cardEl
   * @param   {{ x: number, y: number }} targetPos – position in container coords
   * @returns {Promise<void>}        resolves when the flight animation finishes
   */
  selectCard(cardEl, targetPos) {
    const state = this._findState(cardEl);
    if (!state) return Promise.resolve();

    return new Promise((resolve) => {
      state.selecting = true;
      state.selectStartTime = performance.now();
      state.selectStartPos = { ...state.lastPos };
      state.selectStartRot = { ...state.lastRot };
      state.selectTargetPos = { x: targetPos.x, y: targetPos.y };
      state.selectResolve = resolve;

      // Redistribute remaining cards smoothly
      this._redistributeAngles(state);
    });
  }

  /**
   * Remove a card from the animation system entirely.
   * @param {HTMLElement} cardEl
   */
  removeCard(cardEl) {
    const idx = this.cards.findIndex((s) => s.el === cardEl);
    if (idx === -1) return;
    this.cards.splice(idx, 1);

    // Redistribute angles among remaining cards
    this._redistributeAngles();
  }

  /**
   * Feed in a cursor / hand-tracking position so the orbit can
   * subtly respond (parallax effect).
   *
   * @param {number} x
   * @param {number} y
   */
  setHoverPosition(x, y) {
    this._hoverX = x;
    this._hoverY = y;
  }

  /**
   * Dynamically adjust orbit speed (e.g. for hand gesture control).
   * @param {number} speed – radians per second
   */
  setOrbitSpeed(speed) {
    this.orbitSpeed = speed;
  }

  // -----------------------------------------------------------------------
  // Internal – animation loop
  // -----------------------------------------------------------------------

  /**
   * The single rAF callback that drives all card transforms.
   * @param {number} timestamp – DOMHighResTimeStamp
   */
  _tick(timestamp) {
    if (!this._running) return;

    const frameStart = performance.now();

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp;
    }
    const dt = (timestamp - this._lastTimestamp) / 1000; // seconds
    this._lastTimestamp = timestamp;

    // Time in seconds since page load (for sin/cos)
    const t = timestamp / 1000;

    // Container centre
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const cx = cw / 2;
    const cy = ch / 2;

    // Compute orbit radii — tight ring
    if (!this._radiiSet || this._frameCount % 60 === 0) {
      this.radiusX = Math.min(cw * 0.42, 480);
      this.radiusY = Math.min(ch * 0.15, 120);
      this._radiiSet = true;
    }
    this._frameCount = (this._frameCount || 0) + 1;

    // Snapshot to avoid issues with array mutation during iteration
    const cardsSnapshot = [...this.cards];
    for (const card of cardsSnapshot) {
      if (card.selecting) {
        this._tickSelecting(card, timestamp);
        continue;
      }

      // --- Orbit angle progression ----------------------------------------
      card.currentAngle = lerp(card.currentAngle, card.baseAngle, 0.03);
      card.baseAngle += this.orbitSpeed * dt;

      const angle = card.currentAngle;
      // Normalize angle to [0, 2π)
      const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      // depth: 0 = front (bottom of ellipse, angle=π/2), 1 = back (top, angle=3π/2)
      // sin(angle): +1 at bottom (front), -1 at top (back)
      const depthFactor = Math.sin(angle); // +1=front, -1=back

      // --- Position on ellipse ---
      const cardW = card.el.offsetWidth || 80;
      const cardH = card.el.offsetHeight || 124;
      const ex = cx + this.radiusX * Math.cos(angle) - cardW / 2;
      const ey = cy + this.radiusY * Math.sin(angle) - cardH / 2;

      // Depth z-offset: front cards closer, back cards further
      const z = 40 * depthFactor;

      const posX = ex;
      const posY = ey;
      const posZ = z;

      // --- Scale by depth: front cards full size, back cards smaller ---
      const scaleVal = clamp(0.7 + 0.3 * ((depthFactor + 1) / 2), 0.55, 1.0);

      // --- Opacity: front cards opaque, back cards faded ---
      const opacityVal = clamp(0.5 + 0.5 * ((depthFactor + 1) / 2), 0.55, 1.0);

      // --- Slight tilt following the ring curve ---
      const rz = 0; // no wobble for clean ring look

      // --- Apply transform ------------------------------------------------
      card.el.style.transform =
        `translate3d(${posX}px, ${posY}px, ${posZ}px) scale(${scaleVal})`;
      card.el.style.opacity = opacityVal;

      // Disable pointer events on back cards (top half of ellipse)
      card.el.style.pointerEvents = depthFactor > -0.2 ? 'auto' : 'none';

      // Cache for selection start snapshot
      card.lastPos = { x: posX, y: posY, z: posZ };
      card.lastRot = { rx: 0, ry: 0, rz: 0 };

      // --- Highlight glow (only for front cards) -------------------------
      if (card.highlighted && depthFactor > -0.2) {
        card.highlightPhase += dt;
        const pulse = 0.5 + 0.5 * Math.sin(card.highlightPhase * 4);
        const glowSize = lerp(4, 14, pulse);
        const glowOpacity = lerp(0.5, 1, pulse);
        card.el.style.filter =
          `drop-shadow(0 0 ${glowSize}px rgba(180, 140, 255, ${glowOpacity}))`;
      } else {
        card.el.style.filter = '';
      }

      // z-index by depth so front cards are on top
      card.el.style.zIndex = Math.round(posZ + 100);
    }

    // --- Frame budget warning --------------------------------------------
    const elapsed = performance.now() - frameStart;
    if (elapsed > 16) {
      console.warn(
        `[AnimationEngine] Frame budget exceeded: ${elapsed.toFixed(2)}ms`
      );
    }

    this._rafId = requestAnimationFrame(this._tick);
  }

  /**
   * Drive the "fly to target" animation for a card that has been selected.
   *
   * @param {CardState} card
   * @param {number}    timestamp
   */
  _tickSelecting(card, timestamp) {
    const elapsed = timestamp - card.selectStartTime;
    const rawT = clamp(elapsed / card.selectDuration, 0, 1);
    const t = easeCubic(rawT);

    const x = lerp(card.selectStartPos.x, card.selectTargetPos.x, t);
    const y = lerp(card.selectStartPos.y, card.selectTargetPos.y, t);
    const z = lerp(card.selectStartPos.z, 0, t); // bring to z=0

    const rx = lerp(card.selectStartRot.rx, 0, t);
    const ry = lerp(card.selectStartRot.ry, 0, t);
    const rz = lerp(card.selectStartRot.rz, 0, t);

    card.el.style.transform =
      `translate3d(${x}px, ${y}px, ${z}px) ` +
      `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

    card.el.style.zIndex = '999';

    if (rawT >= 1) {
      card.selecting = false;
      // Hide the card and remove from animation system
      card.el.style.display = 'none';
      this.removeCard(card.el);
      if (card.selectResolve) {
        card.selectResolve();
        card.selectResolve = null;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Smoothly redistribute base angles among all non-selecting cards.
   * If `excludeState` is provided that card is skipped.
   *
   * @param {CardState} [excludeState]
   */
  _redistributeAngles(excludeState) {
    const active = this.cards.filter(
      (c) => c !== excludeState && !c.selecting
    );
    if (active.length === 0) return;

    const step = (2 * Math.PI) / active.length;

    // Use the first card's current angle as the origin to avoid sudden jumps
    const origin = active[0].currentAngle;

    active.forEach((card, i) => {
      card.baseAngle = origin + step * i;
      // currentAngle will lerp towards baseAngle each frame
    });
  }

  /**
   * Find the CardState for a given DOM element.
   *
   * @param  {HTMLElement} el
   * @return {CardState|undefined}
   */
  _findState(el) {
    return this.cards.find((s) => s.el === el);
  }
}
