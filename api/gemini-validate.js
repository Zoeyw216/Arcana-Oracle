// Vercel Edge Function — Gemini API proxy (non-streaming)
// Used for question validation before tarot reading

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

  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  try {
    const body = await req.json();

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to connect to Gemini API' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
