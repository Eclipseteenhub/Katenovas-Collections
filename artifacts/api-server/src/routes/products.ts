import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

export const productCategories = [
  "Clothes",
  "Jewelry",
  "Home Accessories",
  "Shoes",
  "Bags",
] as const;

function serialize(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    description: p.description,
    category: p.category,
    image: p.image,
    video: p.video,
    inStock: p.inStock,
    stockCount: p.stockCount,
    colors: p.colors ? p.colors.split(",").map((c) => c.trim()).filter(Boolean) : [],
    sizes: p.sizes ? p.sizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
    createdAt: p.createdAt,
  };
}

const productBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().positive(),
  description: z.string().trim().max(2000).optional().default(""),
  category: z.enum(productCategories),
  image: z.string().max(4_500_000).optional().default(""),
  video: z.string().max(25_000_000).optional().default(""),
  inStock: z.boolean().optional().default(true),
  stockCount: z.number().int().nonnegative().optional().default(0),
  colors: z.union([z.string().max(500), z.array(z.string().max(80)).max(30)]).optional().default(""),
  sizes: z.union([z.string().max(500), z.array(z.string().max(80)).max(30)]).optional().default(""),
});

function normalizeList(v: string | string[] | undefined): string {
  if (!v) return "";
  const values = Array.isArray(v) ? v : v.split(",");
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(",");
}

function isSafeImageValue(value: string): boolean {
  if (!value) return true;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)
    || /^https:\/\//i.test(value);
}

// GET /api/products
router.get("/products", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(productsTable)
      .orderBy(desc(productsTable.createdAt));
    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST /api/products
router.post("/products", requireAdmin, async (req, res) => {
  const parsed = productBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product data" });
    return;
  }

  const d = parsed.data;
  if (!isSafeImageValue(d.image)) {
    res.status(400).json({ error: "Product image must be a safe image URL or image upload." });
    return;
  }
  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

  try {
    const [row] = await db
      .insert(productsTable)
      .values({
        id,
        name: d.name,
        price: d.price.toString(),
        description: d.description,
        category: d.category,
        image: d.image,
        video: d.video,
        inStock: d.inStock && d.stockCount > 0,
        stockCount: d.stockCount,
        colors: normalizeList(d.colors),
        sizes: normalizeList(d.sizes),
      })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id
router.put("/products/:id", requireAdmin, async (req, res) => {
  const parsed = productBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product data" });
    return;
  }

  const updates: Partial<typeof productsTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.image !== undefined && !isSafeImageValue(d.image)) {
    res.status(400).json({ error: "Product image must be a safe image URL or image upload." });
    return;
  }
  if (d.name !== undefined) updates.name = d.name;
  if (d.price !== undefined) updates.price = d.price.toString();
  if (d.description !== undefined) updates.description = d.description;
  if (d.category !== undefined) updates.category = d.category;
  if (d.image !== undefined) updates.image = d.image;
  if (d.video !== undefined) updates.video = d.video;
  if (d.inStock !== undefined) updates.inStock = d.inStock;
  if (d.stockCount !== undefined) updates.stockCount = d.stockCount;
  if (d.colors !== undefined) updates.colors = normalizeList(d.colors);
  if (d.sizes !== undefined) updates.sizes = normalizeList(d.sizes);

  try {
    const [existing] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, String(req.params.id)));
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const nextStockCount = d.stockCount ?? existing.stockCount;
    const nextInStock = (d.inStock ?? existing.inStock) && nextStockCount > 0;
    updates.stockCount = nextStockCount;
    updates.inStock = nextInStock;
    const [row] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, String(req.params.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id
router.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const [row] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, String(req.params.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
