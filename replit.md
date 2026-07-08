# Katenovas Collections

An e-commerce website for a Nigerian fashion & lifestyle brand selling Clothes, Jewelry, Home Accessories, Shoes, and Bags — customers browse and order via WhatsApp, and the owner manages products through an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/web-app run dev` — run the website (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- Frontend: plain HTML/CSS/JS (no framework), served by Vite
- Build: esbuild (server), Vite (client)

## Where things live

- `artifacts/web-app/` — customer site + admin dashboard (index, products, cart, contact, admin-login, admin-dashboard)
- `artifacts/web-app/app.js` — customer-facing logic (browsing, cart, WhatsApp checkout)
- `artifacts/web-app/admin.js` — admin login + product CRUD UI
- `artifacts/api-server/src/routes/products.ts` — product CRUD API (`/api/products`)
- `lib/db/src/schema/products.ts` — product DB schema (Drizzle)

## Architecture decisions

- Products live in Postgres (via the API); the shopping cart stays in the browser's `localStorage` per device — carts are not shared across devices, by design.
- Checkout has no payment processor — it hands the cart off to WhatsApp as a pre-filled message to the store's number for the owner to confirm manually.
- Admin login is a hardcoded username/password checked client-side, with the session flag stored in `sessionStorage`. There is no real backend auth/authorization on the product API itself.
- Product images are uploaded as base64 data URLs and stored directly in the database (no object storage).

## Product

- **Customers:** browse products by category (Clothes, Jewelry, Home Accessories, Shoes, Bags), search, add to cart, and check out via a pre-filled WhatsApp message to place an order.
- **Admin:** log in at `/admin-login.html`, then add/edit/delete products (name, price, category, description, image, in-stock toggle) from `/admin-dashboard.html`. Changes appear on the live site immediately.

## User preferences

- WhatsApp order number: `2348025497647`

## Gotchas

- All `<script>` tags must keep `type="module"` — without it, Vite silently drops the JS file from the production build.
- Any DOM element created dynamically via `innerHTML` (product cards, cart rows, admin rows) must use `addEventListener`/event delegation, not inline `onclick="..."` — inline handlers can't see module-scoped functions.
- Product images are base64-encoded in the request body; the API's JSON body limit is raised to 10mb to accommodate them.
- After changing `artifacts/web-app/*.html` or JS, run `pnpm --filter @workspace/web-app run build` before publishing so the production bundle picks up the change.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
