// ============================================================================
// image-generator.js -- Gemini (Nano Banana) API card image generation
// Generates Mucha-style tarot card art via Google Gemini image generation
// Caches results in IndexedDB for offline use
// ============================================================================

const GEMINI_MODEL = 'gemini-2.0-flash-exp-image-generation';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// IndexedDB cache for generated card images
// ---------------------------------------------------------------------------

class CardImageCache {
  constructor() {
    this.dbName = 'arcana-oracle';
    this.storeName = 'card-images';
    this._db = null;
  }

  async _getDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(this.storeName, { keyPath: 'id' });
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async get(cardId) {
    const db = await this._getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(cardId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async set(cardId, data, mimeType) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put({ id: cardId, data, mimeType, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async has(cardId) {
    const entry = await this.get(cardId);
    return entry !== null;
  }

  async getAsDataURL(cardId) {
    const entry = await this.get(cardId);
    if (!entry) return null;
    return `data:${entry.mimeType};base64,${entry.data}`;
  }

  async clear() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async count() {
    const db = await this._getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  }
}

// Shared cache instance
export const cardImageCache = new CardImageCache();

// ---------------------------------------------------------------------------
// Card-specific Mucha-style prompts
// ---------------------------------------------------------------------------

const CARD_PROMPTS = {
  0: `The Fool tarot card. A dreamy youth in flowing Art Nouveau robes steps towards a cliff edge, a small white dog at their feet. They carry a bindle and a white rose. Butterflies and dandelion seeds float around them. Expression of innocent wonder.`,
  1: `The Magician tarot card. A powerful figure in ornate robes stands before a table with a chalice, pentacle, sword, and wand. One hand points to the sky, the other to earth. An infinity lemniscate glows above their head. Roses and lilies frame the scene.`,
  2: `The High Priestess tarot card. A serene woman sits between two pillars (one black, one white), wearing a lunar crown and flowing blue-silver robes. She holds a partially hidden scroll. A crescent moon at her feet. Pomegranates and a veil of stars behind her.`,
  3: `The Empress tarot card. A radiant woman with a crown of twelve stars sits in a lush garden on a velvet throne. She wears flowing robes with pomegranate patterns. Wheat grows at her feet, a waterfall behind her. Venus symbol on a heart-shaped shield.`,
  4: `The Emperor tarot card. A commanding figure in red-gold armor sits on a stone throne carved with ram heads. He holds an ankh scepter and an orb. Mountains rise behind him. His long beard and stern gaze convey authority and structure.`,
  5: `The Hierophant tarot card. A spiritual teacher in elaborate vestments sits between two grey pillars, wearing a triple crown. He raises two fingers in blessing. Two acolytes kneel before him. Crossed keys at his feet. Stained glass patterns in background.`,
  6: `The Lovers tarot card. Two figures stand beneath an angelic being with outstretched wings blessing them from above. Behind one figure a tree of knowledge with a serpent, behind the other a tree of flames. A radiant sun above the angel.`,
  7: `The Chariot tarot card. A warrior prince stands in a golden chariot drawn by two sphinxes (one black, one white). A canopy of stars above, a city behind. The charioteer wears a star crown. Armor with crescents and alchemical symbols.`,
  8: `Strength tarot card. A gentle woman calmly opens the jaws of a lion with her bare hands. White robe with a garland of flowers. An infinity symbol above her head. Quiet inner power, not brute force. Flowers and vines surround them.`,
  9: `The Hermit tarot card. An old sage in a grey hooded cloak stands on a mountain peak, holding a lantern with a six-pointed star inside. He leans on a wooden staff. Snow-covered peaks below, a vast starry sky above. Solitary and contemplative.`,
  10: `Wheel of Fortune tarot card. A great golden wheel inscribed with alchemical symbols floats in clouds. A sphinx atop the wheel, a serpent descends one side, a figure rises on the other. In corners: an angel, eagle, lion, and bull. Zodiac symbols around.`,
  11: `Justice tarot card. A crowned figure sits between pillars holding a raised sword in one hand and balanced scales in the other. Purple-red robes, a square crown. Symmetrical geometric patterns in background. Expression stern and impartial.`,
  12: `The Hanged Man tarot card. A figure suspended upside down from a living tree by one foot, the other leg crossed behind. Serene enlightened expression with a halo of golden light around their head. Autumn leaves fall. Contemplative sacrifice.`,
  13: `Death tarot card. A skeletal figure in black armor rides a white horse. A king lies fallen, a bishop pleads, a maiden and child watch. A white rose banner. In the distance, a river and a rising sun between two towers. Transformation, not destruction.`,
  14: `Temperance tarot card. A luminous winged angel pours water between two chalices, one foot in a stream, one on land. A path leads to a golden crown on a mountain. Irises bloom. A triangle with a sun on the angel's chest. Rainbow prismatic light.`,
  15: `The Devil tarot card. A horned, bat-winged figure perches on a dark pedestal. Two small chained figures below with loose chains they could remove. An inverted pentagram above. Dark red and black atmosphere. Temptation and bondage.`,
  16: `The Tower tarot card. A tall stone tower struck by lightning from a dark sky. The crown at its top blown off. Two figures fall from the tower. Flames pour from windows. Sparks and debris rain down. Dramatic scene of sudden upheaval and revelation.`,
  17: `The Star tarot card. A nude woman kneels by a pool, pouring water from two pitchers into the pool and onto land. A large eight-pointed star surrounded by seven smaller stars. A bird perches in a tree. Peaceful night sky, hope and renewal.`,
  18: `The Moon tarot card. A large full moon with a face shines between two towers. A winding path from a pool where a crayfish emerges. A dog and a wolf howl at the moon. Droplets fall from the moon. Mysterious, dreamlike, slightly unsettling.`,
  19: `The Sun tarot card. A radiant golden sun with a face shines over a walled garden. A joyful child rides a white horse, arms outstretched. Sunflowers bloom tall. A red banner flows. Everything bright and celebratory. Pure happiness and vitality.`,
  20: `Judgement tarot card. An angel blows a great trumpet from the clouds, bearing a cross flag. Below, figures rise from coffins with arms outstretched. Mountains and a vast sea. Resurrection and spiritual awakening. Dawn light breaking through.`,
  21: `The World tarot card. A dancing figure draped in purple scarf encircled by a large green laurel wreath tied with red ribbons. In four corners: an angel, eagle, lion, and bull. The figure holds two wands. Completion, wholeness, cosmic harmony.`
};

const STYLE_SUFFIX = `Alphonse Mucha Art Nouveau style illustration. Richly detailed with flowing organic curves, ornamental halos, stylized floral borders, and golden accents. Deep dark jewel-tone background. Mystical, ethereal, and luxurious atmosphere. Elegant and symbolic figure. Portrait orientation, decorative border frame. High quality detailed artwork.`;

function buildPrompt(card) {
  const desc = CARD_PROMPTS[card.id] || `${card.nameEn} tarot card with symbolic imagery.`;
  return `${desc}\n\n${STYLE_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// ImageGenerator class
// ---------------------------------------------------------------------------

export class ImageGenerator {
  constructor() {
    this._apiKey = localStorage.getItem('gemini_api_key') || '';
    this._abortController = null;
  }

  get hasApiKey() {
    return this._apiKey.length > 0;
  }

  getApiKey() {
    return this._apiKey;
  }

  setApiKey(key) {
    this._apiKey = key.trim();
    if (this._apiKey) {
      localStorage.setItem('gemini_api_key', this._apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }

  clearApiKey() {
    this._apiKey = '';
    localStorage.removeItem('gemini_api_key');
  }

  /**
   * Generate an image for a single card using Gemini API.
   * @param {Object} card - Card data object
   * @returns {Promise<string>} Data URL of generated image
   */
  async generateCardImage(card) {
    if (!this.hasApiKey) throw new Error('Gemini API Key 未设置');

    const prompt = buildPrompt(card);
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${this._apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT']
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = `API 错误 ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        msg = errJson.error?.message || msg;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) {
      throw new Error('响应中没有图片数据');
    }

    const { mimeType, data: base64Data } = imagePart.inlineData;
    await cardImageCache.set(card.id, base64Data, mimeType);
    return `data:${mimeType};base64,${base64Data}`;
  }

  /**
   * Generate images for all cards with progress callback.
   * @param {Array} cards - Array of card data objects
   * @param {Function} onProgress - (completed, total, card, status)
   * @returns {Promise<{success: number, failed: number, errors: string[]}>}
   */
  async generateAll(cards, onProgress) {
    const results = { success: 0, failed: 0, errors: [] };
    const total = cards.length;
    this._abortController = new AbortController();

    for (let i = 0; i < cards.length; i++) {
      if (this._abortController.signal.aborted) break;

      const card = cards[i];

      // Skip if already cached
      if (await cardImageCache.has(card.id)) {
        results.success++;
        onProgress?.(i + 1, total, card, 'cached');
        continue;
      }

      try {
        onProgress?.(i, total, card, 'generating');
        await this.generateCardImage(card);
        results.success++;
        onProgress?.(i + 1, total, card, 'done');

        // Delay between requests to avoid rate limiting
        if (i < cards.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${card.name}: ${err.message}`);
        onProgress?.(i + 1, total, card, 'error');
      }
    }

    this._abortController = null;
    return results;
  }

  /** Abort an ongoing generateAll operation. */
  abort() {
    this._abortController?.abort();
  }

  /** Clear all cached images. */
  async clearCache() {
    await cardImageCache.clear();
  }

  /** Get count of cached images. */
  async getCacheCount() {
    return cardImageCache.count();
  }
}
