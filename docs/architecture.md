# RestoFlow — Architecture

This document describes how RestoFlow is put together and why. It is updated at
the end of each development phase.

> **Status:** Phase 1 (foundation) complete. Sections marked *planned* describe
> the agreed design for later phases and will be confirmed as they are built.

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
| Django services (`apps/*/services.py`, planned) | business rules: pricing, order creation, WhatsApp message | live in views or serializers |
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
  (200 / 503). Deployment probes and the Phase 1 home page use it.

## 4. Frontend

- **Tooling:** Vite, React 19, TypeScript in strict mode (plus
  `noUncheckedIndexedAccess`), Tailwind CSS v4 with design tokens declared in
  `src/index.css`, ESLint and Prettier.
- **Routing:** React Router data router (`src/router.tsx`). Admin routes will be
  code-split so public visitors never download dashboard code.
- **Server state:** TanStack Query. Query functions live in `src/services`, and
  hooks wrap them. Components never call `fetch`.
- **Client state:** Zustand, for the cart only, persisted to `localStorage`
  (Phase 4).
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
| Catalog content (products, categories, …) | stored per language in the database (planned, Phase 2) and returned in the requested language |
| Direction | `<html dir>` and `<html lang>` follow the active language (`ar` → `rtl`) |
| Layout mirroring | Tailwind logical utilities (`ps-*`, `ms-*`, `text-start`, `start-*`) instead of left/right |
| Persistence | `localStorage` key `restoflow.language`; French is the default |

Arabic is a real right-to-left layout: the document direction flips, and so do
spacing, alignment and icon placement. It is not just right-aligned text. A
test makes sure every language has the same translation keys.

## 6. Ordering and WhatsApp flow *(planned, Phase 4)*

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
- The UI never says an order was "sent". It tells the customer to press
  **Send** in WhatsApp.
- New orders start as *initiated* (awaiting the WhatsApp message). Only staff
  can move an order to *confirmed* and beyond. Nothing is confirmed
  automatically.
- The WhatsApp message is built server-side in the customer's language, so the
  wording lives in exactly one place.

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
| 11 | Per-language columns for catalog translations (`name_fr`, `name_ar`, `name_en`) *(proposed for Phase 2)* | Three fixed languages: plain SQL, indexable, no extra dependency |
| 12 | Scoped rate limits for order creation and login | Basic abuse protection on the public endpoints |
