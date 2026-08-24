import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const app = express();
const PORT = 3000;

// Parse JSON request bodies (support up to 50mb for base64 file uploads/images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// PostgreSQL Pool connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// API Routes for Database persistence

// 1. Get Portfolio Config
app.get("/api/config", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM portfolio_config ORDER BY id ASC LIMIT 1"
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      res.json({
        managerName: row.manager_name,
        schoolName: row.school_name,
        year: row.year,
        managerTitle: row.manager_title,
        logoUrl: row.logo_url || "",
        managerPhotoUrl: row.manager_photo_url || "",
        biography: row.biography || "",
        vision: row.vision || "",
        mission: row.mission || "",
        values: row.values || "",
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error("Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

// 2. Save/Update Portfolio Config
app.post("/api/config", async (req, res) => {
  try {
    const {
      managerName,
      schoolName,
      year,
      managerTitle,
      logoUrl,
      managerPhotoUrl,
      biography,
      vision,
      mission,
      values,
    } = req.body;

    const existing = await pool.query("SELECT id FROM portfolio_config LIMIT 1");
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await pool.query(
        `UPDATE portfolio_config 
         SET manager_name = $1, school_name = $2, year = $3, manager_title = $4,
             logo_url = $5, manager_photo_url = $6, biography = $7, vision = $8,
             mission = $9, values = $10, updated_at = NOW()
         WHERE id = $11`,
        [
          managerName,
          schoolName,
          year,
          managerTitle,
          logoUrl || "",
          managerPhotoUrl || "",
          biography || "",
          vision || "",
          mission || "",
          values || "",
          id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO portfolio_config 
         (manager_name, school_name, year, manager_title, logo_url, manager_photo_url, biography, vision, mission, values)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          managerName,
          schoolName,
          year,
          managerTitle,
          logoUrl || "",
          managerPhotoUrl || "",
          biography || "",
          vision || "",
          mission || "",
          values || "",
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// 3. Get All Portfolio Pages (Standards & Evidences)
app.get("/api/pages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, title, icon_name as \"iconName\", description, criteria, attachments FROM portfolio_pages ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// 4. Save/Sync All Pages
app.post("/api/pages", async (req, res) => {
  try {
    const pages = req.body;
    if (!Array.isArray(pages)) {
      return res.status(400).json({ error: "Expected an array of pages" });
    }

    for (const page of pages) {
      await pool.query(
        `INSERT INTO portfolio_pages (id, code, title, icon_name, description, criteria, attachments, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (id) DO UPDATE 
         SET code = EXCLUDED.code,
             title = EXCLUDED.title,
             icon_name = EXCLUDED.icon_name,
             description = EXCLUDED.description,
             criteria = EXCLUDED.criteria,
             attachments = EXCLUDED.attachments,
             updated_at = NOW()`,
        [
          page.id,
          page.code,
          page.title,
          page.iconName || "Folder",
          page.description || "",
          JSON.stringify(page.criteria || []),
          JSON.stringify(page.attachments || []),
        ]
      );
    }

    res.json({ success: true, count: pages.length });
  } catch (error) {
    console.error("Error saving pages:", error);
    res.status(500).json({ error: "Failed to save pages" });
  }
});

// 5. Update Single Page
app.put("/api/pages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const page = req.body;

    await pool.query(
      `INSERT INTO portfolio_pages (id, code, title, icon_name, description, criteria, attachments, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE 
       SET code = EXCLUDED.code,
           title = EXCLUDED.title,
           icon_name = EXCLUDED.icon_name,
           description = EXCLUDED.description,
           criteria = EXCLUDED.criteria,
           attachments = EXCLUDED.attachments,
           updated_at = NOW()`,
      [
        id,
        page.code,
        page.title,
        page.iconName || "Folder",
        page.description || "",
        JSON.stringify(page.criteria || []),
        JSON.stringify(page.attachments || []),
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
});

// Serve static assets or route through Vite Dev Server
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
