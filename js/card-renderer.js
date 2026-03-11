// ============================================================================
// card-renderer.js  --  Art Nouveau / Alphonse Mucha-style tarot card renderer
// Renders 220x360 card faces & backs with inline SVG + CSS
// ES module  --  vanilla JS, no frameworks
// ============================================================================

const CARD_W = 220;
const CARD_H = 360;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Pad card id to 2 digits */
function padId(id) {
  return String(id).padStart(2, '0');
}

/** Convert English name to kebab-case filename segment */
function nameToSlug(nameEn) {
  return nameEn.toLowerCase().replace(/\s+/g, '-');
}

/** Build expected image path */
function imagePath(card) {
  return `assets/cards/${padId(card.id)}-${nameToSlug(card.nameEn)}.png`;
}

/** Probe whether an image URL loads successfully */
function probeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// SVG building blocks -- Art Nouveau decorative elements
// ---------------------------------------------------------------------------

/** Ornate Art Nouveau outer frame with flowing organic curves */
function svgFrame(primary, secondary) {
  return `
    <!-- Outer golden border -->
    <rect x="4" y="4" width="212" height="352" rx="14" ry="14"
          fill="none" stroke="${primary}" stroke-width="1.5" opacity="0.6"/>
    <rect x="8" y="8" width="204" height="344" rx="11" ry="11"
          fill="none" stroke="${primary}" stroke-width="0.5" opacity="0.35"/>

    <!-- Corner ornaments -- top-left -->
    <g opacity="0.7">
      <path d="M18,18 Q14,18 14,22 L14,48 Q14,52 18,55 Q22,52 22,48 L22,30
               Q22,22 30,18 L18,18 Z"
            fill="none" stroke="${primary}" stroke-width="0.8"/>
      <circle cx="18" cy="18" r="2.5" fill="${primary}" opacity="0.5"/>
      <path d="M14,35 Q8,40 14,45" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <path d="M25,14 Q30,8 35,14" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <!-- Small flower -->
      <circle cx="14" cy="40" r="1.2" fill="${secondary}" opacity="0.6"/>
      <circle cx="30" cy="14" r="1.2" fill="${secondary}" opacity="0.6"/>
    </g>

    <!-- Corner ornaments -- top-right (mirrored) -->
    <g opacity="0.7" transform="translate(220,0) scale(-1,1)">
      <path d="M18,18 Q14,18 14,22 L14,48 Q14,52 18,55 Q22,52 22,48 L22,30
               Q22,22 30,18 L18,18 Z"
            fill="none" stroke="${primary}" stroke-width="0.8"/>
      <circle cx="18" cy="18" r="2.5" fill="${primary}" opacity="0.5"/>
      <path d="M14,35 Q8,40 14,45" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <path d="M25,14 Q30,8 35,14" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <circle cx="14" cy="40" r="1.2" fill="${secondary}" opacity="0.6"/>
      <circle cx="30" cy="14" r="1.2" fill="${secondary}" opacity="0.6"/>
    </g>

    <!-- Corner ornaments -- bottom-left (mirrored vertically) -->
    <g opacity="0.7" transform="translate(0,360) scale(1,-1)">
      <path d="M18,18 Q14,18 14,22 L14,48 Q14,52 18,55 Q22,52 22,48 L22,30
               Q22,22 30,18 L18,18 Z"
            fill="none" stroke="${primary}" stroke-width="0.8"/>
      <circle cx="18" cy="18" r="2.5" fill="${primary}" opacity="0.5"/>
      <path d="M14,35 Q8,40 14,45" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <path d="M25,14 Q30,8 35,14" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <circle cx="14" cy="40" r="1.2" fill="${secondary}" opacity="0.6"/>
      <circle cx="30" cy="14" r="1.2" fill="${secondary}" opacity="0.6"/>
    </g>

    <!-- Corner ornaments -- bottom-right (mirrored both) -->
    <g opacity="0.7" transform="translate(220,360) scale(-1,-1)">
      <path d="M18,18 Q14,18 14,22 L14,48 Q14,52 18,55 Q22,52 22,48 L22,30
               Q22,22 30,18 L18,18 Z"
            fill="none" stroke="${primary}" stroke-width="0.8"/>
      <circle cx="18" cy="18" r="2.5" fill="${primary}" opacity="0.5"/>
      <path d="M14,35 Q8,40 14,45" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <path d="M25,14 Q30,8 35,14" fill="none" stroke="${primary}" stroke-width="0.5"/>
      <circle cx="14" cy="40" r="1.2" fill="${secondary}" opacity="0.6"/>
      <circle cx="30" cy="14" r="1.2" fill="${secondary}" opacity="0.6"/>
    </g>

    <!-- Side vine flourishes -- left -->
    <path d="M12,80 Q6,110 12,140 Q6,170 12,200 Q6,230 12,260"
          fill="none" stroke="${primary}" stroke-width="0.5" opacity="0.3"/>
    <path d="M10,100 Q5,102 8,108" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="7" cy="105" r="1" fill="${secondary}" opacity="0.35"/>
    <path d="M10,180 Q5,182 8,188" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="7" cy="185" r="1" fill="${secondary}" opacity="0.35"/>
    <path d="M10,240 Q5,242 8,248" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="7" cy="245" r="1" fill="${secondary}" opacity="0.35"/>

    <!-- Side vine flourishes -- right -->
    <path d="M208,80 Q214,110 208,140 Q214,170 208,200 Q214,230 208,260"
          fill="none" stroke="${primary}" stroke-width="0.5" opacity="0.3"/>
    <path d="M210,100 Q215,102 212,108" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="213" cy="105" r="1" fill="${secondary}" opacity="0.35"/>
    <path d="M210,180 Q215,182 212,188" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="213" cy="185" r="1" fill="${secondary}" opacity="0.35"/>
    <path d="M210,240 Q215,242 212,248" fill="none" stroke="${secondary}" stroke-width="0.4" opacity="0.4"/>
    <circle cx="213" cy="245" r="1" fill="${secondary}" opacity="0.35"/>
  `;
}

/** Decorative numeral frame at the top of the card */
function svgNumeralFrame(numeral, primary, secondary) {
  return `
    <g>
      <!-- Arch frame for numeral -->
      <path d="M70,16 Q110,4 150,16"
            fill="none" stroke="${primary}" stroke-width="0.8" opacity="0.6"/>
      <path d="M75,20 Q110,10 145,20"
            fill="none" stroke="${primary}" stroke-width="0.5" opacity="0.4"/>
      <!-- Small decorative dots flanking numeral -->
      <circle cx="72" cy="24" r="1.5" fill="${primary}" opacity="0.5"/>
      <circle cx="148" cy="24" r="1.5" fill="${primary}" opacity="0.5"/>
      <!-- Diamond accents -->
      <polygon points="68,24 72,20 76,24 72,28" fill="none" stroke="${primary}"
               stroke-width="0.5" opacity="0.4"/>
      <polygon points="144,24 148,20 152,24 148,28" fill="none" stroke="${primary}"
               stroke-width="0.5" opacity="0.4"/>
      <!-- Numeral text -->
      <text x="110" y="27" text-anchor="middle" fill="${primary}"
            font-family="'Cinzel', serif" font-size="14" font-weight="700"
            letter-spacing="3">${numeral}</text>
      <!-- Thin rule below numeral -->
      <line x1="82" y1="34" x2="138" y2="34"
            stroke="${primary}" stroke-width="0.4" opacity="0.4"/>
    </g>
  `;
}

/** Central illustration area -- renders the card's svgPath as golden line art */
function svgCentralArt(svgPath, primary, secondary, uid) {
  // The svgPath data is drawn in a ~130x100 coordinate space
  // We translate and scale it into the card's central panel
  return `
    <g>
      <!-- Oval halo / aureole behind the figure -->
      <ellipse cx="110" cy="160" rx="58" ry="72"
               fill="none" stroke="${primary}" stroke-width="0.5" opacity="0.15"/>
      <ellipse cx="110" cy="160" rx="52" ry="66"
               fill="none" stroke="${primary}" stroke-width="0.3" opacity="0.1"/>

      <!-- Radial decoration -- small star/dot ring -->
      ${Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30) * Math.PI / 180;
        const cx = 110 + Math.cos(angle) * 62;
        const cy = 160 + Math.sin(angle) * 76;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="0.8"
                        fill="${primary}" opacity="0.25"/>`;
      }).join('\n      ')}

      <!-- Card symbol artwork (golden line art) -->
      <g transform="translate(45,108) scale(1.38,1.2)">
        <path d="${svgPath}"
              fill="none" stroke="url(#goldGrad_${uid})" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"
              filter="url(#glow_${uid})"/>
      </g>

      <!-- Art Nouveau arch above illustration -->
      <path d="M35,95 Q50,80 75,78 Q110,72 145,78 Q170,80 185,95"
            fill="none" stroke="${primary}" stroke-width="0.6" opacity="0.3"/>
      <!-- Arch accent line -->
      <path d="M42,92 Q75,82 110,78 Q145,82 178,92"
            fill="none" stroke="${secondary}" stroke-width="0.3" opacity="0.25"/>

      <!-- Art Nouveau arch below illustration -->
      <path d="M35,235 Q50,248 75,250 Q110,255 145,250 Q170,248 185,235"
            fill="none" stroke="${primary}" stroke-width="0.6" opacity="0.3"/>
      <path d="M42,238 Q75,246 110,250 Q145,246 178,238"
            fill="none" stroke="${secondary}" stroke-width="0.3" opacity="0.25"/>

      <!-- Small decorative flowers/stars at arch peaks -->
      <g transform="translate(110,74)" opacity="0.5">
        ${smallStar(0, 0, primary)}
      </g>
      <g transform="translate(110,256)" opacity="0.5">
        ${smallStar(0, 0, primary)}
      </g>
    </g>
  `;
}

/** Name banner at the bottom of the card */
function svgNameBanner(name, nameEn, primary, secondary) {
  return `
    <g>
      <!-- Banner decorative frame -->
      <path d="M30,285 Q30,278 40,278 L180,278 Q190,278 190,285
               L190,310 Q190,318 180,318 L40,318 Q30,318 30,310 Z"
            fill="none" stroke="${primary}" stroke-width="0.7" opacity="0.45"/>
      <!-- Inner line -->
      <path d="M35,283 L185,283" stroke="${primary}" stroke-width="0.3" opacity="0.3"/>
      <path d="M35,313" stroke="${primary}" stroke-width="0.3" opacity="0.3"/>

      <!-- Banner end flourishes -->
      <path d="M28,290 Q22,298 28,306" fill="none" stroke="${primary}"
            stroke-width="0.5" opacity="0.35"/>
      <path d="M192,290 Q198,298 192,306" fill="none" stroke="${primary}"
            stroke-width="0.5" opacity="0.35"/>
      <circle cx="22" cy="298" r="1.2" fill="${secondary}" opacity="0.4"/>
      <circle cx="198" cy="298" r="1.2" fill="${secondary}" opacity="0.4"/>

      <!-- Chinese card name -->
      <text x="110" y="302" text-anchor="middle" fill="${primary}"
            font-family="'Noto Serif SC', serif" font-size="16" font-weight="700"
            letter-spacing="4">${name}</text>

      <!-- English name below -->
      <text x="110" y="330" text-anchor="middle" fill="${primary}"
            font-family="'Cinzel', serif" font-size="9" letter-spacing="1.5"
            opacity="0.55">${nameEn.toUpperCase()}</text>

      <!-- Small decorative rule under English name -->
      <line x1="75" y1="336" x2="145" y2="336"
            stroke="${primary}" stroke-width="0.3" opacity="0.3"/>

      <!-- Tiny bottom ornaments -->
      <circle cx="75" cy="336" r="1" fill="${primary}" opacity="0.3"/>
      <circle cx="145" cy="336" r="1" fill="${primary}" opacity="0.3"/>
      <circle cx="110" cy="340" r="1.2" fill="${secondary}" opacity="0.3"/>
    </g>
  `;
}

/** Tiny 4-point star decoration */
function smallStar(cx, cy, color) {
  return `
    <path d="M${cx},${cy - 4} L${cx + 1},${cy - 1} L${cx + 4},${cy}
             L${cx + 1},${cy + 1} L${cx},${cy + 4} L${cx - 1},${cy + 1}
             L${cx - 4},${cy} L${cx - 1},${cy - 1} Z"
          fill="${color}" opacity="0.6"/>
  `;
}

/** Background fill with gradient and subtle pattern */
function svgBackground(card, uid) {
  const { primary, secondary, bg } = card.colors;

  // Parse gradient colors from the bg CSS string
  // Format: "linear-gradient(135deg, #color1, #color2)"
  let bgColor1 = '#f5f0e4';
  let bgColor2 = '#ede6d4';
  const match = bg.match(/#[0-9A-Fa-f]{6}/g);
  if (match && match.length >= 2) {
    bgColor1 = match[0];
    bgColor2 = match[1];
  }

  return `
    <defs>
      <!-- Card background gradient -->
      <linearGradient id="bgGrad_${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgColor1}"/>
        <stop offset="100%" stop-color="${bgColor2}"/>
      </linearGradient>
      <!-- Golden gradient for line art -->
      <linearGradient id="goldGrad_${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5d78e"/>
        <stop offset="50%" stop-color="${primary}"/>
        <stop offset="100%" stop-color="#c9a24e"/>
      </linearGradient>
      <!-- Glow filter for the central art -->
      <filter id="glow_${uid}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <!-- Subtle radial vignette -->
      <radialGradient id="vignette_${uid}" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="white" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.15"/>
      </radialGradient>
      <!-- Ornament pattern tile -->
      <pattern id="ornPat_${uid}" x="0" y="0" width="44" height="44"
               patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M22,0 Q26,10 22,22 Q18,10 22,0 Z" fill="${primary}" opacity="0.018"/>
        <path d="M0,22 Q10,18 22,22 Q10,26 0,22 Z" fill="${primary}" opacity="0.018"/>
      </pattern>
    </defs>
    <!-- Main background -->
    <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"
          fill="url(#bgGrad_${uid})"/>
    <!-- Subtle ornament pattern overlay -->
    <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"
          fill="url(#ornPat_${uid})"/>
    <!-- Vignette -->
    <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"
          fill="url(#vignette_${uid})"/>
  `;
}

/** Art Nouveau side flourishes -- vine/curve decorations */
function svgFlourishes(primary, secondary) {
  return `
    <!-- Top decorative flourish band -->
    <path d="M40,42 Q55,36 70,42 Q85,48 100,42 Q115,36 130,42 Q145,48 160,42 Q175,36 180,42"
          fill="none" stroke="${primary}" stroke-width="0.4" opacity="0.2"/>

    <!-- Bottom decorative flourish band -->
    <path d="M40,268 Q55,274 70,268 Q85,262 100,268 Q115,274 130,268 Q145,262 160,268 Q175,274 180,268"
          fill="none" stroke="${primary}" stroke-width="0.4" opacity="0.2"/>

    <!-- Left Art Nouveau vine -->
    <path d="M20,65 Q18,80 24,90 Q18,100 20,115 Q16,125 22,135"
          fill="none" stroke="${primary}" stroke-width="0.4" opacity="0.2"/>
    <!-- Tiny leaves on vine -->
    <path d="M22,82 Q17,78 20,74" fill="none" stroke="${secondary}" stroke-width="0.35" opacity="0.3"/>
    <path d="M20,108 Q15,104 18,100" fill="none" stroke="${secondary}" stroke-width="0.35" opacity="0.3"/>
    <ellipse cx="16" cy="76" rx="1.5" ry="2.5" fill="${secondary}" opacity="0.15"
             transform="rotate(-30,16,76)"/>
    <ellipse cx="14" cy="102" rx="1.5" ry="2.5" fill="${secondary}" opacity="0.15"
             transform="rotate(-20,14,102)"/>

    <!-- Right Art Nouveau vine (mirrored) -->
    <path d="M200,65 Q202,80 196,90 Q202,100 200,115 Q204,125 198,135"
          fill="none" stroke="${primary}" stroke-width="0.4" opacity="0.2"/>
    <path d="M198,82 Q203,78 200,74" fill="none" stroke="${secondary}" stroke-width="0.35" opacity="0.3"/>
    <path d="M200,108 Q205,104 202,100" fill="none" stroke="${secondary}" stroke-width="0.35" opacity="0.3"/>
    <ellipse cx="204" cy="76" rx="1.5" ry="2.5" fill="${secondary}" opacity="0.15"
             transform="rotate(30,204,76)"/>
    <ellipse cx="206" cy="102" rx="1.5" ry="2.5" fill="${secondary}" opacity="0.15"
             transform="rotate(20,206,102)"/>

    <!-- Element corners -- small decorative dots -->
    <circle cx="34" cy="42" r="0.8" fill="${secondary}" opacity="0.3"/>
    <circle cx="186" cy="42" r="0.8" fill="${secondary}" opacity="0.3"/>
    <circle cx="34" cy="268" r="0.8" fill="${secondary}" opacity="0.3"/>
    <circle cx="186" cy="268" r="0.8" fill="${secondary}" opacity="0.3"/>
  `;
}

// ---------------------------------------------------------------------------
// Element badge (small icon indicating fire/water/earth/air)
// ---------------------------------------------------------------------------
function svgElementBadge(element, primary) {
  const symbols = {
    fire:  `<polygon points="110,344 106,352 114,352" fill="${primary}" opacity="0.3"/>`,
    water: `<polygon points="110,352 106,344 114,344" fill="${primary}" opacity="0.3"/>
            <line x1="106" y1="349" x2="114" y2="349" stroke="${primary}"
                  stroke-width="0.4" opacity="0.3"/>`,
    earth: `<rect x="106" y="344" width="8" height="8" fill="none"
                  stroke="${primary}" stroke-width="0.5" opacity="0.3"/>`,
    air:   `<circle cx="110" cy="348" r="4" fill="none" stroke="${primary}"
                    stroke-width="0.5" opacity="0.3"/>`,
    all:   `<circle cx="110" cy="348" r="3" fill="${primary}" opacity="0.2"/>
            <circle cx="110" cy="348" r="5" fill="none" stroke="${primary}"
                    stroke-width="0.4" opacity="0.2"/>`
  };
  return symbols[element] || '';
}

// ---------------------------------------------------------------------------
// Compose full card face SVG
// ---------------------------------------------------------------------------
function buildCardFaceSVG(card) {
  const uid = `card${card.id}`;
  const { primary, secondary } = card.colors;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}"
    width="${CARD_W}" height="${CARD_H}" style="display:block;">
    ${svgBackground(card, uid)}
    ${svgFrame(primary, secondary)}
    ${svgFlourishes(primary, secondary)}
    ${svgNumeralFrame(card.numeral, primary, secondary)}
    ${svgCentralArt(card.svgPath, primary, secondary, uid)}
    ${svgNameBanner(card.name, card.nameEn, primary, secondary)}
    ${svgElementBadge(card.element, primary)}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Card face with image (when webp exists)
// ---------------------------------------------------------------------------
function buildCardFaceImage(card, imgSrc) {
  const uid = `cardimg${card.id}`;
  const { primary, secondary } = card.colors;

  return `<svg xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    viewBox="0 0 ${CARD_W} ${CARD_H}"
    width="${CARD_W}" height="${CARD_H}" style="display:block;">
    <defs>
      <clipPath id="cardClip_${uid}">
        <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"/>
      </clipPath>
      <linearGradient id="imgOverlay_${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0.05"/>
        <stop offset="70%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.5"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#cardClip_${uid})">
      <!-- Card image -->
      <image href="${imgSrc}" x="0" y="0" width="${CARD_W}" height="${CARD_H}"
             preserveAspectRatio="xMidYMid slice"/>
      <!-- Subtle darkening overlay for text legibility -->
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#imgOverlay_${uid})"/>
    </g>
    <!-- Frame over image -->
    ${svgFrame(primary, secondary)}
    <!-- Numeral -->
    ${svgNumeralFrame(card.numeral, '#f5d78e', secondary)}
    <!-- Name banner with semi-transparent backing -->
    <rect x="28" y="276" width="164" height="46" rx="8" ry="8"
          fill="black" opacity="0.45"/>
    ${svgNameBanner(card.name, card.nameEn, '#f5d78e', secondary)}
    ${svgElementBadge(card.element, '#f5d78e')}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Card back design -- mandala + crescent moon + stars
// ---------------------------------------------------------------------------
function buildCardBackSVG() {
  const gold = '#c9a24e';
  const uid = 'back';

  // Build star field
  const stars = [];
  const starPositions = [
    [45, 55], [175, 55], [30, 120], [190, 120], [40, 240], [180, 240],
    [55, 300], [165, 300], [85, 40], [135, 40], [65, 320], [155, 320],
    [25, 180], [195, 180], [110, 30], [110, 330],
    [38, 85], [182, 85], [38, 275], [182, 275]
  ];
  for (const [sx, sy] of starPositions) {
    const size = 0.6 + Math.random() * 1.0;
    stars.push(`<circle cx="${sx}" cy="${sy}" r="${size.toFixed(1)}"
                        fill="${gold}" opacity="${(0.2 + Math.random() * 0.35).toFixed(2)}"/>`);
  }

  // Mandala ring count
  const mandalaRings = [];
  for (let r = 18; r <= 72; r += 9) {
    mandalaRings.push(
      `<circle cx="110" cy="180" r="${r}" fill="none" stroke="${gold}"
              stroke-width="${r === 45 ? 0.8 : 0.4}" opacity="${r === 45 ? 0.4 : 0.2}"/>`
    );
  }

  // Mandala radial lines & petal shapes
  const mandalaDetails = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i * 22.5) * Math.PI / 180;
    const x1 = 110 + Math.cos(angle) * 18;
    const y1 = 180 + Math.sin(angle) * 18;
    const x2 = 110 + Math.cos(angle) * 72;
    const y2 = 180 + Math.sin(angle) * 72;
    mandalaDetails.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
             x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
             stroke="${gold}" stroke-width="0.3" opacity="0.15"/>`
    );
    // Petal at r=36
    if (i % 2 === 0) {
      const pa = angle - 0.15;
      const pb = angle + 0.15;
      const px1 = 110 + Math.cos(pa) * 30;
      const py1 = 180 + Math.sin(pa) * 30;
      const px2 = 110 + Math.cos(angle) * 44;
      const py2 = 180 + Math.sin(angle) * 44;
      const px3 = 110 + Math.cos(pb) * 30;
      const py3 = 180 + Math.sin(pb) * 30;
      mandalaDetails.push(
        `<path d="M${px1.toFixed(1)},${py1.toFixed(1)}
                  Q${px2.toFixed(1)},${py2.toFixed(1)} ${px3.toFixed(1)},${py3.toFixed(1)}"
               fill="none" stroke="${gold}" stroke-width="0.5" opacity="0.25"/>`
      );
    }
    // Dots at r=54
    const dx = 110 + Math.cos(angle) * 54;
    const dy = 180 + Math.sin(angle) * 54;
    mandalaDetails.push(
      `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="1.2"
              fill="${gold}" opacity="0.2"/>`
    );
    // Outer petal arcs at r=63
    if (i % 2 === 1) {
      const oa = angle - 0.12;
      const ob = angle + 0.12;
      const ox1 = 110 + Math.cos(oa) * 58;
      const oy1 = 180 + Math.sin(oa) * 58;
      const ox2 = 110 + Math.cos(angle) * 70;
      const oy2 = 180 + Math.sin(angle) * 70;
      const ox3 = 110 + Math.cos(ob) * 58;
      const oy3 = 180 + Math.sin(ob) * 58;
      mandalaDetails.push(
        `<path d="M${ox1.toFixed(1)},${oy1.toFixed(1)}
                  Q${ox2.toFixed(1)},${oy2.toFixed(1)} ${ox3.toFixed(1)},${oy3.toFixed(1)}"
               fill="none" stroke="${gold}" stroke-width="0.4" opacity="0.2"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}"
    width="${CARD_W}" height="${CARD_H}" style="display:block;">
    <defs>
      <linearGradient id="backGrad_${uid}" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#f5f0e4"/>
        <stop offset="50%" stop-color="#ede6d4"/>
        <stop offset="100%" stop-color="#e8e0cc"/>
      </linearGradient>
      <radialGradient id="backGlow_${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#d4c8a8" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <filter id="moonGlow_${uid}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Deep purple-to-navy background -->
    <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"
          fill="url(#backGrad_${uid})"/>
    <rect width="${CARD_W}" height="${CARD_H}" rx="14" ry="14"
          fill="url(#backGlow_${uid})"/>

    <!-- Outer border -->
    <rect x="4" y="4" width="212" height="352" rx="12" ry="12"
          fill="none" stroke="${gold}" stroke-width="1.2" opacity="0.5"/>
    <rect x="10" y="10" width="200" height="340" rx="9" ry="9"
          fill="none" stroke="${gold}" stroke-width="0.5" opacity="0.25"/>

    <!-- Corner ornaments -->
    <g opacity="0.5">
      <!-- TL -->
      <path d="M16,16 Q16,30 22,36" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <path d="M16,16 Q30,16 36,22" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <circle cx="16" cy="16" r="2" fill="${gold}" opacity="0.4"/>
      <!-- TR -->
      <path d="M204,16 Q204,30 198,36" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <path d="M204,16 Q190,16 184,22" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <circle cx="204" cy="16" r="2" fill="${gold}" opacity="0.4"/>
      <!-- BL -->
      <path d="M16,344 Q16,330 22,324" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <path d="M16,344 Q30,344 36,338" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <circle cx="16" cy="344" r="2" fill="${gold}" opacity="0.4"/>
      <!-- BR -->
      <path d="M204,344 Q204,330 198,324" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <path d="M204,344 Q190,344 184,338" fill="none" stroke="${gold}" stroke-width="0.6"/>
      <circle cx="204" cy="344" r="2" fill="${gold}" opacity="0.4"/>
    </g>

    <!-- Star field -->
    ${stars.join('\n    ')}

    <!-- Crescent moon -->
    <g filter="url(#moonGlow_${uid})">
      <path d="M95,76 Q95,50 110,40 Q100,50 100,70
               Q100,90 120,100 Q95,95 95,76 Z"
            fill="${gold}" opacity="0.6"/>
    </g>
    <!-- Bright stars near moon -->
    <g opacity="0.7">
      ${smallStar(130, 52, gold)}
      ${smallStar(142, 72, gold)}
      ${smallStar(78, 60, gold)}
    </g>
    <!-- Small 3-dot constellation -->
    <circle cx="150" cy="48" r="0.8" fill="${gold}" opacity="0.5"/>
    <circle cx="158" cy="42" r="0.6" fill="${gold}" opacity="0.4"/>
    <line x1="142" y1="52" x2="150" y2="48" stroke="${gold}"
          stroke-width="0.3" opacity="0.25"/>
    <line x1="150" y1="48" x2="158" y2="42" stroke="${gold}"
          stroke-width="0.3" opacity="0.25"/>

    <!-- Mandala -->
    ${mandalaRings.join('\n    ')}
    ${mandalaDetails.join('\n    ')}
    <!-- Central mandala motif -->
    <circle cx="110" cy="180" r="8" fill="none" stroke="${gold}"
            stroke-width="0.8" opacity="0.5"/>
    <circle cx="110" cy="180" r="3" fill="${gold}" opacity="0.25"/>
    <!-- Inner cross -->
    <line x1="110" y1="172" x2="110" y2="188" stroke="${gold}"
          stroke-width="0.4" opacity="0.3"/>
    <line x1="102" y1="180" x2="118" y2="180" stroke="${gold}"
          stroke-width="0.4" opacity="0.3"/>

    <!-- Bottom crescent (mirrored, smaller) -->
    <g transform="translate(220,360) scale(-1,-1)" opacity="0.35">
      <path d="M95,76 Q95,50 110,40 Q100,50 100,70
               Q100,90 120,100 Q95,95 95,76 Z"
            fill="${gold}"/>
    </g>

    <!-- Decorative side lines -->
    <path d="M14,60 Q10,100 14,140 Q10,180 14,220 Q10,260 14,300"
          fill="none" stroke="${gold}" stroke-width="0.3" opacity="0.15"/>
    <path d="M206,60 Q210,100 206,140 Q210,180 206,220 Q210,260 206,300"
          fill="none" stroke="${gold}" stroke-width="0.3" opacity="0.15"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a card face into the given container.
 *
 * @param {Object}      card       Card data object (from cards-data.js)
 * @param {HTMLElement}  container  DOM element to render into
 * @param {Object}      [options]  Optional settings
 * @param {boolean}     [options.skipImageCheck=false]  Skip the image probe
 * @returns {Promise<HTMLElement>}  The created card element
 */
export async function renderCard(card, container, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-rendered card-face-rendered';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.borderRadius = '14px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.position = 'relative';
  wrapper.dataset.cardId = card.id;

  let useImage = false;
  let imgSrc = '';

  if (!options.skipImageCheck) {
    imgSrc = imagePath(card);
    useImage = await probeImage(imgSrc);
  }

  if (useImage) {
    wrapper.innerHTML = buildCardFaceImage(card, imgSrc);
  } else {
    wrapper.innerHTML = buildCardFaceSVG(card);
  }

  // Apply reversed rotation if needed
  if (options.showReversed) {
    wrapper.style.transform = 'rotate(180deg)';
  }

  // Make inner SVG responsive
  const svg = wrapper.querySelector('svg');
  if (svg) {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = '100%';
  }

  container.appendChild(wrapper);
  return wrapper;
}

/**
 * Render the card back design into the given container.
 *
 * @param {HTMLElement} container  DOM element to render into
 * @returns {HTMLElement}  The created card-back element
 */
export function renderCardBack(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-rendered card-back-rendered';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.borderRadius = '14px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.position = 'relative';

  wrapper.innerHTML = buildCardBackSVG();

  // Make inner SVG fill the wrapper
  const svg = wrapper.querySelector('svg');
  if (svg) {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = '100%';
  }

  container.appendChild(wrapper);
  return wrapper;
}

/**
 * Pre-render card back SVG to a data URL (rasterized image).
 * Call once, then reuse the returned URL for all floating cards
 * to avoid 22× complex SVG DOMs in the orbit animation.
 */
let _cardBackDataUrl = null;
export async function getCardBackImageUrl() {
  if (_cardBackDataUrl) return _cardBackDataUrl;

  const svgString = buildCardBackSVG();
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W * 2;   // 2× for retina
      canvas.height = CARD_H * 2;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      _cardBackDataUrl = canvas.toDataURL('image/png');
      resolve(_cardBackDataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null); // fallback: caller should use renderCardBack
    };
    img.src = url;
  });
}
