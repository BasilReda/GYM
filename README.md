# 🏋️ GYMAWY — Gym Management System

A full-stack gym management web app with member management, attendance tracking, payments via Stripe, class scheduling, and a mobile-friendly PWA interface with bilingual (English / Arabic) support.

---

## Features

- **Dashboard** — live stats: active members, today's check-ins, monthly revenue, expiry alerts
- **Members** — add, edit, suspend, QR code generation, subscription tracking
- **Attendance** — QR code scanner + manual check-in, duplicate prevention, history
- **Payments** — cash/card/bank recording, Stripe card payments, monthly revenue summary
- **Subscriptions** — plan management (duration, price, active/inactive)
- **Trainers** — trainer profiles linked to class schedules
- **Classes** — class types + session scheduling with trainer conflict detection
- **Member Portal** — members view their own subscription, check-in history, and renew online
- **User Management** — role-based access (owner / manager / reception / trainer / member)
- **Bilingual** — full English and Arabic UI with RTL layout support
- **PWA** — installable on mobile, works offline for the UI shell
- **Mobile-first** — responsive sidebar drawer, bottom nav, safe-area insets

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (via `better-sqlite3`) |
| Auth | JWT (24 h expiry) + bcrypt |
| Payments | Stripe Payment Intents |
| Frontend | Vanilla HTML / CSS / JS (no build step) |
| Container | Docker + Docker Compose |
| Tunnel | ngrok (free static domain) |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [ngrok](https://ngrok.com/download) — for public URL / mobile access (optional for local-only use)
- A [Stripe](https://dashboard.stripe.com) account (test keys are fine)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/gymawy.git
cd gymawy
```

### 2. Configure environment variables

Open `docker-compose.yml` and fill in your own values:

```yaml
environment:
  - JWT_SECRET=your-random-secret-here          # change this!
  - STRIPE_PUBLISHABLE_KEY=pk_test_...          # from Stripe Dashboard
  - STRIPE_SECRET_KEY=sk_test_...               # from Stripe Dashboard
  - STRIPE_CURRENCY=usd                         # or egp, eur, etc.
```

> ⚠️ **Never commit real secret keys to Git.** Use test keys during development.

### 3. Start the app

Double-click `START.bat` — or run:

```bash
docker compose up --build
```

The app will be available at **http://localhost:3000**

---

## Default Accounts

These accounts are created automatically on first run (seeded in `db/seed.js`):

| Role | Email | Password |
|---|---|---|
| Owner | owner@gymdesk.com | Owner@123 |
| Manager | manager@gymdesk.com | Manager@123 |
| Reception | reception@gymdesk.com | Reception@123 |
| Trainer | trainer@gymdesk.com | Trainer@123 |
| Member | member@gymdesk.com | Member@123 |

> Change all passwords after first deployment.

---

## Role Permissions

| Feature | Owner | Manager | Reception | Trainer | Member |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard stats | ✅ | ✅ | ✅ | — | — |
| View members | ✅ | ✅ | ✅ | ✅ | — |
| Add/edit members | ✅ | ✅ | ✅ | — | — |
| Delete members | ✅ | ✅ | ✅ | — | — |
| Record payments | ✅ | ✅ | ✅ | — | — |
| View payment summary | ✅ | ✅ | — | — | — |
| Manage plans | ✅ | — | — | — | — |
| Manage trainers | ✅ | ✅ | — | — | — |
| Schedule classes | ✅ | ✅ | — | — | — |
| Check-in (QR/manual) | ✅ | ✅ | ✅ | — | — |
| Manage users | ✅ | — | — | — | — |
| Member portal | — | — | — | — | ✅ |

---

## Mobile Access (ngrok)

To expose the app to phones over the internet (any network):

### One-time setup

```bash
# Install ngrok, then:
ngrok config add-authtoken YOUR_TOKEN
```

### Start with public URL

Double-click `start-gymdesk.bat` — this starts Docker and ngrok together.

Or manually:

```bash
ngrok http --domain=YOUR-STATIC-DOMAIN.ngrok-free.app 3000
```

Your public URL will be something like `https://your-name.ngrok-free.app`.

The **📱 QR code button** in the top bar generates a scannable QR that opens the app and logs in as Reception automatically.

---

## Project Structure

```
gymawy/
├── db/
│   ├── database.js         # SQLite init + schema (CREATE TABLE)
│   └── seed.js             # Default accounts and plans
├── middleware/
│   └── auth.js             # JWT verify + requireRole helper
├── routes/
│   ├── auth.js             # Login, /me, password change
│   ├── members.js          # Member CRUD + QR generation
│   ├── subscriptions.js    # Subscription plan CRUD
│   ├── payments.js         # Cash/card payment recording
│   ├── stripe.js           # Stripe Payment Intent flow
│   ├── attendance.js       # Check-in (QR + manual)
│   ├── dashboard.js        # Stats, charts, user management
│   ├── trainers.js         # Trainer CRUD
│   ├── classes.js          # Class types + sessions + attendance
│   └── member-portal.js    # Member self-service routes
├── public/
│   ├── index.html          # Single-page app shell
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (cache-first shell)
│   ├── css/
│   │   └── style.css       # Full design system
│   ├── icons/              # PWA icons (192px, 512px)
│   └── js/
│       ├── api.js          # Fetch wrapper (all API calls)
│       ├── app.js          # Router, auth, sidebar, nav
│       ├── i18n.js         # English + Arabic translations
│       ├── stripe-loader.js
│       ├── jsqr.min.js     # QR decoder (served locally)
│       └── pages/          # One JS file per page
│           ├── dashboard.js
│           ├── members.js
│           ├── subscriptions.js
│           ├── attendance.js
│           ├── payments.js
│           ├── trainers.js
│           ├── classes.js
│           ├── users.js
│           └── member-portal.js
├── server.js               # Express entry point
├── Dockerfile
├── docker-compose.yml
├── START.bat               # Windows: start Docker
├── start-gymdesk.bat       # Windows: start Docker + ngrok
└── .env.example
```

---

## Database Schema (SQLite)

Tables: `users`, `members`, `subscription_plans`, `payments`, `attendance`, `trainers`, `class_types`, `class_sessions`, `class_attendance`, `notifications`

The schema is auto-created on first run — no migrations needed. The SQLite file is persisted in a Docker named volume (`gymdesk-db`) so data survives container restarts.

---

## Stripe Setup

1. Create a free account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Developers → API keys**
3. Copy your **Publishable key** and **Secret key** (use test keys: `pk_test_...` / `sk_test_...`)
4. Paste them into `docker-compose.yml` under the `STRIPE_*` environment variables
5. Rebuild: `docker compose up --build`

**Test card:** `4242 4242 4242 4242` — any future expiry, any CVC, any ZIP.

---

## Pulling Latest Changes (for teammates)

```bash
git pull origin main
docker compose down
docker compose up --build
```

The database is preserved in the Docker volume. Only code changes are applied.

---

## Contributing

1. Create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally with Docker
4. Open a pull request

For backend changes: edit files in `routes/` or `db/`.  
For frontend changes: edit files in `public/js/pages/` or `public/css/style.css`.  
No build step required — changes are served directly.
