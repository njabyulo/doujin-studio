import { auth } from "~/lib/auth";
import { createUnauthorizedError } from "~/lib/error-helpers";

export async function requireAuth(request: Request, correlationId: string) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return {
      error: createUnauthorizedError(correlationId),
      user: null,
    };
  }

  return {
    error: null,
    user: session.user,
  };
}
