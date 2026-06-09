// Vercel Edge Function — DeepSeek API streaming proxy
// Edge Runtime: 30s timeout (vs 10s serverless), native streaming (zero buffering)

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

    // System instruction → system message
    if (body.system_instruction?.parts?.[0]?.text) {
      messages.push({
        role: 'system',
        content: body.system_instruction.parts[0].text,
      });
    }

    // Contents → messages (convert Gemini's role/parts to OpenAI's role/content)
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
        temperature: body.generationConfig?.temperature ?? 0.9,
        max_tokens: body.generationConfig?.maxOutputTokens ?? 8192,
        stream: true,
      }),
    });

    // Forward error status from DeepSeek
    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(errText, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pipe the SSE stream directly — zero buffering with Edge Runtime
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to connect to DeepSeek API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
