import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type UserGoal = "减脂" | "增肌" | "维持";

export interface UserProfile {
  id: number;
  name: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: number;
  goal: UserGoal;
  goalCalories: number;
  textAiProvider: "gemini" | "zhipu" | "tongyi" | "silra";
  textAiModel: string;
  visionAiProvider: "gemini" | "zhipu" | "tongyi" | "silra";
  visionAiModel: string;
}

export interface FoodEntity {
  id: number;
  userId: number;
  name: string;
  normalizedName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  cookingMethod: string;
  isEdible: number;
  source: "seed" | "user" | "ai";
  confidence: number;
}

export interface FoodUnitEntity {
  id: number;
  foodId: number;
  unitName: string;
  gramsPerUnit: number;
  isDefault: number;
  source: "seed" | "user" | "ai";
  confidence: number;
}

export interface CreateFoodInput {
  userId: number;
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
  cookingMethod?: string;
  isEdible?: boolean;
  source?: "seed" | "user" | "ai";
  confidence?: number;
}

export interface CreateUnitInput {
  foodId: number;
  unitName: string;
  gramsPerUnit: number;
  isDefault?: boolean;
  source?: "seed" | "user" | "ai";
  confidence?: number;
}

export interface CreateLogInput {
  userId: number;
  date: string;
  type: "food" | "exercise";
  foodId?: number | null;
  name: string;
  amount: number;
  unitName?: string | null;
  grams?: number | null;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface UpdateLogInput extends CreateLogInput {
  id: number;
}

export interface BodyMetricEntity {
  id: number;
  userId: number;
  date: string;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  thigh: number | null;
  photoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBodyMetricInput {
  userId: number;
  date: string;
  weight?: number | null;
  chest?: number | null;
  waist?: number | null;
  thigh?: number | null;
  photoUrl?: string | null;
}

export interface FastingLogEntity {
  id: number;
  userId: number;
  planType: string;
  startTime: string;
  targetEndTime: string;
  actualEndTime: string | null;
  status: "fasting" | "completed" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFastingLogInput {
  userId: number;
  planType: string;
  startTime: string;
  targetEndTime: string;
  actualEndTime?: string | null;
  status: "fasting" | "completed" | "failed";
}

export interface HabitEntity {
  id: number;
  userId: number;
  name: string;
  icon: string;
  color: string;
  frequencyType: "daily" | "weekly";
  frequencyValue: number;
  targetValue: number;
  unit: string;
  isActive: number;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HabitLogEntity {
  id: number;
  habitId: number;
  userId: number;
  date: string;
  status: "pending" | "done" | "missed";
  actualValue: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHabitInput {
  userId: number;
  name: string;
  icon?: string;
  color?: string;
  frequencyType?: "daily" | "weekly";
  frequencyValue?: number;
  targetValue?: number;
  unit?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateHabitInput extends CreateHabitInput {
  id: number;
}

const normalizeFoodName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, "");

export class FitTrackDB {
  private db: Database.Database;

  constructor(dbFilePath?: string) {
    const dbDir = path.resolve("./db");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const filePath = dbFilePath || path.join(dbDir, "fittrack.db");
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    this.seedDefaults();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '用户',
        sex TEXT DEFAULT '其他',
        age INTEGER DEFAULT 25,
        heightCm REAL DEFAULT 170,
        weightKg REAL DEFAULT 70,
        activityLevel REAL DEFAULT 1.2 CHECK(activityLevel >= 1.2 AND activityLevel <= 1.9),
        goal TEXT DEFAULT '维持' CHECK(goal IN ('减脂','增肌','维持')),
        goalCalories INTEGER DEFAULT 2000,
        aiProvider TEXT DEFAULT 'silra',
        aiModel TEXT DEFAULT 'deepseek-v3',
        textAiProvider TEXT DEFAULT 'silra',
        textAiModel TEXT DEFAULT 'deepseek-v3',
        visionAiProvider TEXT DEFAULT 'tongyi',
        visionAiModel TEXT DEFAULT 'qwen-vl-plus',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        calories_per_100g REAL NOT NULL CHECK(calories_per_100g >= 0),
        protein_per_100g REAL DEFAULT 0,
        carbs_per_100g REAL DEFAULT 0,
        fats_per_100g REAL DEFAULT 0,
        cooking_method TEXT DEFAULT '',
        is_edible INTEGER NOT NULL DEFAULT 1 CHECK(is_edible IN (0,1)),
        source TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('seed','user','ai')),
        confidence INTEGER DEFAULT 100 CHECK(confidence >= 0 AND confidence <= 100),
        ai_payload_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, normalized_name),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS food_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food_id INTEGER NOT NULL,
        unit_name TEXT NOT NULL,
        grams_per_unit REAL NOT NULL CHECK(grams_per_unit > 0),
        is_default INTEGER DEFAULT 0 CHECK(is_default IN (0,1)),
        source TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('seed','user','ai')),
        confidence INTEGER DEFAULT 100 CHECK(confidence >= 0 AND confidence <= 100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(food_id, unit_name),
        FOREIGN KEY(food_id) REFERENCES foods(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('food','exercise')),
        food_id INTEGER,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        unit_name TEXT,
        grams REAL,
        calories REAL NOT NULL,
        protein REAL DEFAULT 0,
        carbs REAL DEFAULT 0,
        fats REAL DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(food_id) REFERENCES foods(id)
      );

      CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_foods_user_norm ON foods(user_id, normalized_name);

      CREATE TABLE IF NOT EXISTS body_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        weight REAL,
        chest REAL,
        waist REAL,
        thigh REAL,
        photo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON body_metrics(user_id, date);

      CREATE TABLE IF NOT EXISTS fasting_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        target_end_time TEXT NOT NULL,
        actual_end_time TEXT,
        status TEXT NOT NULL CHECK(status IN ('fasting','completed','failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_fasting_logs_user_status ON fasting_logs(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_fasting_logs_user_start_time ON fasting_logs(user_id, start_time);

      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'check-circle',
        color TEXT DEFAULT '#22c55e',
        frequency_type TEXT NOT NULL DEFAULT 'daily' CHECK(frequency_type IN ('daily','weekly')),
        frequency_value INTEGER DEFAULT 1,
        target_value REAL DEFAULT 1,
        unit TEXT DEFAULT '次',
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','missed')),
        actual_value REAL DEFAULT 0,
        note TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(habit_id, date),
        FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active, sort_order);
      CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);
    `);
    this.ensureUserColumns();
  }

  private ensureUserColumns(): void {
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    const additions = [
      { name: "textAiProvider", sql: "ALTER TABLE users ADD COLUMN textAiProvider TEXT DEFAULT 'silra'" },
      { name: "textAiModel", sql: "ALTER TABLE users ADD COLUMN textAiModel TEXT DEFAULT 'deepseek-v3'" },
      { name: "visionAiProvider", sql: "ALTER TABLE users ADD COLUMN visionAiProvider TEXT DEFAULT 'tongyi'" },
      { name: "visionAiModel", sql: "ALTER TABLE users ADD COLUMN visionAiModel TEXT DEFAULT 'qwen-vl-plus'" },
    ];
    for (const addition of additions) {
      if (!names.has(addition.name)) {
        this.db.exec(addition.sql);
      }
    }
  }

  private seedDefaults(): void {
    const user = this.db.prepare("SELECT id FROM users WHERE id = 1").get();
    if (!user) {
      this.db
        .prepare(
          "INSERT INTO users (id, name, sex, age, heightCm, weightKg, activityLevel, goal, goalCalories, aiProvider, aiModel, textAiProvider, textAiModel, visionAiProvider, visionAiModel) VALUES (1, '用户', '其他', 25, 170, 70, 1.2, '维持', 2000, 'silra', 'deepseek-v3', 'silra', 'deepseek-v3', 'tongyi', 'qwen-vl-plus')"
        )
        .run();
    }

    const habitCount = this.db.prepare("SELECT COUNT(1) AS count FROM habits WHERE user_id = 1").get() as { count: number };
    if (!habitCount || habitCount.count === 0) {
      const insertHabit = this.db.prepare(
        `INSERT INTO habits (user_id, name, icon, color, frequency_type, frequency_value, target_value, unit, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insertHabit.run(1, "晨间阅读", "book-open", "#16a34a", "daily", 1, 30, "分钟", 1, 1);
      insertHabit.run(1, "饮水达标", "glass-water", "#0ea5e9", "daily", 1, 8, "杯", 1, 2);
      insertHabit.run(1, "力量训练", "dumbbell", "#f97316", "daily", 1, 1, "次", 1, 3);
    }
  }

  getProfile(userId = 1): UserProfile {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    return {
      id: row.id,
      name: row.name,
      sex: row.sex,
      age: row.age,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      activityLevel: row.activityLevel,
      goal: row.goal,
      goalCalories: row.goalCalories,
      textAiProvider: row.textAiProvider || row.aiProvider || "silra",
      textAiModel: row.textAiModel || row.aiModel || "deepseek-v3",
      visionAiProvider: row.visionAiProvider || "tongyi",
      visionAiModel: row.visionAiModel || "qwen-vl-plus",
    };
  }

  updateProfile(userId: number, patch: Partial<UserProfile>): void {
    const current = this.getProfile(userId);
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE users
         SET name = ?, sex = ?, age = ?, heightCm = ?, weightKg = ?, activityLevel = ?, goal = ?, goalCalories = ?, aiProvider = ?, aiModel = ?, textAiProvider = ?, textAiModel = ?, visionAiProvider = ?, visionAiModel = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        next.name,
        next.sex,
        next.age,
        next.heightCm,
        next.weightKg,
        next.activityLevel,
        next.goal,
        next.goalCalories,
        next.textAiProvider,
        next.textAiModel,
        next.textAiProvider,
        next.textAiModel,
        next.visionAiProvider,
        next.visionAiModel,
        userId
      );
  }

  searchFoods(userId: number, query: string, limit = 10): FoodEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM foods
         WHERE user_id = ? AND is_edible = 1 AND name LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(userId, `%${query}%`, limit) as any[];
    return rows.map(this.mapFoodEntity);
  }

  getFoodByNormalizedName(userId: number, name: string): FoodEntity | null {
    const normalized = normalizeFoodName(name);
    const row = this.db
      .prepare("SELECT * FROM foods WHERE user_id = ? AND normalized_name = ? LIMIT 1")
      .get(userId, normalized) as any;
    return row ? this.mapFoodEntity(row) : null;
  }

  getFoodById(id: number): FoodEntity | null {
    const row = this.db.prepare("SELECT * FROM foods WHERE id = ? LIMIT 1").get(id) as any;
    return row ? this.mapFoodEntity(row) : null;
  }

  createOrUpdateFood(input: CreateFoodInput, aiPayload?: string): FoodEntity {
    const normalizedName = normalizeFoodName(input.name);
    const existing = this.db
      .prepare("SELECT id FROM foods WHERE user_id = ? AND normalized_name = ?")
      .get(input.userId, normalizedName) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE foods
           SET name=?, calories_per_100g=?, protein_per_100g=?, carbs_per_100g=?, fats_per_100g=?, cooking_method=?, is_edible=?, source=?, confidence=?, ai_payload_json=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`
        )
        .run(
          input.name,
          input.caloriesPer100g,
          input.proteinPer100g || 0,
          input.carbsPer100g || 0,
          input.fatsPer100g || 0,
          input.cookingMethod || "",
          input.isEdible === false ? 0 : 1,
          input.source || "user",
          input.confidence ?? 100,
          aiPayload || null,
          existing.id
        );
      const row = this.db.prepare("SELECT * FROM foods WHERE id = ?").get(existing.id) as any;
      return this.mapFoodEntity(row);
    }

    const info = this.db
      .prepare(
        `INSERT INTO foods
         (user_id, name, normalized_name, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, cooking_method, is_edible, source, confidence, ai_payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.name,
        normalizedName,
        input.caloriesPer100g,
        input.proteinPer100g || 0,
        input.carbsPer100g || 0,
        input.fatsPer100g || 0,
        input.cookingMethod || "",
        input.isEdible === false ? 0 : 1,
        input.source || "user",
        input.confidence ?? 100,
        aiPayload || null
      );
    const row = this.db.prepare("SELECT * FROM foods WHERE id = ?").get(info.lastInsertRowid) as any;
    return this.mapFoodEntity(row);
  }

  upsertFoodUnit(input: CreateUnitInput): FoodUnitEntity {
    const existing = this.db
      .prepare("SELECT id FROM food_units WHERE food_id = ? AND unit_name = ?")
      .get(input.foodId, input.unitName) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE food_units
           SET grams_per_unit=?, is_default=?, source=?, confidence=?
           WHERE id=?`
        )
        .run(
          input.gramsPerUnit,
          input.isDefault ? 1 : 0,
          input.source || "user",
          input.confidence ?? 100,
          existing.id
        );
      const row = this.db.prepare("SELECT * FROM food_units WHERE id = ?").get(existing.id) as any;
      return this.mapUnitEntity(row);
    }

    const info = this.db
      .prepare(
        `INSERT INTO food_units (food_id, unit_name, grams_per_unit, is_default, source, confidence)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.foodId,
        input.unitName,
        input.gramsPerUnit,
        input.isDefault ? 1 : 0,
        input.source || "user",
        input.confidence ?? 100
      );
    const row = this.db.prepare("SELECT * FROM food_units WHERE id = ?").get(info.lastInsertRowid) as any;
    return this.mapUnitEntity(row);
  }

  getFoodUnitsByFoodId(foodId: number): FoodUnitEntity[] {
    const rows = this.db
      .prepare("SELECT * FROM food_units WHERE food_id = ? ORDER BY is_default DESC, id ASC")
      .all(foodId) as any[];
    return rows.map(this.mapUnitEntity);
  }

  getFoodUnits(foodId?: number): FoodUnitEntity[] {
    if (typeof foodId === "number") {
      return this.getFoodUnitsByFoodId(foodId);
    }
    const rows = this.db.prepare("SELECT * FROM food_units ORDER BY food_id ASC, is_default DESC, id ASC").all() as any[];
    return rows.map(this.mapUnitEntity);
  }

  getFoodUnitByName(foodId: number, unitName: string): FoodUnitEntity | null {
    const row = this.db
      .prepare("SELECT * FROM food_units WHERE food_id = ? AND unit_name = ? LIMIT 1")
      .get(foodId, unitName) as any;
    return row ? this.mapUnitEntity(row) : null;
  }

  deleteFoodUnit(id: number): void {
    this.db.prepare("DELETE FROM food_units WHERE id = ?").run(id);
  }

  addLog(input: CreateLogInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO logs (user_id, date, type, food_id, name, amount, unit_name, grams, calories, protein, carbs, fats)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.date,
        input.type,
        input.foodId || null,
        input.name,
        input.amount,
        input.unitName || null,
        input.grams || null,
        input.calories,
        input.protein || 0,
        input.carbs || 0,
        input.fats || 0
      );
    return Number(info.lastInsertRowid);
  }

  getLogs(userId: number, date: string): any[] {
    return this.db
      .prepare("SELECT * FROM logs WHERE user_id = ? AND date = ? ORDER BY timestamp DESC")
      .all(userId, date) as any[];
  }

  getLogById(userId: number, id: number): any | null {
    return (
      (this.db.prepare("SELECT * FROM logs WHERE user_id = ? AND id = ? LIMIT 1").get(userId, id) as any) || null
    );
  }

  updateLog(input: UpdateLogInput): void {
    this.db
      .prepare(
        `UPDATE logs
         SET date = ?, type = ?, food_id = ?, name = ?, amount = ?, unit_name = ?, grams = ?, calories = ?, protein = ?, carbs = ?, fats = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        input.date,
        input.type,
        input.foodId || null,
        input.name,
        input.amount,
        input.unitName || null,
        input.grams || null,
        input.calories,
        input.protein || 0,
        input.carbs || 0,
        input.fats || 0,
        input.userId,
        input.id
      );
  }

  deleteLog(userId: number, id: number): void {
    this.db.prepare("DELETE FROM logs WHERE user_id = ? AND id = ?").run(userId, id);
  }

  listBodyMetrics(userId: number, limit = 30): BodyMetricEntity[] {
    const rows = this.db
      .prepare("SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?")
      .all(userId, limit) as any[];
    return rows.map(this.mapBodyMetricEntity);
  }

  createBodyMetric(input: CreateBodyMetricInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO body_metrics (user_id, date, weight, chest, waist, thigh, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.date,
        input.weight ?? null,
        input.chest ?? null,
        input.waist ?? null,
        input.thigh ?? null,
        input.photoUrl ?? null
      );
    return Number(info.lastInsertRowid);
  }

  getBodyMetricById(userId: number, id: number): BodyMetricEntity | null {
    const row = this.db
      .prepare("SELECT * FROM body_metrics WHERE user_id = ? AND id = ? LIMIT 1")
      .get(userId, id) as any;
    return row ? this.mapBodyMetricEntity(row) : null;
  }

  deleteBodyMetric(userId: number, id: number): void {
    this.db.prepare("DELETE FROM body_metrics WHERE user_id = ? AND id = ?").run(userId, id);
  }

  getCurrentFastingLog(userId: number): FastingLogEntity | null {
    const row = this.db
      .prepare("SELECT * FROM fasting_logs WHERE user_id = ? AND status = 'fasting' ORDER BY start_time DESC LIMIT 1")
      .get(userId) as any;
    return row ? this.mapFastingLogEntity(row) : null;
  }

  createFastingLog(input: CreateFastingLogInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO fasting_logs (user_id, plan_type, start_time, target_end_time, actual_end_time, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.planType,
        input.startTime,
        input.targetEndTime,
        input.actualEndTime ?? null,
        input.status
      );
    return Number(info.lastInsertRowid);
  }

  updateFastingLogStatus(userId: number, id: number, patch: { actualEndTime?: string | null; status: "fasting" | "completed" | "failed" }): void {
    this.db
      .prepare(
        `UPDATE fasting_logs
         SET actual_end_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND id = ?`
      )
      .run(patch.actualEndTime ?? null, patch.status, userId, id);
  }

  listFastingLogs(userId: number, limit = 30): FastingLogEntity[] {
    const rows = this.db
      .prepare("SELECT * FROM fasting_logs WHERE user_id = ? ORDER BY start_time DESC LIMIT ?")
      .all(userId, limit) as any[];
    return rows.map(this.mapFastingLogEntity);
  }

  listHabits(userId: number): HabitEntity[] {
    const rows = this.db
      .prepare("SELECT * FROM habits WHERE user_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC")
      .all(userId) as any[];
    return rows.map(this.mapHabitEntity);
  }

  listAllHabits(userId: number): HabitEntity[] {
    const rows = this.db
      .prepare("SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order ASC, id ASC")
      .all(userId) as any[];
    return rows.map(this.mapHabitEntity);
  }

  createHabit(input: CreateHabitInput): number {
    const info = this.db
      .prepare(
        `INSERT INTO habits (user_id, name, icon, color, frequency_type, frequency_value, target_value, unit, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.name,
        input.icon || "check-circle",
        input.color || "#22c55e",
        input.frequencyType || "daily",
        input.frequencyValue ?? 1,
        input.targetValue ?? 1,
        input.unit || "次",
        input.isActive === false ? 0 : 1,
        input.sortOrder ?? 0
      );
    return Number(info.lastInsertRowid);
  }

  updateHabit(input: UpdateHabitInput): void {
    this.db
      .prepare(
        `UPDATE habits
         SET name = ?, icon = ?, color = ?, frequency_type = ?, frequency_value = ?, target_value = ?, unit = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND id = ?`
      )
      .run(
        input.name,
        input.icon || "check-circle",
        input.color || "#22c55e",
        input.frequencyType || "daily",
        input.frequencyValue ?? 1,
        input.targetValue ?? 1,
        input.unit || "次",
        input.sortOrder ?? 0,
        input.userId,
        input.id
      );
  }

  getHabitById(userId: number, habitId: number): HabitEntity | null {
    const row = this.db
      .prepare("SELECT * FROM habits WHERE user_id = ? AND id = ? LIMIT 1")
      .get(userId, habitId) as any;
    return row ? this.mapHabitEntity(row) : null;
  }

  archiveHabit(userId: number, habitId: number): void {
    this.db
      .prepare(
        `UPDATE habits
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND id = ?`
      )
      .run(userId, habitId);
  }

  getHabitLog(userId: number, habitId: number, date: string): HabitLogEntity | null {
    const row = this.db
      .prepare("SELECT * FROM habit_logs WHERE user_id = ? AND habit_id = ? AND date = ? LIMIT 1")
      .get(userId, habitId, date) as any;
    return row ? this.mapHabitLogEntity(row) : null;
  }

  upsertHabitLog(input: { userId: number; habitId: number; date: string; status: "pending" | "done" | "missed"; actualValue?: number; note?: string }): number {
    const existing = this.db
      .prepare("SELECT id FROM habit_logs WHERE user_id = ? AND habit_id = ? AND date = ?")
      .get(input.userId, input.habitId, input.date) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE habit_logs
           SET status = ?, actual_value = ?, note = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .run(input.status, input.actualValue ?? 0, input.note ?? "", existing.id);
      return existing.id;
    }

    const info = this.db
      .prepare(
        `INSERT INTO habit_logs (habit_id, user_id, date, status, actual_value, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(input.habitId, input.userId, input.date, input.status, input.actualValue ?? 0, input.note ?? "");
    return Number(info.lastInsertRowid);
  }

  listHabitLogsInRange(userId: number, from: string, to: string): HabitLogEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM habit_logs
         WHERE user_id = ? AND date >= ? AND date <= ?
         ORDER BY date ASC, habit_id ASC`
      )
      .all(userId, from, to) as any[];
    return rows.map(this.mapHabitLogEntity);
  }

  listHabitLogsForHabit(userId: number, habitId: number, from: string, to: string): HabitLogEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM habit_logs
         WHERE user_id = ? AND habit_id = ? AND date >= ? AND date <= ?
         ORDER BY date ASC`
      )
      .all(userId, habitId, from, to) as any[];
    return rows.map(this.mapHabitLogEntity);
  }

  listHabitLogsForHabitAll(userId: number, habitId: number): HabitLogEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM habit_logs
         WHERE user_id = ? AND habit_id = ?
         ORDER BY date ASC`
      )
      .all(userId, habitId) as any[];
    return rows.map(this.mapHabitLogEntity);
  }

  listHabitLogsForHabitBeforeDate(userId: number, habitId: number, to: string, limit = 366): HabitLogEntity[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM habit_logs
         WHERE user_id = ? AND habit_id = ? AND date <= ?
         ORDER BY date DESC
         LIMIT ?`
      )
      .all(userId, habitId, to, limit) as any[];
    return rows.map(this.mapHabitLogEntity);
  }

  private mapFoodEntity = (row: any): FoodEntity => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    normalizedName: row.normalized_name,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatsPer100g: row.fats_per_100g,
    cookingMethod: row.cooking_method || "",
    isEdible: row.is_edible,
    source: row.source,
    confidence: row.confidence,
  });

  private mapUnitEntity = (row: any): FoodUnitEntity => ({
    id: row.id,
    foodId: row.food_id,
    unitName: row.unit_name,
    gramsPerUnit: row.grams_per_unit,
    isDefault: row.is_default,
    source: row.source,
    confidence: row.confidence,
  });

  private mapBodyMetricEntity = (row: any): BodyMetricEntity => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    weight: row.weight,
    chest: row.chest,
    waist: row.waist,
    thigh: row.thigh,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  private mapFastingLogEntity = (row: any): FastingLogEntity => ({
    id: row.id,
    userId: row.user_id,
    planType: row.plan_type,
    startTime: row.start_time,
    targetEndTime: row.target_end_time,
    actualEndTime: row.actual_end_time,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  private mapHabitEntity = (row: any): HabitEntity => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    frequencyType: row.frequency_type,
    frequencyValue: row.frequency_value,
    targetValue: row.target_value,
    unit: row.unit,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  private mapHabitLogEntity = (row: any): HabitLogEntity => ({
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    date: row.date,
    status: row.status,
    actualValue: row.actual_value,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const db = new FitTrackDB();

