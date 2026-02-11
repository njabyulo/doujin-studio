import { createDb } from "@doujin/database/client";
import { user as userTable } from "@doujin/database/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";
import type { AppEnv, SessionRecord, SessionUser } from "../types";

type AuthSessionResult = {
  user: SessionUser;
  session: SessionRecord;
} | null;

type VerifyJwtResult = {
  payload: Record<string, unknown>;
} | null;

const getBearerToken = (headerValue: string | undefined) => {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const parseJwtUser = (payload: Record<string, unknown>): SessionUser | null => {
  const id = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  const image = typeof payload.image === "string" ? payload.image : null;

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    name,
    image,
  };
};

const resolveJwtUser = async (c: Context<AppEnv>) => {
  const token = getBearerToken(c.req.header("authorization"));
  if (!token) {
    return null;
  }

  const auth = createAuth(c.env);
  const verified = (await auth.api.verifyJWT({
    body: { token },
    headers: c.req.raw.headers,
  })) as VerifyJwtResult;

  if (!verified?.payload) {
    return null;
  }

  const fromToken = parseJwtUser(verified.payload);
  if (fromToken) {
    return fromToken;
  }

  const userId =
    typeof verified.payload.sub === "string" ? verified.payload.sub : null;
  if (!userId) {
    return null;
  }

  const db = createDb(c.env.DB);
  const [dbUser] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name ?? null,
    image: dbUser.image ?? null,
  };
};

export const authContextMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    c.set("user", null);
    c.set("session", null);

    try {
      const auth = createAuth(c.env);
      const session = (await auth.api.getSession({
        headers: c.req.raw.headers,
      })) as AuthSessionResult;

      if (session?.user && session.session) {
        c.set("user", {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
        });
        c.set("session", session.session);
        await next();
        return;
      }

      const jwtUser = await resolveJwtUser(c);
      if (jwtUser) {
        c.set("user", jwtUser);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          message: "failed_to_resolve_auth_session",
          requestId: c.get("requestId"),
          error: error instanceof Error ? error.message : "unknown_error",
        }),
      );
    }

    await next();
  },
);
