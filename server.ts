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

// In-Memory fallback store
let memoryConfig: any = null;
let memoryPages: any[] = [];

// PostgreSQL Pool connection (only if DATABASE_URL is explicitly set)
let pool: Pool | null = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
    // Silent error handler on idle clients to prevent uncaught exceptions
    pool.on("error", () => {
      // ignore idle errors
    });
  } catch {
    pool = null;
  }
}

// Helper to safely execute database queries with in-memory fallback
async function queryDb(sql: string, params: any[] = []): Promise<any> {
  if (!pool) return null;
  try {
    return await pool.query(sql, params);
  } catch {
    return null;
  }
}

// API Routes for Persistence

// 1. Get Portfolio Config
app.get("/api/config", async (req, res) => {
  try {
    if (pool) {
      const result = await queryDb(
        "SELECT * FROM portfolio_config ORDER BY id ASC LIMIT 1"
      );
      if (result && result.rows.length > 0) {
        const row = result.rows[0];
        return res.json({
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
      }
    }
    // Fallback to in-memory
    res.json(memoryConfig);
  } catch {
    res.json(memoryConfig);
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

    memoryConfig = {
      managerName,
      schoolName,
      year,
      managerTitle,
      logoUrl: logoUrl || "",
      managerPhotoUrl: managerPhotoUrl || "",
      biography: biography || "",
      vision: vision || "",
      mission: mission || "",
      values: values || "",
    };

    if (pool) {
      const existing = await queryDb("SELECT id FROM portfolio_config LIMIT 1");
      if (existing && existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await queryDb(
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
      } else if (existing) {
        await queryDb(
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
    }

    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// 3. Get All Portfolio Pages (Standards & Evidences)
app.get("/api/pages", async (req, res) => {
  try {
    if (pool) {
      const result = await queryDb(
        "SELECT id, code, title, icon_name as \"iconName\", description, criteria, attachments FROM portfolio_pages ORDER BY id ASC"
      );
      if (result && result.rows) {
        return res.json(result.rows);
      }
    }
    // Fallback to in-memory
    res.json(memoryPages);
  } catch {
    res.json(memoryPages);
  }
});

// 4. Save/Sync All Pages
app.post("/api/pages", async (req, res) => {
  try {
    const pages = req.body;
    if (Array.isArray(pages)) {
      memoryPages = pages;
    }

    if (pool && Array.isArray(pages)) {
      for (const page of pages) {
        await queryDb(
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
    }

    res.json({ success: true, count: Array.isArray(pages) ? pages.length : 0 });
  } catch {
    res.json({ success: true });
  }
});

// 5. Update Single Page
app.put("/api/pages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const page = req.body;

    const idx = memoryPages.findIndex((p) => p.id === id);
    if (idx >= 0) {
      memoryPages[idx] = { ...memoryPages[idx], ...page };
    } else {
      memoryPages.push(page);
    }

    if (pool) {
      await queryDb(
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
    }

    res.json({ success: true });
  } catch {
    res.json({ success: true });
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
