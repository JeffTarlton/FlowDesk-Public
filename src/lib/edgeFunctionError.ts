import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

// admin-actions reports its own failures as HTTP 200 + { error }, so an error from
// supabase.functions.invoke means the function could not be reached. On a new install
// that almost always means it has not been deployed yet.
export function describeAdminActionsError(error: unknown, fallback: string): string {
  if (
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError ||
    (error instanceof FunctionsHttpError && error.context?.status === 404)
  ) {
    return 'The admin-actions Edge Function is not deployed or not reachable. Deploy it (see docs/SETUP.md, "supabase functions deploy admin-actions") and try again.';
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
