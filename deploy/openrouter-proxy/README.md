# Default AI answers for the website (OpenRouter)

The website (GitHub Pages) has no server, so anything built into it is public. Two ways to give visitors AI answers
without their own key:

## Recommended: proxy (the key stays secret), about 5 minutes
1. Sign in at dash.cloudflare.com (free) → **Workers & Pages → Create → Worker** → name it `fif-rag` → **Deploy**.
2. **Edit code**, replace everything with `worker.js` from this folder, **Deploy**.
3. **Settings → Variables and Secrets**: add Secret `OPENROUTER_API_KEY` (your key) and Text
   `ALLOWED_ORIGIN` = `https://mohammed-ayman-2023.github.io`. Optional Text `MODEL` (default `openrouter/free`).
4. Copy the worker URL (`https://fif-rag.<you>.workers.dev`).
5. GitHub repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `RAG_PROXY_URL` = that URL. Then re-run the "Deploy website to GitHub Pages" workflow.

The worker accepts only requests from the site, only the team's RAG prompt, and uses a free model.

## Simplest: key built into the page (anyone can read it)
GitHub repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:
`OPENROUTER_API_KEY`. Re-run the Pages workflow. The key is then inside the site's JavaScript and visible to anyone,
so first, in OpenRouter → Keys, set this key's **credit limit to $0** (free models only), and expect that others may
use up its daily free quota. Rotate it after the judging.

Optional variable `OPENROUTER_MODEL` picks another model (default `openrouter/free`, OpenRouter's free-models router).
Free models: 20 requests per minute; 50 per day per account, 1,000 per day after $10 of credits have ever been bought.
