// Gemini Flash API integration for tarot card readings
// Streaming via SSE (alt=sse)

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';
const API_KEY = 'AIzaSyCLqE3PELTWoNB6jzZ30gH5Ua9ilw16INs';

export class GeminiReader {
  constructor() {
    this.abortController = null;
  }

  get hasApiKey() {
    return true;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async getReading({ question, cards, spreadType, onToken, onComplete, onError }) {
    const positionLabels = ['过去', '现在', '未来'];

    const spreadDescription = cards.map((card, i) => {
      const direction = card.isReversed ? '逆位 (Reversed)' : '正位 (Upright)';
      const keywords = card.isReversed ? card.reversed : card.upright;
      return `【${positionLabels[i]}】${card.name} (${card.nameEn}) — ${direction}\n关键词: ${keywords}`;
    }).join('\n\n');

    const systemPrompt = `你是一位经验丰富的塔罗占卜师，拥有数十年的占卜经验。你精通22张大阿尔卡纳牌的深层象征意义，能够洞察牌阵中隐藏的信息。

你的风格：
- 像一位真正的占卜师面对面与来访者交谈，语气温暖、神秘而权威
- 用"你"来称呼提问者，像对话一样自然
- 语言优美流畅，富有诗意，善用比喻和意象
- 给出的建议要具体、实用，不空泛

输出格式要求（非常重要）：
- 绝对不要使用任何 markdown 格式符号，包括但不限于：#、##、###、**、*、---、- 列表符号、> 引用符号
- 用自然的中文段落组织文字，段落之间用空行分隔
- 不要用编号列表，用流畅的叙述方式表达
- 牌名可以用书名号标注，如「愚者」

解读结构：
1. 先用一两句话营造氛围，引入这次占卜
2. 依次解读每张牌在其位置（过去、现在、未来）的含义，结合提问者的具体问题
3. 分析三张牌之间的关联和故事线
4. 给出综合建议和具体的行动指引`;

    const userPrompt = `我的问题是：「${question}」

我抽到的牌：

${spreadDescription}

请为我详细解读这次塔罗占卜。`;

    this.abortController = new AbortController();
    const url = `${API_BASE}/models/${MODEL}:streamGenerateContent?key=${API_KEY}&alt=sse`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 8192
          }
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

      await this._handleSSE(response, onToken, onComplete, onError);
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

  async _handleSSE(response, onToken, onComplete, onError) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const STREAM_TIMEOUT = 30000; // 30s no-data timeout

    const readWithTimeout = () => {
      return Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('STREAM_TIMEOUT')), STREAM_TIMEOUT)
        )
      ]);
    };

    try {
      while (true) {
        const { done, value } = await readWithTimeout();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const parts = data.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) onToken?.(part.text);
              }
            }
            // Any finishReason means the stream is done
            const finishReason = data.candidates?.[0]?.finishReason;
            if (finishReason) {
              onComplete?.();
              return;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
      onComplete?.();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.message === 'STREAM_TIMEOUT') {
        onError?.('连接超时，请重试');
      } else {
        onError?.(err.message);
      }
    }
  }

  /**
   * Fallback: static reading from card data (no API needed)
   */
  static getStaticReading(cards, question, spreadType) {
    const positionLabels = ['过去', '现在', '未来'];

    let html = '';

    cards.forEach((card, i) => {
      const dir = card.isReversed ? '逆位' : '正位';
      const desc = card.isReversed ? card.reversedDesc : card.uprightDesc;
      html += `<div class="interp-card-title">${positionLabels[i]} — ${card.name}（${dir}）</div>`;
      html += `<div class="interp-text">${desc}</div>`;
    });

    html += '<div class="interp-summary">';
    const pastE = cards[0].isReversed ? '挑战' : '力量';
    const presE = cards[1].isReversed ? '反思' : '信心';
    const futE = cards[2].isReversed ? '谨慎前行' : '积极展望';
    html += `关于「${question}」——过去的${cards[0].name}为你积累了${pastE}，当下的${cards[1].name}引导你带着${presE}面对现状，而未来的${cards[2].name}预示着你需要${futE}。牌阵整体提醒你信任过程，保持觉察。`;
    html += '</div>';

    return html;
  }
}
