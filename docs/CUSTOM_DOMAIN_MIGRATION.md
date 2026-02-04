# Custom Domain Migration (AIRIA BEYOND)

This repo currently deploys the frontend to GitHub Pages and the API to Render.

If you want to move to a **custom domain** (recommended for long-term public service), the key is to keep the URL (origin) stable because CORS depends on it.

## What changes when you switch URLs

You must update these areas:

1) **Frontend base path** (Vite `base`)
- GitHub Pages: served under `/AIRIA-BEYOND/`
- Custom domain: usually served under `/`

This repo supports switching via build-time env:
- `VITE_PUBLIC_BASE_PATH=/AIRIA-BEYOND/` (GitHub Pages)
- `VITE_PUBLIC_BASE_PATH=/` (custom domain)

2) **API CORS allowed origins**
- Set `APP_PUBLIC_URL=https://your-domain.example/` on the API (Render)
- Or set `APP_ALLOWED_ORIGINS=https://your-domain.example,https://another.example`

3) **Frontend API base URL**
- Set `VITE_API_BASE_URL=https://airia-beyond.onrender.com` (or your API URL)

## Option A (recommended): Vercel/Netlify frontend + Render API

### Steps

1) Buy a domain and point it to Vercel or Netlify
- You’ll configure DNS in your registrar (A/CNAME) based on the hosting provider UI.

2) Create a new project on Vercel/Netlify from this GitHub repo

3) Set frontend environment variables (build-time)
- `VITE_PUBLIC_BASE_PATH=/`
- `VITE_API_BASE_URL=https://airia-beyond.onrender.com`

4) Update the API (Render) environment variables
- `APP_PUBLIC_URL=https://your-domain.example/`

Optional (recommended for pre-release email-only auth):
- `AUTH_DISABLE_OAUTH=true`

5) Re-deploy (frontend + API)
- After changing env vars, trigger a new build/deploy so the settings take effect.

## Netlify quick checklist (this repo)

This repo includes a ready-to-use Netlify config: `netlify.toml`.

### Netlify build settings

- **Build command**: `npm install && npm -w apps/web run build`
- **Publish directory**: `apps/web/dist`
- **Node**: 20

### Netlify environment variables (Site settings → Environment variables)

Required:
- `VITE_PUBLIC_BASE_PATH=/`
- `VITE_API_BASE_URL=https://airia-beyond.onrender.com`

### Render (API) environment variables

Required:
- `APP_PUBLIC_URL=https://your-domain.example/` (enables CORS for the new origin)
Optional:
- `AUTH_DISABLE_OAUTH=true`

## Option B: GitHub Pages custom domain + Render API

This keeps the current GitHub Actions deploy flow.

1) In GitHub repo settings → Pages → Custom domain
- Set `your-domain.example` and enable HTTPS.

2) Keep GitHub Pages base path
- You still usually serve from `/` on a custom domain.
- Ensure the build uses `VITE_PUBLIC_BASE_PATH=/`.

3) Update the API CORS
- Set `APP_PUBLIC_URL=https://your-domain.example/` on Render.

## Common failure symptoms

- Calls fail with CORS
  - API `allowedOrigins` does not include the new domain; set `APP_PUBLIC_URL`.
