# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luxury Horizon** is a luxury travel agency biolink landing page. The repository contains a single-page HTML application that serves as a social media hub, directing visitors to Instagram, TikTok, and WhatsApp contact channels.

## Repository Structure

```
luxuryhorizon/
├── biolink/              # Main biolink application
│   ├── index.html        # Self-contained single-page app (HTML + CSS + JS)
│   └── assest/
│       └── logo.jpeg     # Brand logo
├── Openclaw/             # Separate AI agent project (unrelated to biolink)
└── .netlify/             # Netlify deployment configuration
    └── state.json        # Site ID: 4341fb93-74cf-44b1-a250-0771dca20584
```

## Deployment

The biolink is deployed to **Netlify**:
- Production URL: `https://luxhorizon.netlify.app`
- Deploy directory: `.` (root, but Netlify serves `biolink/index.html`)
- Deployment command: `netlify deploy --prod --dir . --message "Your message"`

### Deployment Workflow

When making changes to the biolink:
1. Edit `biolink/index.html`
2. Commit changes with descriptive message including co-author attribution
3. Deploy: `netlify deploy --prod --dir . --message "Description of changes"`
4. Push to git: `git push`

## Architecture

### Single-File Application

`biolink/index.html` is completely self-contained with:
- **HTML structure**: Logo, brand name, social media buttons
- **Embedded CSS**: Custom design system with deep space + rose gold + platinum color palette
- **Embedded JavaScript**: Canvas-based starfield animation

### Design System

Color palette defined in CSS custom properties:
```css
--space:      #08071A   /* Deep space background */
--space-2:    #0F0D26   /* Secondary space */
--rose-gold:  #C9826A   /* Primary accent */
--rose-2:     #E8A890   /* Light rose gold */
--platinum:   #D8D8E8   /* Text color */
--platinum-2: #AEAEC8   /* Secondary platinum */
--violet:     #2B1E5A   /* Nebula effect */
```

### Visual Effects

1. **Nebula background**: Animated radial gradients (`.nebula::before`, `.nebula::after`)
2. **Starfield**: Canvas-based micro stars with opacity animation (160 stars)
3. **Logo particles**: Rose-gold particles orbiting the logo (animated via CSS `@keyframes orbit`)
4. **Button shimmer**: Instagram button has animated gradient (`@keyframes btn-shimmer`)

### Button Styles

- **Instagram Profile** (`.btn-ig-profile`): Rose gold gradient with shimmer animation
- **TikTok** (`.btn-tiktok`): Dark gradient with subtle border
- **WhatsApp** (`.btn-wa`): Mint green gradient

## Important URLs

- Instagram: `https://www.instagram.com/agencialuxuryhorizon_`
- TikTok: `https://www.tiktok.com/@luxury.horizon_`
- WhatsApp: `wa.me/573126322306` (pre-filled message in Spanish)

## Social Media Preview

Open Graph and Twitter Card metadata configured for WhatsApp/iMessage/social sharing:
- Title: "Luxury Horizon — Agencia de Viajes & Tours"
- Image: `https://luxhorizon.netlify.app/assest/logo.jpeg`
- Locale: `es_CO` (Spanish - Colombia)

## Development Notes

- **No build process**: Direct HTML editing, no bundler or package manager
- **Fonts**: Google Fonts (Cinzel for headings, Raleway for body)
- **Typography**: Uppercase styling with wide letter-spacing for luxury aesthetic
- **Responsive**: Mobile-first design with `max-width: 420px` card
- **Animation performance**: Uses `requestAnimationFrame` for starfield, CSS animations for effects

## Common Modifications

### Updating Social Links
Edit the `href` attributes in the button `<a>` tags (lines 341-354).

### Changing Colors
Modify CSS custom properties in `:root` (lines 29-37).

### Adjusting Animations
- Nebula drift: `@keyframes drift1`, `@keyframes drift2` (lines 82-83)
- Button shimmer: `@keyframes btn-shimmer` (line 245)
- Star count: Change `length: 160` in `initStars()` (line 375)

### Adding New Buttons
Follow the pattern of existing buttons in `.btn-group` (lines 339-356), ensuring:
- Consistent spacing (`gap: 0.9rem`)
- Icon SVG with `class="btn-icon"`
- Appropriate color scheme matching brand
