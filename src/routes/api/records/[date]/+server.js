import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { calcRecord } from '$lib/server/calc.js';

export async function PUT({ params, request, locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const { date } = params;
  const { checkIn, checkOut, mealExpense, memo } = await request.json();

  const sr = await pool.query('SELECT * FROM settings WHERE user_id = $1', [locals.user.user_id]);
  const s = sr.rows[0] || { buffer_min:60, max_ot_min:240, meal_morning_start:420, meal_morning_end:540, meal_evening_start:1080, meal_evening_end:1260, meal_min_overlap:60, meal_weekend_min_min:60 };

  const { workMin, otMin, meals } = calcRecord(checkIn, checkOut, date, s);

  await pool.query(`
    INSERT INTO records (user_id, date, check_in, check_out, work_min, ot_min, meals, meal_expense, memo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (user_id, date) DO UPDATE SET
      check_in=$3, check_out=$4, work_min=$5, ot_min=$6, meals=$7, meal_expense=$8, memo=$9
  `, [locals.user.user_id, date, checkIn||null, checkOut||null, workMin, otMin, meals, mealExpense||0, memo||'']);

  return json({ ok: true, record: {
    checkIn: checkIn||null, checkOut: checkOut||null,
    workMin, otMin, meals, mealExpense: mealExpense||0, memo: memo||''
  }});
}

export async function DELETE({ params, locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  await pool.query('DELETE FROM records WHERE user_id = $1 AND date = $2', [locals.user.user_id, params.date]);
  return json({ ok: true });
}
