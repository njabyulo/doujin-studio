import {
  apiErrorSchema,
  healthResponseSchema,
  meResponseSchema,
  projectListResponseSchema,
  projectResponseSchema,
  versionResponseSchema,
} from "@doujin/contracts";
import { convertSetCookieToCookie } from "better-auth/test";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const AUTH_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY NOT NULL,
    "email" text NOT NULL,
    "email_verified" integer NOT NULL DEFAULT 0,
    "name" text,
    "image" text,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "expires_at" integer NOT NULL,
    "token" text NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token")`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL,
    "provider_id" text NOT NULL,
    "user_id" text NOT NULL,
    "access_token" text,
    "refresh_token" text,
    "id_token" text,
    "access_token_expires_at" integer,
    "refresh_token_expires_at" integer,
    "scope" text,
    "password" text,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id")`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" integer NOT NULL,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "jwks" (
    "id" text PRIMARY KEY NOT NULL,
    "public_key" text NOT NULL,
    "private_key" text NOT NULL,
    "created_at" integer NOT NULL,
    "expires_at" integer
  )`,
  `CREATE TABLE IF NOT EXISTS "project" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "title" text NOT NULL,
    "media_plan_json" text,
    "active_checkpoint_id" text,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "project_user_id_idx" ON "project" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "project_active_checkpoint_id_idx" ON "project" ("active_checkpoint_id")`,
  `CREATE TABLE IF NOT EXISTS "project_member" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "user_id" text NOT NULL,
    "role" text NOT NULL DEFAULT 'owner',
    "created_at" integer NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "project_member_project_user_unique" ON "project_member" ("project_id", "user_id")`,
  `CREATE INDEX IF NOT EXISTS "project_member_project_id_idx" ON "project_member" ("project_id")`,
  `CREATE INDEX IF NOT EXISTS "project_member_user_id_idx" ON "project_member" ("user_id")`,
];

const CLEAR_TABLE_STATEMENTS = [
  `DELETE FROM "project_member"`,
  `DELETE FROM "project"`,
  `DELETE FROM "session"`,
  `DELETE FROM "account"`,
  `DELETE FROM "verification"`,
  `DELETE FROM "jwks"`,
  `DELETE FROM "user"`,
];

async function createAuthSession(email: string) {
  const response = await SELF.fetch("https://example.com/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Test User",
      email,
      password: "Password123!",
    }),
  });

  expect(response.status).toBe(200);

  const cookieHeaders = convertSetCookieToCookie(new Headers(response.headers));
  const cookie = cookieHeaders.get("cookie");
  expect(cookie).toBeTruthy();

  return { cookie: cookie as string };
}

async function createProject(cookie: string, title: string) {
  const response = await SELF.fetch("https://example.com/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ title }),
  });

  expect(response.status).toBe(201);
  const body = projectResponseSchema.parse(await response.json());
  return body.project;
}

describe("api worker", () => {
  beforeEach(async () => {
    for (const statement of AUTH_SCHEMA_STATEMENTS) {
      await env.DB.prepare(statement).run();
    }

    for (const statement of CLEAR_TABLE_STATEMENTS) {
      await env.DB.prepare(statement).run();
    }
  });

  it("serves health at root and /api with request IDs", async () => {
    const rootResponse = await SELF.fetch("https://example.com/health");
    expect(rootResponse.status).toBe(200);
    expect(rootResponse.headers.get("x-request-id")).toBeTruthy();

    const rootBody = await rootResponse.json();
    expect(healthResponseSchema.parse(rootBody)).toEqual({ ok: true });

    const prefixedResponse = await SELF.fetch("https://example.com/api/health");
    expect(prefixedResponse.status).toBe(200);
    expect(prefixedResponse.headers.get("x-request-id")).toBeTruthy();

    const prefixedBody = await prefixedResponse.json();
    expect(healthResponseSchema.parse(prefixedBody)).toEqual({ ok: true });
  });

  it("returns version and commit metadata", async () => {
    const response = await SELF.fetch("https://example.com/version");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = versionResponseSchema.parse(await response.json());
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.commitSha).toBe("test-sha");
  });

  it("returns standard error shape on unknown routes", async () => {
    const response = await SELF.fetch("https://example.com/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTruthy();
  });

  it("rejects unauthenticated /me requests", async () => {
    const response = await SELF.fetch("https://example.com/me");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns authenticated user for session-cookie requests", async () => {
    const { cookie } = await createAuthSession("session-user@example.com");

    const response = await SELF.fetch("https://example.com/me", {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = meResponseSchema.parse(await response.json());
    expect(body.user.email).toBe("session-user@example.com");
    expect(body.tenant.type).toBe("user");
    expect(body.tenant.id).toBe(body.user.id);
  });

  it("returns authenticated user for JWT bearer requests", async () => {
    const { cookie } = await createAuthSession("jwt-user@example.com");

    const tokenResponse = await SELF.fetch("https://example.com/api/auth/token", {
      headers: {
        cookie,
      },
    });

    expect(tokenResponse.status).toBe(200);
    const tokenBody = (await tokenResponse.json()) as { token: string };
    expect(tokenBody.token).toBeTruthy();

    const meResponse = await SELF.fetch("https://example.com/me", {
      headers: {
        authorization: `Bearer ${tokenBody.token}`,
      },
    });

    expect(meResponse.status).toBe(200);
    expect(meResponse.headers.get("x-request-id")).toBeTruthy();

    const body = meResponseSchema.parse(await meResponse.json());
    expect(body.user.email).toBe("jwt-user@example.com");
    expect(body.tenant.type).toBe("user");
  });

  it("rejects unauthenticated project creation", async () => {
    const response = await SELF.fetch("https://example.com/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "My Project" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates a project for the authenticated user", async () => {
    const { cookie } = await createAuthSession("create-project-user@example.com");
    const response = await SELF.fetch("https://example.com/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ title: "  Brand Campaign  " }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = projectResponseSchema.parse(await response.json());
    expect(body.project.id).toBeTruthy();
    expect(body.project.title).toBe("Brand Campaign");
    expect(body.project.role).toBe("owner");
  });

  it("returns BAD_REQUEST for invalid project payload", async () => {
    const { cookie } = await createAuthSession("invalid-project-user@example.com");
    const response = await SELF.fetch("https://example.com/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ title: "" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("lists only projects that belong to the current user membership", async () => {
    const { cookie: userACookie } = await createAuthSession("projects-a@example.com");
    const { cookie: userBCookie } = await createAuthSession("projects-b@example.com");

    const userAProjectOne = await createProject(userACookie, "User A Project 1");
    const userAProjectTwo = await createProject(userACookie, "User A Project 2");
    await createProject(userBCookie, "User B Project");

    const response = await SELF.fetch("https://example.com/projects", {
      headers: {
        cookie: userACookie,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = projectListResponseSchema.parse(await response.json());
    expect(body.projects).toHaveLength(2);
    expect(body.projects.map((project) => project.id)).toEqual([
      userAProjectTwo.id,
      userAProjectOne.id,
    ]);
    expect(body.projects.every((project) => project.role === "owner")).toBe(true);
  });

  it("rejects unauthenticated project listing", async () => {
    const response = await SELF.fetch("https://example.com/projects");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = apiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns a project when the user is a member", async () => {
    const { cookie } = await createAuthSession("get-project-user@example.com");
    const created = await createProject(cookie, "Feature Film");

    const response = await SELF.fetch(
      `https://example.com/projects/${created.id}`,
      {
        headers: { cookie },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = projectResponseSchema.parse(await response.json());
    expect(body.project.id).toBe(created.id);
    expect(body.project.title).toBe("Feature Film");
    expect(body.project.role).toBe("owner");
  });

  it("returns NOT_FOUND for non-member or missing project access", async () => {
    const { cookie: ownerCookie } = await createAuthSession("owner@example.com");
    const { cookie: outsiderCookie } = await createAuthSession("outsider@example.com");
    const created = await createProject(ownerCookie, "Private Project");

    const nonMemberResponse = await SELF.fetch(
      `https://example.com/projects/${created.id}`,
      {
        headers: { cookie: outsiderCookie },
      },
    );

    expect(nonMemberResponse.status).toBe(404);
    expect(nonMemberResponse.headers.get("x-request-id")).toBeTruthy();
    const nonMemberBody = apiErrorSchema.parse(await nonMemberResponse.json());
    expect(nonMemberBody.error.code).toBe("NOT_FOUND");

    const missingResponse = await SELF.fetch(
      "https://example.com/projects/does-not-exist",
      {
        headers: { cookie: ownerCookie },
      },
    );

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.headers.get("x-request-id")).toBeTruthy();
    const missingBody = apiErrorSchema.parse(await missingResponse.json());
    expect(missingBody.error.code).toBe("NOT_FOUND");
  });
});
