// Claude API integration for tarot card readings
// Uses direct browser CORS with anthropic-dangerous-direct-browser-access header

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;
const STORAGE_KEY = 'arcana_oracle_api_key';

export class ClaudeReader {
  constructor() {
    this.apiKey = localStorage.getItem(STORAGE_KEY) || '';
    this.abortController = null;
  }

  get hasApiKey() {
    return this.apiKey.length > 0;
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    if (this.apiKey) {
      localStorage.setItem(STORAGE_KEY, this.apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = '';
    localStorage.removeItem(STORAGE_KEY);
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get a tarot reading from Claude API with streaming
   * @param {Object} params
   * @param {string} params.question - User's question
   * @param {Array} params.cards - Drawn cards with isReversed flag
   * @param {number} params.spreadType - 1 (single) or 3 (past/present/future)
   * @param {function} params.onToken - Callback for each streamed token
   * @param {function} params.onComplete - Callback when done
   * @param {function} params.onError - Callback on error
   */
  async getReading({ question, cards, spreadType, onToken, onComplete, onError }) {
    if (!this.hasApiKey) {
      onError?.('未设置 API Key');
      return;
    }

    const positionLabels = spreadType === 1
      ? ['指引']
      : ['过去', '现在', '未来'];

    const spreadDescription = cards.map((card, i) => {
      const direction = card.isReversed ? '逆位 (Reversed)' : '正位 (Upright)';
      const keywords = card.isReversed ? card.reversed : card.upright;
      return `【${positionLabels[i]}】${card.name} (${card.nameEn}) — ${direction}\n关键词: ${keywords}`;
    }).join('\n\n');

    const systemPrompt = `你是一位拥有深厚塔罗智慧的占卜师，精通22张大阿尔卡纳牌的象征意义。你的解读风格温暖而神秘，富有诗意但清晰易懂。你会根据提问者的具体问题，将牌面含义与实际生活联系起来，给出有深度的解读和切实的建议。

请用中文回答，语言优美流畅，像是在讲述一个神秘的故事。适当使用比喻和意象。解读要有层次感：先解读每张牌，再分析牌与牌之间的关系，最后给出综合建议。`;

    const userPrompt = `我的问题是：「${question}」

我抽到的牌：

${spreadDescription}

请为我详细解读这次塔罗占卜。`;

    this.abortController = new AbortController();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          stream: true
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errBody = await response.text();
        let msg = `API 请求失败 (${response.status})`;
        try {
          const errJson = JSON.parse(errBody);
          msg = errJson.error?.message || msg;
        } catch {}
        onError?.(msg);
        return;
      }

      await this._handleStream(response, onToken, onComplete, onError);
    } catch (err) {
      if (err.name === 'AbortError') {
        onComplete?.();
      } else {
        onError?.(err.message || '网络请求失败');
      }
    } finally {
      this.abortController = null;
    }
  }

  async _handleStream(response, onToken, onComplete, onError) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.type === 'content_block_delta' && data.delta?.text) {
              onToken?.(data.delta.text);
            }

            if (data.type === 'message_stop') {
              onComplete?.();
              return;
            }

            if (data.type === 'error') {
              onError?.(data.error?.message || '流式响应错误');
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
      onComplete?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err.message);
      }
    }
  }

  /**
   * Fallback: generate a reading from static card data (no API needed)
   */
  static getStaticReading(cards, question, spreadType) {
    const positionLabels = spreadType === 1
      ? ['指引']
      : ['过去', '现在', '未来'];

    let html = '';

    cards.forEach((card, i) => {
      const dir = card.isReversed ? '逆位' : '正位';
      const desc = card.isReversed ? card.reversedDesc : card.uprightDesc;
      html += `<div class="interp-card-title">${positionLabels[i]} — ${card.name}（${dir}）</div>`;
      html += `<div class="interp-text">${desc}</div>`;
    });

    // Summary
    html += '<div class="interp-summary">';
    if (spreadType === 1) {
      const c = cards[0];
      const energy = c.isReversed ? '逆位能量提醒你注意潜在的挑战' : '正位能量为你带来积极的指引';
      html += `关于「${question}」，${c.name}的${energy}。${c.isReversed ? '建议你重新审视当前的方向，调整策略。' : '顺应这股能量前行，答案将会逐渐清晰。'}`;
    } else {
      const pastE = cards[0].isReversed ? '挑战' : '力量';
      const presE = cards[1].isReversed ? '反思' : '信心';
      const futE = cards[2].isReversed ? '谨慎前行' : '积极展望';
      html += `关于「${question}」——过去的${cards[0].name}为你积累了${pastE}，当下的${cards[1].name}引导你带着${presE}面对现状，而未来的${cards[2].name}预示着你需要${futE}。牌阵整体提醒你信任过程，保持觉察。`;
    }
    html += '</div>';

    return html;
  }
}
