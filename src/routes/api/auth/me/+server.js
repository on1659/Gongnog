import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
  if (!locals.user) return json({ ok: false }, { status: 401 });
  return json({ ok: true, username: locals.user.username });
}
