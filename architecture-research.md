# Palm & Plate -- Architecture Research & Recommendations

> **Date:** March 2026
> **Client:** Palm & Plate (Food Club, Bahrain)
> **Scale:** ~100 members now, max ~1,000
> **Budget:** BHD 500 total build | Cost-conscious ongoing hosting
> **Stack (Decided):** React | NestJS | PostgreSQL | Prisma 7 | Turborepo | shadcn/ui + Tailwind | PM2 | GitHub Actions | Resend | Astro (landing)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Split: Admin vs Member](#2-frontend-split-admin-vs-member)
3. [Authentication & OTP](#3-authentication--otp)
4. [Deployment & Hosting](#4-deployment--hosting)
5. [Database Hosting](#5-database-hosting)
6. [TAP Payments Integration](#6-tap-payments-integration)
7. [Recommended Architecture (Final)](#7-recommended-architecture-final)
8. [Decision Matrix](#8-decision-matrix)
9. [Cost Summary](#9-cost-summary)

---

## 1. Architecture Overview

### What We're Building

```
palmandplate.com              --> Landing page (Astro, separate repo)
app.palmandplate.com          --> Member PWA (mobile-optimized)
admin.palmandplate.com        --> Admin dashboard
api.palmandplate.com          --> NestJS API (shared backend)
```

**Two frontends, one backend, one database.** The admin dashboard and member app are fundamentally different UX paradigms -- admin is desktop-heavy data tables/charts, member is mobile-first cards/events/payments. They share the same NestJS API with role-based access control.

### AWS Mental Model Mapping

Since you come from AWS, here's how every component maps:

| AWS Concept | Palm & Plate Equivalent |
|---|---|
| CloudFront + S3 | Vercel CDN (for React static files) OR Nginx on VPS |
| EC2 | Hostinger VPS KVM2 (runs NestJS as persistent process) |
| RDS (PostgreSQL) | PostgreSQL on same VPS (or Supabase managed) |
| Cognito | NestJS-native auth (@nestjs/jwt + @nestjs/passport + email OTP via Resend) |
| ALB (Load Balancer) | Nginx reverse proxy (on same VPS) |
| Lambda | NOT used -- NestJS runs as a long-lived process, not serverless |
| ECS | NOT needed at this scale -- PM2 on the VPS |
| Route 53 | Domain registrar DNS (Hostinger, Cloudflare, etc.) |
| ACM (SSL) | Let's Encrypt (free, auto-renewing) |
| CodePipeline | GitHub Actions (CI/CD) |

**Key insight:** At 100-1,000 users, you don't need distributed infrastructure. Everything runs on one $5/month VPS. The equivalent AWS setup (EC2 + RDS + ALB + CloudFront) would cost $40-50/month for the same workload.

---

## 2. Frontend Split: Admin vs Member

### Recommendation: Turborepo Monorepo with Two Separate React Apps

This is what Airbnb, Uber, and Stripe do -- monorepo with independent apps sharing a component library. At your scale, this is the cleanest, most maintainable approach.

**How the big companies do it:** Google, Meta, Uber, and Airbnb all use monorepos for multiple frontend apps. Uber has 500+ web apps in one monorepo. The pattern is universal: when you have multiple frontends hitting the same API, a monorepo with shared packages eliminates type drift and enables atomic changes.

### Monorepo Structure

```
palm-and-plate/
  apps/
    member-app/          # Mobile-optimized React (Vite) PWA
    admin-app/           # Admin dashboard (React, from scratch)
    api/                 # NestJS backend (modular monolith)
  packages/
    ui/                  # Shared shadcn/ui component library
    shared-types/        # TypeScript DTOs shared between all apps
    config-eslint/       # Shared ESLint config
    config-typescript/   # Shared TypeScript config
  turbo.json
  pnpm-workspace.yaml
  package.json
```

### Why Turborepo (not Nx, not Lerna)

| Tool | Verdict |
|---|---|
| **Turborepo** | Lightweight, fast, zero-config. Perfect for small teams. Vercel-backed. |
| Nx | Enterprise-grade overkill. More config, more tooling, more complexity than needed. |
| Lerna | Legacy. Only useful for npm package publishing. |

### Why Two Apps (not one app with role-based routing)

- **Bundle separation:** Member app stays lean (~200KB). Admin app can include heavy charting/table libraries without affecting member load times
- **Independent deploys:** Fix an admin bug without touching the member app
- **Different UX paradigms:** Admin = desktop data tables, charts, CRUD forms. Member = mobile cards, swipe, bottom nav, PWA
- **Security:** Admin components never ship to member bundles

### Why NOT micro-frontends

Overkill. The 2025-2026 consensus is clear: micro-frontends are for teams of 10+ developers needing independent deployments and technology heterogeneity. A small team building two React apps does not need Module Federation, runtime integration, or the operational overhead.

### Member App: Mobile-Optimized PWA

The member app should be a Progressive Web App (PWA):

- **"Add to Home Screen"** gives an app-like icon and full-screen experience (no browser chrome)
- **Offline caching** for event details, menus, schedules (useful at events with spotty connectivity)
- **Push notifications** for event reminders and updates
- **No App Store fees or approval process**
- **Implementation:** `vite-plugin-pwa` handles service workers, offline caching, and web app manifest automatically

**UI Stack:** React 19 + Vite + shadcn/ui + Tailwind CSS (mobile-first)

### Admin App: From Scratch (TanStack + shadcn/ui)

**Client decision:** Build the admin dashboard from scratch instead of using a framework like Refine or React Admin. This gives full control over the UX and avoids framework lock-in.

**Admin stack:**

| Library | Role |
|---|---|
| **TanStack Table** | Data tables with sorting, filtering, pagination, column resizing. Headless = full control over rendering. |
| **TanStack Query** | Server state management. Caching, background refetch, optimistic updates. Replaces manual `useEffect` + `fetch` patterns. |
| **React Hook Form** | Form handling with validation. Lightweight, performant (no re-renders on every keystroke). |
| **shadcn/ui + Tailwind** | UI components. Same design language as the member app. Copy-paste components, fully customizable. |

**Why not Refine?** Adds an abstraction layer that becomes a ceiling when you need non-standard admin UX (custom dashboards, complex multi-step workflows). The 4 libraries above give you the same primitives without the framework's opinions.

**Why not React Admin?** Material UI locked, opinionated, heavier bundle.

**Why not AdminJS?** Auto-generated from database models. Fast to start, hard to customize.

### Domain Structure

```
palmandplate.com            --> Landing page (Astro, separate repo)
app.palmandplate.com        --> Member PWA
admin.palmandplate.com      --> Admin dashboard
api.palmandplate.com        --> NestJS API
```

Subdomains (not subpaths) because: complete isolation, independent deploys, cleaner separation, separate caching/CDN rules.

### Landing Page: Astro (Separate Repo)

The landing/marketing page (`palmandplate.com`) lives in a **separate repository**, not in the Turborepo monorepo. Astro is a static-site framework optimized for content-heavy pages with zero JS by default.

**Why Astro:**
- **Zero JS shipped** by default -- pure HTML/CSS for marketing pages. Sub-100KB total.
- **Island architecture** -- interactive components (e.g., a booking widget) only hydrate where needed
- **Content collections** -- menus, event galleries, testimonials managed as Markdown/MDX files
- **Built-in image optimization** -- `<Image>` component with automatic WebP/AVIF, lazy loading
- **SEO-first** -- static HTML = instant indexing, perfect Lighthouse scores

**Why separate repo (not in the monorepo):**
- Landing page has a completely different build pipeline (Astro, not Vite+React)
- Different deploy cadence -- marketing pages update independently of the app
- Different contributors -- marketing/content team doesn't need access to the app monorepo
- Keeps the Turborepo monorepo focused: member app + admin app + API

**Deployment:** Static build → copy to `/var/www/palmandplate.com/` on the VPS. Nginx serves it directly. Or host on Cloudflare Pages (free) if you want CDN for the landing page.

### Backend API Design: One API, RBAC Guards

One NestJS API serves both frontends. Access control via CASL (attribute-based):

```
Controller Organization:
  modules/
    events/
      events.controller.ts          # Shared endpoints (GET /events)
      events.admin.controller.ts    # Admin-only (POST, PUT, DELETE)
    members/
      members.controller.ts         # Member self-service (GET /me, PUT /me)
      members.admin.controller.ts   # Admin management (GET /members, POST /members)
```

No separate API versioning. One API, role-based guards. Admin endpoints grouped under admin controllers for clarity.

---

## 3. Authentication: Email OTP + NestJS-Issued JWTs

### Why Email OTP (Not SMS, Not Magic Links)

**Client decision:** Email OTP, not phone-based. This eliminates all SMS/WhatsApp costs entirely.

| Method | Verdict |
|---|---|
| **Email OTP (6-digit code)** | **Winner.** User enters email → receives 6-digit code → types it in the app → done. Works perfectly in PWA (user stays in the app). $0/month via free email providers. |
| SMS OTP | $8-50+/month for Bahrain numbers. Per-SMS costs add up. Carrier filtering issues. |
| WhatsApp OTP | $5-30/month. Requires Meta Business verification. |
| Magic Links | **Broken for PWA.** User clicks link in Gmail → opens in Safari/Chrome → auth happens outside the PWA. The installed PWA loses the auth context. Email OTP keeps the user in-app. |

### Architecture: Build It Yourself in NestJS

No external auth service needed. NestJS handles everything: OTP generation, email delivery, JWT issuance, session management.

```
MEMBER APP (PWA)                    NestJS BACKEND                       RESEND (SMTP)
    |                                    |                                    |
1. Enter email -----------------------> |                                    |
2.                    Generate 6-digit code (crypto.randomInt)               |
3.                    Store { code, email, expiresAt } in PostgreSQL         |
4.                    Rate limit: 1 OTP per 60s per email                    |
5.                                       |------- Send email: "123456" ----->|
6. User checks email, copies code        |                                   |
7. Enter code ------------------------> |                                    |
8.                    Verify: compare code, check expiry, check attempts     |
9.                    Delete OTP record on success                           |
10.                   Issue JWT (access token) + Refresh Token               |
11. <--- { accessToken, refreshToken } --|                                   |
12. Store tokens, send JWT on every API request                              |
```

**NestJS modules involved:**

```typescript
// auth/
//   auth.module.ts         - imports JwtModule, MailModule
//   auth.controller.ts     - POST /auth/otp/request, POST /auth/otp/verify, POST /auth/refresh
//   auth.service.ts        - OTP generation, verification, JWT issuance
//   otp.entity.ts          - { id, email, code, expiresAt, attempts, createdAt }
//   jwt.strategy.ts        - @nestjs/passport JWT strategy
//   jwt-auth.guard.ts      - protects routes

// Dependencies:
//   @nestjs/jwt             - JWT signing/verification
//   @nestjs/passport        - auth guards
//   @nestjs-modules/mailer  - email via Nodemailer (connects to Resend SMTP)
```

**OTP logic (~2-3 hours to build):**

```typescript
// auth.service.ts (simplified)
import { randomInt } from 'crypto';

async requestOtp(email: string) {
  // Rate limit: 1 per 60s per email
  const recent = await this.otpRepo.findOne({ where: { email }, order: { createdAt: 'DESC' } });
  if (recent && Date.now() - recent.createdAt.getTime() < 60_000) {
    throw new TooManyRequestsException('Wait 60 seconds');
  }

  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await this.otpRepo.save({ email, code: await hash(code), expiresAt, attempts: 0 });

  await this.mailerService.sendMail({
    to: email,
    subject: 'Palm & Plate - Your Login Code',
    text: `Your code is: ${code}. It expires in 10 minutes.`,
  });
}

async verifyOtp(email: string, code: string) {
  const otp = await this.otpRepo.findOne({ where: { email }, order: { createdAt: 'DESC' } });
  if (!otp || otp.expiresAt < new Date()) throw new UnauthorizedException('Code expired');
  if (otp.attempts >= 5) throw new UnauthorizedException('Too many attempts');

  otp.attempts++;
  await this.otpRepo.save(otp);

  if (!await verify(otp.code, code)) throw new UnauthorizedException('Invalid code');

  await this.otpRepo.delete(otp.id);

  // Find or create user
  let user = await this.usersService.findByEmail(email);
  if (!user) user = await this.usersService.create({ email, role: 'member' });

  // Issue tokens
  const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: '15m' });
  const refreshToken = this.jwtService.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '90d' });

  return { accessToken, refreshToken, user };
}
```

### Email Provider: Resend (Free, 3,000/month)

Every free transactional email option, verified as of March 2026:

| Provider | Free Tier | Daily Limit | Custom Domain | API/SMTP | Verdict |
|---|---|---|---|---|---|
| **Resend** | **3,000/month forever** | **100/day** | Yes | Both | **Winner. Best DX, excellent deliverability, `@nestjs-modules/mailer` via SMTP.** |
| **Brevo (ex-Sendinblue)** | **300/day forever** | 300/day | Yes | Both | Good alternative. Higher daily limit. More complex setup. |
| **SMTP2GO** | **1,000/month forever** | ~33/day | Yes | Both | Decent fallback. Lower volume. |
| **Mailjet** | 6,000/month, 200/day | 200/day | Yes | Both | Generous monthly, but 200/day cap. |
| SendGrid | **DEAD** (free tier killed July 2025) | N/A | N/A | N/A | No longer an option. |
| Amazon SES | 12-month free trial only, then $0.10/1K | N/A | Yes | Both | Old 62K-from-EC2 free tier gone since Aug 2023. |
| Gmail SMTP | 500/day (personal) | 500/day | No | SMTP only | Fragile. Google can throttle/block. Unprofessional sender. |
| Self-hosted SMTP on VPS | Unlimited | Unlimited | Yes | SMTP | **NOT viable.** Hostinger blocks port 25. VPS IPs have zero reputation. OTPs land in spam. |

**Why Resend wins:**
- `@nestjs-modules/mailer` + Nodemailer connects via standard SMTP (`smtp.resend.com:465`)
- Custom domain (`otp@palmandplate.com`) with DKIM/SPF/DMARC = excellent inbox delivery
- 3,000/month free tier is ~10x what Palm & Plate needs at steady state
- Clean API if you ever want to switch from SMTP to REST
- No credit card required for free tier

**Resend SMTP config for NestJS:**

```typescript
// mail.module.ts
MailerModule.forRoot({
  transport: {
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
  },
  defaults: { from: '"Palm & Plate" <otp@palmandplate.com>' },
})
```

### Session Persistence: 90-Day Refresh Tokens

OTP is only needed on **first login** and **new devices**. After that, refresh tokens keep users logged in.

**How it works:**

| Event | What Happens |
|---|---|
| First login (new user) | Enter email → receive OTP → verify → get access token (15min) + refresh token (90 days) |
| Return visit (same device) | App reads refresh token from storage → calls `POST /auth/refresh` → gets new access token. No OTP needed. |
| Access token expires (every 15min) | Axios interceptor auto-refreshes using the refresh token. Invisible to user. |
| Refresh token expires (90 days) | User must re-enter email and get a new OTP. Happens ~4x per year. |
| New device / cleared browser data | No tokens → OTP required again |
| Explicit logout | Refresh token deleted from server + client. Next login requires OTP. |

**Device trust pattern (optional, reduces OTP further):**

```typescript
// On successful OTP verification, also return a device token
const deviceToken = crypto.randomUUID();
await this.deviceRepo.save({ userId: user.id, deviceToken, userAgent, createdAt: new Date() });
// Store deviceToken in localStorage

// On next login from same device:
// 1. App sends { email, deviceToken } to POST /auth/device-login
// 2. Server verifies deviceToken belongs to this email's user
// 3. Skip OTP entirely, issue new JWT tokens directly
```

**Steady-state OTP volume:**
- ~100 members, most returning on same device
- New signups: ~5-10/month
- Re-auth (expired refresh tokens, new devices): ~5-10/month
- **Total: ~10-20 OTPs/month** (well within Resend's 3,000 free tier)

### Why NOT Magic Links for PWA

Magic links (clickable URL in email) have a fundamental problem with installed PWAs:

1. User is in the **installed PWA** (added to home screen, fullscreen, no browser chrome)
2. Clicks "Send Magic Link" → checks Gmail
3. Clicks the magic link in the email
4. Link opens in **Safari/Chrome** (the default browser), NOT back in the PWA
5. Auth completes in the browser. The PWA doesn't know about it.

**Email OTP avoids this entirely.** User sees the code in Gmail, switches back to the PWA, types it in. The auth flow never leaves the app.

> **Note:** Even for users who access Palm & Plate via browser (not installed PWA), email OTP is still better UX. The user stays on the same tab, types the code, done. No tab-switching, no "check your email and click the link" confusion.

### Why NOT Supabase Auth / Firebase Auth

| Service | Why We Don't Need It |
|---|---|
| **Supabase Auth** | Adds an external dependency for something NestJS handles natively. We'd be using Supabase ONLY for auth (not DB), adding a service to manage for no cost savings. `@nestjs/jwt` + `@nestjs/passport` does the same thing in ~100 lines of code we fully control. |
| **Firebase Auth** | Same issue plus: requires Firebase SDK on frontend, Blaze billing plan, no control over email templates. Over-engineered for "send a 6-digit code to an email." |

**The NestJS-native approach:**
- `@nestjs/jwt` for token signing/verification
- `@nestjs/passport` for route guards
- `@nestjs-modules/mailer` for sending OTP emails via Resend
- **Total dependencies: 3 packages. Total code: ~200 lines. Total cost: $0/month.**

---

## 4. Deployment & Hosting

### Every Option, Mapped to Your AWS Mental Model

### Option A: Vercel (The Founder Likes This)

**What it is:** CloudFront + S3 + Lambda. Frontend-first platform.

**Can Vercel host NestJS?** Technically yes, but NestJS runs as serverless functions (Lambda-style). Every request re-bootstraps the entire NestJS dependency injection container. Cold starts: 1-3 seconds. No WebSockets. Function timeout: 10s (hobby) / 60s (pro). No background jobs or cron.

**Can Vercel host PostgreSQL?** No. Vercel partners with Neon (serverless PostgreSQL). You'd need an external DB.

**Critical:** Vercel Hobby plan is **strictly non-commercial**. A food club handling payments = commercial. **You must use Pro at $20/month minimum.**

**Architecture on Vercel:**
```
[Vercel CDN] --> React SPA (static, globally cached)
[Vercel Functions] --> NestJS as serverless (cold starts, stateless, no WebSockets)
[Neon/Supabase] --> PostgreSQL (external)
```

**Monthly cost:** $20 (Vercel Pro) + $0-19 (Neon DB) = **$20-39/month**

**Verdict:** Vercel is excellent for the React frontend. It is a terrible fit for a NestJS modular monolith backend. NestJS was designed as a persistent long-running process, not a stateless function.

### Option B: Hostinger VPS

**What it is:** EC2 instance. Root access, you install everything.

**Plans (Feb 2026, annual pricing):**
| Plan | vCPU | RAM | Storage | Bandwidth | Promo Price | Renewal Price |
|---|---|---|---|---|---|---|
| KVM1 | 1 | 4 GB | 50 GB NVMe | 4 TB | $5.99/mo | $12.99/mo |
| KVM2 | 2 | 8 GB | 100 GB NVMe | 8 TB | $8.49/mo | $16.99/mo |
| KVM4 | 4 | 16 GB | 200 GB NVMe | 16 TB | $12.99/mo | $30.99/mo |
| KVM8 | 8 | 32 GB | 400 GB NVMe | 32 TB | $24.99/mo | $53.99/mo |

**Can you run everything on one VPS?** Yes. React (Nginx static), NestJS (PM2 persistent process), PostgreSQL -- all on one KVM1 box with 4 GB RAM to spare.

**Architecture on Hostinger VPS:**
```
[Hostinger VPS - KVM1: 1 vCPU, 4GB RAM, 50GB NVMe - $4.99/mo]
  |
  +-- Nginx (reverse proxy + static files)
  |     |-- palmandplate.com --> React landing page
  |     |-- app.palmandplate.com --> React member PWA
  |     |-- admin.palmandplate.com --> React admin app
  |     |-- api.palmandplate.com --> proxy to NestJS :3000
  |
  +-- NestJS (PM2, port 3000) -- persistent process, full features
  |     |-- WebSockets: YES
  |     |-- Background jobs: YES
  |     |-- Cron (for recurring payments): YES
  |     |-- Local DB connection: ZERO latency
  |
  +-- PostgreSQL (port 5432, localhost only)
        |-- 50GB NVMe storage
        |-- pg_dump cron for backups
```

**vs AWS equivalent:**
| AWS | Cost | Hostinger Equivalent | Cost |
|---|---|---|---|
| EC2 t3.micro (1 vCPU, 1GB) | ~$8.50/mo | KVM1 (1 vCPU, 4GB) | $4.99/mo |
| RDS db.t3.micro | ~$15/mo | PostgreSQL on same VPS | $0 |
| ALB | ~$16/mo | Nginx on same VPS | $0 |
| CloudFront + S3 | ~$0-5/mo | Nginx on same VPS | $0 |
| **Total** | **~$40-45/mo** | **Total** | **$4.99/mo** |

**Monthly cost:** **$4.99/month** for everything.

**Pros:** Cheapest by far. NestJS runs as designed. Full control. WebSockets work. Cron works. Local DB = zero latency.

**Cons:** You are the sysadmin. OS updates, security patches, firewall config are your responsibility. Single point of failure (no redundancy). Requires SSH/Linux knowledge.

### Option C: Supabase

**What it is:** RDS + Cognito + API Gateway + S3 in a box. Open-source Firebase alternative built on PostgreSQL.

**Supabase provides:** Managed PostgreSQL, Auth (OTP, magic links, social), auto-generated REST APIs, realtime subscriptions, file storage.

**Supabase does NOT provide:** NestJS hosting. You still need to host NestJS somewhere else.

**Free tier:** 500 MB DB, 50K auth MAUs, BUT **projects pause after 7 days of inactivity.** A food club might not have daily traffic -- if nobody opens the app for a week, the DB goes to sleep. Next user waits 30-60 seconds. Unusable for production.

**Pro plan:** $25/month. No pause. 8 GB DB. 100K MAUs.

**Architecture with Supabase:**
```
[Vercel/Nginx] --> React apps (frontend)
[VPS/Railway] --> NestJS (backend, hosted separately)
[Supabase] --> PostgreSQL + Auth ($25/mo Pro, or $0 free with pause risk)
```

**Monthly cost:** $25 (Supabase Pro) + $5-7 (NestJS hosting) = **$30-32/month**

**Verdict:** Expensive as a database host ($25/month for Pro). The free tier's pause-after-7-days is a dealbreaker for production. Supabase Auth is free but unnecessary — NestJS handles auth natively (see Section 3).

### Option D: Firebase

**What it is:** DynamoDB + Cognito + Lambda. Google's BaaS, primarily NoSQL (Firestore).

**Can you use PostgreSQL with Firebase?** Only via Firebase Data Connect (new, April 2025). It provisions a Cloud SQL instance at $9.37/month minimum. This is basically Google Cloud SQL with a Firebase wrapper.

**Verdict: Not recommended.** Firebase is built around NoSQL (Firestore). Your data model is inherently relational (members, events, payments, memberships, invites). Switching to NoSQL means redesigning everything. Firebase Data Connect adds PostgreSQL but it's new, expensive, and overkill. The NestJS + Firebase pairing is awkward.

### Option E: Railway.app

**What it is:** Elastic Beanstalk + RDS in a box. Push code, get a running app.

**Monthly cost:** $5 Hobby plan (includes $5 usage credits). NestJS + PostgreSQL typically fits within $5-8/month.

**Pros:** Dead simple. Connect GitHub, deploy. One-click PostgreSQL. NestJS runs as persistent process. WebSockets work.

**Cons:** No free tier (30-day trial only). US/EU regions only (latency to Bahrain).

### Option F: Coolify on VPS (Dark Horse)

**What it is:** Self-hosted Heroku/Vercel on your own VPS. Open-source PaaS (40K+ GitHub stars).

Install Coolify on a Hostinger VPS and get: one-click deploys from GitHub, automatic SSL, Docker-based deployments, one-click PostgreSQL, a management dashboard. All for the cost of the VPS.

**Monthly cost:** $4.99-5.99 (just the VPS)

**Pros:** VPS pricing ($5/mo) with PaaS convenience (git push to deploy). No vendor lock-in. Full control.

**Cons:** Coolify itself needs resources (recommends 2 GB RAM minimum -- KVM1's 4 GB covers this). You still manage the VPS OS.

### Comparison Table

| Option | Monthly Cost | NestJS Fit | PostgreSQL | WebSockets | DevOps Effort | AWS Equivalent |
|---|---|---|---|---|---|---|
| **Hostinger VPS KVM1** | **$4.99** | Excellent | On same box | Yes | High | EC2 + self-managed PG |
| **Coolify on VPS** | **$4.99** | Excellent | One-click | Yes | Medium | Self-hosted EB |
| **Railway Hobby** | **$5-8** | Excellent | One-click managed | Yes | Low | EB + RDS |
| **Render** | **$14** | Good | Managed | Yes | Low | EB + RDS |
| **Vercel Pro + Neon** | **$20-39** | Poor (serverless) | External | No | Low/Med | CloudFront+S3+Lambda |
| **Supabase Pro + hosting** | **$30-32** | N/A (need host) | Excellent | Realtime | Low/Med | RDS+Cognito+APIGW |
| **Firebase + hosting** | **$15-20** | Poor | Poor fit | Limited | Low | DynamoDB+Lambda |

### Hostinger VPS Tier Deep Analysis: Which KVM for Palm & Plate?

#### Per-Component RAM Consumption (Real Benchmarks)

| Component | Idle RAM | Under Load (100 concurrent) |
|---|---|---|
| Ubuntu 22.04 LTS (OS baseline) | 200 MB | 200 MB |
| Nginx (master + 2 workers, static files + reverse proxy) | 15 MB | 30 MB |
| NestJS (PM2, `--max-old-space-size=256`, with ORM + auth + CASL) | 150-200 MB | 200-250 MB |
| PostgreSQL 16 (`shared_buffers=128MB`, small dataset) | 180 MB | 200 MB |
| PM2 daemon | 50 MB | 50 MB |
| **TOTAL** | **~595-645 MB** | **~680-730 MB** |

**Key tuning:** Always set `--max-old-space-size=256` on NestJS via PM2. Without it, Node.js V8 can allocate up to ~1.5 GB heap on a 4 GB machine. With the cap, NestJS stays at 200-300 MB ceiling.

**ORM impact on memory:**
- **Prisma 7** (chosen): Pure TypeScript engine (Rust binary removed). ~90% smaller bundle, ~3x faster queries. No separate process, no binary overhead. Memory footprint comparable to Drizzle/TypeORM now.
- Drizzle ORM: ~7 KB bundle, zero binary dependencies -- most lightweight option
- TypeORM: moderate memory, class instantiation overhead per row
- Prisma 5/6 (legacy): spawned a separate Rust query engine binary, added ~30-50 MB overhead. **Prisma 7 eliminates this entirely.**

#### Scenario A: Production Only

| VPS Tier | RAM Used | RAM Free | CPU Fit? | Verdict |
|---|---|---|---|---|
| **KVM1** (1 vCPU, 4 GB) | ~645 MB | **3.3 GB free** | 1 vCPU is the bottleneck, not RAM | Works, but CPU may lag under 50+ concurrent requests |
| **KVM2** (2 vCPU, 8 GB) | ~645 MB | **7.3 GB free** | 2 vCPU = NestJS and PostgreSQL on separate cores | Comfortable overkill |
| KVM4/KVM8 | ~645 MB | 15+ GB free | Massive overkill | Not needed |

#### Scenario B: Production + Dev/UAT on Same VPS

**Yes, you can host both on one VPS.** The architecture:

```
[Single Hostinger VPS]
  |
  [Nginx] (routes by subdomain)
  |
  +-- app.palmandplate.com        --> React member PWA (prod)
  +-- admin.palmandplate.com      --> React admin app (prod)
  +-- api.palmandplate.com        --> NestJS :3000 (prod)
  |
  +-- staging.palmandplate.com    --> React member PWA (staging)
  +-- admin-staging.palmandplate.com --> React admin (staging)
  +-- api-staging.palmandplate.com   --> NestJS :3001 (staging)
  |
  [PostgreSQL] (ONE instance, TWO databases)
      +-- palm_plate_prod
      +-- palm_plate_staging
```

**RAM budget with both environments (PM2, no Docker):**

| Component | RAM |
|---|---|
| Ubuntu OS | 200 MB |
| Nginx (serves all subdomains) | 20 MB |
| NestJS PROD (port 3000) | 200 MB |
| NestJS STAGING (port 3001) | 200 MB |
| PostgreSQL (1 instance, 2 databases -- shared buffer pool) | 200 MB |
| PM2 daemon (managing 2 processes) | 60 MB |
| **TOTAL** | **~880 MB** |

**Critical:** One PostgreSQL instance with two databases shares the same `shared_buffers` pool. Running two separate PostgreSQL instances would double RAM to ~360-400 MB for no benefit at this scale.

| VPS Tier | RAM Used (Prod + Staging) | RAM Free | Fits? |
|---|---|---|---|
| **KVM1** (1 vCPU, 4 GB) | ~880 MB | **3.1 GB free** | Yes, but 1 vCPU shared across 2 NestJS + PostgreSQL |
| **KVM2** (2 vCPU, 8 GB) | ~880 MB | **7.1 GB free** | Yes, comfortably. 2 cores handle both envs well |
| KVM4 (4 vCPU, 16 GB) | ~880 MB | 15.1 GB free | Massive overkill |
| KVM8 (8 vCPU, 32 GB) | ~880 MB | 31.1 GB free | Absurd overkill |

#### If Using Docker Compose Instead of PM2

Docker adds ~300-400 MB overhead (dockerd + containerd):

| VPS Tier | RAM Used (Docker, Prod + Staging) | RAM Free | Fits? |
|---|---|---|---|
| **KVM1** (4 GB) | ~1.2 GB | **2.8 GB free** | Yes, but tighter |
| **KVM2** (8 GB) | ~1.2 GB | **6.8 GB free** | Comfortable |

#### If Using Coolify (Self-Hosted PaaS)

Coolify adds ~500-700 MB (its own PostgreSQL, Redis, Laravel workers):

| VPS Tier | RAM Used (Coolify, Prod + Staging) | RAM Free | Fits? |
|---|---|---|---|
| **KVM1** (4 GB) | ~1.5-1.9 GB | **2.1-2.5 GB free** | Tight. Works but limited burst headroom. |
| **KVM2** (8 GB) | ~1.5-1.9 GB | **6.1-6.5 GB free** | Comfortable |

#### Two Separate KVM1s vs One KVM2?

| Factor | Two KVM1s ($5.99 x 2 = $11.98/mo) | One KVM2 ($8.49/mo) |
|---|---|---|
| Total resources | 2 vCPU, 8 GB RAM, 100 GB disk | 2 vCPU, 8 GB RAM, 100 GB disk |
| Cost | **$11.98/mo** | **$8.49/mo** (saves $3.49) |
| Isolation | Full OS isolation. Staging crash can't kill prod. | Shared kernel. Runaway staging could OOM-kill prod. |
| PostgreSQL | Must run 2 separate PG instances (doubles RAM) or use remote DB | 1 instance, 2 databases (efficient) |
| Maintenance | 2 servers to patch, monitor, SSH into, back up | 1 server |
| Networking | Staging-to-prod = network latency | Localhost = zero latency |
| SSL | 2 certbot setups | 1 certbot with multiple domains |
| Deploy pipeline | 2 targets | 1 target, 2 PM2 app names |

**Verdict: One KVM2 wins.** Cheaper ($8.49 vs $11.98), simpler (1 server), more efficient (shared PG). The isolation risk is mitigated by PM2's `max_memory_restart` and `--max-old-space-size` caps.

#### Final VPS Recommendation

**KVM2 ($8.49/month)** is the right tier.

Why not KVM1: It technically fits (~880 MB used, 3.1 GB free), but the **1 vCPU is the real constraint**, not RAM. With two NestJS instances + PostgreSQL + Nginx sharing one CPU core, you'll notice latency under concurrent load. The $2.50/month premium for KVM2 gets you a second CPU core, which lets NestJS and PostgreSQL run on separate cores.

Why not KVM4/KVM8: At 880 MB total usage, 16-32 GB RAM is 18-36x what you need. You'd be paying for resources that sit idle forever.

**Summary:**
- **KVM2 at $8.49/month** = both production and staging, all services, comfortable headroom
- Use **PM2** (not Docker) to save ~300 MB overhead unless you specifically need containerization
- Use **one PostgreSQL instance with two databases** (prod + staging share buffer pool)
- NestJS with `--max-old-space-size=256` and `max_memory_restart: 300M`
- **Prisma 7** (pure TS engine) -- no Rust binary overhead, ~90% smaller than Prisma 5/6

---

## 5. Database Hosting

### Option A: PostgreSQL on VPS (with NestJS) -- $0 extra

Install PostgreSQL directly on the Hostinger VPS alongside NestJS. Local connections = zero network latency. 50 GB NVMe storage is more than enough for a food club. Backup via `pg_dump` cron job.

**When you think of this:** Think of running PostgreSQL on the same EC2 instance instead of using RDS. Less managed, but at this scale, the management burden is minimal.

### Option B: Supabase (Managed PostgreSQL) -- $0 free / $25 Pro

Use Supabase purely as a managed PostgreSQL host. Connect NestJS via the connection string. Get: managed backups, dashboard, and optionally Auth.

**Free tier risk:** Project pauses after 7 days of inactivity.
**Pro at $25/month:** No pause, 8 GB storage, daily backups.

**When you think of this:** Think of RDS. Managed, backed up, but costs money.

### Option C: Neon (Serverless PostgreSQL) -- $0 free / $19 Launch

Neon is what Vercel uses under the hood for "Vercel Postgres." Serverless = scales to zero, scales up on demand.

**Free tier:** 0.5 GB storage, 10 databases. No auto-pause concern (always available).
**Launch at $19/month:** 10 GB storage, more compute.

**When you think of this:** Think of Aurora Serverless v2. Pay for what you use, scales automatically.

### Recommendation

**If going VPS route:** PostgreSQL on the same box. $0 extra. At 100-1,000 members with structured data (members, events, payments), you'll use maybe 100 MB of database storage. A 50 GB NVMe drive is 500x what you need.

**If going split architecture (e.g., Vercel frontend + separate backend):** Supabase free tier for development, Supabase Pro ($25/month) or Neon Launch ($19/month) for production.

---

## 6. TAP Payments Integration

### Overview

TAP Payments is the leading MENA payment gateway. Headquartered in the region with a Bahrain hub. CBB-licensed. Supports: Visa, Mastercard, AMEX, Apple Pay, Google Pay, **BenefitPay** (critical for Bahrain), Tabby (BNPL).

**Integration modes:**
1. **Redirect** -- Customer goes to TAP-hosted page, pays, comes back. Simplest.
2. **Embedded (Card SDK v2)** -- Card input embedded on your page. SDK tokenizes, backend charges.
3. **BenefitPay button** -- Dedicated SDK, generates QR code, user scans with BenefitPay app.
4. **Payment Links/Invoices** -- Generate links sent via WhatsApp/email/SMS.

**There is no official Node.js/NestJS backend SDK.** Backend integration is via REST API (`https://api.tap.company/v2/`) with Bearer token auth. This is the standard pattern (same as Stripe).

### Architecture in NestJS

```
Frontend (React)
    |
    |-- TAP Card SDK v2 (tokenizes card) --> returns tok_xxxxx
    |-- BenefitPay Button SDK (for BenefitPay payments)
    |
    v
NestJS Backend
    |
    |-- TapPaymentsModule
    |     |-- TapPaymentsService      (wraps REST API: charges, refunds, tokens)
    |     |-- TapWebhookController    (receives POST webhooks from TAP)
    |     |-- TapWebhookGuard         (HMAC-SHA256 signature verification)
    |
    |-- MembershipModule
    |     |-- MembershipService       (subscription business logic)
    |     |-- RecurringBillingCron     (scheduled renewal charges)
    |
    |-- EventsModule
    |     |-- EventPaymentService     (one-time ticket payments)
    |
    v
TAP Payments API (https://api.tap.company/v2)
```

### Recurring Payments (Memberships)

1. First payment: Create charge with `save_card: true`
2. TAP returns `customer_id`, `card_id`, `payment_agreement_id` -- store these
3. NestJS cron job finds memberships due for renewal
4. Generate fresh token from saved card (`POST /v2/tokens`)
5. Create merchant-initiated charge with `customer_initiated: false`
6. Webhook confirms, extend membership

**Important:** Only Visa/Mastercard/AMEX support recurring. BenefitPay does NOT. Tokens expire in 5 minutes -- generate fresh for each charge.

### BenefitPay (Bahrain-Specific)

BenefitPay is Bahrain's national payment network. TAP has a dedicated React SDK (`@tap-payments/benefit-pay-button`). BHD amounts must use 3 decimal places (e.g., `3.000` for 3 BHD).

**BenefitPay is one-time only** -- no recurring/saved card support. Members paying monthly via BenefitPay would need to manually pay each month (or use card for auto-renewal).

### Webhooks

TAP sends POST to your `post.url` for `CAPTURED` and `FAILED` events. Verify via HMAC-SHA256 hash. TAP retries **twice** on failure. Your endpoint must use valid SSL.

### Alternatives (for reference)

| Gateway | Bahrain | BenefitPay | Recurring | Notes |
|---|---|---|---|---|
| **TAP Payments** | Yes (HQ) | Yes (SDK) | Yes | Best fit for this project |
| Stripe | **No** | No | Yes | Not available in Bahrain |
| PayTabs | Yes | Limited | Yes | $49.99/mo or 2.85% + $0.27 |
| MyFatoorah | Yes | Limited | Limited | Invoice-focused |
| Checkout.com | Yes | Yes | Yes | Enterprise-grade, overkill |

TAP is the right choice. Local presence, BenefitPay SDK, recurring support, BHD native.

---

## 7. Recommended Architecture (Final)

### Primary Recommendation: Hostinger VPS + NestJS Auth + Resend

**Total monthly cost: $8.49/month (VPS only, everything else free)**

```
PRODUCTION ARCHITECTURE

[Users in Bahrain]
       |
       | HTTPS (Let's Encrypt, auto-renewed)
       |
[Hostinger VPS - KVM2: 2 vCPU, 8GB RAM, 100GB NVMe - $8.49/mo]
       |
   [Nginx reverse proxy]
       |
       +-- palmandplate.com           --> Astro landing page (static HTML)
       +-- app.palmandplate.com       --> React member PWA (static)
       +-- admin.palmandplate.com     --> React admin app (static)
       +-- api.palmandplate.com       --> NestJS :3000 (proxy)
       |
       +-- [NestJS Backend] (PM2, persistent process)
       |     |-- Modular monolith architecture
       |     |-- Email OTP (generate, send via Resend, verify)
       |     |-- JWT issuance (@nestjs/jwt) + refresh tokens (90-day)
       |     |-- @nestjs/passport guards on all protected routes
       |     |-- CASL-based RBAC (admin vs member)
       |     |-- TAP Payments integration
       |     |-- Cron jobs (recurring billing, reminders)
       |     |-- WebSocket support (if needed for realtime)
       |
       +-- [PostgreSQL 16] (localhost, port 5432)
             |-- All application data + OTP codes + refresh tokens
             |-- Automated daily pg_dump backups
             |-- Hostinger weekly VPS snapshots


[External Services (all free)]
       |
       +-- [Resend] (free, 3,000 emails/month)
       |     |-- OTP email delivery via SMTP
       |     |-- Custom domain: otp@palmandplate.com
       |     |-- DKIM/SPF/DMARC for inbox deliverability
       |
       +-- [TAP Payments] (transaction fees only)
       |     |-- Card payments (Visa/MC/AMEX)
       |     |-- BenefitPay
       |     |-- Apple Pay / Google Pay
       |     |-- Recurring billing
       |
       +-- [GitHub Actions] (free for public/small repos)
             |-- CI/CD pipeline
             |-- Build, test, deploy to VPS via SSH
```

### Why This Configuration

| Decision | Rationale |
|---|---|
| **Hostinger VPS over Vercel** | NestJS is a persistent process framework. Serverless (Vercel) means cold starts, no WebSockets, no cron. VPS runs NestJS as designed. |
| **KVM2 over KVM1** | $2.50/month more for a second CPU core. Two NestJS instances (prod + staging) + PostgreSQL sharing one core causes latency. Two cores = NestJS and PG on separate cores. |
| **PostgreSQL on VPS over Supabase DB** | $0/month vs $25/month. At 100-1,000 members, the DB fits in <1 GB. Self-managed PostgreSQL on a VPS is trivial at this scale. |
| **NestJS-native auth over Supabase Auth** | No external auth dependency. `@nestjs/jwt` + `@nestjs/passport` + `@nestjs-modules/mailer` = ~200 lines of code we fully control. $0/month. No vendor lock-in. |
| **Email OTP over SMS/WhatsApp OTP** | $0/month (Resend free tier) vs $8-50/month for SMS providers. Email works everywhere, no carrier issues, no per-message costs. |
| **Resend over other email providers** | 3,000/month free forever, best developer experience, Nodemailer-compatible SMTP, custom domain support, no credit card required. |
| **90-day refresh tokens** | OTP only needed on first login / new device. Reduces OTP volume to ~10-20/month. Users stay logged in for months. |
| **Turborepo monorepo** | Two React apps sharing types and UI components. Atomic changes. One `pnpm install`. Turborepo caches unchanged apps. |
| **Admin from scratch** | TanStack Table + TanStack Query + React Hook Form + shadcn/ui. Full control, no framework ceiling, same design language as member app. |
| **PWA for member app** | Add-to-homescreen, offline support, push notifications. No App Store fees. `vite-plugin-pwa` handles everything. |

### Alternative: Split Architecture (if founder wants Vercel)

```
[Vercel Free*] --> React member PWA + admin app (CDN, preview deploys)
[Hostinger VPS KVM2] --> NestJS + PostgreSQL ($8.49/mo)
[Resend] --> Email OTP (free, 3K/mo)

Total: ~$8.49/month

*Note: Vercel Hobby is technically non-commercial.
 For commercial use, Vercel Pro = $20/month.
 Alternatively, keep frontends on the VPS and skip Vercel entirely.
```

This gives the founder the Vercel DX for frontends (preview deploys, CDN) while keeping the backend on a proper VPS. But it adds complexity (two hosting providers) and potentially $20/month for Vercel Pro.

### Alternative: Railway (if team wants zero DevOps)

```
[Railway Hobby] --> NestJS + PostgreSQL ($5-8/mo)
[Vercel/Netlify] --> React apps (free or $20/mo)
[Resend] --> Email OTP (free)

Total: $5-28/month
```

Railway = "connect GitHub, click deploy." No SSH, no server management. The tradeoff is slightly higher cost and US/EU-only regions (more latency to Bahrain).

### Deployment: PM2 + GitHub Actions

**Client decision:** PM2 for process management, GitHub Actions for CI/CD. No Docker.

**Why PM2 (not Docker):**

| Factor | PM2 | Docker |
|---|---|---|
| RAM overhead | ~50 MB (daemon only) | ~300-400 MB (dockerd + containerd) |
| Learning curve | 5 commands: `start`, `stop`, `restart`, `logs`, `status` | Dockerfiles, docker-compose, volumes, networking |
| Zero-downtime reload | `pm2 reload app` (built-in) | Rolling update config needed |
| Auto-restart on crash | Built-in | Restart policies in compose |
| Memory limiting | `max_memory_restart: '300M'` | Container memory limits |
| Best for | Single VPS, small team, one app | Multi-service, multi-server, team isolation |

**PM2 is the de facto standard for single-VPS Node.js deployments.** 100M+ downloads. Well-documented NestJS + PM2 combo with dedicated guides. The "stop using PM2" critiques target multi-server orchestration scenarios -- not applicable to a single KVM2 VPS.

**PM2 ecosystem file:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'palm-plate-prod',
      script: 'dist/main.js',
      cwd: '/var/www/palm-plate/apps/api',
      instances: 1,
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'palm-plate-staging',
      script: 'dist/main.js',
      cwd: '/var/www/palm-plate-staging/apps/api',
      instances: 1,
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
    },
  ],
};
```

**GitHub Actions deploy workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/palm-plate
            git pull origin main
            pnpm install --frozen-lockfile
            npx prisma migrate deploy
            pnpm --filter api build
            pm2 restart palm-plate-prod
            cp -r apps/member-app/dist/* /var/www/app.palmandplate.com/
            cp -r apps/admin-app/dist/* /var/www/admin.palmandplate.com/
```

**Deploy flow explained:**

1. Push to `main` → GitHub Actions triggers
2. CI builds and tests everything in clean environment
3. If tests pass → SSH into VPS
4. `git pull` gets the latest code
5. `pnpm install` installs any new dependencies
6. `prisma migrate deploy` runs any new database migrations
7. `pnpm --filter api build` recompiles only the NestJS API
8. `pm2 restart` swaps to new build (zero-downtime with `pm2 reload`)
9. Static frontend files copied to Nginx-served directories

**Rollback:** `git revert` + push to `main` → same pipeline deploys the previous working version.

---

## 8. Decision Matrix

### Final Decisions (All Confirmed)

| # | Decision | Final Answer | Rationale |
|---|---|---|---|
| 1 | **OTP Method** | Email OTP via Resend ($0) | Free forever, 3K/mo. No SMS costs. PWA-friendly (user stays in-app). |
| 2 | **Auth Service** | NestJS-native (@nestjs/jwt + passport) | ~200 lines of code. No vendor lock-in. $0/month. |
| 3 | **Hosting** | Hostinger VPS KVM2 ($8.49/mo) | 2 vCPU, 8GB RAM. Prod + staging on one box. |
| 4 | **Database** | PostgreSQL on VPS ($0) | Local = zero latency. One instance, two databases (prod + staging). |
| 5 | **Admin Framework** | From scratch (TanStack + shadcn/ui) | TanStack Table + TanStack Query + React Hook Form. Full control, no framework ceiling. |
| 6 | **Frontend Split** | Two separate React apps (Turborepo monorepo) | Different UX paradigms, independent deploys, bundle separation. |
| 7 | **Monorepo Tool** | Turborepo | Lightweight, fast, zero-config. Vercel-backed. |
| 8 | **ORM** | Prisma 7 (pure TS engine) | Rust engine removed. 90% smaller bundle, 3x faster queries. No binary overhead. |
| 9 | **UI Library** | shadcn/ui + Tailwind CSS | Copy-paste components. Shared across member + admin apps via `packages/ui/`. |
| 10 | **Landing Page** | Astro (separate repo) | Zero JS by default. Static HTML. SEO-first. Different build pipeline from app. |
| 11 | **Email Provider** | Resend (3K/mo free) | Best DX. Nodemailer SMTP. Custom domain. No credit card. |
| 12 | **Payments** | TAP Payments | Only option for Bahrain + BenefitPay. CBB-licensed. Recurring support. |
| 13 | **CI/CD** | GitHub Actions | Free for private repos (2K min/mo). SSH deploy to VPS. |
| 14 | **SSL** | Let's Encrypt | Free, auto-renewing via certbot. Required for TAP webhooks, PWA, JWT security. |
| 15 | **Process Manager** | PM2 | De facto standard for single-VPS Node.js. 100M+ downloads. Auto-restart, zero-downtime reload, memory limits. |

---

## 9. Cost Summary

### Recommended Stack: Total Monthly Cost

**$8.49/month all-in.** Everything else is free.

| Service | Monthly Cost | Notes |
|---|---|---|
| Hostinger VPS KVM2 (annual commitment) | **$8.49** | 2 vCPU, 8GB RAM, 100GB NVMe. Hosts prod + staging. |
| Email OTP via Resend | **$0** | 3,000 emails/month free forever. Palm & Plate needs ~10-20/month steady state. |
| NestJS auth (@nestjs/jwt + passport) | **$0** | Built into the backend. No external auth service. |
| PostgreSQL on VPS | **$0** | Runs on same box. |
| Let's Encrypt SSL | **$0** | Auto-renewed via certbot. |
| GitHub Actions CI/CD | **$0** | Free for private repos (2,000 min/month). |
| TAP Payments | Transaction fees only | 2.5% + TAP fee per transaction. No monthly subscription. |
| **Total infrastructure** | **$8.49/month ($101.88/year)** | |

### Why It's So Cheap

The key insight: **email OTP via free providers eliminates the only recurring cost beyond hosting.**

Previous architecture (SMS OTP) would have cost $16-51/month depending on SMS provider. Switching to email OTP removes $8-43/month in SMS fees. The remaining $8.49 is just the VPS, which you need regardless.

### Cost Comparison: Email OTP vs SMS OTP vs WhatsApp OTP

| Configuration | Monthly (Yr 1) | Annual (Yr 1) |
|---|---|---|
| **VPS KVM2 + Email OTP via Resend (recommended)** | **$8.49** | **$101.88** |
| VPS KVM2 + Firebase Phone Auth (SMS) | $16–33 | $198–402 |
| VPS KVM2 + D7 Networks raw SMS (DIY OTP) | ~$19 | ~$230 |
| VPS KVM2 + Twilio Verify WhatsApp | ~$39 | ~$465 |
| VPS KVM2 + Twilio Verify SMS | ~$51 | ~$618 |
| Equivalent on AWS (EC2+RDS+ALB+CF) + Twilio | ~$85-95 | ~$1,020-1,140 |
| Supabase Pro + Railway + Twilio Verify | ~$65-70 | ~$780-840 |

**Savings vs SMS approaches:** $90-500+/year by choosing email OTP.

### Renewal Pricing (After Year 1)

KVM2 renews at $16.99/month. Plan accordingly:

| Configuration | Year 1 Monthly | Year 2+ Monthly | Year 2+ Annual |
|---|---|---|---|
| **VPS + Email OTP (recommended)** | **$8.49** | **$16.99** | **$203.88** |
| VPS + Firebase Phone Auth (SMS) | $16–33 | $25–42 | $300–504 |
| VPS + Twilio Verify WhatsApp | ~$39 | ~$47 | ~$564 |
| VPS + Twilio Verify SMS | ~$51 | ~$60 | ~$720 |

> **Note:** Even at Year 2+ renewal pricing ($16.99/month VPS), the email OTP stack is still cheaper than ANY SMS-based approach at Year 1 promotional pricing.

---

## Sources

### Authentication & Email OTP
- [Resend Pricing](https://resend.com/pricing) | [SMTP Docs](https://resend.com/docs/send-with-smtp)
- [Brevo Free Tier](https://www.brevo.com/pricing/)
- [SMTP2GO Free Tier](https://www.smtp2go.com/pricing/)
- [@nestjs-modules/mailer](https://github.com/nest-modules/mailer)
- [@nestjs/jwt](https://github.com/nestjs/jwt) | [@nestjs/passport](https://github.com/nestjs/passport)
- [NestJS Authentication Docs](https://docs.nestjs.com/security/authentication)

### SMS OTP Research (for reference -- not used in final architecture)
- [Twilio SMS Pricing -- Bahrain](https://www.twilio.com/en-us/sms/pricing/bh) | [Twilio Verify Pricing](https://www.twilio.com/en-us/verify/pricing)
- [Firebase Phone Auth Pricing](https://firebase.google.com/docs/phone-number-verification/pricing)
- [WhatsApp Business API 2026 Pricing](https://flowcall.co/blog/whatsapp-business-api-pricing-2026)
- [Infobip-Batelco Partnership](https://www.infobip.com/news/infobip-batelco-by-beyon-partners)

### Deployment & Hosting
- [Vercel Pricing](https://vercel.com/pricing) | [Hobby Restrictions](https://vercel.com/docs/plans/hobby) | [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel WebSocket FAQ](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Hostinger VPS](https://www.hostinger.com/vps-hosting) | [Pricing](https://www.hostinger.com/pricing/vps-hosting)
- [Supabase Pricing](https://supabase.com/pricing)
- [Firebase Pricing](https://firebase.google.com/pricing) | [Data Connect](https://firebase.google.com/docs/data-connect/pricing)
- [Railway Pricing](https://railway.com/pricing) | [NestJS Guide](https://docs.railway.com/guides/nest)
- [Render Pricing](https://render.com/pricing)
- [Coolify](https://coolify.io/) | [GitHub (40K+ stars)](https://github.com/coollabsio/coolify)
- [Neon PostgreSQL Pricing](https://neon.com/pricing)

### Frontend Architecture
- [Turborepo vs Nx vs Lerna (2026)](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71)
- [Micro-Frontends in 2025](https://dev.to/tahamjp/micro-frontends-in-2025-are-they-still-worth-it-23lp)
- [PWA Best Practices 2026](https://wirefuture.com/post/progressive-web-apps-pwa-best-practices-for-2026)
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
- [Astro](https://astro.build/) | [Astro Docs](https://docs.astro.build/)
- [TanStack Table](https://tanstack.com/table) | [TanStack Query](https://tanstack.com/query)
- [React Hook Form](https://react-hook-form.com/)
- [shadcn/ui](https://ui.shadcn.com/)

### ORM
- [Prisma 7 Announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- Rust engine → TypeScript rewrite, 90% smaller, 3x faster
- [Prisma Docs](https://www.prisma.io/docs)

### Process Management & Deployment
- [PM2](https://pm2.io/) | [GitHub (42K+ stars)](https://github.com/Unitech/pm2)
- [PM2 + NestJS Production Guide](https://dev.to/mochafreddo/managing-nextjs-and-nestjs-applications-in-production-with-pm2-3j25)
- [PM2 Ecosystem Setup for NestJS (Jan 2026)](https://medium.com/@zulfikarditya/pm2-ecosystem-setup-guide-for-node-js-nestjs-45b0eee8629a)
- [NestJS Deploy on VPS with PM2 + Nginx](https://priorcoder.com/blog/how-to-deploy-nestjs-on-your-vps-in-production-mode-using-pm2-and-nginx/)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action) -- GitHub Actions SSH deploy

### TAP Payments
- [TAP Developers](https://developers.tap.company/)
- [Create a Charge](https://developers.tap.company/reference/create-a-charge) | [Recurring](https://developers.tap.company/docs/recurring-payments) | [Webhooks](https://developers.tap.company/docs/webhook)
- [BenefitPay SDK](https://developers.tap.company/docs/benefitpay-web-sdk)
- [Payment Gateways in Bahrain](https://inai.io/blog/top-6-payment-gateways-in-bahrain)
- [Bahrain Digital Payment Regulations](https://blog.tap.company/resolution-no-43-digital-payments-bahrain/)

### NestJS Patterns
- [RBAC with CASL in NestJS](https://www.permit.io/blog/how-to-protect-a-url-inside-a-nestjs-app-using-rbac-authorization)
- [NestJS Authorization Docs](https://docs.nestjs.com/security/authorization)
- [NestJS Versioning](https://docs.nestjs.com/techniques/versioning)
