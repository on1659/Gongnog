import { validateSession } from '$lib/server/auth.js';
import { init } from '$lib/server/db.js';

await init();

export async function handle({ event, resolve }) {
  const sessionId = event.cookies.get('session');
  const user = await validateSession(sessionId);
  event.locals.user = user;
  return resolve(event);
}
