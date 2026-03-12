// Gemini Flash API integration for tarot card readings
// Streaming via SSE (alt=sse)

const PROXY_URL = '/api/gemini';

const BASE_SYSTEM_PROMPT = `你是一位神秘而富有智慧的塔罗占卜师。你拥有数十年的占卜经验，精通22张大阿尔卡纳牌的深层象征、神话原型和心理学意涵。

你的风格和语气：
- 你是一位温暖而洞察力强的灵性引导者，像面对面与来访者促膝交谈
- 语气沉稳、神秘、有深度，带有一种命运低语般的诗意感
- 用"你"称呼来访者，行文亲切自然
- 善于将塔罗牌的象征意义与来访者的具体生活情境联系起来
- 不要泛泛而谈，要深入到来访者的问题中给出精准、有温度的指引
- 绝对不要给出具体的行动清单或"建议1、建议2"这种列表。你是塔罗师，不是人生导师或职业顾问
- 如果要引导来访者，用塔罗牌的意象和隐喻来启发，比如"命运之轮提醒你顺应变化的潮流"，而不是"制定详细的计划并学习新技能"

输出格式要求（非常重要）：
- 绝对不要使用任何 markdown 格式符号，包括但不限于：#、##、###、**、*、---、- 列表符号、> 引用符号、数字编号
- 用自然的中文段落组织文字，段落之间用空行分隔
- 不要用编号列表，用流畅的叙述方式表达
- 牌名用书名号标注，如「愚者」`;

const READING_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + `

核心要求（最重要）：
- 你的解读必须紧密围绕来访者提出的问题展开，所有分析都要与这个问题直接相关
- 不要只是罗列每张牌的通用含义，而是要把牌的含义融入到来访者的问题语境中
- 三张牌要构成一个完整的叙事：过去的因→现在的境→未来的果
- 字数不少于800字，给出丰富、有深度的解读

解读结构：
- 以一小段富有氛围感的开场白引入（与来访者的问题相关，不要千篇一律）
- 从「过去」的牌开始，解读这张牌揭示了来访者在这个问题上经历过什么，是如何走到今天的
- 然后解读「现在」的牌，分析来访者此刻的处境、心态、面临的机遇或挑战
- 接着解读「未来」的牌，预示接下来可能的发展方向和需要注意的事项
- 最后把三张牌串联成一个完整的故事，给出有洞察力的综合分析
- 用塔罗牌的意象给予来访者灵性层面的启示和方向感，而非世俗的具体操作建议
- 以一句富有力量感和命运感的结语收尾`;

const FOLLOW_UP_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + `

来访者现在有后续问题。请基于刚才的牌面和解读，继续以塔罗师的身份回答。保持同样的语气和风格。回答简洁一些，200-400字即可。

关于补充抽牌（非常重要，请仔细判断）：
作为一位专业塔罗师，你需要主动判断当前牌面是否足以回答来访者的追问。以下情况你应该建议抽补充牌：
- 来访者的追问涉及一个全新的维度或方向（比如之前问感情，现在追问事业、健康、财务等）
- 来访者想深入了解某个方面，但现有牌面对此没有足够的信息
- 来访者的问题触及了原始牌面未能覆盖的盲区
- 你作为塔罗师直觉感到需要更多牌面信息来给出负责任的解读

当你判断需要补充牌时：
1. 先向来访者解释为什么现有牌面不足以完整回答这个问题
2. 说明补充牌将帮助揭示什么样的信息
3. 在回复的最末尾单独一行写：[DRAW:1] 或 [DRAW:2]（数字表示建议抽几张）

当来访者抽完补充牌后，你必须结合新牌和之前所有牌面进行综合解读，不要只解读新牌。

如果现有牌面已经足够回答追问，则直接回答，不要加 [DRAW] 标记。`;

export class GeminiReader {
  constructor() {
    this.abortController = null;
    this.conversationHistory = []; // multi-turn conversation
    this._systemPrompt = '';       // cached for follow-ups
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

    const userPrompt = `我的问题是：「${question}」

我抽到的牌：

${spreadDescription}

请为我详细解读这次塔罗占卜。`;

    // Reset conversation history
    this._systemPrompt = READING_SYSTEM_PROMPT;
    this.conversationHistory = [
      { role: 'user', parts: [{ text: userPrompt }] }
    ];

    // Track full response for conversation history
    let fullResponse = '';
    const wrappedOnToken = (token) => {
      fullResponse += token;
      onToken?.(token);
    };
    const wrappedOnComplete = () => {
      // Save model response to history
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }]
      });
      onComplete?.();
    };

    await this._streamRequest({
      systemPrompt: READING_SYSTEM_PROMPT,
      contents: this.conversationHistory,
      onToken: wrappedOnToken,
      onComplete: wrappedOnComplete,
      onError
    });
  }

  async followUp({ message, onToken, onComplete, onError }) {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    let fullResponse = '';
    const wrappedOnToken = (token) => {
      fullResponse += token;
      onToken?.(token);
    };
    const wrappedOnComplete = () => {
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: fullResponse }]
      });
      onComplete?.();
    };

    await this._streamRequest({
      systemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
      contents: this.conversationHistory,
      onToken: wrappedOnToken,
      onComplete: wrappedOnComplete,
      onError
    });
  }

  /** Add supplementary card info to conversation (after follow-up draw) */
  addCardInfo(cards) {
    const positionLabels = ['补充牌'];
    const desc = cards.map((card, i) => {
      const direction = card.isReversed ? '逆位 (Reversed)' : '正位 (Upright)';
      const keywords = card.isReversed ? card.reversed : card.upright;
      return `【补充牌${i + 1}】${card.name} (${card.nameEn}) — ${direction}\n关键词: ${keywords}`;
    }).join('\n\n');

    const msg = `我又抽了${cards.length}张补充牌：\n\n${desc}\n\n请结合这些新牌和之前的牌面，继续解读。`;
    this.conversationHistory.push({ role: 'user', parts: [{ text: msg }] });
    return msg;
  }

  async _streamRequest({ systemPrompt, contents, onToken, onComplete, onError }) {
    this.abortController = new AbortController();

    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
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
    const c = cards.map((card, i) => ({
      name: card.name,
      nameEn: card.nameEn,
      dir: card.isReversed ? '逆位' : '正位',
      desc: card.isReversed ? card.reversedDesc : card.uprightDesc,
      keywords: card.isReversed ? card.reversed : card.upright,
      pos: positionLabels[i]
    }));

    let html = '';

    // Atmospheric intro
    html += `<p>让我们一同凝视这三张牌为「${question}」所揭示的信息。命运的丝线在牌面之间交织，且听它低语。</p>`;
    html += '<br>';

    // Each card — rich narrative
    c.forEach((card) => {
      html += `<p><strong>${card.pos} —「${card.name}」（${card.dir}）</strong></p>`;
      html += `<p>${card.desc}</p>`;
      html += `<p>关键意象：${card.keywords}</p>`;
      html += '<br>';
    });

    // Synthesis
    html += `<p>纵观这三张牌的脉络：过去的「${c[0].name}」${c[0].dir === '逆位' ? '暗示你曾在这个领域经历过一些需要反思的时刻' : '说明你在这条路上已经积累了宝贵的经验'}，而现在的「${c[1].name}」${c[1].dir === '逆位' ? '提醒你此刻需要换一个角度来看待当下的处境' : '则为你此刻的状态注入了一股明确的力量'}。展望未来，「${c[2].name}」${c[2].dir === '逆位' ? '暗示前方需要你保持警觉和灵活' : '预示着一个充满可能性的方向正在向你展开'}。</p>`;
    html += '<br>';
    html += `<p>请记住，塔罗牌为你提供的是指引而非定论。关于「${question}」，最重要的是倾听自己内心的声音，带着这些启示，勇敢地走出下一步。</p>`;
    html += '<p style="margin-top:16px;font-size:0.85em;color:var(--text-secondary);font-style:italic;">（AI 解读暂时不可用，以上为基础解读。输入你的 Gemini API Key 可获得更深度的个性化解读。）</p>';

    return html;
  }
}
