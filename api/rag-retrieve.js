// Vercel Edge Function — RAG retrieval endpoint
// Embeds the query via Jina, then does cosine similarity against precomputed embeddings

export const config = { runtime: 'edge' };

const JINA_URL = 'https://api.jina.ai/v1/embeddings';
const JINA_KEY = process.env.JINA_API_KEY;
const TOP_K = 6; // Return top 6 most relevant chunks

// Cosine similarity between two vectors
function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!JINA_KEY) {
    return new Response(JSON.stringify({ error: 'JINA_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query, cardIds } = await req.json();

    // 1. Embed the query via Jina
    const jinaRes = await fetch(JINA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JINA_KEY}`,
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v3',
        input: [query],
        task: 'retrieval.query',
        dimensions: 256,
      }),
    });

    if (!jinaRes.ok) {
      const err = await jinaRes.text();
      return new Response(JSON.stringify({ error: 'Jina API error', detail: err }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jinaData = await jinaRes.json();
    const queryEmbedding = jinaData.data[0].embedding;

    // 2. Load precomputed embeddings
    //    In Edge Function, we fetch from our own static file
    const baseUrl = new URL(req.url).origin;
    const embeddingsRes = await fetch(`${baseUrl}/data/embeddings.json`);
    const chunks = await embeddingsRes.json();

    // 3. Filter by card IDs if provided (metadata filtering)
    let candidates = chunks;
    if (cardIds && cardIds.length > 0) {
      candidates = chunks.filter(c => cardIds.includes(c.card_id));
    }

    // 4. Compute cosine similarity and rank
    const scored = candidates.map(c => ({
      card_name: c.card_name,
      card_name_en: c.card_name_en,
      topic: c.topic,
      text: c.text,
      score: cosineSim(queryEmbedding, c.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topK = scored.slice(0, TOP_K);

    return new Response(JSON.stringify({ results: topK }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
