import {
  SApiError,
  SHealthResponse,
  SInterpretPlaybackResponse,
  SMeResponse,
  SProjectListResponse,
  SProjectResponse,
  SVersionResponse,
} from "@doujin/core";
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
  const response = await SELF.fetch(
    "https://example.com/api/auth/sign-up/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Test User",
        email,
        password: "Password123!",
      }),
    },
  );

  expect(response.status).toBe(200);
  const cookieHeaders = convertSetCookieToCookie(new Headers(response.headers));
  const cookie = cookieHeaders.get("cookie");
  expect(cookie).toBeTruthy();

  return { cookie: cookie as string };
}

async function createProject(cookie: string, title: string) {
  const response = await SELF.fetch("https://example.com/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ title }),
  });

  expect(response.status).toBe(201);
  const body = SProjectResponse.parse(await response.json());
  return body.project;
}

describe("api worker (surface pruned for web)", () => {
  beforeEach(async () => {
    for (const statement of AUTH_SCHEMA_STATEMENTS) {
      await (env as any).DB.prepare(statement).run();
    }

    for (const statement of CLEAR_TABLE_STATEMENTS) {
      await (env as any).DB.prepare(statement).run();
    }
  });

  it("serves health under /api only", async () => {
    const okResponse = await SELF.fetch("https://example.com/api/health");
    expect(okResponse.status).toBe(200);
    expect(okResponse.headers.get("x-request-id")).toBeTruthy();
    expect(SHealthResponse.parse(await okResponse.json())).toEqual({
      ok: true,
    });

    const rootResponse = await SELF.fetch("https://example.com/health");
    expect(rootResponse.status).toBe(404);
    expect(rootResponse.headers.get("x-request-id")).toBeTruthy();
    expect(SApiError.parse(await rootResponse.json()).error.code).toBe(
      "NOT_FOUND",
    );
  });

  it("serves version metadata under /api only", async () => {
    const okResponse = await SELF.fetch("https://example.com/api/version");
    expect(okResponse.status).toBe(200);
    expect(okResponse.headers.get("x-request-id")).toBeTruthy();
    const body = SVersionResponse.parse(await okResponse.json());
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.commitSha).toMatch(/\S+/);

    const rootResponse = await SELF.fetch("https://example.com/version");
    expect(rootResponse.status).toBe(404);
    expect(rootResponse.headers.get("x-request-id")).toBeTruthy();
    expect(SApiError.parse(await rootResponse.json()).error.code).toBe(
      "NOT_FOUND",
    );
  });

  it("returns standard error shape on unknown routes", async () => {
    const response = await SELF.fetch("https://example.com/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(SApiError.parse(await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("rejects unauthenticated /api/me requests", async () => {
    const response = await SELF.fetch("https://example.com/api/me");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(SApiError.parse(await response.json()).error.code).toBe(
      "UNAUTHORIZED",
    );
  });

  it("returns authenticated user for session-cookie requests", async () => {
    const { cookie } = await createAuthSession("session-user@example.com");
    const response = await SELF.fetch("https://example.com/api/me", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const body = SMeResponse.parse(await response.json());
    expect(body.user.email).toBe("session-user@example.com");
    expect(body.tenant.type).toBe("user");
    expect(body.tenant.id).toBe(body.user.id);
  });

  it("rejects unauthenticated project listing and creation", async () => {
    const listResponse = await SELF.fetch("https://example.com/api/projects");
    expect(listResponse.status).toBe(401);
    expect(SApiError.parse(await listResponse.json()).error.code).toBe(
      "UNAUTHORIZED",
    );

    const createResponse = await SELF.fetch(
      "https://example.com/api/projects",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "My Project" }),
      },
    );
    expect(createResponse.status).toBe(401);
    expect(SApiError.parse(await createResponse.json()).error.code).toBe(
      "UNAUTHORIZED",
    );
  });

  it("creates and lists projects for the authenticated user", async () => {
    const { cookie } = await createAuthSession("projects-user@example.com");

    const createdOne = await createProject(cookie, "  Brand Campaign  ");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const createdTwo = await createProject(cookie, "Second Project");

    expect(createdOne.id).toBeTruthy();
    expect(createdOne.title).toBe("Brand Campaign");
    expect(createdOne.role).toBe("owner");

    const listResponse = await SELF.fetch("https://example.com/api/projects", {
      headers: { cookie },
    });
    expect(listResponse.status).toBe(200);
    const listBody = SProjectListResponse.parse(await listResponse.json());
    expect(listBody.projects.map((p) => p.id)).toEqual([
      createdTwo.id,
      createdOne.id,
    ]);
  });

  it("does not expose pruned route groups", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/timelines/anything",
    );
    expect(response.status).toBe(404);
    expect(SApiError.parse(await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("interprets playback commands via /api/editor/interpret", async () => {
    const response = await SELF.fetch(
      "https://example.com/api/editor/interpret",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-test-mode": "1" },
        body: JSON.stringify({
          prompt: "go to middle",
          currentMs: 0,
          durationMs: 10_000,
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = SInterpretPlaybackResponse.parse(await response.json());
    expect(body.command.type).toBeTruthy();
  });
});
