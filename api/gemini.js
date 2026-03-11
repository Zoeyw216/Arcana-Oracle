// Vercel Edge Function — Gemini API streaming proxy
// Edge Runtime: 30s timeout (vs 10s serverless), native streaming (zero buffering)

export const config = { runtime: 'edge' };

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `${API_BASE}/models/${MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`;

  try {
    const body = await req.json();

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Forward error status from Google
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
    return new Response(JSON.stringify({ error: 'Failed to connect to Gemini API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
