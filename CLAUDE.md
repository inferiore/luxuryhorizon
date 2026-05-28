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

### Quotation Page (`website/cotizacion.html`)

Interactive quotation document — filled in the browser and exported to PDF. No backend; works as a standalone file or at `https://luxuryhorizon.lat/website/cotizacion.html`.

**How it works:**
- Every field with `[contenteditable]` is editable directly in the browser (client name, phone, email, city, travel date, pax count, quotation number, observations, signatures)
- The service table supports adding/removing rows with `addRow()` / the ✕ button per row
- `recalcular()` fires on every input and recomputes subtotal, discount, VAT, grand total in COP, and the USD equivalent
- `cargarTRM()` fetches the live COP/USD exchange rate from an external API on page load; user can also click the TRM button or type a custom rate; an editable markup % adjusts the effective rate
- Quotation number is editable (top-right, starts at `001`); date auto-populates with `new Date()`

**Export flows:**
- **Print / PDF**: `window.print()` — use browser's Save as PDF. The `@media print` block hides buttons and strips editable underlines
- **WhatsApp**: generates the PDF blob with `html2pdf.js` (CDN), uploads it, then opens `wa.me/573126322306` with a pre-filled message; the `mostrarBannerWA()` function shows a clickable banner if the popup was blocked

**Adding a new field or column to the services table:**
- Add `<th>` in `<thead>` and a matching `<td contenteditable>` in `addRow()` template string
- If the new column affects totals, update `recalcular()` to read and accumulate the new cells

**Design** matches corporate palette (Cormorant Garamond + Jost, `--midnight` / `--golden`). Signature boxes at the bottom use a 2-col grid (`.firmas`).

### Catalog (`website/catalogo.html`)

PDF-ready club catalog — 6 pages (cover, Pao Pao, Mangata, Sabai, comparison grid, back cover). Open in browser and use **Cmd+P → Save as PDF** in Chrome/Safari.

- Images live in `website/images/catalogo/` (downloaded from Google Drive — see Drive IDs in Claude memory)
- Responsive: desktop shows A4 pages; mobile shows full-width with 1px golden separator between pages
- To add a new club page: copy the Sabai page block. Use plain block stacking with explicit `height` on `<img>` tags — **do not use `height:297mm + flex:1 + overflow:hidden`** on the page div (causes images to render over text)
- New images from Drive: use `mcp__claude_ai_Google_Drive__download_file_content` → decode with Python (see `catalogo_drive.md` memory) → save to `website/images/catalogo/`

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

## Catalog Content Agent — Google Drive

When working on catalog content (images, prices, descriptions), use the Google Drive MCP tools available in this session.

### Drive IDs

| Recurso | ID |
|---|---|
| Spreadsheet "Base de datos" | `13wtCobeqoq90wZojhoh0_nsSmrldv8wSOxMjHgSTCwg` |
| Folder "Assets" (imágenes) | `1aFFn75aJAt_Ei3zwumvIwdosGmLHFjHS` |

### Folders de imágenes por club (dentro de Assets)

| Club | ID |
|---|---|
| Pao Pao | `1xs6lHRB2s_ldkUudWfk-mcFx5HTVCKZa` |
| Mangata | `1VCHz-mHSZgXc0jYrfcvtbB2EztDY2AAb` |
| Sabai | `1UcHiYSGPwm34FiE6CUHt59R0IFa9MTew` |
| Capri Beach | `11zgEW9XNQf56UMR2xhzrPv8XlrmMQxaK` |
| Palmarito Beach | `1t7g4vS3tux1Ai3Bs5Q2ti-0lO_9_P1n2` |
| Paue | `1SHnWHVb6Q9vyWqWoTg5e1ZTbvOKO4OB2` |
| Bora Bora VIP | `1XsJfJ83Wpml6pKnU9TwssuggJW0YGTwQ` |
| Bora Bora Area Club | `1Nvp7-jFtIhq-5YmD-8e81lAuNvRzl5Yd` |
| Ibbiza | `1r8RHnaLVnuRpXiqxHqNnoqgNeso-WNLI` |
| Isla Bela | `1GYTT3x8iQz-wsaXpqNewWgymx1rcPdqN` |
| Tour Bahía | `1Qe9w6O_e-rhxH_7lUo25O5bWlcHgpxyG` |
| Mantas | `1SY09LqCUZoWJVCr2muS-X4IpAlyctPy0` |

### Hoja "Servicios" — columnas

`Club de playa` | `Neto` | `Costo del muelle` | `Precio al público` | `Precio Dollar` | `Descripción` | `Lugar de embarque` | `Lugar`

Leer con `mcp__claude_ai_Google_Drive__read_file_content` usando el ID del spreadsheet.

### Flujo para agregar imágenes

1. Listar con `mcp__claude_ai_Google_Drive__search_files`: `parentId = '<ID>' and mimeType contains 'image/'`
2. Descargar con `mcp__claude_ai_Google_Drive__download_file_content` — el resultado es JSON `{content (base64), id, mimeType, title}` guardado en disco.
3. Procesar con Python Pillow — **siempre** corregir EXIF y recortar a 1200×800px, quality=82. Si Pillow no está: `pip3 install Pillow --break-system-packages`.
4. Guardar en `website/images/catalogo/{clubname}-{n}.jpg` (minúsculas, sin espacios).
5. Actualizar `<img src="...">` en `website/catalogo.html` con `Edit` (nunca `Write` sobre todo el archivo).
6. Saltar archivos PNG mayores de 20MB.

## Key URLs

| Resource | URL |
|---|---|
| Main site | `https://luxuryhorizon.lat/website/` |
| Biolink | `https://luxhorizon.netlify.app` |
| Alejandra | `https://ale.luxuryhorizon.lat` |
| Instagram | `https://www.instagram.com/agencialuxuryhorizon_` |
| TikTok | `https://www.tiktok.com/@luxury.horizon_` |
| WhatsApp | `wa.me/573126322306` |
