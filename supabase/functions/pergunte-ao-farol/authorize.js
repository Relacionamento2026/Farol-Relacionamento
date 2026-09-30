// Uses the caller's JWT for both Auth verification and RLS-protected profile read.
// No service_role, browser profile, or decoded/unverified JWT is trusted.
export async function authorize(req, env, request = fetch) {
  const token = req.headers.get('authorization') || '';
  if (!/^Bearer \S+$/i.test(token)) return 401;
  const url = env.get('SUPABASE_URL');
  const key = env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return 503;
  const options = {headers: {Authorization: token, apikey: key}, signal: AbortSignal.timeout(8000)};
  try {
    const auth = await request(url + '/auth/v1/user', options);
    if (!auth.ok) return auth.status >= 500 ? 503 : 401;
    const user = await auth.json();
    if (!user.id) return 401;
    const profile = await request(url + '/rest/v1/profiles?select=id,ativo&id=eq.' + encodeURIComponent(user.id), options);
    if (!profile.ok) return 503;
    const rows = await profile.json();
    return Array.isArray(rows) && rows.length === 1 && rows[0].id === user.id && rows[0].ativo === 'ativo' ? 200 : 403;
  } catch { return 503; }
}
