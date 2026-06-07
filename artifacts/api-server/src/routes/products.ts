import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { desc } from "drizzle-orm";

const router = Router();

// Serialize a DB product row to the shape the frontend expects
function serialize(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    description: p.description,
    category: p.category,
    image: p.image,
    inStock: p.inStock,
    createdAt: p.createdAt,
  };
}

// Validation schema for create / update body
const productBodySchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().optional().default(""),
  category: z.string().min(1),
  image: z.string().optional().default(""),
  inStock: z.boolean().optional().default(true),
});

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
router.post("/products", async (req, res) => {
  const parsed = productBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product data" });
    return;
  }

  const { name, price, description, category, image, inStock } = parsed.data;
  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

  try {
    const [row] = await db
      .insert(productsTable)
      .values({ id, name, price: price.toString(), description, category, image, inStock })
      .returning();
    res.status(201).json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id
router.put("/products/:id", async (req, res) => {
  const parsed = productBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product data" });
    return;
  }

  const updates: Partial<typeof productsTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.price !== undefined) updates.price = d.price.toString();
  if (d.description !== undefined) updates.description = d.description;
  if (d.category !== undefined) updates.category = d.category;
  if (d.image !== undefined) updates.image = d.image;
  if (d.inStock !== undefined) updates.inStock = d.inStock;

  try {
    const [row] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, req.params.id))
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
router.delete("/products/:id", async (req, res) => {
  try {
    const [row] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, req.params.id))
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
