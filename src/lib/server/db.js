import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      buffer_min INTEGER DEFAULT 60,
      max_ot_min INTEGER DEFAULT 240,
      meal_price_weekday INTEGER DEFAULT 9000,
      meal_price_weekend INTEGER DEFAULT 9000,
      meal_morning_start INTEGER DEFAULT 420,
      meal_morning_end INTEGER DEFAULT 540,
      meal_evening_start INTEGER DEFAULT 1080,
      meal_evening_end INTEGER DEFAULT 1260,
      meal_min_overlap INTEGER DEFAULT 60,
      meal_weekend_min_min INTEGER DEFAULT 60,
      acc_theme TEXT DEFAULT 'blue',
      bg_theme TEXT DEFAULT 'light'
    );
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      check_in TIME,
      check_out TIME,
      work_min INTEGER,
      ot_min INTEGER,
      meals INTEGER DEFAULT 0,
      meal_expense INTEGER DEFAULT 0,
      memo TEXT DEFAULT '',
      UNIQUE(user_id, date)
    );
  `);

  // 컬럼 추가는 별도 쿼리로 실행 (multi-statement 호환성)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_flags INTEGER DEFAULT 0;
  `);
}
