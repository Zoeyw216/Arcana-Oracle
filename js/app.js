import { majorArcana } from './cards-data.js';
import { renderCard, renderCardBack, getCardBackImageUrl } from './card-renderer.js';
import { AnimationEngine } from './animation-engine.js';
import { HandTracker } from './hand-tracker.js';
import { GeminiReader } from './gemini-reader.js';

// === State ===
let selectedSpread = 3;
let drawnCards = [];
let pickCount = 0;
let phase = 'input'; // input | deck | reading
let animEngine = null;
let handTracker = null;
let geminiReader = null;
let handCursorEl = null;
let useHandTracking = false;
let handTrackingReady = false; // grace period flag — ignore grabs until ready

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  createStars();
  geminiReader = new GeminiReader();
  setupUI();
});

// === Stars Background ===
function createStars() {
  const container = document.getElementById('stars');
  if (!container) return;
  for (let i = 0; i < 150; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
    star.style.animationDelay = Math.random() * 4 + 's';
    const size = (1 + Math.random() * 2) + 'px';
    star.style.width = size;
    star.style.height = size;
    container.appendChild(star);
  }
}

// === UI Setup ===
function setupUI() {
  // Draw button
  document.getElementById('drawBtn')?.addEventListener('click', startDrawing);

  // Question enter key
  document.getElementById('questionInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') startDrawing();
  });

  // Reset button
  document.getElementById('resetBtn')?.addEventListener('click', resetAll);

  // Save/Share buttons
  initResultActions();

  // Camera mode selection
  document.getElementById('enableCamera')?.addEventListener('click', () => {
    initHandTracking();
    closeModeModal();
    // Hint will be shown after camera permission is granted (see initHandTracking)
  });
  document.getElementById('useClick')?.addEventListener('click', () => {
    useHandTracking = false;
    closeModeModal();
    showDeckHint(false);
  });

  // Hand cursor element
  handCursorEl = document.getElementById('handCursor');
}

// === Mode Selection Modal ===
function showModeModal() {
  const modal = document.getElementById('modeModal');
  if (modal) {
    modal.classList.add('show');
    // Only show camera option if supported
    const cameraBtn = document.getElementById('enableCamera');
    if (cameraBtn && !HandTracker.isSupported()) {
      cameraBtn.disabled = true;
      cameraBtn.textContent = '设备不支持摄像头';
    }
  }
}

function closeModeModal() {
  document.getElementById('modeModal')?.classList.remove('show');
}

// === Hand Tracking ===
async function initHandTracking() {
  const loadingEl = document.getElementById('handLoadingIndicator');
  if (loadingEl) loadingEl.classList.add('show');

  handTracker = new HandTracker({
    onHandMove: handleHandMove,
    onGrab: handleGrab,
    onRelease: handleRelease,
    onTrackingStart: () => {
      useHandTracking = true;
      handTrackingReady = false;
      if (handCursorEl) handCursorEl.classList.add('active');
      // Default orbit until hand appears
      if (animEngine) animEngine.setOrbitSpeed(0.05);
      // Grace period — ignore grabs for 2s so user can position hand
      setTimeout(() => { handTrackingReady = true; }, 2000);
    },
    onTrackingEnd: () => {
      useHandTracking = false;
      if (handCursorEl) handCursorEl.classList.remove('active');
    }
  });

  try {
    await handTracker.init();
    const previewEl = document.getElementById('cameraPreview');
    const ok = await handTracker.startCamera(previewEl);
    if (ok) {
      // Camera ready — now show the hand gesture hint
      showDeckHint(true);
    } else {
      useHandTracking = false;
      handTracker = null;
      showDeckHint(false); // Fall back to click hint
      showNotification('摄像头访问被拒绝，已切换到点击模式');
    }
  } catch (err) {
    console.error('Hand tracking init failed:', err);
    useHandTracking = false;
    handTracker = null;
    showDeckHint(false); // Fall back to click hint
    showNotification('手势追踪初始化失败，已切换到点击模式');
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

function handleHandMove({ x, y, visible, grabbing }) {
  if (!handCursorEl) return;
  if (!visible) {
    handCursorEl.style.opacity = '0';
    if (animEngine && phase === 'deck') animEngine.setOrbitSpeed(0.05);
    return;
  }
  handCursorEl.style.opacity = '1';
  handCursorEl.style.left = x + 'px';
  handCursorEl.style.top = y + 'px';
  handCursorEl.classList.toggle('grabbing', grabbing);

  // Control orbit speed based on hand gesture + hover
  if (animEngine && phase === 'deck') {
    animEngine.setHoverPosition(x, y);
    if (grabbing) {
      animEngine.setOrbitSpeed(0.005);
    } else {
      // Slow down when hand cursor is over a selectable card
      const hoveredCard = getCardAtPosition(x, y);
      if (hoveredCard) {
        animEngine.setOrbitSpeed(0.05);
      } else {
        animEngine.setOrbitSpeed(0.8);
      }
    }
    checkCardHover(x, y);
  }
}

function handleGrab({ x, y }) {
  if (phase !== 'deck') return;
  if (!handTrackingReady) return; // ignore grabs during grace period
  // Freeze orbit completely during grab attempt
  if (animEngine) animEngine.setOrbitSpeed(0);
  const hoveredCard = getCardAtPosition(x, y);
  if (hoveredCard) {
    pickCard(hoveredCard);
    // Resume orbit after a short delay so ring keeps moving
    setTimeout(() => {
      if (animEngine && phase === 'deck') animEngine.setOrbitSpeed(0.3);
    }, 600);
  } else {
    // Resume slow speed if missed
    if (animEngine) animEngine.setOrbitSpeed(0.005);
  }
}

function handleRelease() {
  // Future: could animate hand opening effect
}

function getCardAtPosition(x, y) {
  const cards = document.querySelectorAll('.floating-card:not(.picked)');
  const PAD = window.innerWidth <= 480 ? 10 : 25;
  let best = null;
  let bestDist = Infinity;
  for (const card of cards) {
    // Skip back cards (pointer-events:none)
    if (card.style.pointerEvents === 'none') continue;
    const rect = card.getBoundingClientRect();
    if (x >= rect.left - PAD && x <= rect.right + PAD &&
        y >= rect.top - PAD && y <= rect.bottom + PAD) {
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = card;
      }
    }
  }
  return best;
}

function checkCardHover(x, y) {
  const cards = document.querySelectorAll('.floating-card:not(.picked)');
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (isOver) {
      animEngine?.highlightCard(card);
      card.classList.add('hand-hover');
    } else {
      animEngine?.unhighlightCard(card);
      card.classList.remove('hand-hover');
    }
  });
}

// === Question Validation ===

/**
 * Local quick-check: returns null if OK, or an error/hint string.
 */
function validateQuestionLocal(q) {
  // Too short
  if (q.length < 2) return { type: 'reject', msg: '请输入一个完整的问题' };
  // Pure numbers / symbols
  if (/^[\d\s\+\-\*\/\=\.\,\;\!\?\#\@\$\%\^\&\(\)]+$/.test(q)) return { type: 'reject', msg: '请输入有意义的问题，而不是数字或符号' };
  // Repeated single char
  if (/^(.)\1+$/.test(q)) return { type: 'reject', msg: '请认真输入你想问的问题' };
  // Random gibberish (no CJK and very short with no spaces)
  if (q.length < 4 && !/[\u4e00-\u9fff]/.test(q) && !/\s/.test(q)) return { type: 'reject', msg: '问题太短了，请描述得更详细一些' };
  return null;
}

/**
 * Use Gemini to analyze if the question is suitable for tarot reading.
 * Returns: { type: 'ok' } | { type: 'followup', msg: string } | { type: 'reject', msg: string }
 */
async function validateQuestionAI(question) {
  const url = '/api/gemini-validate';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text:
          `你是一个塔罗牌占卜助手。用户输入了以下内容作为占卜问题：\n\n"${question}"\n\n` +
          `请判断这个问题是否适合进行塔罗牌占卜，用JSON格式回答（不要markdown代码块）：\n` +
          `- 如果完全无意义（乱码、随机字符、无关内容如数学题等），回复：{"type":"reject","msg":"简短拒绝理由，10字以内"}\n` +
          `- 如果问题极度模糊（只有一两个字，如"感情""工作"，完全无法判断方向），才回复：{"type":"followup","msg":"一个关键追问，不超过15字"}\n` +
          `- 其他所有情况都回复：{"type":"ok"}\n` +
          `重要：大部分问题都应该直接通过（ok）。只有真的只写了一两个词、完全没有具体方向的才需要追问。像"我的工作前景如何""他还会回来吗""最近运势怎样"这种都算清晰，直接ok。不要过度追问。\n` +
          `msg要求：中文，不用emoji，不用称呼语。`
        }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
      })
    });

    if (!res.ok) return { type: 'ok' }; // API error → let through
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return { type: 'ok' };

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(jsonStr);
    if (result.type === 'reject' || result.type === 'followup' || result.type === 'ok') {
      return result;
    }
    return { type: 'ok' };
  } catch {
    return { type: 'ok' }; // Parse/network error → let through
  }
}

function showQuestionHint(msg) {
  let hintEl = document.getElementById('questionHint');
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'questionHint';
    hintEl.style.cssText = 'color:var(--gold-dark);font-family:var(--font-chinese);font-size:0.88em;margin-top:12px;text-align:center;letter-spacing:1px;opacity:0;transition:opacity 0.3s;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.7;';
    const section = document.getElementById('questionSection');
    if (section) section.appendChild(hintEl);
  }
  hintEl.textContent = msg;
  // Remove followup box if showing a reject hint
  removeFollowupBox();
  requestAnimationFrame(() => { hintEl.style.opacity = '1'; });
}

function showFollowupBox(question) {
  hideQuestionHint();
  removeFollowupBox();

  const section = document.getElementById('questionSection');
  if (!section) return;

  const wrap = document.createElement('div');
  wrap.id = 'followupWrap';
  wrap.style.cssText = 'margin-top:14px;text-align:center;opacity:0;transition:opacity 0.3s;max-width:520px;margin-left:auto;margin-right:auto;';

  const label = document.createElement('div');
  label.textContent = question;
  label.style.cssText = 'color:var(--gold-dark);font-family:var(--font-chinese);font-size:0.88em;letter-spacing:1px;margin-bottom:10px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'followupInput';
  input.placeholder = '补充信息后开始抽牌...';
  input.style.cssText = 'width:100%;padding:12px 20px;background:rgba(255,255,255,0.5);border:1px solid rgba(155,139,116,0.15);border-radius:30px;color:var(--text-primary);font-family:var(--font-chinese);font-size:0.95em;font-weight:300;outline:none;transition:border-color 0.3s,box-shadow 0.3s;box-sizing:border-box;';
  input.addEventListener('focus', () => {
    input.style.borderColor = 'rgba(126,147,168,0.35)';
    input.style.boxShadow = '0 0 20px rgba(126,147,168,0.06)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = 'rgba(155,139,116,0.15)';
    input.style.boxShadow = 'none';
  });

  wrap.appendChild(label);
  wrap.appendChild(input);
  section.appendChild(wrap);
  requestAnimationFrame(() => { wrap.style.opacity = '1'; input.focus(); });
}

function removeFollowupBox() {
  const el = document.getElementById('followupWrap');
  if (el) el.remove();
}

function hideQuestionHint() {
  const hintEl = document.getElementById('questionHint');
  if (hintEl) { hintEl.style.opacity = '0'; }
}

// === Drawing Phase ===
let hasAskedFollowup = false;

async function startDrawing() {
  const mainInput = document.getElementById('questionInput');
  const followupInput = document.getElementById('followupInput');
  const btn = document.getElementById('drawBtn');

  const mainQuestion = mainInput?.value.trim() || '';
  const followupAnswer = followupInput?.value.trim() || '';

  // If followup was shown and answered, combine and proceed directly
  if (hasAskedFollowup && followupAnswer) {
    removeFollowupBox();
    hideQuestionHint();
    hasAskedFollowup = false;
    // Store combined question for later use
    mainInput.dataset.fullQuestion = mainQuestion + '（' + followupAnswer + '）';
    proceedToDrawing();
    return;
  }

  // If followup was shown but not answered, shake the followup input
  if (hasAskedFollowup && !followupAnswer && followupInput) {
    followupInput.classList.add('shake');
    setTimeout(() => followupInput.classList.remove('shake'), 600);
    return;
  }

  if (!mainQuestion) {
    if (mainInput) {
      mainInput.classList.add('shake');
      mainInput.setAttribute('placeholder', '请先输入你的问题...');
      setTimeout(() => mainInput.classList.remove('shake'), 600);
    }
    return;
  }

  // Local validation
  const localCheck = validateQuestionLocal(mainQuestion);
  if (localCheck) {
    showQuestionHint(localCheck.msg);
    mainInput?.classList.add('shake');
    setTimeout(() => mainInput?.classList.remove('shake'), 600);
    return;
  }

  // AI validation (show loading state)
  if (btn) { btn.disabled = true; btn.textContent = '分 析 中 ...'; }
  hideQuestionHint();
  removeFollowupBox();

  const aiCheck = await validateQuestionAI(mainQuestion);

  if (btn) { btn.disabled = false; btn.textContent = '开 始 抽 牌'; }

  if (aiCheck.type === 'reject') {
    showQuestionHint(aiCheck.msg);
    mainInput?.classList.add('shake');
    setTimeout(() => mainInput?.classList.remove('shake'), 600);
    return;
  }

  if (aiCheck.type === 'followup') {
    hasAskedFollowup = true;
    showFollowupBox(aiCheck.msg);
    return;
  }

  // OK — proceed
  mainInput.dataset.fullQuestion = mainQuestion;
  hideQuestionHint();
  removeFollowupBox();
  proceedToDrawing();
}

function proceedToDrawing() {
  hasAskedFollowup = false;
  drawnCards = [];
  pickCount = 0;
  phase = 'deck';

  // Hide input controls
  document.querySelector('.header')?.classList.add('hidden');
  document.getElementById('questionSection')?.classList.add('hidden');
  document.getElementById('drawBtn')?.classList.add('hidden');
  document.getElementById('results')?.classList.remove('show');

  // Show deck
  showFloatingDeck();

  // Show mode selection if camera supported and not already tracking
  if (HandTracker.isSupported() && !useHandTracking) {
    showModeModal();
  } else if (!useHandTracking) {
    // No camera support, skip modal and show click hint directly
    showDeckHint(false);
  }
}

let _hintLocked = false;   // when true, NO code path can hide the hint
let _hintTimer  = null;    // single auto-hide timer (cleared on each new call)

function showDeckHint(isHandMode) {
  const hint = document.getElementById('deckHint');
  if (!hint) return;

  // If hint is locked (hand-mode protection active), ignore ALL calls
  if (_hintLocked) return;

  // Cancel any pending auto-hide from a previous call
  if (_hintTimer) { clearTimeout(_hintTimer); _hintTimer = null; }

  hint.textContent = isHandMode
    ? '张开手掌移至空白处，牌阵加速旋转\n移至牌上减速，握拳抓取，共3张'
    : '凭直觉，点选3张牌';
  hint.style.whiteSpace = 'pre-line';

  // Show immediately — no requestAnimationFrame gap
  hint.classList.remove('fade-out');
  hint.classList.add('show');

  const duration = isHandMode ? 15000 : 4000;

  // Lock during hand mode — nothing can dismiss until timer fires
  if (isHandMode) _hintLocked = true;

  // Single auto-hide timer
  _hintTimer = setTimeout(() => {
    _hintLocked = false;
    _hintTimer = null;
    _fadeOutHint();
  }, duration);
}

/** Internal: fade out and remove hint classes */
function _fadeOutHint() {
  const hint = document.getElementById('deckHint');
  if (!hint || !hint.classList.contains('show')) return;
  hint.classList.add('fade-out');
  setTimeout(() => { hint.classList.remove('show', 'fade-out'); }, 600);
}

/** Dismiss hint — respects lock unless force=true */
function dismissHint(force) {
  if (_hintLocked && !force) return;
  _hintLocked = false;
  if (_hintTimer) { clearTimeout(_hintTimer); _hintTimer = null; }
  _fadeOutHint();
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let shuffledDeck = []; // pre-shuffled deck for current draw

async function showFloatingDeck() {
  const deckArea = document.getElementById('deckArea');
  if (!deckArea) return;
  deckArea.innerHTML = '';
  deckArea.classList.add('show');

  // Hint is shown after mode selection (see showDeckHint)
  // If already tracking (e.g. second draw), show hint immediately
  if (useHandTracking) {
    showDeckHint(true);
  }

  // Shuffle the deck — each floating card is bound to a specific tarot card
  shuffledDeck = shuffleArray(majorArcana).map(card => ({
    ...card,
    isReversed: Math.random() < 0.4
  }));

  // Create animation engine
  animEngine = new AnimationEngine(deckArea);

  // Pre-render card back to a shared image (avoids 22× complex SVG DOMs)
  const backImgUrl = await getCardBackImageUrl();

  // Create floating cards (all 22 Major Arcana, shuffled)
  const cardCount = shuffledDeck.length;
  for (let i = 0; i < cardCount; i++) {
    const cardEl = document.createElement('div');
    cardEl.className = 'floating-card';
    cardEl.dataset.index = i;

    // Use pre-rendered image instead of full SVG DOM
    if (backImgUrl) {
      cardEl.style.backgroundImage = `url(${backImgUrl})`;
      cardEl.style.backgroundSize = 'cover';
      cardEl.style.borderRadius = getComputedStyle(cardEl).borderRadius;
    } else {
      renderCardBack(cardEl);
    }

    // Click handler
    cardEl.addEventListener('click', () => {
      if (!useHandTracking) pickCard(cardEl);
    });

    deckArea.appendChild(cardEl);
    animEngine.addCard(cardEl, i, cardCount);
  }

  // Click mode: auto-rotate + user can drag to control
  if (!useHandTracking) {
    animEngine.enableDrag();
  }

  animEngine.start();
}

let pickAnimating = false; // prevent rapid picks during animation

function pickCard(cardEl) {
  if (cardEl.classList.contains('picked') || pickCount >= selectedSpread) return;
  if (pickAnimating) return; // wait for previous pick to finish
  pickAnimating = true;
  setTimeout(() => { pickAnimating = false; }, 800);

  cardEl.classList.add('picked');
  cardEl.style.pointerEvents = 'none';
  cardEl.style.zIndex = '999';
  pickCount++;

  // Dismiss hint on first pick — always force, even during hand-mode lock
  dismissHint(true);

  // Get the pre-assigned card from the shuffled deck
  const idx = parseInt(cardEl.dataset.index, 10);
  const assigned = shuffledDeck[idx];
  drawnCards.push(assigned);

  // Animate card out
  if (animEngine) {
    animEngine.selectCard(cardEl, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  if (pickCount >= selectedSpread) {
    setTimeout(() => {
      if (animEngine) {
        animEngine.stop();
        animEngine = null;
      }
      document.getElementById('deckArea')?.classList.remove('show');
      dismissHint(true); // force — all cards picked
      showResults();
    }, 800);
  } else {
    // Resume orbit speed after pick animation so remaining cards stay visible
    setTimeout(() => {
      if (animEngine && phase === 'deck') animEngine.setOrbitSpeed(0.3);
    }, 600);
  }
}

// === Results Phase ===
function showResults() {
  phase = 'reading';

  // Hide hand cursor and camera PiP in reading phase
  if (handCursorEl) {
    handCursorEl.classList.remove('active');
    handCursorEl.style.opacity = '0';
  }
  const cameraPip = document.getElementById('cameraPip');
  if (cameraPip) cameraPip.style.display = 'none';
  // Stop hand tracking entirely
  if (handTracker) {
    handTracker.stop();
    handTracker = null;
  }

  const inputEl = document.getElementById('questionInput');
  const question = inputEl?.dataset.fullQuestion || inputEl?.value.trim() || '';
  const results = document.getElementById('results');
  const cardsRow = document.getElementById('cardsRow');
  const interpEl = document.getElementById('interpretation');

  if (!results || !cardsRow || !interpEl) return;

  const labels = ['过去', '现在', '未来'];

  // Set title
  const titleEl = document.getElementById('resultsTitle');
  if (titleEl) titleEl.textContent = `关于「${question}」的指引`;

  // Render card faces
  cardsRow.innerHTML = '';
  drawnCards.forEach((card, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper card-wrapper--reading fade-in-up';
    wrapper.style.animationDelay = (i * 0.2) + 's';

    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = labels[i];

    const flipContainer = document.createElement('div');
    flipContainer.className = 'card-flip';
    flipContainer.id = `flip${i}`;

    // Front (card back design)
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    renderCardBack(front);

    // Back (card face - revealed side)
    const back = document.createElement('div');
    back.className = 'card-face card-back-reveal';
    renderCard(card, back, { showReversed: card.isReversed });

    flipContainer.appendChild(front);
    flipContainer.appendChild(back);
    wrapper.appendChild(label);
    wrapper.appendChild(flipContainer);
    cardsRow.appendChild(wrapper);

    // Click to zoom after flipped
    flipContainer.style.cursor = 'pointer';
    flipContainer.addEventListener('click', () => {
      if (flipContainer.classList.contains('flipped')) {
        openCardZoom(card, back);
      }
    });

    // Flip with delay
    setTimeout(() => {
      flipContainer.classList.add('flipped');
    }, 800 + i * 600);
  });

  // Show results container & unlock scrolling on mobile
  results.classList.add('show');
  document.body.classList.add('results-active');

  // Scroll to results
  setTimeout(() => {
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 600);

  // Generate interpretation
  const totalFlipTime = 800 + drawnCards.length * 600 + 400;
  setTimeout(() => {
    generateInterpretation(question, interpEl);
  }, totalFlipTime);
}

// === Card Zoom ===
function openCardZoom(card, sourceEl) {
  const overlay = document.getElementById('cardZoomOverlay');
  const content = document.getElementById('cardZoomContent');
  const nameEl = document.getElementById('cardZoomName');
  if (!overlay || !content) return;

  // Clone the card face into the zoom view
  content.innerHTML = '';
  const clone = sourceEl.cloneNode(true);
  clone.style.position = 'relative';
  clone.style.transform = 'none';
  clone.style.backfaceVisibility = 'visible';
  // Always show card upright in zoom (remove reversed rotation)
  clone.querySelectorAll('*').forEach(el => {
    if (el.style.transform === 'rotate(180deg)') {
      el.style.transform = 'none';
    }
  });
  content.appendChild(clone);

  // Show card name (still note if it was reversed)
  const reversedText = card.isReversed ? '（逆位）' : '';
  nameEl.textContent = `${card.name} · ${card.nameEn}${reversedText}`;

  overlay.classList.add('show');
  // Use rAF to ensure display:flex is applied before opacity transition
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  // Close on click
  const closeHandler = () => {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.classList.remove('show'); }, 350);
    overlay.removeEventListener('click', closeHandler);
  };
  overlay.addEventListener('click', closeHandler);
}

// === Generate Image & Share ===
let generatedImageDataUrl = null; // cache the generated image

function initResultActions() {
  document.getElementById('generateImageBtn')?.addEventListener('click', generateImage);
  document.getElementById('downloadImageBtn')?.addEventListener('click', downloadImage);
  document.getElementById('shareImageBtn')?.addEventListener('click', shareImage);
  // Close preview
  document.getElementById('imagePreviewClose')?.addEventListener('click', closeImagePreview);
  document.getElementById('imagePreviewOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImagePreview();
  });
}

async function generateImage() {
  if (!drawnCards.length) return;

  try {
    showNotification('正在生成照片...');

    const inputEl = document.getElementById('questionInput');
    const question = inputEl?.dataset.fullQuestion || inputEl?.value.trim() || '';
    const labels = ['过去', '现在', '未来'];
    const scale = 2;
    const W = 540 * scale;
    const cardW = 140 * scale;
    const cardH = 230 * scale;
    const cardGap = 20 * scale;
    const margin = 40 * scale;
    const textColor = '#3d4550';
    const subtitleColor = '#566068';
    const bgColor = '#f7f4ef';
    const accentColor = '#9b8b74';

    // Only show the original 3 cards (not supplementary draws)
    const mainCards = drawnCards.slice(0, 3);

    // Pre-load card face images from the actual rendered card elements
    const cardsRow = document.getElementById('cardsRow');
    const renderedImages = cardsRow ? cardsRow.querySelectorAll('image[href]') : [];
    const cardImages = await Promise.all(mainCards.map((card, i) => {
      return new Promise(resolve => {
        const svgImage = renderedImages[i];
        const href = svgImage?.getAttribute('href');
        if (!href) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = href;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }));

    // Get all interpretation + follow-up text with paragraph structure
    const interpEl = document.getElementById('interpretation');
    const fullText = extractReadingText(interpEl);

    // Calculate text block height
    const canvas = document.createElement('canvas');
    canvas.width = W;
    const ctx = canvas.getContext('2d');
    const textMaxW = W - margin * 2;
    const lineH = 22 * scale;
    const paraGap = 12 * scale;
    const sectionGap = 24 * scale;
    const textBlocks = layoutTextBlocks(ctx, fullText, textMaxW, scale);
    const interpBlockH = measureTextBlocksHeight(textBlocks, lineH, paraGap, sectionGap);

    // Total height calculation
    const titleAreaH = 80 * scale;
    const cardsAreaH = cardH + 40 * scale; // card + label
    const spacer = 30 * scale;
    const footerH = 60 * scale;
    const totalH = titleAreaH + cardsAreaH + spacer + interpBlockH + footerH + margin;

    canvas.height = totalH;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, totalH);

    // Title
    let y = margin;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.font = `${16 * scale}px "Noto Serif SC", serif`;
    ctx.fillText(`关于「${question}」的指引`, W / 2, y + 20 * scale);

    // Decorative line under title
    y += 36 * scale;
    const lineW = 60 * scale;
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(W / 2 - lineW, y);
    ctx.lineTo(W / 2 + lineW, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Cards
    y += 24 * scale;
    const totalCardsW = mainCards.length * cardW + (mainCards.length - 1) * cardGap;
    let cardX = (W - totalCardsW) / 2;

    for (let i = 0; i < mainCards.length; i++) {
      const card = mainCards[i];
      const cx = cardX + i * (cardW + cardGap);

      // Label above card
      ctx.fillStyle = accentColor;
      ctx.font = `${12 * scale}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], cx + cardW / 2, y + 14 * scale);

      const cardY = y + 22 * scale;

      // Draw card background (dark rounded rect)
      drawRoundedRect(ctx, cx, cardY, cardW, cardH, 10 * scale);
      ctx.fillStyle = '#1a1d24';
      ctx.fill();

      // Draw card image if available (cover fit to preserve aspect ratio)
      if (cardImages[i]) {
        ctx.save();
        drawRoundedRect(ctx, cx, cardY, cardW, cardH, 10 * scale);
        ctx.clip();

        const img = cardImages[i];
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const slotRatio = cardW / cardH;
        let dw, dh, ox, oy;
        if (imgRatio > slotRatio) {
          dh = cardH; dw = cardH * imgRatio;
          ox = -(dw - cardW) / 2; oy = 0;
        } else {
          dw = cardW; dh = cardW / imgRatio;
          ox = 0; oy = -(dh - cardH) / 2;
        }

        if (card.isReversed) {
          ctx.translate(cx + cardW / 2, cardY + cardH / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -cardW / 2 + ox, -cardH / 2 + oy, dw, dh);
        } else {
          ctx.drawImage(img, cx + ox, cardY + oy, dw, dh);
        }
        ctx.restore();
      }

      // Card name below
      const nameY = cardY + cardH + 18 * scale;
      ctx.fillStyle = subtitleColor;
      ctx.font = `${10 * scale}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      const reversedMark = card.isReversed ? ' (逆位)' : '';
      ctx.fillText(card.name + reversedMark, cx + cardW / 2, nameY);
    }

    // Interpretation text with paragraph layout
    y += cardsAreaH + spacer;
    ctx.textAlign = 'left';
    y = renderTextBlocks(ctx, textBlocks, margin, y, lineH, paraGap, sectionGap, textColor, accentColor, scale);

    // Footer
    const footerY = totalH - 30 * scale;
    ctx.fillStyle = '#5a6f82';
    ctx.globalAlpha = 0.6;
    ctx.font = `${10 * scale}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Arcana Oracle · Made by Zoey Wang', W / 2, footerY);
    ctx.globalAlpha = 1;

    // Done
    generatedImageDataUrl = canvas.toDataURL('image/png');
    showImagePreview(generatedImageDataUrl);

  } catch (err) {
    console.error('Generate image failed:', err);
    showNotification('生成失败，请截图保存');
  }
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split(/\n+/);
  const lines = [];
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const char of para) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Extract structured text from interpretation element, including follow-up conversations.
 * Returns array of sections: { type: 'reading'|'question'|'cards'|'reply', text: string }
 */
function extractReadingText(interpEl) {
  if (!interpEl) return [];
  const sections = [];
  const children = interpEl.children;

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const cls = el.className || '';

    if (cls.includes('follow-up-divider')) {
      continue; // skip dividers
    } else if (cls.includes('follow-up-question')) {
      sections.push({ type: 'question', text: el.textContent.trim() });
    } else if (cls.includes('follow-up-new-cards')) {
      sections.push({ type: 'cards', text: el.textContent.trim() });
    } else if (cls.includes('streaming-text') || el.tagName === 'DIV') {
      // Main reading or follow-up reply — extract paragraphs from <p> tags
      const paragraphs = el.querySelectorAll('p');
      if (paragraphs.length > 0) {
        const text = Array.from(paragraphs).map(p => p.textContent.trim()).filter(Boolean).join('\n\n');
        const type = sections.length === 0 ? 'reading' : 'reply';
        sections.push({ type, text });
      } else {
        const text = el.textContent.trim();
        if (text) {
          const type = sections.length === 0 ? 'reading' : 'reply';
          sections.push({ type, text });
        }
      }
    } else if (el.tagName === 'H3') {
      // Skip "解读中..." heading
      continue;
    }
  }
  return sections;
}

/**
 * Layout text blocks: wrap each section's text and tag with type for rendering.
 */
function layoutTextBlocks(ctx, sections, maxWidth, scale) {
  const blocks = [];
  for (const section of sections) {
    ctx.font = section.type === 'question'
      ? `italic ${13 * scale}px "Noto Serif SC", serif`
      : `${14 * scale}px "Noto Serif SC", serif`;
    const lines = wrapText(ctx, section.text, maxWidth);
    blocks.push({ type: section.type, lines });
  }
  return blocks;
}

function measureTextBlocksHeight(blocks, lineH, paraGap, sectionGap) {
  let h = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) h += sectionGap;
    const block = blocks[i];
    for (let j = 0; j < block.lines.length; j++) {
      if (block.lines[j] === '') {
        h += paraGap; // paragraph break
      } else {
        h += lineH;
      }
    }
  }
  return h;
}

function renderTextBlocks(ctx, blocks, x, startY, lineH, paraGap, sectionGap, textColor, accentColor, scale) {
  let y = startY;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i > 0) y += sectionGap;

    if (block.type === 'question') {
      // Draw a subtle divider line before the question
      ctx.save();
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - sectionGap / 2);
      ctx.lineTo(x + 40 * scale, y - sectionGap / 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = accentColor;
      ctx.font = `italic ${13 * scale}px "Noto Serif SC", serif`;
    } else if (block.type === 'cards') {
      ctx.fillStyle = accentColor;
      ctx.font = `${13 * scale}px "Noto Serif SC", serif`;
    } else {
      ctx.fillStyle = textColor;
      ctx.font = `${14 * scale}px "Noto Serif SC", serif`;
    }

    for (const line of block.lines) {
      if (line === '') {
        y += paraGap;
      } else {
        ctx.fillText(line, x, y);
        y += lineH;
      }
    }
  }
  return y;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function showImagePreview(dataUrl) {
  const overlay = document.getElementById('imagePreviewOverlay');
  const img = document.getElementById('imagePreviewImg');
  if (!overlay || !img) return;

  img.src = dataUrl;
  overlay.classList.add('show');
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
}

function closeImagePreview() {
  const overlay = document.getElementById('imagePreviewOverlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.classList.remove('show'); }, 350);
}

async function downloadImage() {
  if (!generatedImageDataUrl) return;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Mobile: use Web Share API to let user save to photos
  if (isMobile && navigator.share) {
    try {
      const blob = await (await fetch(generatedImageDataUrl)).blob();
      const file = new File([blob], 'arcana-oracle.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled
    }
  }

  // Desktop fallback: trigger download
  const link = document.createElement('a');
  link.download = `arcana-oracle-${Date.now()}.png`;
  link.href = generatedImageDataUrl;
  link.click();
  showNotification('图片已保存');
}

async function shareImage() {
  const inputEl = document.getElementById('questionInput');
  const question = inputEl?.dataset.fullQuestion || inputEl?.value.trim() || '';
  const cardNames = drawnCards.map(c => `${c.name}${c.isReversed ? '(逆位)' : ''}`).join('、');
  const text = `🔮 Arcana Oracle 塔罗占卜\n\n问题：${question}\n抽到的牌：${cardNames}\n\n来试试你的运势 →`;

  // Try to share image if Web Share API supports files
  if (navigator.share && generatedImageDataUrl) {
    try {
      const blob = await (await fetch(generatedImageDataUrl)).blob();
      const file = new File([blob], 'arcana-oracle.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Arcana Oracle 塔罗占卜', text, files: [file] });
        return;
      }
    } catch (e) {
      // Fall through to text share
    }
  }

  // Fallback: share text
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Arcana Oracle 塔罗占卜', text });
    } catch (e) {
      // User cancelled
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('已复制到剪贴板');
    } catch {
      showNotification('分享功能不可用');
    }
  }
}

async function generateInterpretation(question, container) {
  container.innerHTML = '<h3>解读中...</h3><div class="streaming-text"><span class="cursor-blink">|</span></div>';

  const textEl = container.querySelector('.streaming-text');
  let fullText = '';
  let scrollPending = false;

  await geminiReader.getReading({
    question,
    cards: drawnCards,
    spreadType: selectedSpread,
    onToken: (token) => {
      fullText += token;
      textEl.innerHTML = formatText(fullText) + '<span class="cursor-blink">|</span>';
      // Throttle scroll to once per frame to avoid jank
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(() => {
          textEl.scrollIntoView({ behavior: 'instant', block: 'end' });
          scrollPending = false;
        });
      }
    },
    onComplete: () => {
      textEl.innerHTML = formatText(fullText);
      container.querySelector('h3').textContent = '解读';
      // Show follow-up input
      showFollowUpInput();
    },
    onError: (err) => {
      console.error('Gemini API error:', err);
      container.innerHTML = '<h3>解读</h3>' +
        GeminiReader.getStaticReading(drawnCards, question, selectedSpread);
      // No follow-up for static fallback
    }
  });
}

// === Follow-up Questions ===
let followUpBound = false;

function showFollowUpInput() {
  const followUp = document.getElementById('followUp');
  if (!followUp) return;
  followUp.style.display = '';

  if (!followUpBound) {
    followUpBound = true;
    const input = document.getElementById('followUpInput');
    const sendBtn = document.getElementById('followUpSend');

    const doSend = () => {
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      sendFollowUp(msg);
    };

    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) doSend();
    });
  }
}

async function sendFollowUp(message) {
  const container = document.getElementById('interpretation');
  const followUp = document.getElementById('followUp');
  if (!container) return;

  // Disable input while streaming
  const input = document.getElementById('followUpInput');
  const sendBtn = document.getElementById('followUpSend');
  input.disabled = true;
  sendBtn.disabled = true;

  // Append divider + user question
  const divider = document.createElement('div');
  divider.className = 'follow-up-divider';
  container.appendChild(divider);

  const questionEl = document.createElement('div');
  questionEl.className = 'follow-up-question';
  questionEl.textContent = message;
  container.appendChild(questionEl);

  // Append streaming response area
  const replyEl = document.createElement('div');
  replyEl.className = 'streaming-text';
  replyEl.innerHTML = '<span class="cursor-blink">|</span>';
  container.appendChild(replyEl);

  let fullText = '';
  let scrollPending = false;

  await geminiReader.followUp({
    message,
    onToken: (token) => {
      fullText += token;
      replyEl.innerHTML = formatText(fullText) + '<span class="cursor-blink">|</span>';
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(() => {
          replyEl.scrollIntoView({ behavior: 'instant', block: 'end' });
          scrollPending = false;
        });
      }
    },
    onComplete: () => {
      // Check for [DRAW:N] marker
      const drawMatch = fullText.match(/\[DRAW:(\d+)\]\s*$/);
      const cleanText = fullText.replace(/\[DRAW:\d+\]\s*$/, '').trim();
      replyEl.innerHTML = formatText(cleanText);

      if (drawMatch) {
        const drawCount = Math.min(parseInt(drawMatch[1], 10), 2);
        showFollowUpDrawButton(drawCount, container);
      }

      // Re-enable input
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    },
    onError: (err) => {
      console.error('Follow-up error:', err);
      replyEl.innerHTML = '<p style="color:var(--text-secondary);font-style:italic;">追问失败，请稍后再试。</p>';
      input.disabled = false;
      sendBtn.disabled = false;
    }
  });
}

function showFollowUpDrawButton(count, container) {
  const btn = document.createElement('button');
  btn.className = 'follow-up-draw-btn';
  btn.textContent = `抽${count}张补充牌`;
  btn.addEventListener('click', () => {
    btn.remove();
    handleFollowUpDraw(count, container);
  });
  container.appendChild(btn);

  // Scroll to the button
  requestAnimationFrame(() => btn.scrollIntoView({ behavior: 'smooth', block: 'end' }));
}

async function handleFollowUpDraw(count, container) {
  // Find undrawn cards from shuffled deck
  const drawnIds = new Set(drawnCards.map(c => c.id));
  const available = shuffledDeck.filter(c => !drawnIds.has(c.id));

  if (available.length < count) {
    container.insertAdjacentHTML('beforeend', '<p style="color:var(--text-secondary);font-style:italic;">牌堆中没有足够的牌了。</p>');
    return;
  }

  // Disable follow-up input while picking
  const input = document.getElementById('followUpInput');
  const sendBtn = document.getElementById('followUpSend');
  input.disabled = true;
  sendBtn.disabled = true;

  // Use the full-screen overlay for supplementary draw
  const overlay = document.getElementById('deckOverlay');
  const overlayArea = document.getElementById('deckOverlayArea');
  const overlayHint = document.getElementById('deckOverlayHint');
  overlayArea.innerHTML = '';
  overlayHint.textContent = `请选择 ${count} 张补充牌`;

  // Show overlay with fade-in
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('show'));
  });

  // Create animation engine inside overlay area
  animEngine = new AnimationEngine(overlayArea);
  const backImgUrl = await getCardBackImageUrl();

  const cardCount = available.length;
  for (let i = 0; i < cardCount; i++) {
    const cardEl = document.createElement('div');
    cardEl.className = 'floating-card';
    cardEl.dataset.index = i;

    if (backImgUrl) {
      cardEl.style.backgroundImage = `url(${backImgUrl})`;
      cardEl.style.backgroundSize = 'cover';
      cardEl.style.borderRadius = getComputedStyle(cardEl).borderRadius;
    } else {
      renderCardBack(cardEl);
    }

    overlayArea.appendChild(cardEl);
    animEngine.addCard(cardEl, i, cardCount);
  }

  animEngine.enableDrag();
  animEngine.start();

  // Wait for user to pick `count` cards via click
  const newCards = await new Promise((resolve) => {
    const picked = [];
    let supplementPickAnimating = false;

    overlayArea.addEventListener('click', function handler(e) {
      const cardEl = e.target.closest('.floating-card:not(.picked)');
      if (!cardEl) return;
      if (supplementPickAnimating) return;
      supplementPickAnimating = true;
      setTimeout(() => { supplementPickAnimating = false; }, 800);

      cardEl.classList.add('picked');
      cardEl.style.pointerEvents = 'none';
      cardEl.style.zIndex = '999';

      const idx = parseInt(cardEl.dataset.index, 10);
      picked.push(available[idx]);

      if (animEngine) {
        animEngine.selectCard(cardEl, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }

      const remaining = count - picked.length;
      overlayHint.textContent = remaining > 0 ? `还需选择 ${remaining} 张补充牌` : '选牌完成';

      if (picked.length >= count) {
        overlayArea.removeEventListener('click', handler);
        setTimeout(() => {
          if (animEngine) { animEngine.stop(); animEngine = null; }
          // Fade out overlay
          overlay.classList.remove('show');
          setTimeout(() => {
            overlay.style.display = 'none';
            overlayArea.innerHTML = '';
          }, 400);
          resolve(picked);
        }, 800);
      }
    });
  });

  // Add to drawnCards
  drawnCards.push(...newCards);

  // Show picked cards info
  const cardsHtml = newCards.map(card => {
    const dir = card.isReversed ? '逆位' : '正位';
    return `「${card.name}」（${dir}）`;
  }).join('、');

  const cardInfoEl = document.createElement('div');
  cardInfoEl.className = 'follow-up-new-cards';
  cardInfoEl.innerHTML = `<p>你抽到了补充牌：${cardsHtml}</p>`;
  container.appendChild(cardInfoEl);

  // Add card info to conversation and stream new reading
  geminiReader.addCardInfo(newCards);

  const replyEl = document.createElement('div');
  replyEl.className = 'streaming-text';
  replyEl.innerHTML = '<span class="cursor-blink">|</span>';
  container.appendChild(replyEl);

  let fullText = '';
  let scrollPending = false;

  await geminiReader.followUp({
    message: `请结合补充牌继续解读。`,
    onToken: (token) => {
      fullText += token;
      replyEl.innerHTML = formatText(fullText) + '<span class="cursor-blink">|</span>';
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(() => {
          replyEl.scrollIntoView({ behavior: 'instant', block: 'end' });
          scrollPending = false;
        });
      }
    },
    onComplete: () => {
      const cleanText = fullText.replace(/\[DRAW:\d+\]\s*$/, '').trim();
      replyEl.innerHTML = formatText(cleanText);
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    },
    onError: (err) => {
      console.error('Supplementary reading error:', err);
      replyEl.innerHTML = '<p style="color:var(--text-secondary);font-style:italic;">补充解读失败，请稍后再试。</p>';
      input.disabled = false;
      sendBtn.disabled = false;
    }
  });
}

function formatText(text) {
  return text
    // Strip markdown headings
    .replace(/^#{1,6}\s+/gm, '')
    // Strip horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Strip bold/italic markers
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    // Strip list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Convert paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

// === Notifications ===
function showNotification(msg) {
  let notif = document.getElementById('notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'notification';
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}

// === Reset ===
function resetAll() {
  phase = 'input';
  drawnCards = [];
  pickCount = 0;
  generatedImageDataUrl = null;
  shuffledDeck = [];
  pickAnimating = false;

  if (animEngine) {
    animEngine.stop();
    animEngine = null;
  }

  // Restore UI
  document.querySelector('.header')?.classList.remove('hidden');
  document.getElementById('questionSection')?.classList.remove('hidden');
  document.getElementById('drawBtn')?.classList.remove('hidden');
  document.getElementById('results')?.classList.remove('show');
  document.getElementById('deckArea')?.classList.remove('show');
  // Clean up deck overlay
  const deckOverlay = document.getElementById('deckOverlay');
  if (deckOverlay) { deckOverlay.classList.remove('show'); deckOverlay.style.display = 'none'; }
  document.getElementById('deckOverlayArea')?.replaceChildren();
  document.body.classList.remove('results-active');

  // Reset follow-up
  const followUpEl = document.getElementById('followUp');
  if (followUpEl) followUpEl.style.display = 'none';
  const followUpInput = document.getElementById('followUpInput');
  if (followUpInput) { followUpInput.value = ''; followUpInput.disabled = false; }
  const followUpSend = document.getElementById('followUpSend');
  if (followUpSend) followUpSend.disabled = false;
  geminiReader.conversationHistory = [];

  dismissHint(true); // force — full reset

  const input = document.getElementById('questionInput');
  if (input) {
    input.value = '';
    input.disabled = false;
  }

  // Hide camera PiP if still showing
  const cameraPip = document.getElementById('cameraPip');
  if (cameraPip) cameraPip.style.display = '';

  // Close image preview if open
  closeImagePreview();

  // Abort any ongoing API call
  geminiReader?.abort();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
