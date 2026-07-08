# Katenovas Collections

An e-commerce website for a Nigerian fashion & lifestyle brand selling Clothes, Jewelry, Home Accessories, Shoes, and Bags — customers browse and check out online via Paystack (or via WhatsApp), and the owner manages products and orders through an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/web-app run dev` — run the website (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` — Paystack API keys (test mode)
- Required env: `ADMIN_USERNAME`, `ADMIN_PASSWORD` — admin login credentials
- Required env: `SESSION_SECRET` — signs the admin session cookie

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + `express-session` (server-side admin auth)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- Payments: Paystack (test mode, initialized server-side)
- Frontend: plain HTML/CSS/JS (no framework), served by Vite
- Build: esbuild (server), Vite (client)

## Where things live

- `artifacts/web-app/` — customer site + admin dashboard (index, products, cart, checkout, order-success, about, contact, policy pages, admin-login, admin-dashboard)
- `artifacts/web-app/app.js` — customer-facing logic (browsing, cart, checkout, WhatsApp checkout, order-success verification)
- `artifacts/web-app/admin.js` — admin login/session (server-backed) + product CRUD + orders management UI
- `artifacts/api-server/src/routes/products.ts` — product CRUD API (`/api/products`), write ops protected by `requireAdmin`
- `artifacts/api-server/src/routes/checkout.ts` — Paystack checkout (`POST /api/checkout/initialize`, `GET /api/checkout/verify/:reference`)
- `artifacts/api-server/src/routes/orders.ts` — admin-only orders API (`GET/PATCH /api/orders`)
- `artifacts/api-server/src/routes/admin.ts` — admin login/session/logout (`/api/admin/*`)
- `artifacts/api-server/src/middleware/requireAdmin.ts` — session-based admin auth guard
- `lib/db/src/schema/products.ts`, `lib/db/src/schema/orders.ts` — DB schemas (Drizzle)

## Architecture decisions

- Products live in Postgres (via the API); the shopping cart stays in the browser's `localStorage` per device — carts are not shared across devices, by design.
- Two checkout paths: (1) online payment via Paystack (test mode) at `/checkout.html`, which creates a pending order server-side, redirects to Paystack, then verifies payment on `/order-success.html`; (2) the original WhatsApp pre-filled-message checkout on the cart page, still available for customers who prefer it.
- Admin auth is server-side: `express-session` with a signed cookie (`kc_admin_sid`), checked via `requireAdmin` middleware. Product write routes (`POST/PUT/DELETE /api/products`) and all of `/api/orders` require an authenticated admin session.
- Product images are uploaded as base64 data URLs and stored directly in the database (no object storage).
- Orders store a snapshot of item name/price/qty at time of purchase, plus payment status (pending/success/failed) and a separate fulfilment status (Pending/Processing/Shipped/Delivered/Cancelled) editable by the admin.

## Product

- **Customers:** browse products by category (Clothes, Jewelry, Home Accessories, Shoes, Bags), search, add to cart, and either pay online via Paystack at checkout or place an order via a pre-filled WhatsApp message. Footer links to About, Contact, Privacy Policy, Terms & Conditions, Refund & Return Policy, and Shipping & Delivery Policy on every page.
- **Admin:** log in at `/admin-login.html` (server-verified session, not client-side), then manage Products (add/edit/delete) and Orders (search, view details, update fulfilment status) from tabs on `/admin-dashboard.html`. Changes appear on the live site immediately.

## User preferences

- WhatsApp order number: `2348025497647`
- Business address shown in footer/policies: `131, Upper Mission Extension, Aduwawa, Benin City, Edo State, Nigeria`
- Business email shown in footer/policies: `katenovascollections@gmail.com` (placeholder — confirm with owner and update sitewide if incorrect)

## Gotchas

- All `<script>` tags must keep `type="module"` — without it, Vite silently drops the JS file from the production build.
- Any DOM element created dynamically via `innerHTML` (product cards, cart rows, admin rows, order rows) must use `addEventListener`/event delegation, not inline `onclick="..."` — inline handlers can't see module-scoped functions.
- Product images are base64-encoded in the request body; the API's JSON body limit is raised to 10mb to accommodate them.
- After changing `artifacts/web-app/*.html` or JS, run `pnpm --filter @workspace/web-app run build` before publishing so the production bundle picks up the change.
- `lib/db/src/schema/*.ts` must import `z` from `"zod/v4"` (not `"zod"`) because `drizzle-zod` requires v4 typings; route files can keep using classic `"zod"`.
- Express 5 types `req.params.id` as `string | string[]` — wrap in `String()` before passing to Drizzle's `eq()`.
- Header/footer markup is duplicated per static HTML page (no templating) — when adding a new nav link or footer section, update it on every page.
- Adding a new static page requires registering it in `artifacts/web-app/vite.config.js` under `build.rollupOptions.input`, or Vite won't include it in the production build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
