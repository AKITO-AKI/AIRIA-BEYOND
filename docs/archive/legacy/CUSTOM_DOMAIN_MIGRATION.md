# Custom Domain Migration (AIRIA BEYOND)

This repo currently deploys the frontend to GitHub Pages and the API to Render.

If you want to move to a **custom domain** (recommended for long-term public service), the key is to keep the URL (origin) stable because OAuth and CORS depend on it.

## What changes when you switch URLs

You must update these three areas:

1) **Frontend base path** (Vite `base`)
- GitHub Pages: served under `/AIRIA-BEYOND/`
- Custom domain: usually served under `/`

This repo supports switching via build-time env:
- `VITE_PUBLIC_BASE_PATH=/AIRIA-BEYOND/` (GitHub Pages)
- `VITE_PUBLIC_BASE_PATH=/` (custom domain)

2) **API CORS allowed origins**
- Set `APP_PUBLIC_URL=https://your-domain.example/` on the API (Render)
- Or set `APP_ALLOWED_ORIGINS=https://your-domain.example,https://another.example`

3) **OAuth allow-lists** (Google/Apple)
- Google: Authorized JavaScript origins must include your new origin
- Apple: Services ID redirect URI must match your redirect URI exactly

## Option A (recommended): Vercel/Netlify frontend + Render API

### Steps

1) Buy a domain and point it to Vercel or Netlify
- You’ll configure DNS in your registrar (A/CNAME) based on the hosting provider UI.

2) Create a new project on Vercel/Netlify from this GitHub repo

3) Set frontend environment variables (build-time)
- `VITE_PUBLIC_BASE_PATH=/`
- `VITE_API_BASE_URL=https://airia-beyond.onrender.com`
- `VITE_GOOGLE_CLIENT_ID=...`
- `VITE_APPLE_CLIENT_ID=...`
- `VITE_APPLE_REDIRECT_URI=https://your-domain.example/`

4) Update the API (Render) environment variables
- `APP_PUBLIC_URL=https://your-domain.example/`
- `GOOGLE_CLIENT_ID=...` (must match the Google client ID used to issue id_tokens)
- `APPLE_CLIENT_ID=...`

5) Update OAuth provider configuration
- Google Identity: add `https://your-domain.example` to Authorized JavaScript origins
- Apple: add `https://your-domain.example/` as Redirect URI for your Services ID

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
- `VITE_GOOGLE_CLIENT_ID=...`
- `VITE_APPLE_CLIENT_ID=...`
- `VITE_APPLE_REDIRECT_URI=https://your-domain.example/`

### Render (API) environment variables

Required:
- `APP_PUBLIC_URL=https://your-domain.example/` (enables CORS for the new origin)
- `GOOGLE_CLIENT_ID=...`
- `APPLE_CLIENT_ID=...`

## Option B: GitHub Pages custom domain + Render API

This keeps the current GitHub Actions deploy flow.

1) In GitHub repo settings → Pages → Custom domain
- Set `your-domain.example` and enable HTTPS.

2) Keep GitHub Pages base path
- You still usually serve from `/` on a custom domain.
- Ensure the build uses `VITE_PUBLIC_BASE_PATH=/`.

3) Update the API CORS
- Set `APP_PUBLIC_URL=https://your-domain.example/` on Render.

4) Update OAuth allow-lists

## Common failure symptoms

- Frontend shows OAuth buttons as “未設定”
  - Frontend build-time env vars are missing (`VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID`).

- Backend returns `... is not configured`
  - Render env vars are missing (`GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID`).

- Backend returns Unauthorized after OAuth
  - Google/Apple token verification failed (audience / redirect mismatch).

- Calls fail with CORS
  - API `allowedOrigins` does not include the new domain; set `APP_PUBLIC_URL`.
