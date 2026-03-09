import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';
import { createSession } from '$lib/server/auth.js';
import bcrypt from 'bcryptjs';

export async function POST({ request, cookies }) {
  const { username, password } = await request.json();
  if (!username || !password) return json({ ok: false, message: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });

  const r = await pool.query('SELECT id, username, password FROM users WHERE username = $1', [username]);
  const user = r.rows[0];
  if (!user) return json({ ok: false, message: '아이디 또는 비밀번호가 틀렸습니다.' }, { status: 401 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return json({ ok: false, message: '아이디 또는 비밀번호가 틀렸습니다.' }, { status: 401 });

  const session = await createSession(user.id);
  cookies.set('session', session.id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 });
  return json({ ok: true, username: user.username });
}
