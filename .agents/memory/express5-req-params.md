---
name: Express 5 req.params typing
description: Why req.params.<name> can fail strict-typed calls like drizzle-orm's eq() and needs String() coercion
---

With `@types/express` 5.x, `req.params[key]` is typed as `string | string[]` (to account for repeated wildcard segments), not just `string`. Passing it directly into strict-typed APIs like drizzle-orm's `eq(column, value)` fails `tsc` with a "No overload matches this call" error, even though at runtime a named `:id`-style param is always a plain string.

**Why:** This is invisible at runtime (esbuild doesn't type-check) but breaks `tsc --build`/`pnpm run typecheck`, and can go unnoticed for a while if incremental `.tsbuildinfo` caching masks it.

**How to apply:** Wrap the param in `String(req.params.id)` (or validate/parse it) before passing to drizzle query builders or other strictly-typed functions.
