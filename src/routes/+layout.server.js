import { redirect } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function load({ locals, url }) {
  if (!locals.user && url.pathname !== '/login') {
    throw redirect(302, '/login');
  }
  if (locals.user && url.pathname === '/login') {
    throw redirect(302, '/');
  }

  let theme = { accTheme: 'blue', bgTheme: 'light' };
  if (locals.user) {
    const r = await pool.query('SELECT acc_theme, bg_theme FROM settings WHERE user_id = $1', [locals.user.user_id]);
    if (r.rows[0]) {
      theme = { accTheme: r.rows[0].acc_theme, bgTheme: r.rows[0].bg_theme };
    }
  }

  return { user: locals.user, theme };
}
