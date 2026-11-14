// Flame in Freefall: OpenRouter proxy for the website's default AI answers (Cloudflare Worker).
// The OpenRouter key lives here as a secret, never in the website. Only the project's own site may call it,
// only with the team's RAG prompt, and only a free model is used, so it cannot run up a bill.
//
// Settings (Workers > your worker > Settings > Variables and Secrets):
//   OPENROUTER_API_KEY  (Secret)  your OpenRouter key
//   ALLOWED_ORIGIN      (Text)    https://mohammed-ayman-2023.github.io
//   MODEL               (Text)    optional, default "openrouter/free"
const PROMPT_STARTS = ['# Role\nYou are the Flame in Freefall research assistant']
const MAX_CHARS = 60000

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || ''
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
    const ok = allowed.includes(origin) || origin.startsWith('http://localhost')
    const cors = { 'access-control-allow-origin': ok ? origin : allowed[0] || '', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' }
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors } })
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors })
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!ok) return json({ error: 'origin not allowed' }, 403)
    let body
    try { body = await request.json() } catch { return json({ error: 'invalid JSON' }, 400) }
    const prompt = String(body?.prompt || '')
    if (!PROMPT_STARTS.some(s => prompt.startsWith(s)) || prompt.length > MAX_CHARS) return json({ error: 'only the Flame in Freefall RAG prompt is accepted' }, 400)
    const model = env.MODEL || 'openrouter/free'
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json', 'HTTP-Referer': allowed[0] || 'https://github.com', 'X-Title': 'Flame in Freefall' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return json({ error: j?.error?.message || `OpenRouter HTTP ${r.status}` }, r.status === 429 ? 429 : 502)
    return json({ answer: j.choices?.[0]?.message?.content || '', model: j.model || model })
  },
}
