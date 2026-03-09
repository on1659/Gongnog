import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

function toCC(row) {
  return {
    bufferMin: row.buffer_min,
    maxOtMin: row.max_ot_min,
    mealPriceWeekday: row.meal_price_weekday,
    mealPriceWeekend: row.meal_price_weekend,
    mealMorningStart: row.meal_morning_start,
    mealMorningEnd: row.meal_morning_end,
    mealEveningStart: row.meal_evening_start,
    mealEveningEnd: row.meal_evening_end,
    mealMinOverlap: row.meal_min_overlap,
    mealWeekendMinMin: row.meal_weekend_min_min,
    accTheme: row.acc_theme,
    bgTheme: row.bg_theme,
  };
}

export async function GET({ locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const r = await pool.query('SELECT * FROM settings WHERE user_id = $1', [locals.user.user_id]);
  if (!r.rows[0]) return json({ bufferMin:60, maxOtMin:240, mealPriceWeekday:9000, mealPriceWeekend:9000, mealMorningStart:420, mealMorningEnd:540, mealEveningStart:1080, mealEveningEnd:1260, mealMinOverlap:60, mealWeekendMinMin:60, accTheme:'blue', bgTheme:'light' });
  return json(toCC(r.rows[0]));
}

export async function PUT({ request, locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const body = await request.json();
  const map = {
    bufferMin:'buffer_min', maxOtMin:'max_ot_min',
    mealPriceWeekday:'meal_price_weekday', mealPriceWeekend:'meal_price_weekend',
    mealMorningStart:'meal_morning_start', mealMorningEnd:'meal_morning_end',
    mealEveningStart:'meal_evening_start', mealEveningEnd:'meal_evening_end',
    mealMinOverlap:'meal_min_overlap', mealWeekendMinMin:'meal_weekend_min_min',
    accTheme:'acc_theme', bgTheme:'bg_theme',
  };
  const sets = [], vals = [];
  let i = 1;
  for (const [cc, sc] of Object.entries(map)) {
    if (body[cc] !== undefined) { sets.push(`${sc} = $${i++}`); vals.push(body[cc]); }
  }
  if (!sets.length) return json({ ok: true });
  vals.push(locals.user.user_id);
  await pool.query(`UPDATE settings SET ${sets.join(',')} WHERE user_id = $${i}`, vals);
  return json({ ok: true });
}
