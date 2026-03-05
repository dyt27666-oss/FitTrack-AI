import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure database directory exists
const dbDir = path.resolve("./data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}
const dbPath = path.join(dbDir, "fittrack.db");
const db = new Database(dbPath);

// Initialize Database Schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      age INTEGER,
      gender TEXT,
      height REAL,
      weight REAL,
      goal_calories INTEGER,
      activity_level REAL DEFAULT 1.2,
      ai_provider TEXT DEFAULT 'gemini',
      ai_model TEXT DEFAULT 'gemini-3-flash-preview',
      api_key TEXT,
      base_url TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL,
      calories REAL NOT NULL,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fats REAL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fats REAL DEFAULT 0,
      unit TEXT DEFAULT 'g'
    );

    CREATE TABLE IF NOT EXISTS custom_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER,
      name TEXT NOT NULL,
      weight_g REAL NOT NULL,
      calories_per_unit REAL,
      FOREIGN KEY(food_id) REFERENCES foods(id)
    );
  `);

  // Migration: Check if food_id column exists in custom_units
  try {
    db.prepare("SELECT food_id FROM custom_units LIMIT 1").get();
  } catch (e) {
    console.log("Migrating custom_units: adding food_id column");
    db.prepare("ALTER TABLE custom_units ADD COLUMN food_id INTEGER").run();
  }

  // Seed profile if not exists
  const profileExists = db.prepare("SELECT id FROM profile WHERE id = 1").get();
  if (!profileExists) {
    db.prepare("INSERT INTO profile (id, name, age, gender, height, weight, goal_calories, activity_level, ai_provider, ai_model) VALUES (1, '用户', 25, '其他', 170, 70, 2000, 1.2, 'gemini', 'gemini-3-flash-preview')").run();
  }
  
  // Seed common foods if empty
  const foodCount = db.prepare("SELECT COUNT(*) as count FROM foods").get() as { count: number };
  if (foodCount.count === 0) {
    const commonFoods = [
      ['米饭', 130, 2.7, 28, 0.3],
      ['鸡蛋', 143, 13, 1.1, 10],
      ['鸡胸肉', 165, 31, 0, 3.6],
      ['苹果', 52, 0.3, 14, 0.2],
      ['香蕉', 89, 1.1, 23, 0.3],
      ['西兰花', 34, 2.8, 7, 0.4],
      ['牛奶', 42, 3.4, 5, 1],
      ['牛肉', 250, 26, 0, 15]
    ];
    const insertFood = db.prepare("INSERT INTO foods (name, calories, protein, carbs, fats) VALUES (?, ?, ?, ?, ?)");
    commonFoods.forEach(f => insertFood.run(...f));
  }

  console.log("Database initialized successfully at", dbPath);
} catch (error) {
  console.error("Database initialization failed:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Helper for error handling
  const handleDbError = (res: any, error: any, context: string) => {
    console.error(`${context} error:`, error);
    if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
      res.status(503).json({ error: "Database locked. Please try again." });
    } else if (error.code === 'EACCES' || error.code === 'SQLITE_READONLY') {
      res.status(403).json({ error: "Permission denied. Database is read-only." });
    } else {
      res.status(500).json({ error: `Failed to ${context}` });
    }
  };

  // Profile
  app.get("/api/profile", (req, res) => {
    try {
      const row = db.prepare("SELECT * FROM profile WHERE id = 1").get();
      res.json(row);
    } catch (error) {
      handleDbError(res, error, "fetch profile");
    }
  });

  app.post("/api/profile", (req, res) => {
    try {
      const { name, age, gender, height, weight, goal_calories, activity_level, ai_provider, ai_model, api_key, base_url } = req.body;
      
      // Check if columns exist, if not add them (migration for existing DB)
      try {
        db.prepare("SELECT api_key FROM profile").get();
      } catch (e) {
        // Ignore column missing error during migration check
        try {
           db.prepare("ALTER TABLE profile ADD COLUMN api_key TEXT").run();
           db.prepare("ALTER TABLE profile ADD COLUMN base_url TEXT").run();
        } catch (migrationError) {
           console.log("Migration skipped or failed", migrationError);
        }
      }

      db.prepare(`
        UPDATE profile 
        SET name = ?, age = ?, gender = ?, height = ?, weight = ?, goal_calories = ?, activity_level = ?, ai_provider = ?, ai_model = ?, api_key = ?, base_url = ?
        WHERE id = 1
      `).run(name, age, gender, height, weight, goal_calories, activity_level, ai_provider, ai_model, api_key, base_url);
      res.json({ success: true });
    } catch (error) {
      handleDbError(res, error, "update profile");
    }
  });

  // Logs
  app.get("/api/logs/:date", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM logs WHERE date = ? ORDER BY timestamp DESC").all(req.params.date);
      res.json(rows);
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.post("/api/logs/:type", (req, res) => {
    try {
      const { date, name, amount, calories, protein, carbs, fats } = req.body;
      const type = req.params.type;
      const info = db.prepare(`
        INSERT INTO logs (date, type, name, amount, calories, protein, carbs, fats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(date, type, name, amount, calories, protein || 0, carbs || 0, fats || 0);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Add log error:", error);
      res.status(500).json({ error: "Failed to add log" });
    }
  });

  app.delete("/api/logs/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM logs WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete log error:", error);
      res.status(500).json({ error: "Failed to delete log" });
    }
  });

  // Foods
  app.get("/api/foods/search", (req, res) => {
    try {
      const q = req.query.q as string;
      const rows = db.prepare("SELECT * FROM foods WHERE name LIKE ? LIMIT 10").all(`%${q}%`);
      res.json(rows);
    } catch (error) {
      console.error("Search food error:", error);
      res.status(500).json({ error: "Failed to search foods" });
    }
  });

  app.post("/api/foods", (req, res) => {
    try {
      const { name, calories, protein, carbs, fats } = req.body;
      const info = db.prepare("INSERT INTO foods (name, calories, protein, carbs, fats) VALUES (?, ?, ?, ?, ?)").run(name, calories, protein, carbs, fats);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Add food error:", error);
      res.status(500).json({ error: "Failed to add food" });
    }
  });

  // Custom Units
  app.get("/api/units", (req, res) => {
    try {
      const food_id = req.query.food_id;
      let rows;
      if (food_id) {
        rows = db.prepare("SELECT * FROM custom_units WHERE food_id = ?").all(food_id);
      } else {
        rows = db.prepare("SELECT * FROM custom_units").all();
      }
      res.json(rows);
    } catch (error) {
      console.error("Get units error:", error);
      res.status(500).json({ error: "Failed to fetch units" });
    }
  });

  app.post("/api/units", (req, res) => {
    try {
      const { name, weight_g, calories_per_unit, food_id } = req.body;
      const info = db.prepare("INSERT INTO custom_units (name, weight_g, calories_per_unit, food_id) VALUES (?, ?, ?, ?)").run(name, weight_g, calories_per_unit, food_id || null);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Add unit error:", error);
      res.status(500).json({ error: "Failed to add unit" });
    }
  });

  app.delete("/api/units/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM custom_units WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete unit error:", error);
      res.status(500).json({ error: "Failed to delete unit" });
    }
  });

  // Backup
  app.get("/api/backup", (req, res) => {
    try {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      res.attachment('fittrack-backup.zip');
      archive.pipe(res);

      archive.glob('**/*', {
        cwd: __dirname,
        ignore: ['node_modules/**', 'dist/**', '.git/**', 'data/*.db-journal']
      });

      archive.finalize();
    } catch (error) {
      console.error("Backup error:", error);
      res.status(500).send("Backup failed");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
