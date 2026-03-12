# Palm & Plate Landing Page

## Project Overview
- **What:** Landing page for Palm & Plate, Bahrain's first food club (~100 members)
- **Framework:** Astro + Tailwind CSS + TypeScript
- **Repo:** https://github.com/Suhaib5333/palmandplate-landingpage.git
- **Domain:** www.palmandplate.com
- **App URL:** https://app.palmandplate.com (member login: /login)
- **Admin URL:** https://admin.palmandplate.com (NOT linked from landing page)
- **Instagram:** @palmnplate (note: different from domain)
- **Email:** info@palmandplate.com
- **Purpose:** Marketing/brochure site with waitlist CTA, separate from main app monorepo

## Brand Identity
- **Colors:** Clay #A42F2A (primary), Saffron #F5B532 (accent), Olive #38572D (tertiary), Cream #FCE5C5 (bg), Charcoal #1B1B1B
- **Fonts:** TAN Ashford (headings), DIN Next (body/subheadings), Amrys Bold (logo)
- **Logo:** Palm tree growing from a plate — symbol of Arab hospitality meets dining
- **Textures:** Grain overlay on everything, warm photography
- **Tone:** Warm, intimate, editorial. NOT corporate. Cultural anchoring to Bahrain/Arab identity
- **Key message:** "Bahrain's First Food Club"

## Architecture
- Landing page is separate from the Turborepo monorepo (member app + admin app + API)
- Main app stack: React + NestJS + PostgreSQL + Prisma + shadcn/ui + Tailwind
- Events are called "Volumes" — each volume is a unique dining experience at a different restaurant
- Page title: "Palm & Plate"
- Favicon: Gold logo icon PNG (`public/favicon.png`)

## App URLs (Environment-Based)
Centralized in `src/config.ts`, controlled by `VITE_APP_ENV` env variable:
| Env | Base URL | Login | Register |
|-----|----------|-------|----------|
| dev | http://localhost:5173 | /login | /register |
| uat | https://uat.palmandplate.com | /login | /register |
| prod | https://app.palmandplate.com | /login | /register |

- `.env` sets `VITE_APP_ENV=dev` (local development)
- `.env.production` sets `VITE_APP_ENV=prod` (production builds)
- All components import `{ urls }` from `@/config` — no hardcoded app URLs in components

## Page Structure (index.astro)
`Navbar → Hero → About → HowItWorks → Volumes → Gallery → Testimonials → Pricing → Waitlist → Footer`

## Key Files
- `src/config.ts` — Centralized app URLs (login, register) per environment
- `tailwind.config.mjs` — Brand colors, custom fonts, display text sizes
- `src/styles/global.css` — @font-face, scroll animations, grain texture, component classes
- `src/layouts/Layout.astro` — Base HTML with IntersectionObserver, favicon, meta tags
- `src/pages/index.astro` — Main page composition
- `src/components/` — All section components
- `public/fonts/` — TAN Ashford, DIN Next family, Amrys Bold
- `.env` — Dev environment config (`VITE_APP_ENV=dev`)
- `.env.production` — Prod environment config (`VITE_APP_ENV=prod`)

## Image Organization
All event images live in `src/assets/images/events/`:
- `vol01-*.jpg` — Volume 01: Loy Krathong at Monsoon (Nov 4, 2025)
- `vol02/*.jpg` — Volume 02: Italian Night at Osteria (Nov 20, 2025)
- `vol05/*.jpg` — Volume 05: Holiday Feast at Diana's (Dec 22, 2025)
- `vol07/*.jpg` — Volume 07: Rooftop Supper (Jan 26, 2026)

Brand assets in `src/assets/images/brand/`:
- `logo-full-cream.png`, `logo-full-gold.png`, `logo-full-red.png`
- `logo-icon-gold.png`, `logo-icon-red.png`
- `palm-story.png`, `welcome.png`

## Image Usage Rules
- **NO duplicate images across sections.** Each image appears in exactly one component.
- Images are optimized via Astro's `<Image>` component (WebP, quality 70-75)
- When cropping is an issue (faces cut off), prefer food/scene shots or use `object-top`/`object-center`

### Image Map (which component uses what):
**About.astro:** vol02-longtable, vol02-pizza
**Volumes.astro:**
- V01: vol01-ambient (hero), vol01-food1, vol01-candid, vol01-detail, vol01-scene (strip)
- V02: vol02-scene (hero), vol02-setup, vol02-food1, vol02-menu, vol02-table (strip)
- V05: vol05-group (hero), vol05-food1, vol05-food2, vol05-dessert, vol05-table (strip)
- V07: vol07-duo (hero), vol07-food1, vol07-candid2, vol07-setup, vol07-group (strip)
**Gallery.astro:** vol01-laughing, vol01-duo, vol01-table, vol01-portrait, vol02-food2, vol05-moment, vol05-feast, vol05-outside, vol07-scene, vol07-lamb, vol07-food2
**Waitlist.astro:** vol01-group, vol05-soup, vol01-moment

## Volumes Data
| Volume | Name | Restaurant | Date | Courses | Seats | Price |
|--------|------|-----------|------|---------|-------|-------|
| 01 | Loy Krathong | Monsoon | Nov 4, 2025 | 11 | 12 | 12 BD |
| 02 | Italian Night | Osteria | Nov 20, 2025 | 7 | 14 | 12 BD |
| 05 | Holiday Feast | Diana's | Dec 22, 2025 | 8 | 20 | 15 BD |
| 07 | Rooftop Supper | (Courtyard) | Jan 26, 2026 | 8 | 15 | 14 BD |
| More | "More Volumes to Come" teaser at bottom |

## Navigation & Links
- **Navbar desktop:** About | Volumes | Gallery | Pricing | Contact | Log In | [Join the Waitlist]
- **Navbar "Join the Waitlist" button** → scrolls to `#waitlist` section on page
- **Navbar "Log In"** → https://app.palmandplate.com/login
- **Mobile menu:** Full-screen overlay with same links + "Already a member? Log in" (menu auto-closes on link click)
- **Hero "Join the Waitlist" button** → scrolls to `#waitlist` section on page
- **Hero scroll indicator:** Centered animated down-arrow at bottom (bouncing chevron in circle, links to #about)
- **Footer:** Navigate links include Log In, plus social links (Instagram, WhatsApp only — no X/Twitter)
- **Waitlist section:** Big CTA → {urls.register} + "Already a member? Log in" → {urls.login}
- **Pricing cards:** All tier CTAs → {urls.register}
- **Instagram:** @palmnplate (different handle from domain)

## User Preferences
- **NEVER include "Co-Authored-By: Claude" in git commits**
- User prefers `main` branch (not `master`)
- User wants lively, animation-rich, photo-heavy UI/UX
- User iterates heavily on image selection — check for face cropping, blurriness, content suitability
- User doesn't want duplicate images across sections
- User prefers food/scene shots over people shots when cropping is an issue

## Scroll Animations
Classes defined in global.css, triggered by IntersectionObserver in Layout.astro:
- `.reveal` — fade up
- `.reveal-left` / `.reveal-right` — slide from sides
- `.reveal-scale` — scale up
- `.stagger-children` — children animate in sequence
- `.parallax` with `data-speed` — scroll parallax
- `.img-zoom` — hover zoom on images

## Git
- `.gitignore` includes `docs/` and `CLAUDE.md`
- `docs/` folder has been deleted locally (was 10GB raw source photos/videos)

## Maintenance
- **IMPORTANT:** Keep `context.md`, `CLAUDE.md`, and `MEMORY.md` up to date whenever changes are made to the project structure, navigation, images, domains, or any other key details. These files should always reflect the current state of the project.
