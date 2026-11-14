# Deploying Flame in Freefall

The website, its API and the three models run as **one container** (`Dockerfile`): build the React site,
then run `uvicorn server.main:app`, which serves both. It needs about 270 MB of memory and starts in about 2 s.
There is no GPU and no database server; the optional AI answers read a 91 MB vector database from the repo.

## Recommended: Hugging Face Spaces (Docker)

The best fit for this project: free CPU hardware with 16 GB of memory (enough for the optional RAG
assistant as well), built for ML demos, and it builds straight from our `Dockerfile` on port 7860.

1. Sign in at huggingface.co → **New Space** → name `flame-in-freefall`, SDK **Docker**, template **Blank**, hardware **CPU basic (free)**.
2. Push this repository to the Space (an access token with *write* scope is needed, from Settings → Access Tokens):
   ```bash
   git remote add space https://huggingface.co/spaces/<your-username>/flame-in-freefall
   git push space website:main
   ```
   The Space's `README.md` must start with this header (add it on the Space, or prepend it before pushing):
   ```yaml
   ---
   title: Flame in Freefall
   emoji: 🔥
   colorFrom: red
   colorTo: blue
   sdk: docker
   app_port: 7860
   ---
   ```
   Large files: if the push is refused for files over 10 MB (`RAG/database/*`), run `git lfs install` and
   `git lfs track "RAG/database/**"` before pushing, or push without `RAG/` (AI answers then report
   "RAG database not in this deployment" and the cited search still works).
3. Optional: Space **Settings → Variables and secrets → New secret** `GOOGLE_API_KEY` to turn on Gemini answers.
4. The site is live at `https://<your-username>-flame-in-freefall.hf.space`, with API docs at `/api/docs`.
   Free Spaces sleep after 48 h without visitors and wake on the next visit.

## Alternative: Render (Docker)

`render.yaml` is a ready Blueprint: Render dashboard → **New → Blueprint** → choose this GitHub repository and
the `website` branch (or `main` after merging). Add `GOOGLE_API_KEY` as a secret if wanted. The free plan has 512 MB
of memory (enough for the site, API and models), but it sleeps after 15 minutes idle with a cold start of
about a minute.

## Static-only (no live models)

`web/` builds to a static site (`npm ci && npm run build` → `web/dist`) that runs from the precomputed model
grids, and can go on Vercel, Netlify or GitHub Pages. To make it call a live API hosted elsewhere, set
`VITE_API_URL=https://<api-host>` at build time and `ALLOWED_ORIGINS=https://<site-host>` on the API.

## Not recommended

- **Vercel / Netlify functions for the API:** scikit-learn + lifelines + pandas exceed serverless bundle limits.
- **Streamlit Community Cloud:** hosts the existing dashboard (`app/streamlit_app.py`), not this React site.

## Check a deployment

```bash
curl https://<host>/api/health        # status ok, model scores, whether AI answers are available
curl -X POST https://<host>/api/predict/gas -H 'content-type: application/json' -d '{"fuel":"propane","o2":30,"p":0.69}'
```
