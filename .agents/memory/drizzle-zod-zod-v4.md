---
name: drizzle-zod requires zod/v4 typings
description: Why lib/*/schema files using createInsertSchema must import z from "zod/v4", not "zod", even when the project's zod runtime version is 3.25.x
---

`drizzle-zod` 0.8.x ships its own `.d.ts` files that internally `import type { z } from 'zod/v4'`. If a Drizzle schema file (e.g. a table + `createInsertSchema(table)`) imports `z` from the classic `"zod"` entry point instead, `tsc --build` fails with:

```
Type 'ZodObject<...>' does not satisfy the constraint 'ZodType<any, any, any>'.
  ... is missing the following properties from type 'ZodType<any, any, any>': _type, _parse, _getType, _getOrReturnCtx, and 7 more.
```

This is because zod 3.25+ ships two structurally-incompatible APIs from the same package: the classic v3 API (`"zod"`) and a v4-compatible "mini" API (`"zod/v4"`). `drizzle-zod`'s generic constraints are written against the v4 API, so classic-v3 `ZodObject` output doesn't structurally satisfy them.

**Why:** This surfaced as a full workspace typecheck failure after clearing `.tsbuildinfo` (stale incremental cache had been silently hiding it). Runtime (esbuild) is unaffected since esbuild doesn't type-check — the app worked in production despite this being broken under `tsc --build`.

**How to apply:** In any `lib/db/src/schema/*.ts` file that calls `createInsertSchema`/`createSelectSchema` from `drizzle-zod`, import `z` from `"zod/v4"`. Plain request-validation `z.object(...)` usage in route handlers (api-server routes) is unaffected and should keep importing from `"zod"` (the classic v3 API) per existing project convention — only Drizzle-schema-adjacent files need `"zod/v4"`.
