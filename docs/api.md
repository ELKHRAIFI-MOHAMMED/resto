# RestoFlow — API reference

Base path: `/api/`. The interactive OpenAPI documentation is served at
`/api/docs/` (Swagger UI) and `/api/schema/` (OpenAPI 3 YAML). This page
summarises the conventions and the main flows.

## Conventions

| Topic | Rule |
| --- | --- |
| Format | JSON. Uploads use `multipart/form-data`. |
| Language | `Accept-Language: fr \| ar \| en` selects translated fields and error messages (default `fr`) |
| Money | strings with 2 decimals, e.g. `"65.00"`; currency in the `currency` field (`MAD`) |
| Pagination | `?page=` and `?page_size=` (max 100) → `{count, next, previous, results}`. Small lists (categories, zones, hours, variants, images) are not paginated. |
| Search | `?search=` on list endpoints that support it |
| Ordering | `?ordering=field` or `?ordering=-field` |
| Auth | Session cookie + CSRF header, for `/api/admin/*` and logout only |
| Rate limits | anonymous 120/min, order creation 10/min, login 5/min (configurable) |

### Errors

Every error uses the same envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input.",
    "details": { "customer_phone": ["Enter a valid phone number."] }
  }
}
```

`code` is stable and safe for the frontend to translate. Common codes:

| HTTP | code | Meaning |
| --- | --- | --- |
| 400 | `validation_error` | field errors in `details` |
| 400 | `invalid_items` | some cart lines are invalid, see `details.items[]` |
| 400 | `delivery_zone_required`, `delivery_zone_invalid`, `minimum_order_not_met`, `order_type_unavailable`, `empty_order` | order rules |
| 403 | `not_authenticated`, `permission_denied` | auth |
| 404 | `not_found` | |
| 409 | `ordering_closed`, `whatsapp_not_configured` | the restaurant cannot take orders |
| 409 | `invalid_status_transition` | status change not allowed |
| 409 | `protected` | the item is still referenced (e.g. a category with products) |
| 429 | `throttled` | `details.retry_after_seconds` |

Item-level codes in `details.items[]`: `product_not_found`,
`product_unavailable`, `variant_required`, `variant_invalid`, `addon_invalid`.

## Public endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health/` | API and database status (200 / 503) |
| GET | `/restaurant/` | Restaurant profile, ordering settings, `is_open_now` |
| GET | `/restaurant/hours/` | Opening slots |
| GET | `/categories/` | Active categories with `product_count` |
| GET | `/products/` | Menu products. Filters: `category` (slug), `featured`, `available`; `search`; `ordering=price\|-price\|created_at` |
| GET | `/products/{slug}/` | Product with active variants, add-ons and gallery |
| GET | `/delivery/zones/` | Active delivery zones |
| POST | `/orders/quote/` | Price a cart without saving it |
| POST | `/orders/` | Place an order (returns the WhatsApp hand-off data) |

### Product (list item)

```json
{
  "id": 4,
  "slug": "tacos-poulet",
  "name": "Tacos Poulet",
  "description": "Poulet mariné, frites, sauce fromagère gratinée.",
  "category": { "id": 2, "slug": "tacos", "name": "Tacos" },
  "price": "45.00",
  "sale_price": null,
  "effective_price": "45.00",
  "is_on_sale": false,
  "image": "http://localhost:5173/media/products/3f2a….webp",
  "is_available": true,
  "is_featured": true,
  "has_options": true
}
```

`has_options` is true when the product has variants to pick or add-ons to
offer: the menu should then open the product detail instead of adding the
product straight to the cart.

### Offers (packs)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/offers/` | Current offers (active, within their optional `starts_on`/`ends_on` dates) with their groups: `{id, name, quantity, products: [{id, slug, name, image, is_available, variant_name}]}` |
| GET | `/offers/{slug}/` | One current offer (404 otherwise) |

A dish picked in an offer is served in its first active size (`variant_name`),
without extras; the offer price covers everything. An order item is either a
product or an offer:

```json
{"offer": 1, "quantity": 1, "special_instructions": "",
 "choices": [{"group": 1, "products": [4, 4, 6]}, {"group": 2, "products": [10, 10, 11]}]}
```

Each group must be present once, with exactly `quantity` product ids (repeats
allowed) taken from that group. Item error codes: `offer_not_found`,
`offer_choices_invalid`, `offer_choice_unavailable`. Quotes and saved orders
return the picks as `choices: [{group_name, product, product_name, quantity}]`,
and the WhatsApp message lists them under the offer line
(`   Plats: 2x Tacos Poulet (M), 1x Pizza Margherita (Moyenne)`).

### Placing an order

The client sends **identifiers and quantities only**. Any price fields are
ignored, and the backend recomputes everything.

```http
POST /api/orders/
Accept-Language: fr
Content-Type: application/json
```

```json
{
  "order_type": "delivery",
  "delivery_zone": 1,
  "customer_name": "Mohamed",
  "customer_phone": "06 12 34 56 78",
  "delivery_address": "5 rue Test",
  "city": "Casablanca",
  "customer_notes": "Interphone 3",
  "client_token": "5f0c6f1e-2b1a-4d7e-9a53-3d2f0c1b7a10",
  "items": [
    { "product": 2, "quantity": 2, "addons": [1], "special_instructions": "" },
    { "product": 4, "quantity": 1, "variant": 9, "special_instructions": "Sans oignons" }
  ]
}
```

Rules:

- `order_type` is `delivery` or `pickup`. Delivery requires `delivery_zone`,
  `delivery_address` and `city`.
- `customer_phone` accepts Moroccan formats (`06…`, `07…`, `05…`, `+212…`,
  `00212…`) and other international numbers. It is stored as `+<digits>`.
- Each line takes `quantity` 1–50; there are at most 50 lines.
- When a product has active variants, `variant` is required. `addons` must be
  active add-ons offered on that product, each selected once.
- Delivery fee: the zone's fee, or 0 when the subtotal reaches the
  restaurant's `free_delivery_threshold`. The minimum subtotal for delivery is
  the higher of the zone's and the restaurant's minimum. Pickup has no fee and
  no minimum.
- `client_token` (optional UUID) makes the request safe to retry: sending the
  same token again returns the order already created, with `200 OK` instead
  of `201`, rather than a duplicate. The frontend generates one per checkout
  attempt, so a dropped connection never produces two orders.

Response `201 Created`:

```json
{
  "reference": "RF-2026-0001",
  "status": "pending",
  "order_type": "delivery",
  "items": [
    {
      "product": 2,
      "product_name": "Double Cheese Burger",
      "product_price": "65.00",
      "variant_name": "",
      "variant_price": "0.00",
      "addons": [{ "id": 1, "addon": 1, "addon_name": "Supplément fromage", "addon_price": "8.00" }],
      "quantity": 2,
      "unit_price": "73.00",
      "line_total": "146.00",
      "special_instructions": ""
    }
  ],
  "subtotal": "206.00",
  "delivery_fee": "15.00",
  "total": "221.00",
  "currency": "MAD",
  "language": "fr",
  "whatsapp": {
    "phone": "212600000000",
    "message": "Bonjour ! Je souhaite passer une commande.\n\nRéférence de commande: RF-2026-0001\n…"
  }
}
```

The frontend opens
`https://wa.me/{whatsapp.phone}?text={encodeURIComponent(whatsapp.message)}`.
The order is already saved as `pending`. It is **not** confirmed: the customer
must press Send in WhatsApp, and staff confirm the order by hand.

`POST /orders/quote/` takes `items` and optionally `order_type` and
`delivery_zone`, and returns the same amounts (`items`, `subtotal`,
`delivery_fee`, `total`, `free_delivery_applied`, `minimum_order_amount`)
without saving anything. Without `order_type` (the cart page) only the items
are validated and priced; delivery rules apply once a type, and for delivery a
zone, are given. Item problems come back as `invalid_items` with
`details.items[]`, so the cart can flag the exact lines.

## Authentication

| Method | Path | Description |
| --- | --- | --- |
| GET | `/auth/csrf/` | Sets the `csrftoken` cookie (204) |
| POST | `/auth/login/` | `{email, password}` with the `X-CSRFToken` header; returns the user and sets the HttpOnly `sessionid` cookie |
| POST | `/auth/logout/` | 204 |
| GET | `/auth/me/` | Current user: `{id, email, first_name, last_name, role, is_owner, is_courier}` |

Only active staff and courier accounts can log in. Every failure returns the same
`Invalid email or password.` message, so the endpoint never reveals which
emails exist.

## Admin endpoints (`/api/admin/`)

All admin endpoints require an active staff session. Unsafe methods also need
the `X-CSRFToken` header.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `dashboard/?days=30` | Order totals, confirmed count, revenue (confirmed and not cancelled), counts by status, product counts, top 5 products, daily series |
| GET | `orders/` | Filters: `status` (repeatable), `order_type`, `delivery_zone`, `date_from`, `date_to` (YYYY-MM-DD), `confirmed`; `search` on reference, name or phone; `ordering=created_at\|total\|status` |
| GET | `orders/{id}/` | Full detail with snapshots, WhatsApp message and `allowed_statuses` |
| PATCH | `orders/{id}/status/` | `{status}`. Manual workflow; an invalid transition returns 409 |
| CRUD | `products/` | All translations, `addons` as a list of IDs, `image` via multipart (`null` clears it). Filters: `category`, `is_active`, `is_available`, `is_featured` |
| CRUD | `products/{id}/variants/` | Variants of a product |
| CRUD | `products/{id}/images/` | Gallery images (multipart) |
| CRUD | `addons/` | Shared add-ons |
| CRUD | `offers/` | Offers with their rules written together: `groups: [{name_fr, name_ar, name_en, quantity (1–20), products: [ids]}]` (1–10 groups, replaced as a whole on update), `price`, `starts_on`, `ends_on`, `is_active`; `image` via multipart. Unpaginated |
| CRUD | `categories/` | Deleting a category that has products returns 409 `protected` |
| POST | `categories/reorder/` | `{ids: [3, 1, 2]}` sets the display order |
| CRUD | `delivery/zones/` | Delivery zones |
| GET, PATCH | `settings/` | **Owner only.** Restaurant profile and ordering settings; `whatsapp_number` is normalised (e.g. `+212 6 12…` → `212612…`) |
| CRUD | `couriers/` | Courier accounts: `{email, first_name, last_name, phone, zones: [ids], is_on_duty, is_active, password}` (password write-only); `active_orders` is read-only. Deleting removes the login |
| PATCH | `orders/{id}/courier/` | `{courier: id \| null}` assigns or unassigns a delivery order (409 if it is not a delivery, is closed, already picked up, or the courier is inactive) |
| POST | `orders/{id}/auto-assign/` | Picks the on-duty courier of the order's zone with the fewest active deliveries; 409 `no_courier_available` |
| GET, PUT | `settings/hours/` | **Owner only.** PUT `{hours: [{weekday, opens_at, closes_at, is_closed}]}` replaces the whole week |

## Courier endpoints (`/api/courier/`)

Courier session required (staff get 403). A courier only ever sees the orders
assigned to them; any other ID returns 404.

| Method | Path | Notes |
| --- | --- | --- |
| GET, PATCH | `me/` | Profile and zones; only `is_on_duty` is writable |
| GET | `orders/?scope=active\|done` | Assigned deliveries (done = last completed/cancelled) |
| GET | `orders/{id}/` | Address, phone, items, notes, amount to collect |
| POST | `orders/{id}/pickup/` | `confirmed`/`preparing` → `out_for_delivery`, sets `picked_up_at` |
| POST | `orders/{id}/deliver/` | `out_for_delivery` → `completed`, sets `delivered_at` |

### Automatic dispatch

When staff confirm a delivery order that has no courier and the restaurant
setting `auto_assign_couriers` is on, the order goes to an on-duty courier
serving its zone, the one with the fewest active deliveries (ties: the one
who waited longest). If nobody is available the order stays unassigned and
staff assign it by hand. Confirmation itself always remains a manual action.

### Order status workflow

```
pending ──▶ confirmed ──▶ preparing ──▶ out_for_delivery ──▶ completed   (delivery)
             confirmed ─────────────────▶ out_for_delivery              (courier pick-up)
                                    └─▶ ready ─────────────▶ completed   (pickup)
any non-final status ──▶ cancelled
```

`completed` and `cancelled` are final. `confirmed_at` is set the first time an
order is confirmed.

### Uploads

Images only (`jpg`, `jpeg`, `png`, `webp`), verified with Pillow. Limits:
5 MB (`MAX_IMAGE_UPLOAD_SIZE`) and 6000 px per side. Files are stored under
random UUID names.
