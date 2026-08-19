# Katenovas Collections — First Launch Production Fix & Hardening

You are working on an existing full-stack e-commerce application called **Katenovas Collections**.

This is NOT a request to rebuild the application from scratch.

Your job is to **inspect the existing codebase carefully, understand its current architecture, then make targeted changes to prepare it for its first real launch**.

The application already has a customer storefront, product catalogue, search/filtering, cart, checkout, Paystack integration, WhatsApp ordering, admin dashboard, order management, email functionality, and an AI shopping assistant called Kena.

Preserve the existing visual design, branding, working functionality, routes, database structure, and UX wherever possible. Do not replace working systems merely because you prefer a different implementation.

## 1. FIRST: AUDIT THE EXISTING CODE BEFORE CHANGING IT

Before making changes:

- Inspect the complete frontend.
- Inspect the complete API/backend.
- Inspect database/schema definitions and storage logic.
- Inspect authentication/session logic.
- Inspect admin authorization.
- Inspect product CRUD.
- Inspect cart behavior.
- Inspect checkout and Paystack initialization.
- Inspect Paystack verification.
- Inspect order creation/update logic.
- Inspect WhatsApp ordering.
- Inspect email/order notifications.
- Inspect Kena/AI chat.
- Inspect environment-variable usage.
- Inspect deployment configuration.
- Inspect package scripts and TypeScript/build configuration.

Run whatever safe tests, type checks, build checks, lint checks, and API checks are available.

Do not modify files during the initial inspection until you understand the current implementation.

After inspection, implement the fixes below.

---

# 2. CRITICAL: FIX CHAT HTML/XSS HANDLING

The customer AI chat currently renders user/assistant message content in a way that can interpret HTML.

Fix this completely.

Requirements:

- Never insert raw customer-controlled chat content into the DOM as HTML.
- Treat all chat messages as plain text unless there is a deliberate, sanitized Markdown renderer.
- User input such as `<script>`, `<img onerror=...>`, HTML tags, event handlers, and JavaScript URLs must be rendered harmlessly as text.
- Preserve normal line breaks and readable chat formatting.
- Do not disable the chatbot.
- Do not remove Kena.
- Make sure both user messages and AI responses are safe.
- Check every other place where chat content is rendered and apply the same principle.

Acceptance test:

A message containing malicious HTML/JavaScript must display as harmless text and must never execute.

---

# 3. CRITICAL: ENFORCE REAL INVENTORY / STOCK ON THE SERVER

The application has product availability and stock quantity.

The server must be authoritative for inventory.

Do not rely on frontend/localStorage validation.

Implement:

- If a product is unavailable, checkout must reject it.
- If a product has a finite stock quantity, requested quantity must not exceed available stock.
- Reject zero or negative quantities.
- Reject invalid/non-numeric quantities.
- Validate every cart line item server-side.
- Fetch the latest product information from the database during checkout.
- Never trust price, availability, stock, or product information supplied by the browser.
- Calculate the authoritative order total on the server.
- Return a useful customer-facing error when stock has changed.
- Prevent a customer from manipulating the frontend to purchase unavailable inventory.

If the existing application supports a boolean “in stock” field and a stock count, keep their intended meaning consistent.

Important:

Do not simply add a frontend quantity limit.

The API/backend must enforce the rule.

---

# 4. CRITICAL: DECIDE AND FIX SIZE/COLOR HANDLING

Inspect the current product model and UI.

Products may contain size and color information, but the current cart/order representation may only contain product ID and quantity.

This creates a potential real-world problem for clothing/products with variants.

Do one of the following based on the existing architecture:

### Preferred option
Implement proper product variant selection:

- Customer can select available size(s).
- Customer can select available color(s).
- Selected variant is stored in the cart.
- Selected variant is sent through checkout.
- Selected variant is stored in the order.
- Selected variant is included in WhatsApp order messages.
- Order admin displays the selected variant.
- Stock validation understands the selected variant if the data model supports per-variant stock.

OR:

### Temporary first-launch option
If the current database is not capable of safely supporting variant-level inventory, do not create a half-working variant system.

Instead:

- Remove/hide unsupported size/color claims from the customer purchase flow.
- Keep the data model untouched where practical.
- Make it clear that those fields are not currently selectable.

Do NOT allow customers to think they selected a size/color when the order system does not record it.

Choose the safer implementation after inspecting the current schema.

---

# 5. CRITICAL: SECURE THE PUBLIC PAYMENT VERIFICATION RESPONSE

Inspect the Paystack verification endpoint and the public payment-success flow.

The public payment verification route must NOT expose unnecessary customer PII.

The customer-facing verification response should contain only information actually required by the success page, such as:

- payment/order status
- public order/reference ID
- amount
- basic success information
- customer name only if genuinely needed

Do NOT return the full private order record to an unauthenticated client.

Do not expose:

- full address
- phone number
- email
- private admin notes
- internal payment metadata
- unnecessary database fields
- other sensitive customer information

The admin dashboard must retain access to the full order information through authenticated routes.

Make sure changing the response does not break the existing success page.

---

# 6. HIGH: MAKE PAYSTACK CALLBACK/REDIRECT HANDLING SERVER-SAFE

Inspect how the checkout callback URL is constructed.

Do not blindly trust arbitrary callback URLs supplied by the browser.

The server should determine or allowlist the legitimate storefront callback URL.

Requirements:

- Prevent arbitrary external callback/redirect destinations.
- Preserve the current Paystack flow.
- Support local development and production where appropriate.
- Keep the callback configurable through environment configuration if necessary.
- Never hardcode secrets.

After changing this, verify that Paystack initialization still works.

---

# 7. HIGH: IMPROVE PRODUCT/API ERROR HANDLING

The storefront should distinguish between:

1. A genuinely empty catalogue.
2. A temporary API/database/network failure.

Do not silently convert API failures into “no products”.

Implement:

- loading state
- empty-catalogue state
- API failure state
- retry option
- useful console logging for developers
- user-friendly error messages

Do not expose sensitive backend error details to customers.

---

# 8. HIGH: CLEAN AND VALIDATE LOCAL CART DATA

The cart is persisted in browser storage.

Implement cart reconciliation whenever current products are loaded.

Requirements:

- Remove cart entries for products that no longer exist.
- Remove cart entries for products that can no longer be purchased.
- Remove invalid quantities.
- Normalize quantities to safe positive integers.
- Prevent impossible/stale cart states.
- Keep the cart badge synchronized with the actual usable cart.
- Avoid a situation where the UI says the cart contains items that no longer exist.

Do not destroy valid carts unnecessarily.

---

# 9. HIGH: REVALIDATE INVENTORY BEFORE CHECKOUT

Before payment begins:

- Refresh/revalidate product availability and pricing from the server.
- Confirm every cart item still exists.
- Confirm every item is purchasable.
- Confirm every quantity is valid.
- Confirm every quantity is within available stock.
- Confirm the final server-calculated total.

If something changed:

- Do not initialize Paystack.
- Clearly tell the customer what changed.
- Let them update their cart and retry.

The browser should never be treated as the source of truth for final pricing or inventory.

---

# 10. HIGH: HANDLE FAILED PAYMENT INITIALIZATION CLEANLY

Inspect the current sequence:

1. Create order.
2. Initialize Paystack.
3. Payment.
4. Verify payment.

If order creation occurs before Paystack initialization and Paystack initialization fails, do not leave ambiguous abandoned records that look like legitimate active orders.

Choose a clean approach based on the existing schema:

- mark such orders as abandoned/failed, OR
- delete the temporary order if safe, OR
- use another transaction-safe approach.

Do not lose legitimate paid orders.

Make the order/payment state machine explicit and consistent.

At minimum distinguish sensible states such as:

- pending
- paid/successful
- failed
- abandoned/cancelled where needed

Do not redesign the whole order system unnecessarily.

---

# 11. HIGH: REVIEW PAYMENT VERIFICATION FOR DUPLICATE PROCESSING

Payment verification/webhook handling must be idempotent.

If the same Paystack transaction/reference is verified more than once:

- do not create duplicate orders
- do not send duplicate customer emails
- do not send duplicate admin notifications
- do not decrement stock multiple times
- do not incorrectly change an already-paid order

Check existing order/payment records before applying side effects.

This is extremely important for a real payment system.

---

# 12. HIGH: MAKE STOCK DECREMENT SAFE

After successful payment, inventory should update in a controlled way.

Implement stock reduction only after confirmed successful payment.

Requirements:

- Never decrement stock before payment is confirmed.
- Never decrement stock twice for the same successful payment/order.
- Never allow stock to become negative.
- Handle the possibility that another customer purchased the same item first.
- Keep order state and inventory state consistent.

If true concurrency-safe inventory cannot be guaranteed with the current database structure, implement the safest practical server-side check and clearly document the remaining limitation.

---

# 13. HIGH: ADD RATE LIMITING TO PUBLIC AI CHAT

Kena is publicly accessible.

Add sensible server-side rate limiting to the AI chat endpoint.

Requirements:

- Limit excessive repeated requests.
- Prevent a single client from generating unlimited AI API calls.
- Return a friendly rate-limit response.
- Keep normal customers unaffected.
- Do not rely solely on frontend throttling.

If a configurable rate limit is practical, expose configuration through environment variables.

Also enforce reasonable input limits:

- maximum message size
- maximum conversation/history size
- maximum number of messages retained/sent to the model

Keep existing normal chat functionality.

---

# 14. HIGH: MAKE KENA'S BUSINESS INFORMATION CONSISTENT

Kena should not contain a separate hard-coded universe of business facts that can become outdated.

Identify business facts currently hard-coded into the AI system prompt or frontend.

Centralize important business settings where practical:

- business name
- description
- phone
- WhatsApp
- email
- address
- delivery areas
- delivery times
- return/refund rules
- payment methods
- opening/support hours
- categories

At minimum, create a single clearly identifiable configuration/source for these values so they are not duplicated in multiple places.

Kena should use the same current business information as the rest of the site.

Do not invent any new business facts.

Use the existing values as defaults until the owner replaces them.

---

# 15. HIGH: MAKE AI MODEL CONFIGURABLE

Do not hardcode the AI model in a way that requires source-code edits every time it needs to change.

Move the model identifier to environment/configuration.

Requirements:

- Keep the current model as the default.
- Do not break OpenRouter integration.
- Do not expose API keys to the browser.
- Do not change providers unless necessary.

---

# 16. HIGH: HARDEN ADMIN AUTHENTICATION

Inspect the existing admin login/session system.

Requirements:

- Keep authentication server-side.
- Ensure protected admin endpoints verify the authenticated session.
- Ensure logout invalidates the session correctly.
- Ensure unauthenticated users cannot directly call protected admin APIs.
- Do not rely on hiding the admin UI.
- Do not expose admin credentials in frontend JavaScript.
- Ensure cookies use appropriate security settings in production where practical.

Add basic login attempt throttling/rate limiting.

Do not replace the authentication system unnecessarily.

---

# 17. HIGH: RESTRICT API CORS

The current API uses broad CORS behavior.

Restrict cross-origin access to only the legitimate storefront origin(s) required by the application.

Requirements:

- Production origin should be explicitly allowed.
- Development origin can be allowed if needed.
- Do not use unrestricted `*` access when credentials/sensitive APIs are involved.
- Verify that the storefront still works after the change.

Do not break same-origin requests.

---

# 18. HIGH: REVIEW SECRET AND ENVIRONMENT-VARIABLE HANDLING

Perform a complete repository scan for accidentally committed secrets.

Look for:

- Paystack secret keys
- OpenRouter/API keys
- admin credentials
- database credentials
- SMTP/email passwords
- session secrets
- private tokens

Requirements:

- Secrets must come from environment variables.
- Never place secrets in frontend/browser code.
- Never hardcode production credentials.
- Do not print secrets in logs.
- Do not return secrets in API responses.
- If a real secret is found committed to Git history, flag it clearly and explain that it should be rotated/revoked rather than merely deleted from the latest file.

Do not fabricate replacement values.

---

# 19. MEDIUM: IMPROVE WHATSAPP ORDER LOGIC

Keep WhatsApp ordering because it is important for this business.

Make the generated message clear and useful.

The message should contain, where available:

- Business name
- Product names
- Quantity
- Selected size/color if variants are implemented
- Per-item price
- Total
- A clear statement that this is a new order request

Do not expose internal database information.

Before opening WhatsApp:

- validate the cart locally
- remove stale products
- validate positive quantities
- ensure useful product data exists

Important:

Do not pretend WhatsApp orders are paid orders.

They are manual order requests unless explicitly processed through the payment/order system.

---

# 20. MEDIUM: IMPROVE EMAIL/ORDER WORKFLOW

Inspect customer/admin notification emails.

Requirements:

- Payment success should not produce duplicate emails.
- Email failure must not incorrectly mark payment as failed.
- Failed email sending should be logged.
- Admin should be able to see useful email status.
- Avoid leaking sensitive information unnecessarily.
- Do not block confirmed payment on an unreliable email service.

Preserve the existing email system where possible.

---

# 21. MEDIUM: HANDLE EMAIL FAILURES CLEANLY

If email delivery fails after successful payment:

- order remains paid
- customer sees successful payment
- failure is logged
- admin can identify the failed notification
- system should not try dangerous/unbounded retries

Add a sensible retry mechanism only if the current architecture supports it cleanly.

---

# 22. MEDIUM: VALIDATE PRODUCT INPUTS ON ADMIN CREATE/UPDATE

Add server-side validation for product CRUD.

Validate:

- name
- description
- category
- price
- stock status
- stock count
- image URL/data
- sizes
- colors
- optional video field

Reject malformed or dangerous values.

Do not rely only on HTML input validation.

Ensure prices cannot be negative.

Ensure stock cannot be negative.

Normalize arrays such as colors/sizes.

---

# 23. MEDIUM: VALIDATE ADMIN ORDER UPDATES

Check order-status updates.

Requirements:

- only authenticated admins can update them
- allowed status values are enforced server-side
- malicious arbitrary status values are rejected
- notes are handled safely
- updates are logged where appropriate

Do not trust frontend dropdown values alone.

---

# 24. MEDIUM: IMPROVE PRODUCT IMAGE SAFETY

Keep the current image system for first launch unless changing it is genuinely necessary.

However:

- validate image MIME/type
- validate file size
- do not accept arbitrary executable content
- safely handle image URLs
- ensure unsafe protocols such as javascript: cannot become image sources
- escape values inserted into HTML

Do not undertake a full object-storage migration in this first-launch pass unless the current implementation is already failing.

---

# 25. MEDIUM: FIX STALE/DELETED PRODUCT EDGE CASES

Test and handle:

- product deleted while it is in someone's cart
- product becomes unavailable while in cart
- product price changes while in cart
- product stock changes while in cart
- category changes while in cart
- invalid product IDs
- empty carts

The server must always use current authoritative product information when creating an order.

---

# 26. MEDIUM: IMPROVE CUSTOMER-FACING ERROR MESSAGES

Do not expose stack traces or raw database/API errors.

Use friendly messages for:

- catalogue unavailable
- checkout unavailable
- payment initialization failure
- payment verification failure
- out-of-stock product
- invalid quantity
- invalid checkout input
- Kena unavailable
- WhatsApp unavailable
- unexpected server error

Developer logs can contain technical details, but customer responses should remain safe and understandable.

---

# 27. LOWER PRIORITY: HANDLE THE VIDEO FIELD CLEANLY

Inspect the existing product `video` field.

Determine whether it is actually intended to be part of the live product experience.

If unused:

- do not break the field
- document it or remove it if clearly obsolete
- do not add unnecessary UI purely to use it

If it is intended to be customer-facing:

- implement it properly and safely

Prefer leaving it alone if it is not necessary for first launch.

---

# 28. LOWER PRIORITY: PREPARE FOR IMAGE STORAGE MIGRATION

Do not perform a major storage rewrite during this launch-hardening pass unless necessary.

Document that the current base64/data-URL image approach may become inefficient as the catalogue grows.

The immediate objective is a stable small catalogue.

Future architecture should use proper image/object storage and URLs rather than storing large image blobs directly in ordinary product records.

---

# 29. DO NOT ADD UNNECESSARY FEATURES

For this first-launch hardening pass, DO NOT add:

- loyalty programs
- customer accounts
- recommendation engines
- AI fashion stylist
- cryptocurrency payments
- mobile app
- social login
- complex analytics dashboards
- multi-vendor architecture
- complicated coupons
- subscriptions
- unnecessary animations
- unrelated redesigns

The goal is reliability, safety, and business readiness.

---

# 30. PRESERVE THE CURRENT DESIGN

Do not redesign Katenovas Collections from scratch.

Preserve:

- logo
- brand identity
- colors
- navigation
- page structure
- product presentation
- existing responsive design
- Kena chat concept
- admin workflow unless corrections are necessary

Only change UI when required to support the fixes.

---

# 31. TESTING REQUIREMENTS

After implementing changes, run all available:

- TypeScript checks
- build checks
- lint checks
- unit tests
- integration tests
- API tests

Then manually/automatically test at least these scenarios:

### Storefront
1. Load homepage.
2. Load products.
3. Search products.
4. Filter categories.
5. Add to cart.
6. Change quantity.
7. Remove from cart.
8. Refresh page.
9. Load an empty cart.
10. Handle deleted product in cart.
11. Handle unavailable product.
12. Handle insufficient stock.

### Checkout
13. Submit valid customer information.
14. Reject invalid customer information.
15. Verify server-calculated total.
16. Prevent manipulated prices.
17. Prevent manipulated quantities.
18. Prevent unavailable items.
19. Initialize Paystack.
20. Handle payment initialization failure.
21. Verify successful payment.
22. Verify duplicate verification.
23. Verify failed payment.
24. Confirm order state.
25. Confirm inventory changes exactly once.
26. Confirm no sensitive PII is exposed publicly.

### WhatsApp
27. Generate a correct order message.
28. Confirm totals.
29. Confirm quantities.
30. Confirm variants if implemented.
31. Confirm stale cart handling.

### Kena
32. Ask product price.
33. Ask product availability.
34. Ask delivery question.
35. Ask return-policy question.
36. Request human help.
37. Send malicious HTML input.
38. Send oversized input.
39. Send many rapid requests.
40. Verify Kena uses current business information.

### Admin
41. Login with invalid credentials.
42. Login with valid credentials.
43. Logout.
44. Attempt protected API access while logged out.
45. Add product.
46. Edit product.
47. Delete product.
48. Update stock.
49. Update order status.
50. Add order notes.
51. Send/test email.
52. View email logs.

---

# 32. BUILD/DEPLOYMENT SAFETY

Before finishing:

- make sure the project builds successfully
- make sure startup commands still work
- make sure production environment variables are documented
- do not remove required Replit configuration
- do not break the existing deployment
- do not change database schema destructively without migration
- do not delete existing customer/order data
- do not overwrite production credentials

If a migration is required, create it safely and preserve existing records.

---

# 33. FINAL REPORT

After making changes, provide a concise but complete report containing:

### Changed
Every significant fix implemented.

### Not changed
Anything intentionally left alone because it was not necessary for first launch.

### Tests passed
Every test/check that actually ran successfully.

### Tests failed
Every test that failed and why.

### Unable to verify
Anything that could not be tested in the available environment.

### Remaining risks
Any known limitations.

### Files changed
Give the exact files modified.

### Database changes
State clearly whether the database/schema changed.

### Environment variables
State which new environment variables are required, without revealing their values.

### Deployment notes
State whether any deployment/restart/migration action is needed.

IMPORTANT:

Do not claim a test passed unless you actually ran it.

Do not claim the app is production-ready merely because the code compiles.

Do not silently weaken security checks to make tests pass.

Do not rewrite the project unnecessarily.

The final result should be a stable first-launch version of Katenovas Collections that can safely be populated with the real business's products and information.