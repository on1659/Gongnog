import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

const VALID_FLAGS = [1, 2, 4, 8];

export async function GET({ locals }) {
  if (!locals.user) return json({ ok: true, flags: 0 });
  const r = await pool.query(
    'SELECT tutorial_flags FROM users WHERE id = $1',
    [locals.user.user_id]
  );
  return json({ ok: true, flags: r.rows[0]?.tutorial_flags || 0 });
}

export async function POST({ request, locals }) {
  if (!locals.user) return new Response(null, { status: 401 });
  const { flag } = await request.json();
  if (!VALID_FLAGS.includes(flag)) return json({ ok: false, message: 'Invalid flag' }, { status: 400 });
  const r = await pool.query(
    'SELECT tutorial_flags FROM users WHERE id = $1',
    [locals.user.user_id]
  );
  const currentFlags = r.rows[0]?.tutorial_flags || 0;
  await pool.query(
    'UPDATE users SET tutorial_flags = $1 WHERE id = $2',
    [currentFlags | flag, locals.user.user_id]
  );
  return json({ ok: true });
}
