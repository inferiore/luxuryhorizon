# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luxury Horizon** is a Colombian luxury travel agency with two distinct web properties:

1. **Main website** (`website/`) — Full marketing site with tour catalog, served via Docker/nginx on Google Cloud at `https://luxuryhorizon.lat`
2. **Biolink** (`biolink/`) — Social media hub page, deployed separately to Netlify at `https://luxhorizon.netlify.app`
3. **Influencer pages** (`website/influencers/`) — Personalized landing pages per influencer, each on its own subdomain (e.g. `ale.luxuryhorizon.lat`)

## Local Development

**Start dev server** (no SSL required):
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Accessible at `http://localhost:8080` (or LAN IP for mobile testing).

**Hot reload**: `website/` and `biolink/` are volume-mounted in dev — changes are visible on browser refresh with no rebuild needed. Only run `--build` again if you change `nginx-dev.conf` or add a new top-level directory.

**Stop dev server:**
```bash
docker compose -f docker-compose.dev.yml down
```

## Production Deployment (Google Cloud)

Server IP: `34.44.81.102` — domain `luxuryhorizon.lat`

**Deploy changes** (run on the server):
```bash
git pull && docker compose up -d --build
```

**First-time SSL setup** (run once on the server):
```bash
./init-ssl.sh
```

**Add a new influencer subdomain** (run on the server after updating nginx.conf):
```bash
./add-influencer.sh <name>   # e.g. ./add-influencer.sh gabs
```
This stops nginx briefly, issues a Let's Encrypt cert for `<name>.luxuryhorizon.lat`, then restarts.

**Biolink** (separate, deployed to Netlify):
```bash
netlify deploy --prod --dir . --message "Description"
```

## Architecture

### Infrastructure

- `Dockerfile` — copies `biolink/` and `website/` into nginx image
- `nginx.conf` — production config: HTTP→HTTPS redirect, main site, per-influencer subdomains (each needs its own SSL cert block)
- `nginx-dev.conf` — local config: HTTP only, no SSL, no certbot
- `docker-compose.yml` — production (ports 80+443, certbot renewal sidecar)
- `docker-compose.dev.yml` — local dev (port 8080, mounts nginx-dev.conf)
- `certbot/conf/` — Let's Encrypt certificates (gitignored, lives only on server)

### Main Website (`website/index.html`)

Single self-contained HTML file with embedded CSS and JS:
- **Language detection**: `navigator.language` → Spanish if `es-*`, otherwise English; user choice persisted in `localStorage('lh-lang')`
- **Tour filtering**: `filterTours(city)` toggles `.hidden` on `.tour-card[data-city]` elements; filter pills have `.active` state
- **Tour cards**: `data-slides='["img1.jpg","img2.jpg"]'` drives the image slideshow

### Influencer Pages

Each influencer lives at `website/influencers/{name}/`:
- `index.html` — the live page (served at `{name}.luxuryhorizon.lat`)
- `{name}-bg.jpg` — wide banner crop (800×420px)
- `{name}-portrait.jpg` — portrait crop (500px wide) for designs that use it
- Design variants (`v1.html`, `v2.html`, etc.) are kept for comparison until the client picks one, then the chosen file becomes `index.html`

**WhatsApp URL pattern** — each influencer gets a unique pre-filled message:
```
https://wa.me/573126322306?text=Hola%2C%20vengo%20de%20parte%20de%20{Name}%2C%20estoy%20interesado%20en%20información%20de%20los%20tours
```

**Images from the main site** must use absolute URLs in influencer pages (relative paths break under the subdomain):
```
https://luxuryhorizon.lat/biolink/assest/logo.jpeg
https://luxuryhorizon.lat/website/images/hero-1.jpg
```

**Adding a new influencer** — full checklist:
1. Create `website/influencers/{name}/` with images and HTML
2. Add server block to `nginx.conf` (copy the `ale.luxuryhorizon.lat` block)
3. Add the new subdomain to the HTTP block's `server_name` line
4. On server: `./add-influencer.sh {name}` then `git pull && docker compose up -d --build`
5. Add DNS A record: `{name}.luxuryhorizon.lat → 34.44.81.102`

### Design System

**Corporate palette** (used across all pages):
```css
--midnight:       #0A1A32   /* Primary background */
--midnight-light: #112244   /* Secondary background */
--golden:         #B79A49   /* Primary accent */
--golden-light:   #d4b86a   /* Light gold */
--bronze:         #A56C30   /* Warm accent */
--teal:           #44F0F7   /* Electric accent */
--smoke:          #F0F0F0   /* Body text */
```

**Fonts:**
- Main site: `Cormorant Garamond` (headings) + `Jost` (body)
- Influencer pages: `Cinzel` (display headings) + `Raleway` (body)

**WhatsApp CTA button pattern** — animated green gradient with breathing pulse:
```css
background: linear-gradient(135deg, #0A6630, #1A9E50, #25D366, #1A9E50, #0A6630);
background-size: 260% auto;
animation: wa-shimmer 5s linear infinite, wa-breathe 2.8s ease-in-out infinite;
```

**Canvas animation pattern** (stars + floating particles):
- Stars: array of `{x, y, r, phase, spd}`, opacity animated via `Math.sin`
- Particles: spawn at bottom, float upward, fade in/out via `Math.sin(progress * Math.PI)`, respawn on death

### Image Processing

Use Python Pillow to prepare influencer photos:
```python
from PIL import Image, ImageOps
img = ImageOps.exif_transpose(Image.open(src))   # always fix EXIF rotation
banner  = img.crop(...).resize((800, 420), Image.LANCZOS)   # wide crop
portrait = img.crop(...).resize((500, 700), Image.LANCZOS)   # tall crop
banner.save(dst, "JPEG", quality=82, optimize=True)          # target ≤120KB
```

## Key URLs

| Resource | URL |
|---|---|
| Main site | `https://luxuryhorizon.lat/website/` |
| Biolink | `https://luxhorizon.netlify.app` |
| Alejandra | `https://ale.luxuryhorizon.lat` |
| Instagram | `https://www.instagram.com/agencialuxuryhorizon_` |
| TikTok | `https://www.tiktok.com/@luxury.horizon_` |
| WhatsApp | `wa.me/573126322306` |
