import { redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
  if (!locals.user && url.pathname !== '/login') {
    throw redirect(302, '/login');
  }
  if (locals.user && url.pathname === '/login') {
    throw redirect(302, '/');
  }
  return { user: locals.user };
}
