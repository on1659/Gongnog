export async function load({ locals, url }) {
  const now = new Date();
  const year = parseInt(url.searchParams.get('year') || now.getFullYear());
  const month = parseInt(url.searchParams.get('month') || (now.getMonth() + 1));
  return { user: locals.user, year, month };
}
