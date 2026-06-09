// Vercel Edge Function — DeepSeek API proxy (non-streaming)
// Used for question validation before tarot reading

export const config = { runtime: 'edge' };

const API_BASE = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `${API_BASE}/chat/completions`;

  try {
    const body = await req.json();

    // Convert from Gemini format to OpenAI/DeepSeek format
    const messages = [];

    if (body.system_instruction?.parts?.[0]?.text) {
      messages.push({
        role: 'system',
        content: body.system_instruction.parts[0].text,
      });
    }

    if (body.contents) {
      for (const item of body.contents) {
        messages.push({
          role: item.role === 'model' ? 'assistant' : 'user',
          content: item.parts.map(p => p.text).join(''),
        });
      }
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: body.generationConfig?.temperature ?? 0.7,
        max_tokens: body.generationConfig?.maxOutputTokens ?? 1024,
        stream: false,
      }),
    });

    const data = await upstream.text();

    // Convert DeepSeek response back to Gemini format for frontend compatibility
    try {
      const parsed = JSON.parse(data);
      if (parsed.choices?.[0]?.message?.content) {
        const geminiFormat = {
          candidates: [{
            content: {
              parts: [{ text: parsed.choices[0].message.content }],
              role: 'model',
            },
            finishReason: 'STOP',
          }],
        };
        return new Response(JSON.stringify(geminiFormat), {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {}

    return new Response(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to connect to DeepSeek API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
