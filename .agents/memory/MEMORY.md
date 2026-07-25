# Memory Index

- [drizzle-zod requires zod/v4 in schema files](drizzle-zod-zod-v4.md) — createInsertSchema type errors (TS2344) if lib/db schema files import from "zod" instead of "zod/v4".
- [Express 5 req.params typed as string|string[]](express5-req-params.md) — wrap req.params.x in String() before passing to drizzle eq() or similar strict-typed APIs.
- [OpenRouter 402 = no credits](openrouter-credits.md) — "402 Insufficient credits" from OpenRouter means the account has no purchased credits; it is a billing issue, not a code/key issue.
- [Resend fallback FROM address](email-service.md) — Resend falls back to onboarding@resend.dev; works in test but live customer emails require a verified sending domain at resend.com.
- [Paystack dual-key support](paystack-keys.md) — checkout reads Paystack_Secret_Live_API_KEY || PAYSTACK_SECRET_KEY so both old test keys and new live keys work without code changes.
