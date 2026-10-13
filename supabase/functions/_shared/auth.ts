declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function authResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders });
}

export async function requireAuthenticatedUser(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return authResponse('Sign in to continue.', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('Edge Function auth is missing Supabase environment configuration.');
    return authResponse('Authentication is temporarily unavailable.', 503);
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) return null;
    if (response.status === 401 || response.status === 403) {
      return authResponse('Your session is invalid or has expired. Please sign in again.', 401);
    }
    console.error('Supabase Auth could not validate an Edge Function request.', response.status);
    return authResponse('Authentication is temporarily unavailable.', 503);
  } catch (error) {
    console.error('Could not reach Supabase Auth from an Edge Function.', error);
    return authResponse('Authentication is temporarily unavailable.', 503);
  }
}
