import { majorArcana } from './cards-data.js';
import { renderCard, renderCardBack } from './card-renderer.js';
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

  // Camera mode selection
  document.getElementById('enableCamera')?.addEventListener('click', () => {
    initHandTracking();
    closeModeModal();
  });
  document.getElementById('useClick')?.addEventListener('click', () => {
    useHandTracking = false;
    closeModeModal();
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
      if (handCursorEl) handCursorEl.classList.add('active');
      // Update hint for hand tracking mode
      const hint = document.getElementById('deckHint');
      if (hint) hint.textContent = '请将手掌伸入摄像头范围';
      // Default orbit until hand appears
      if (animEngine) animEngine.setOrbitSpeed(0.05);
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
    if (!ok) {
      useHandTracking = false;
      handTracker = null;
      showNotification('摄像头访问被拒绝，已切换到点击模式');
    }
  } catch (err) {
    console.error('Hand tracking init failed:', err);
    useHandTracking = false;
    handTracker = null;
    showNotification('手势追踪初始化失败: ' + (err.message || '未知错误'));
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

function handleHandMove({ x, y, visible, grabbing }) {
  if (!handCursorEl) return;
  const hint = document.getElementById('deckHint');
  if (!visible) {
    handCursorEl.style.opacity = '0';
    if (animEngine && phase === 'deck') animEngine.setOrbitSpeed(0.05);
    if (hint && phase === 'deck') hint.textContent = '请将手掌伸入摄像头范围';
    return;
  }
  handCursorEl.style.opacity = '1';
  handCursorEl.style.left = x + 'px';
  handCursorEl.style.top = y + 'px';
  handCursorEl.classList.toggle('grabbing', grabbing);

  // Control orbit speed based on hand gesture
  if (animEngine && phase === 'deck') {
    animEngine.setHoverPosition(x, y);
    if (grabbing) {
      animEngine.setOrbitSpeed(0.005);
      if (hint) hint.textContent = '移到想要的牌上方，握拳即可抓取';
    } else {
      animEngine.setOrbitSpeed(0.25);
      if (hint) hint.textContent = '手掌张开 → 牌阵旋转  ｜  握拳 → 抓取';
    }
    checkCardHover(x, y);
  }
}

function handleGrab({ x, y }) {
  if (phase !== 'deck') return;
  const hoveredCard = getCardAtPosition(x, y);
  if (hoveredCard) {
    pickCard(hoveredCard);
  }
}

function handleRelease() {
  // Future: could animate hand opening effect
}

function getCardAtPosition(x, y) {
  const cards = document.querySelectorAll('.floating-card:not(.picked)');
  const PAD = 15;
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

// === Drawing Phase ===
function startDrawing() {
  const question = document.getElementById('questionInput')?.value.trim();
  if (!question) {
    const input = document.getElementById('questionInput');
    if (input) {
      input.classList.add('shake');
      input.setAttribute('placeholder', '请先输入你的问题...');
      setTimeout(() => input.classList.remove('shake'), 600);
    }
    return;
  }

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
  }
}

function showFloatingDeck() {
  const deckArea = document.getElementById('deckArea');
  if (!deckArea) return;
  deckArea.innerHTML = '';
  deckArea.classList.add('show');

  const hint = document.getElementById('deckHint');
  if (hint) {
    hint.classList.add('show');
    hint.textContent = useHandTracking ? '张开手掌 → 牌阵旋转 ｜ 握拳 → 抓取面前的牌' : '凭直觉点选牌面';
  }

  // Create animation engine
  animEngine = new AnimationEngine(deckArea);

  // Create floating cards (all 22 Major Arcana)
  const cardCount = majorArcana.length;
  for (let i = 0; i < cardCount; i++) {
    const cardEl = document.createElement('div');
    cardEl.className = 'floating-card';
    cardEl.dataset.index = i;

    // Render card back
    renderCardBack(cardEl);

    // Click handler
    cardEl.addEventListener('click', () => {
      if (!useHandTracking) pickCard(cardEl);
    });

    deckArea.appendChild(cardEl);
    animEngine.addCard(cardEl, i, cardCount);
  }

  animEngine.start();
}

function pickCard(cardEl) {
  if (cardEl.classList.contains('picked') || pickCount >= selectedSpread) return;
  cardEl.classList.add('picked');
  pickCount++;

  // Random card from remaining
  const available = majorArcana.filter(c => !drawnCards.find(d => d.id === c.id));
  const chosen = available[Math.floor(Math.random() * available.length)];
  const isReversed = Math.random() < 0.5;
  drawnCards.push({ ...chosen, isReversed });

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
      document.getElementById('deckHint')?.classList.remove('show');
      showResults();
    }, 800);
  }
}

// === Results Phase ===
function showResults() {
  phase = 'reading';
  const question = document.getElementById('questionInput')?.value.trim() || '';
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
    wrapper.className = 'card-wrapper fade-in-up';
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

    // Flip with delay
    setTimeout(() => {
      flipContainer.classList.add('flipped');
    }, 800 + i * 600);
  });

  // Show results container
  results.classList.add('show');

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

async function generateInterpretation(question, container) {
  container.innerHTML = '<h3>解读中...</h3><div class="streaming-text"><span class="cursor-blink">|</span></div>';

  const textEl = container.querySelector('.streaming-text');
  let fullText = '';

  await geminiReader.getReading({
    question,
    cards: drawnCards,
    spreadType: selectedSpread,
    onToken: (token) => {
      fullText += token;
      textEl.innerHTML = formatText(fullText) + '<span class="cursor-blink">|</span>';
      container.scrollTop = container.scrollHeight;
    },
    onComplete: () => {
      textEl.innerHTML = formatText(fullText);
      container.querySelector('h3').textContent = '解读';
    },
    onError: (err) => {
      console.error('Gemini API error:', err);
      container.innerHTML = '<h3>解读</h3>' +
        GeminiReader.getStaticReading(drawnCards, question, selectedSpread);
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
  document.getElementById('deckHint')?.classList.remove('show');

  const input = document.getElementById('questionInput');
  if (input) {
    input.value = '';
    input.disabled = false;
  }

  // Abort any ongoing API call
  geminiReader?.abort();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
