// admin-actions: FlowDesk's privileged server-side operations.
//
// The browser only ever holds the public anon/publishable key, so anything that
// needs the service role runs here instead:
//   create-user                 admin only - create an auth user + profile (temp password, forced reset)
//   update-password             self only  - change your own password and clear the first-login reset flag
//                                            (keeps the current session, signs out the others)
//   admin-force-password-reset  admin only - set another user's password and force a reset
//   delete-comment              admin, or the comment's author
//
// Every request must send the caller's access token (Authorization: Bearer <jwt>).
// The function verifies that token itself, so deploy it without the gateway JWT check:
//
//   supabase functions deploy admin-actions --no-verify-jwt
//
// Or paste this file into the dashboard's Edge Function editor (Edge Functions >
// Deploy a new function > Via Editor), name it exactly "admin-actions", and turn
// JWT verification off in the function's settings (it also works with it left on).
//
// Environment (auto-injected by Supabase, nothing to configure):
//   SUPABASE_URL
//   SUPABASE_SECRET_KEYS ("default" entry, new API keys) or, if absent,
//   SUPABASE_SERVICE_ROLE_KEY (legacy key)
//
// Errors are always returned as HTTP 200 with { error: string }. The frontend calls
// this through supabase.functions.invoke(), which drops the response body on non-2xx
// statuses, so the UI would lose the real error message. The intended status
// (401/403/400/404/500) is still written to the function logs.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// An error with the HTTP status it maps to (used for logging, see note above)
class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Prefer the new-style secret key. Once legacy keys are disabled on a project,
// SUPABASE_SERVICE_ROLE_KEY is still injected but holds a key that no longer works.
function getServiceKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys?.default === 'string' && keys.default) return keys.default;
  } catch {
    // Malformed value: fall back to the legacy key
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || undefined;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Unexpected error';
}

// Reads a required, non-empty string field from the request body
function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `Missing or invalid field: ${field}`);
  }
  return value;
}

// Roles an admin can assign (see user_role in the schema; 'customer' has no UI)
const ASSIGNABLE_ROLES = ['admin', 'developer', 'support_desk', 'branch_manager'];

// The published password of the seeded admin (supabase/migrations/*_seed_admin.sql)
const DEFAULT_ADMIN_PASSWORD = 'Password2026!';

// Same rules as ForcePasswordResetModal, enforced server-side
function validateNewPassword(password: string) {
  if (password === DEFAULT_ADMIN_PASSWORD) {
    throw new HttpError(400, 'Choose a password other than the default setup password');
  }
  if (password.length < 8 || !/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new HttpError(400, 'Password must be at least 8 characters and include a number and a special character');
  }
}

// auth.admin.listUsers() is paginated; walk the pages to find an email
// deno-lint-ignore no-explicit-any
async function findAuthUserByEmail(adminSupabase: any, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u: { email?: string }) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (users.length < 1000) return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) {
      throw new HttpError(500, 'Server misconfigured: admin-actions needs SUPABASE_URL and SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Service-role client: verifies the caller's token and does the privileged work
    const adminSupabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Verify the user who is calling the function
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new HttpError(401, 'Unauthorized');
    }

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);
    if (userError || !user) {
      console.warn('admin-actions: rejected token:', userError?.message ?? 'no user');
      throw new HttpError(401, 'Unauthorized');
    }

    // 2. Load the caller's profile. Deactivated accounts can't use any action
    //    (deactivation only flips profiles.is_active; the auth session stays valid).
    const { data: callerProfile, error: callerError } = await adminSupabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (callerError) throw callerError;
    if (!callerProfile) {
      throw new HttpError(403, 'Forbidden: No FlowDesk profile for this account');
    }
    if (callerProfile.is_active === false) {
      throw new HttpError(403, 'Forbidden: Your account is deactivated');
    }
    const isAdmin = callerProfile?.role === 'admin';

    // 3. Extract action payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Invalid JSON body');
    }
    const { action } = body;

    if (action === 'create-user') {
      // Must be an admin to create users
      if (!isAdmin) {
        throw new HttpError(403, 'Forbidden: Only admins can create users');
      }

      const email = requireString(body, 'email');
      const password = requireString(body, 'password');
      const { full_name, company_name, branch_id, role } = body;

      if (typeof role !== 'string' || !ASSIGNABLE_ROLES.includes(role)) {
        throw new HttpError(400, 'Missing or invalid field: role');
      }

      let newUserId: string;

      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        const alreadyRegistered = (authError as { code?: string }).code === 'email_exists'
          || authError.message.toLowerCase().includes('already been registered');
        if (alreadyRegistered) {
          // Only recover accounts without an active profile (e.g. added in the Supabase
          // dashboard, or previously deactivated). Never take over an active user.
          const existingUser = await findAuthUserByEmail(adminSupabase, email);
          if (!existingUser) throw authError;

          const { data: existingProfile, error: existingProfileError } = await adminSupabase
            .from('profiles')
            .select('id, is_active')
            .eq('id', existingUser.id)
            .maybeSingle();
          if (existingProfileError) throw existingProfileError;
          if (existingProfile?.is_active) {
            throw new HttpError(409, 'A user with this email already exists');
          }

          newUserId = existingUser.id;

          // Update their auth password to the new temp password
          const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(newUserId, { password });
          if (updateAuthError) throw updateAuthError;
        } else {
          throw authError;
        }
      } else {
        newUserId = authData.user.id;
      }

      // Ensure the user's profile is updated correctly.
      // Use UPSERT so it recovers them if the trigger failed or row was manually deleted.
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .upsert({
          id: newUserId,
          email: email.toLowerCase(),
          full_name,
          company_name,
          branch_id: branch_id || null,
          role,
          force_password_reset: true,
          is_active: true // ensure they are active if recovered
        });

      if (profileError) throw profileError;

      return jsonResponse({ success: true, user: authData?.user || { id: newUserId, email } });
    }

    if (action === 'update-password') {
      const { user_id } = body;

      // Users can only update their own password
      if (user_id !== user.id) {
        throw new HttpError(403, 'Forbidden: Cannot update password for another user');
      }

      const password = requireString(body, 'password');
      validateNewPassword(password);

      // Change the password as the caller, through Supabase Auth's own "update user"
      // endpoint. Auth then keeps the session that made this request and signs out
      // the user's other sessions. auth.admin.updateUserById() would end every
      // session, including this one, so the app would sign the user out right after
      // the first-login reset.
      const authResponse = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      if (!authResponse.ok) {
        const detail = await authResponse.json().catch(() => null);
        throw new HttpError(
          authResponse.status,
          detail?.msg || detail?.message || detail?.error_description || 'Failed to update password',
        );
      }

      // The password really changed, so the first-login reset is done. Clearing the
      // flag only here means the reset screen can't be skipped from the browser.
      const { error: flagError } = await adminSupabase
        .from('profiles')
        .update({ force_password_reset: false })
        .eq('id', user.id);

      if (flagError) throw flagError;

      return jsonResponse({ success: true });
    }

    if (action === 'admin-force-password-reset') {
      // Verify the caller is an admin
      if (!isAdmin) {
        throw new HttpError(403, 'Forbidden: Only admins can force a password reset');
      }

      const target_user_id = requireString(body, 'target_user_id');
      const new_password = requireString(body, 'new_password');

      // Update their actual auth password
      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(target_user_id, {
        password: new_password
      });
      if (updateError) throw updateError;

      // Set force_password_reset = true on their public profile
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({ force_password_reset: true })
        .eq('id', target_user_id);

      if (profileError) throw profileError;

      return jsonResponse({ success: true });
    }

    if (action === 'delete-comment') {
      const comment_id = requireString(body, 'comment_id');

      const { data: comment, error: commentError } = await adminSupabase
        .from('ticket_comments')
        .select('author_id')
        .eq('id', comment_id)
        .maybeSingle();

      if (commentError) throw commentError;
      if (!comment) throw new HttpError(404, 'Comment not found');

      // Admins can delete any comment; everyone else only their own
      if (!isAdmin && comment.author_id !== user.id) {
        throw new HttpError(403, 'Forbidden: You can only delete your own comments');
      }

      const { error: delError } = await adminSupabase
        .from('ticket_comments')
        .delete()
        .eq('id', comment_id);

      if (delError) throw delError;

      return jsonResponse({ success: true });
    }

    throw new HttpError(400, 'Invalid action');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = errorMessage(err);
    console.error(`admin-actions error (${status}):`, message);
    // HTTP 200 on purpose; see the note at the top of this file
    return jsonResponse({ error: message });
  }
});
