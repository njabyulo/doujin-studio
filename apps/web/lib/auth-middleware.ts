
export async function requireAuth(request: Request, correlationId: string) {
  // Temporarily bypass auth for testing
  return {
    error: null,
    user: { id: "test-user", email: "test@example.com" },
  };

  // const session = await auth.api.getSession({
  //   headers: request.headers,
  // });

  // if (!session?.user) {
  //   return {
  //     error: createUnauthorizedError(correlationId),
  //     user: null,
  //   };
  // }

  // return {
  //   error: null,
  //   user: session.user,
  // };
}
