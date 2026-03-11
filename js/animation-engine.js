/**
 * AnimationEngine - 3D floating card animation for a tarot card web app.
 *
 * Cards orbit along an elliptical path with true 3D depth.
 * On mobile, the ring is tighter and more dramatic — back cards
 * shrink and hide behind the front row for a carousel feel.
 *
 * All transforms use translate3d / scale for GPU acceleration.
 * A single requestAnimationFrame loop drives every card.
 *
 * Performance-optimised: dimensions cached, style writes minimised,
 * zero per-frame allocation.
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
   * @param {number}      width      – cached element width
   * @param {number}      height     – cached element height
   */
  constructor(el, baseAngle, width, height) {
    this.el = el;

    // Cached dimensions (avoid per-frame offsetWidth/offsetHeight reads)
    this.width = width;
    this.height = height;

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

    // Previous style values — only write to DOM when changed
    this._prevPointerEvents = '';
    this._prevFilter = '';
    this._prevZIndex = -1;
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

    // Cached container dimensions (updated via ResizeObserver)
    this._cw = containerEl.clientWidth;
    this._ch = containerEl.clientHeight;
    this._cx = this._cw / 2;
    this._cy = this._ch / 2;

    // Ellipse radii
    this.radiusX = 0;
    this.radiusY = 0;

    // Depth rendering parameters (adjusted per viewport)
    this._scaleMin = 0.55;
    this._scaleMax = 1.0;
    this._opacityMin = 0.55;
    this._opacityMax = 1.0;
    this._depthZ = 40;
    this._depthPower = 1.0;   // steeper = more dramatic front/back separation
    this._speedMult = 1.0;    // orbit speed multiplier (mobile faster)
    this._isMobile = false;

    this._updateLayout();

    // Global orbit speed (radians / second)
    this.orbitSpeed = 0.8;

    // rAF handle
    this._rafId = null;
    this._running = false;
    this._lastTimestamp = null;

    // Optional hand-tracking cursor influence
    this._hoverX = 0;
    this._hoverY = 0;

    // Bind once so we can cancel
    this._tick = this._tick.bind(this);

    // Listen for container resize — update cached dimensions without per-frame reads
    this._resizeObserver = new ResizeObserver(() => {
      this._cw = this.container.clientWidth;
      this._ch = this.container.clientHeight;
      this._cx = this._cw / 2;
      this._cy = this._ch / 2;
      this._updateLayout();
    });
    this._resizeObserver.observe(this.container);
  }

  /**
   * Recompute ellipse radii + depth parameters based on viewport.
   *
   * Mobile (≤ 480px): tight flat ring with dramatic depth —
   *   back cards shrink to ~25% and fade to 0, hiding behind front row.
   *
   * Desktop: gentle ring with subtle depth.
   */
  _updateLayout() {
    this._isMobile = this._cw <= 480;

    if (this._isMobile) {
      // --- Mobile 3D carousel ---
      // Wider ellipse for horizontal spread, very flat vertically
      this.radiusX = this._cw * 0.47;
      this.radiusY = 40;
      // Aggressive depth: only front 2-3 cards fully visible
      this._scaleMin = 0.25;
      this._scaleMax = 1.0;
      this._opacityMin = 0.0;
      this._opacityMax = 1.0;
      this._depthZ = 80;
      // Power curve makes depth drop steeply behind the front row
      this._depthPower = 1.8;
      // Moderate orbit so rotation is visible but not dizzying
      this._speedMult = 1.5;
      this.container.style.perspective = '600px';
    } else {
      // --- Desktop gentle ring ---
      this.radiusX = Math.min(this._cw * 0.42, 480);
      this.radiusY = Math.min(this._ch * 0.15, 120);
      this._scaleMin = 0.55;
      this._scaleMax = 1.0;
      this._opacityMin = 0.55;
      this._opacityMax = 1.0;
      this._depthZ = 40;
      this._depthPower = 1.0;
      this._speedMult = 1.0;
      this.container.style.perspective = '1200px';
    }
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

    // Cache dimensions once — avoids per-frame layout reads
    const w = cardEl.offsetWidth || 80;
    const h = cardEl.offsetHeight || 124;
    const state = new CardState(cardEl, baseAngle, w, h);

    // Make sure the element can be transformed without causing layout shifts
    cardEl.style.position = 'absolute';
    cardEl.style.willChange = 'transform, opacity';

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
      state._prevFilter = '';
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
      state.selectStartPos.x = state.lastPos.x;
      state.selectStartPos.y = state.lastPos.y;
      state.selectStartPos.z = state.lastPos.z;
      state.selectStartRot.rx = state.lastRot.rx;
      state.selectStartRot.ry = state.lastRot.ry;
      state.selectStartRot.rz = state.lastRot.rz;
      state.selectTargetPos.x = targetPos.x;
      state.selectTargetPos.y = targetPos.y;
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

    if (this._lastTimestamp === null) {
      this._lastTimestamp = timestamp;
    }
    const dt = (timestamp - this._lastTimestamp) / 1000; // seconds
    this._lastTimestamp = timestamp;

    // Use cached container centre (updated by ResizeObserver)
    const cx = this._cx;
    const cy = this._cy;

    // Cache depth parameters as locals for hot loop
    const sMin = this._scaleMin;
    const sRange = this._scaleMax - this._scaleMin;
    const oMin = this._opacityMin;
    const oRange = this._opacityMax - this._opacityMin;
    const dZ = this._depthZ;
    const dPow = this._depthPower;
    const sMult = this._speedMult;
    const rX = this.radiusX;
    const rY = this.radiusY;

    // Snapshot: _tickSelecting → removeCard → splice() can mutate this.cards mid-loop
    const cards = [...this.cards];
    const len = cards.length;
    for (let i = 0; i < len; i++) {
      const card = cards[i];

      if (card.selecting) {
        this._tickSelecting(card, timestamp);
        continue;
      }

      // --- Orbit angle progression ----------------------------------------
      card.currentAngle = lerp(card.currentAngle, card.baseAngle, 0.03);
      card.baseAngle += this.orbitSpeed * sMult * dt;

      const angle = card.currentAngle;
      const depthFactor = Math.sin(angle); // +1=front, -1=back

      // Normalized 0→1 (0=back, 1=front), then apply power curve
      // dPow > 1 = steeper falloff → only front cards prominent
      const depthLinear = clamp((depthFactor + 1) * 0.5, 0, 1);
      const depthNorm = dPow === 1 ? depthLinear : Math.pow(depthLinear, dPow);

      // --- Position on ellipse (use cached card dimensions) ---------------
      const posX = cx + rX * Math.cos(angle) - card.width / 2;
      const posY = cy + rY * Math.sin(angle) - card.height / 2;
      const posZ = dZ * depthFactor;

      // --- Scale & opacity by depth ---------------------------------------
      const scaleVal = sMin + sRange * depthNorm;
      const opacityVal = oMin + oRange * depthNorm;

      // --- Apply transform + opacity in one write -------------------------
      card.el.style.transform =
        `translate3d(${posX.toFixed(1)}px,${posY.toFixed(1)}px,${posZ.toFixed(1)}px) scale(${scaleVal.toFixed(3)})`;
      card.el.style.opacity = opacityVal;

      // Disable pointer events on back cards (only write when changed)
      const pe = depthFactor > -0.2 ? 'auto' : 'none';
      if (card._prevPointerEvents !== pe) {
        card.el.style.pointerEvents = pe;
        card._prevPointerEvents = pe;
      }

      // Cache for selection start snapshot (reuse existing objects)
      card.lastPos.x = posX;
      card.lastPos.y = posY;
      card.lastPos.z = posZ;
      card.lastRot.rx = 0;
      card.lastRot.ry = 0;
      card.lastRot.rz = 0;

      // --- Highlight glow (only for front cards) -------------------------
      let filterVal = '';
      if (card.highlighted && depthFactor > -0.2) {
        card.highlightPhase += dt;
        const pulse = 0.5 + 0.5 * Math.sin(card.highlightPhase * 4);
        const glowSize = lerp(4, 14, pulse);
        const glowOpacity = lerp(0.5, 1, pulse);
        filterVal =
          `drop-shadow(0 0 ${glowSize.toFixed(0)}px rgba(180,140,255,${glowOpacity.toFixed(2)}))`;
      }
      if (card._prevFilter !== filterVal) {
        card.el.style.filter = filterVal;
        card._prevFilter = filterVal;
      }

      // z-index by depth so front cards are on top (only write when changed)
      const zi = Math.round(posZ + 100);
      if (card._prevZIndex !== zi) {
        card.el.style.zIndex = zi;
        card._prevZIndex = zi;
      }
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
