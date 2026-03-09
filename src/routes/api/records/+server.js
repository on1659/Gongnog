import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET({ locals, url }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  const r = await pool.query(
    `SELECT date, check_in, check_out, work_min, ot_min, meals, meal_expense, memo FROM records WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3`,
    [locals.user.user_id, year, month]
  );
  const out = {};
  for (const row of r.rows) {
    const key = row.date.toISOString().slice(0,10);
    out[key] = {
      checkIn: row.check_in ? row.check_in.slice(0,5) : null,
      checkOut: row.check_out ? row.check_out.slice(0,5) : null,
      workMin: row.work_min,
      otMin: row.ot_min,
      meals: row.meals,
      mealExpense: row.meal_expense,
      memo: row.memo,
    };
  }
  return json(out);
}
