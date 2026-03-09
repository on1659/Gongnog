import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { createSession } from '$lib/server/auth.js';
import bcrypt from 'bcryptjs';

export async function POST({ request, cookies }) {
  const { username, password } = await request.json();
  if (!username || !password) return json({ ok: false, message: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
  if (username.length < 2) return json({ ok: false, message: '아이디는 2자 이상이어야 합니다.' }, { status: 400 });
  if (password.length < 4) return json({ ok: false, message: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  let user;
  try {
    const r = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username', [username, hash]);
    user = r.rows[0];
  } catch (e) {
    if (e.code === '23505') return json({ ok: false, message: '이미 존재하는 아이디입니다.' }, { status: 409 });
    throw e;
  }

  await pool.query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

  const session = await createSession(user.id);
  cookies.set('session', session.id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 });
  return json({ ok: true, username: user.username });
}
