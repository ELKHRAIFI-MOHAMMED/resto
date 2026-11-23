# RestoFlow — Architecture

This document describes how RestoFlow is put together and why. It is updated at
the end of each development phase.

> **Status:** complete (all 7 phases). Production setup: [deployment.md](deployment.md).

## 1. Overview

RestoFlow is the ordering website of **one** restaurant. Customers browse the
menu, build a cart and check out as guests. The order is saved by the backend,
then handed off to WhatsApp, where the customer sends it to the restaurant.
Staff manage the catalog, settings and orders from a private dashboard.

```
┌──────────────────────────┐        HTTPS (JSON)        ┌──────────────────────────┐
│  React SPA (Vite)        │  ───────────────────────▶  │  Django + DRF            │
│  - public site           │   /api/...                 │  - public API            │
│  - /admin dashboard      │  ◀───────────────────────  │  - /api/admin/ API       │
│  Zustand cart (local)    │   session cookie + CSRF    │  - business rules        │
└────────────┬─────────────┘                            └────────────┬─────────────┘
             │ wa.me/<number>?text=<message>                         │ ORM
             ▼                                                       ▼
      ┌─────────────┐                                         ┌─────────────┐
      │  WhatsApp   │  customer presses "Send"                │ PostgreSQL  │
      └─────────────┘                                         └─────────────┘
```

There is no microservice, message queue or payment gateway. Online payment and
multi-restaurant support are out of scope for this version.

## 2. Repository layout

```
restoflow/
├── backend/                 Django project
│   ├── config/              settings (base / development / production / test), urls, wsgi
│   ├── apps/
│   │   ├── core/            shared API infrastructure: pagination, error envelope, health
│   │   ├── accounts/        email-based staff users and roles
│   │   ├── restaurant/      restaurant profile, settings, opening hours
│   │   ├── categories/      menu categories
│   │   ├── products/        products, variants, add-ons, images
│   │   ├── delivery/        delivery zones and fees
│   │   └── orders/          orders, items, price snapshots, WhatsApp message
│   └── tests/               pytest suite
├── frontend/                React + TypeScript SPA
│   └── src/
│       ├── components/      reusable UI components
│       ├── layouts/         page shells (public, admin)
│       ├── pages/           route-level components
│       ├── features/        feature modules: menu, products, cart, checkout, admin
│       ├── hooks/           shared React hooks (TanStack Query wrappers, …)
│       ├── services/        API client and endpoint functions
│       ├── store/           Zustand stores (cart)
│       ├── i18n/            i18next setup, language helpers
│       ├── locales/         UI dictionaries: fr / ar / en
│       └── types/           shared TypeScript types
├── docs/                    project documentation
└── docker-compose.yml       local PostgreSQL
```

### Layering rules

| Layer | Owns | Must not |
| --- | --- | --- |
| Django models | data integrity, constraints | depend on HTTP |
| Django services (`orders/pricing.py`, `orders/services.py`, `orders/whatsapp.py`, `orders/dashboard.py`, `restaurant/services.py`) | business rules: pricing, order creation, status workflow, WhatsApp message, statistics | depend on DRF or HTTP |
| DRF serializers / views | input validation, HTTP, permissions | contain pricing logic |
| `frontend/src/services` | HTTP calls, error normalisation | touch the DOM |
| `frontend/src/features` | feature state and hooks | duplicate backend rules as authority |
| Components | rendering | fetch directly or compute prices |

## 3. Backend

- **Framework:** Django 5.2 LTS (supported until April 2028), Django REST Framework.
- **Settings:** split into `base`, `development`, `production` and `test`. All
  configuration comes from environment variables. In development they are read
  from the repository-level `.env` file, which Docker Compose and Vite share.
- **Apps:** one Django app per domain area, under `apps/`. `core` holds the
  cross-cutting pieces.
- **API conventions:**
  - JSON only in production; the browsable API is enabled in development.
  - Page-number pagination (`?page=`, `?page_size=` up to 100).
  - Filtering via `django-filter`, plus `?search=` and `?ordering=`.
  - Every error uses one envelope (see `apps/core/exceptions.py`):
    ```json
    { "error": { "code": "validation_error", "message": "Invalid input.", "details": { "phone": ["…"] } } }
    ```
  - `Accept-Language` selects the language (via `LocaleMiddleware`), so
    validation messages and translated catalog fields follow the UI language.
  - The OpenAPI 3 schema is at `/api/schema/` and Swagger UI at `/api/docs/`
    (drf-spectacular).
- **Health check:** `GET /api/health/` reports API and database status
  (200 / 503), for deployment probes.

## 4. Frontend

- **Tooling:** Vite, React 19, TypeScript in strict mode (plus
  `noUncheckedIndexedAccess`), Tailwind CSS v4 with design tokens declared in
  `src/index.css`, ESLint and Prettier.
- **Routing:** React Router data router (`src/router.tsx`): `/`, `/menu`
  (`?category=` and `?q=` live in the URL, so a filtered menu can be shared),
  `/menu/:slug`, `/cart`. Admin routes will be code-split so public visitors
  never download dashboard code.
- **Server state:** TanStack Query. Query functions live in
  `src/services/catalog.ts` and hooks wrap them (`src/hooks/useCatalog.ts`).
  Components never call `fetch`. Translated queries include the language in
  their key, so switching language refetches the content in that language.
- **Client state:** Zustand. The cart (`src/store/cart.ts`) is saved to
  `localStorage` and survives reloads and language changes. A line is
  identified by product, variant, add-ons and instructions; quantities are
  clamped to the backend limits (1-50). Toasts live in `src/store/toast.ts`.
- **Money:** API decimal strings are parsed into **integer centimes**
  (`src/lib/money.ts`), so sums never drift. Prices shown while browsing are
  estimates (`features/cart/pricing.ts`); the backend recomputes every total.
- **Feature folders:** `features/home` (homepage sections), `features/menu`
  (menu rows, category nav, grouping), `features/products` (options form),
  `features/cart` (add-to-cart hook, estimates). Pages in `src/pages` only
  assemble them.
- **SEO:** each page sets its `<title>`, meta description and Open Graph tags
  with React 19 document metadata. The homepage adds schema.org `Restaurant`
  JSON-LD built from live API data (`src/lib/structuredData.ts`).
- **API client** (`src/services/api.ts`): sends cookies, adds `X-CSRFToken` to
  unsafe requests, sends `Accept-Language`, and turns every failure into a typed
  `ApiError`.
- **Dev proxy:** Vite forwards `/api` and `/media` to Django, so in development
  the SPA and API share one origin. Cookies and CSRF behave as they will in
  production.

## 5. Internationalization

| Concern | Mechanism |
| --- | --- |
| UI strings | i18next dictionaries in `src/locales/{fr,ar,en}/common.json`; keys are type-checked against French |
| Catalog content (products, categories, zones, …) | `*_fr` / `*_ar` / `*_en` columns; the API returns the `Accept-Language` value, falling back to French (`apps/core/i18n.py`) |
| Direction | `<html dir>` and `<html lang>` follow the active language (`ar` → `rtl`) |
| Layout mirroring | Tailwind logical utilities (`ps-*`, `ms-*`, `text-start`, `start-*`) instead of left/right |
| Persistence | `localStorage` key `restoflow.language`; French is the default. A `?lang=ar` link overrides the saved choice |
| Plurals | i18next plural keys; Arabic defines all six forms (`_zero` to `_other`) |
| Numbers and dates | Latin digits in every language; weekday names and number formats from `Intl` |
| Bidirectional text | prices wrapped in `<bdi>`; time ranges and phone numbers forced `dir="ltr"` inside Arabic text |

Arabic is a real right-to-left layout: the document direction flips, and so do
spacing, alignment and icon placement. It is not just right-aligned text. A
test makes sure every language has the same translation keys.

## 5b. Design system

The visual identity is anchored in Casablanca's Art Deco architecture and
Moroccan craft, on the palette fixed by the brief.

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#111111` | page |
| `surface` / `surface-raised` | `#1C1C1C` / `#252321` | bands, inputs, toasts |
| `border` | `#2E2B28` | hairlines, dividers |
| `accent` | `#C89B5C` | prices, primary actions, active states only |
| `foreground` / `muted` | `#F8F5EF` / `#A8A29E` | text (both pass WCAG AA on the background) |

Typography (self-hosted with Fontsource, split into Unicode subsets so a
visitor only downloads the scripts they see):

| Role | Latin | Arabic |
| --- | --- | --- |
| Display | Italiana, a high-contrast Deco face | Reem Kufi, geometric Kufi |
| Text and UI | Jost, a Futura revival (1927) | Noto Naskh Arabic |

The browser falls back per character: an Arabic dish name inside a Latin
heading renders in Reem Kufi automatically. Sizes follow Bringhurst's classic
scale (14, 16, 18, 21, 24, 36, 48, 60, 72); Arabic gets a slightly larger base
size and line height.

Signature elements, used sparingly:

- **The arch.** A tall Moroccan window with a brass outline frames food
  photography, on the hero and the product page only (`components/ArchImage.tsx`).
- **The printed menu.** Dish rows and the category board use dotted leaders
  between name and price.
- **The zellige star.** An eight-point star is the placeholder for dishes
  without a photo.

Motion: one page-load reveal of the hero arch, plus feedback to user actions
(toasts, hover states). `prefers-reduced-motion` disables animations.
Accessibility: a skip link, visible focus, landmarks, labelled controls,
`aria-live` for toasts and search results, and 44 px minimum touch targets.

## 6. Ordering and WhatsApp flow

```
Customer        React SPA                      Django API                    PostgreSQL
   │  checkout     │                               │                              │
   │──────────────▶│ POST /api/orders/             │                              │
   │               │  (product ids, variant/addon  │                              │
   │               │   ids, quantities, customer)  │                              │
   │               │──────────────────────────────▶│ validate availability,       │
   │               │                               │ recompute every price,       │
   │               │                               │ delivery fee, minimum order  │
   │               │                               │── atomic transaction ───────▶│ order + item
   │               │                               │                              │ snapshots
   │               │◀──────────────────────────────│ reference, totals, message   │
   │               │ build wa.me URL               │                              │
   │◀──────────────│ (encodeURIComponent)          │                              │
   │ opens WhatsApp, must press "Send"             │                              │
```

Rules:

- The client sends **identifiers and quantities only**. Prices sent by the
  client are ignored, and the backend computes the authoritative total.
- The order is saved **before** WhatsApp opens. If WhatsApp fails to open, the
  customer keeps the order reference and gets a retry button.
- The order page (`/order/:reference`) keeps the hand-off for 24 hours in the
  browser (`store/lastOrder.ts`): it offers to reopen WhatsApp, copy the
  message, or send it manually to the displayed number, and survives reloads.
- The UI never says an order was "sent". It tells the customer to press
  **Send** in WhatsApp.
- New orders start as *initiated* (awaiting the WhatsApp message). Only staff
  can move an order to *confirmed* and beyond. Nothing is confirmed
  automatically.
- The WhatsApp message is built server-side in the customer's language, so the
  wording lives in exactly one place (`apps/orders/whatsapp.py`). Customer text
  is flattened to a single line, so it cannot fake extra message lines.
- `POST /api/orders/quote/` runs the same pricing without saving anything. The
  cart and checkout show authoritative totals and per-item errors without
  copying any pricing rule into the frontend.
- Reference numbers (`RF-<year>-<seq>`) come from a per-year counter row
  locked inside the order transaction.
- Staff move orders through a type-aware workflow
  (`pending → confirmed → preparing → ready | out_for_delivery → completed`,
  or `cancelled`). Invalid transitions return 409.

### How WhatsApp is opened

Browsers only allow new tabs during a user action, but the order must be
saved before WhatsApp opens. `features/checkout/usePlaceOrder.ts` therefore:

| Device | Hand-off |
| --- | --- |
| Desktop (fine pointer) | Opens an empty tab **inside the click**, saves the order, then points that tab at `wa.me` (with `opener` cleared). If the order fails, the tab is closed. If pop-ups are blocked, the order page offers the button. |
| Phone or tablet (coarse pointer) | Saves the order, navigates to the order page, which hands off in the same tab (`location.assign`): the OS opens the WhatsApp app, and Back returns to the order page. |

The URL is `https://wa.me/<digits>?text=<encodeURIComponent(message)>`
(`features/checkout/whatsapp.ts`), with the number and message returned by
the API.

### Cart, quote and checkout

- The cart page asks the API for a quote without an order type: exact
  subtotal, flagged lines (`product_unavailable`, `variant_invalid`, …), and
  stored prices and names refreshed when they changed (the customer is told).
- The checkout quotes again whenever the order type or zone changes, showing
  the delivery fee, the free-delivery threshold and the minimum order before
  submitting. Client-side validation mirrors the backend rules for instant,
  translated feedback; backend field errors map back onto the same fields.
- Every API error code has a translated message (`features/checkout/errors.ts`).
- Each cart line has an Edit link to `/menu/<slug>?edit=<line key>`: the product
  form opens on the line's size, extras, quantity and notes (options that no
  longer exist are dropped) and `replaceLine` swaps it in place, merging it
  with an identical line if there is one. A stale key simply opens the normal
  add-to-cart form.

## 6b. Administration dashboard

`/admin/*` is a separate, lazily loaded chunk (`features/admin/AdminApp.tsx`,
about 15 KB gzipped) with its own layout; public visitors never download it.

| Page | What staff do there |
| --- | --- |
| Login | Session login (CSRF cookie first, then `POST /api/auth/login/`); rate limited server-side |
| Dashboard | Initiated vs confirmed orders, confirmed revenue, available products, orders by status, popular dishes, orders-per-day bar chart (single series, brand accent, hover values, table view) |
| Orders | Filter by status, type, dates; search reference, name or phone; auto-refresh every 30 s. Detail page shows snapshots and the received WhatsApp message, offers only the transitions the backend allows, and links to reply on WhatsApp |
| Products | List with quick switches (available today, active, featured); editor with FR/AR/EN fields, prices, add-ons, image, sizes and gallery |
| Extras, categories, zones | One generic table + modal form (`CrudPage.tsx`); categories add reordering and images |
| Settings | Owner only: restaurant profile, WhatsApp number, ordering switches, fees, social links, weekly opening hours with several slots per day |

Rules: every admin request goes through the same API client (session cookie,
CSRF header); the route guard (`RequireStaff`) is a convenience, the API is
the authority (403 for anyone else). Order confirmation is always a manual
action, with a reminder to wait for the customer's WhatsApp message.
Images are uploaded with a separate multipart request after the JSON save.

## 6b2. Offers (packs)

- `apps/offers`: an offer has a fixed price and groups ("pick 3 among these
  dishes"). `current_offers()` is shared by the public API and pricing, so an
  offer outside its dates can neither be shown nor ordered.
- Pricing (`orders/pricing.py`) treats an offer line like a product line:
  validated from the database, priced at the offer price, snapshotted with
  its picks (`OrderItemChoice`) in the order's language.
- Frontend: `/offres/:slug` (lazy chunk) with a picker per group; cart lines
  carry `offerId` and `choices`, are keyed by offer + picks + notes, and can
  be edited like product lines. Offers show on the home page and at the top
  of the menu. Admin → Offers edits the rules (groups, dishes per category,
  price, dates).

## 6c. Couriers and dispatch

- Couriers are `User` rows with role `courier` (never staff) plus a `Courier`
  profile (phone, zones, on-duty flag). They log in through the same
  endpoint; `/admin` redirects them to `/livreur`, and the API checks roles
  on every request (`IsCourier`, `IsStaff`).
- `apps/orders/dispatch.py` holds the rules: manual assignment, automatic
  choice (zone, on duty, fewest active deliveries, longest wait), pick-up and
  delivery transitions. Auto-assignment runs when staff confirm a delivery
  order, if enabled in Settings.
- `/livreur/*` is its own lazy chunk (`features/courier/`), mobile first, with
  the amount to collect, call / WhatsApp / directions links and a 20 s
  refresh.

## 6d. Light mode

The palette is CSS variables; `:root[data-theme='light']` swaps them for a
cream and bronze set (all text pairs ≥ 4.5:1). `public/theme-init.js` applies
the saved choice (`localStorage['restoflow.theme']`) before first paint, as
an external script so the CSP needs no inline exception. Dark stays the
default.

## 7. Key decisions

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | Monorepo with `backend/` and `frontend/` | One clone, one history, and API and UI change together |
| 2 | Django 5.2 **LTS** over the latest 6.x | Long security support for a real restaurant deployment |
| 3 | **Session authentication + CSRF** for the admin, not JWT | The token stays in an HttpOnly cookie that XSS can't read, with no refresh-token logic; it suits a same-site SPA |
| 4 | **Deny by default** (`IsAuthenticated`), public endpoints opt in with `AllowAny` | A forgotten permission fails closed |
| 5 | Custom `User` model (email login, `owner` / `manager` roles) created before the first migration | Changing `AUTH_USER_MODEL` later is very costly |
| 6 | Django admin moved to `/django-admin/` (configurable) | `/admin/*` belongs to the React dashboard |
| 7 | Single `.env` at the repository root | One source of configuration for Django, Docker and Vite (Vite only exposes `VITE_*`) |
| 8 | PostgreSQL in Docker, apps run natively | Fast reloads, with production parity for the database |
| 9 | `DecimalField` and `Decimal` end to end; the API serialises money as strings | No floating-point rounding errors on prices |
| 10 | Order lines store name and price **snapshots** | Editing or deleting a product never rewrites past orders |
| 11 | Per-language columns for catalog translations (`name_fr`, `name_ar`, `name_en`), French required, others fall back | Three fixed languages: plain SQL, searchable in every language, no extra dependency |
| 12 | Scoped rate limits for order creation and login | Basic abuse protection on the public endpoints |
| 13 | Services raise a framework-agnostic `BusinessRuleError`, converted to the error envelope in one place | Business rules stay testable without HTTP, and error codes stay consistent |
| 14 | Business-invariant `CHECK` constraints (totals, sale price, quantities, singleton) | Integrity holds even for writes that bypass Django validation |
| 15 | Public endpoints skip authentication; admin endpoints use sessions | Public calls need no CSRF token; admin calls are always CSRF-checked, and login is wrapped in `csrf_protect` |
| 16 | WhatsApp templates are per-language dictionaries in code, and API errors expose stable `code`s for the frontend to translate (no gettext catalogues) | No gettext toolchain to install; each wording lives in one place |
| 17 | `is_active` (hidden) is separate from `is_available` (shown as unavailable) | Matches how restaurants work: a dish can be sold out today and still appear on the menu |
| 18 | Native form controls styled with Tailwind; shadcn/ui not added for the public site | The public pages need few widgets; semantic HTML keeps the bundle small and accessible. shadcn/ui will be considered for the admin dashboard |
| 19 | The whole menu is fetched once (following pagination); category filtering happens on the client, search goes to the API | Switching categories is instant, and search stays multilingual (names and descriptions in all three languages) |
| 20 | Demo photos are Unsplash stock photos stored in `backend/demo/images` and attached by `seed_demo`; dishes without a matching photo keep the placeholder | A realistic demo without passing off unrelated photos as dishes |
| 21 | Idempotent order creation through a client-generated `client_token` (unique in the database) | Mobile connections drop; a retry must never create a second order |
| 22 | The quote endpoint accepts a cart without an order type | The cart shows exact, server-checked amounts before the customer chooses delivery or pickup, with no pricing logic in React |
| 23 | Pre-opened tab on desktop, same-tab hand-off on phones | Works with pop-up blockers, keeps the order saved first, and keeps Back working on phones |
| 24 | Persistent database connections (`CONN_MAX_AGE`) only in production | The dev server opens one thread per request; persistent connections there exhaust PostgreSQL's client limit |
| 25 | The admin is a lazy chunk with descendant routes, and shares components, API client and i18n with the public site | One codebase and design language, without making visitors download back-office code |
| 26 | Admin dashboards use lining figures (Jost) rather than the display face | Italiana's old-style numerals read poorly as data |
| 27 | Admin strings in separate locale files, registered when the admin chunk loads; menu, product, checkout and order pages lazily loaded | Visitors download neither back-office code nor back-office text |
| 28 | `robots.txt` and `sitemap.xml` generated by Django from the live menu (`PUBLIC_SITE_URL`), with `hreflang` alternates | Search engines need absolute URLs and an up-to-date list of dishes in three languages |
| 29 | Database cache in production | Rate limits must be shared by all Gunicorn workers; no Redis to operate |
| 30 | axe-core checks in the unit test suite | Accessibility regressions fail the build, in both reading directions |
| 31 | Three containers (Postgres, Gunicorn + WhiteNoise, nginx) with health checks; migrations on start | One-server deployment a restaurant can afford, without a separate static host or cache server |
| 32 | nginx serves uploads directly from a read-only volume, images only, under a sandboxing CSP | Fast media without letting an uploaded file ever execute |
| 33 | The private Django admin path must live under `/django-admin/` | A single prefix for nginx to forward, enforced at start-up so the admin cannot become unreachable |
