// Vercel Serverless Function — Gemini API proxy
// Keeps the API key on the server side, streams SSE back to the client

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const url = `${API_BASE}/models/${MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    // Forward error status from Google
    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json');
      return res.end(errText);
    }

    // Stream SSE back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    console.error('Gemini proxy error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to connect to Gemini API' });
    } else {
      res.end();
    }
  }
}
