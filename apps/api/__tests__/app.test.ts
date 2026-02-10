import {
  SAssetResponse as STAssetResponse,
  SAssetUploadSessionResponse as STAssetUploadSessionResponse,
  SApiError,
  SHealthResponse as STHealthResponse,
  SMeResponse,
  SProjectAssetListResponse as STProjectAssetListResponse,
  SProjectListResponse as STProjectListResponse,
  SProjectResponse as STProjectResponse,
  STTimelineWithLatestResponse,
  SVersionResponse as STVersionResponse,
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
  `CREATE TABLE IF NOT EXISTS "assets" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "type" text NOT NULL,
    "status" text NOT NULL DEFAULT 'pending_upload',
    "r2_key" text NOT NULL,
    "size" integer NOT NULL,
    "mime" text NOT NULL,
    "checksum_sha256" text,
    "duration_ms" integer,
    "width" integer,
    "height" integer,
    "poster_asset_id" text,
    "created_at" integer NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("poster_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "assets_r2_key_unique" ON "assets" ("r2_key")`,
  `CREATE INDEX IF NOT EXISTS "assets_project_id_idx" ON "assets" ("project_id")`,
  `CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status")`,
  `CREATE INDEX IF NOT EXISTS "assets_created_at_idx" ON "assets" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "assets_project_type_status_idx" ON "assets" ("project_id", "type", "status")`,
  `CREATE TABLE IF NOT EXISTS "timelines" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL,
    "name" text NOT NULL,
    "latest_version" integer NOT NULL DEFAULT 0,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "timelines_project_unique" ON "timelines" ("project_id")`,
  `CREATE INDEX IF NOT EXISTS "timelines_updated_at_idx" ON "timelines" ("updated_at")`,
  `CREATE TABLE IF NOT EXISTS "timeline_versions" (
    "id" text PRIMARY KEY NOT NULL,
    "timeline_id" text NOT NULL,
    "version" integer NOT NULL,
    "source" text NOT NULL DEFAULT 'system',
    "created_by_user_id" text NOT NULL,
    "data" text NOT NULL,
    "edl_data" text,
    "created_at" integer NOT NULL,
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "timeline_versions_timeline_version_unique" ON "timeline_versions" ("timeline_id", "version")`,
  `CREATE INDEX IF NOT EXISTS "timeline_versions_timeline_created_at_idx" ON "timeline_versions" ("timeline_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "ai_edl_proposals" (
    "id" text PRIMARY KEY NOT NULL,
    "timeline_id" text NOT NULL,
    "base_version" integer NOT NULL,
    "created_by_user_id" text NOT NULL,
    "prompt_excerpt" text NOT NULL,
    "operations_json" text NOT NULL,
    "assistant_summary" text NOT NULL,
    "expires_at" integer NOT NULL,
    "consumed_at" integer,
    "created_at" integer NOT NULL,
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_edl_proposals_timeline_created_idx" ON "ai_edl_proposals" ("timeline_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "ai_edl_proposals_expires_idx" ON "ai_edl_proposals" ("expires_at")`,
  `CREATE TABLE IF NOT EXISTS "ai_chat_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "project_id" text NOT NULL,
    "timeline_id" text NOT NULL,
    "model" text NOT NULL,
    "status" text NOT NULL,
    "prompt_excerpt" text NOT NULL,
    "response_excerpt" text NOT NULL,
    "tool_call_count" integer NOT NULL DEFAULT 0,
    "created_at" integer NOT NULL,
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
    FOREIGN KEY ("timeline_id") REFERENCES "timelines"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_chat_logs_user_project_created_idx" ON "ai_chat_logs" ("user_id", "project_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "ai_chat_logs_timeline_created_idx" ON "ai_chat_logs" ("timeline_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "ai_chat_logs_status_created_idx" ON "ai_chat_logs" ("status", "created_at")`,
];

const CLEAR_TABLE_STATEMENTS = [
  `DELETE FROM "ai_chat_logs"`,
  `DELETE FROM "ai_edl_proposals"`,
  `DELETE FROM "timeline_versions"`,
  `DELETE FROM "timelines"`,
  `DELETE FROM "assets"`,
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
  const body = STProjectResponse.parse(await response.json());
  return body.project;
}

async function createUploadSession(
  cookie: string,
  projectId: string,
  overrides: Partial<{
    fileName: string;
    mime: string;
    size: number;
    type: "video" | "poster";
  }> = {},
) {
  const response = await SELF.fetch(
    `https://example.com/projects/${projectId}/assets/upload-session`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        fileName: overrides.fileName ?? "clip.mp4",
        mime: overrides.mime ?? "video/mp4",
        size: overrides.size ?? 128,
        type: overrides.type ?? "video",
      }),
    },
  );

  expect(response.status).toBe(201);
  return STAssetUploadSessionResponse.parse(await response.json());
}

async function completeAssetUpload(
  cookie: string,
  assetId: string,
  payload: {
    size: number;
    checksumSha256?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    posterAssetId?: string;
  },
) {
  const response = await SELF.fetch(`https://example.com/assets/${assetId}/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(payload),
  });

  return response;
}

async function createTimeline(
  cookie: string,
  projectId: string,
  payload: {
    name?: string;
    seedAssetId?: string;
  } = {},
) {
  const response = await SELF.fetch(
    `https://example.com/projects/${projectId}/timelines`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(payload),
    },
  );

  return response;
}

async function getLatestProjectTimeline(cookie: string, projectId: string) {
  const response = await SELF.fetch(
    `https://example.com/projects/${projectId}/timelines/latest`,
    {
      headers: {
        cookie,
      },
    },
  );

  return response;
}

async function getTimeline(cookie: string, timelineId: string) {
  const response = await SELF.fetch(`https://example.com/timelines/${timelineId}`, {
    headers: {
      cookie,
    },
  });

  return response;
}

async function patchTimeline(
  cookie: string,
  timelineId: string,
  payload: {
    baseVersion: number;
    source?: "system" | "autosave" | "manual" | "ai";
    data: unknown;
  },
) {
  const response = await SELF.fetch(`https://example.com/timelines/${timelineId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(payload),
  });

  return response;
}

function createAiChatPayload(
  timelineId: string,
  prompt: string,
  context?: unknown,
) {
  return {
    timelineId,
    messages: [
      {
        id: "user-message-1",
        role: "user" as const,
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    ...(context ? { context } : {}),
  };
}

async function postAiChat(
  cookie: string | null,
  payload: unknown,
  path = "/api/ai/chat",
) {
  const response = await SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ai-test-mode": "1",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });

  return response;
}

async function postApplyEdlProposal(cookie: string, proposalId: string) {
  const response = await SELF.fetch("https://example.com/api/edl/apply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ proposalId }),
  });

  return response;
}

async function createTimelineWithUploadedSeedAsset(cookie: string, projectId: string) {
  const seedPayload = new TextEncoder().encode("seeded-video-blob");
  const uploadSession = await createUploadSession(cookie, projectId, {
    fileName: "seed.mp4",
    mime: "video/mp4",
    size: seedPayload.byteLength,
    type: "video",
  });
  await env.MEDIA_BUCKET.put(uploadSession.r2Key, seedPayload);
  const completeResponse = await completeAssetUpload(cookie, uploadSession.assetId, {
    size: seedPayload.byteLength,
    durationMs: 10_000,
    width: 1280,
    height: 720,
  });
  expect(completeResponse.status).toBe(200);

  const createResponse = await createTimeline(cookie, projectId, {
    seedAssetId: uploadSession.assetId,
    name: "AI Test Timeline",
  });
  expect(createResponse.status).toBe(201);

  return STTimelineWithLatestResponse.parse(await createResponse.json());
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
    expect(STHealthResponse.parse(rootBody)).toEqual({ ok: true });

    const prefixedResponse = await SELF.fetch("https://example.com/api/health");
    expect(prefixedResponse.status).toBe(200);
    expect(prefixedResponse.headers.get("x-request-id")).toBeTruthy();

    const prefixedBody = await prefixedResponse.json();
    expect(STHealthResponse.parse(prefixedBody)).toEqual({ ok: true });
  });

  it("returns version and commit metadata", async () => {
    const response = await SELF.fetch("https://example.com/version");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = STVersionResponse.parse(await response.json());
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.commitSha).toMatch(/\S+/);
  });

  it("returns standard error shape on unknown routes", async () => {
    const response = await SELF.fetch("https://example.com/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = SApiError.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTruthy();
  });

  it("rejects unauthenticated /me requests", async () => {
    const response = await SELF.fetch("https://example.com/me");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const body = SApiError.parse(await response.json());
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

    const body = SMeResponse.parse(await response.json());
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

    const body = SMeResponse.parse(await meResponse.json());
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

    const body = SApiError.parse(await response.json());
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

    const body = STProjectResponse.parse(await response.json());
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

    const body = SApiError.parse(await response.json());
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

    const body = STProjectListResponse.parse(await response.json());
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

    const body = SApiError.parse(await response.json());
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

    const body = STProjectResponse.parse(await response.json());
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
    const nonMemberBody = SApiError.parse(await nonMemberResponse.json());
    expect(nonMemberBody.error.code).toBe("NOT_FOUND");

    const missingResponse = await SELF.fetch(
      "https://example.com/projects/does-not-exist",
      {
        headers: { cookie: ownerCookie },
      },
    );

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.headers.get("x-request-id")).toBeTruthy();
    const missingBody = SApiError.parse(await missingResponse.json());
    expect(missingBody.error.code).toBe("NOT_FOUND");
  });

  it("creates an upload session and fetches the pending asset", async () => {
    const { cookie } = await createAuthSession("asset-session@example.com");
    const createdProject = await createProject(cookie, "Asset Session Project");
    const uploadSession = await createUploadSession(cookie, createdProject.id, {
      fileName: "trailer.mov",
      mime: "video/quicktime",
      size: 456,
      type: "video",
    });

    expect(uploadSession.assetId).toBeTruthy();
    expect(uploadSession.r2Key).toContain(`projects/${createdProject.id}/assets/`);
    expect(uploadSession.putUrl).toContain("X-Amz-");

    const assetResponse = await SELF.fetch(
      `https://example.com/assets/${uploadSession.assetId}`,
      {
        headers: { cookie },
      },
    );

    expect(assetResponse.status).toBe(200);
    const body = STAssetResponse.parse(await assetResponse.json());
    expect(body.asset.id).toBe(uploadSession.assetId);
    expect(body.asset.status).toBe("pending_upload");
    expect(body.asset.mime).toBe("video/quicktime");
  });

  it("rejects unauthenticated upload session creation", async () => {
    const { cookie } = await createAuthSession("asset-auth-owner@example.com");
    const createdProject = await createProject(cookie, "Restricted Upload");
    const response = await SELF.fetch(
      `https://example.com/projects/${createdProject.id}/assets/upload-session`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fileName: "clip.mp4",
          mime: "video/mp4",
          size: 64,
          type: "video",
        }),
      },
    );

    expect(response.status).toBe(401);
    const body = SApiError.parse(await response.json());
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects upload session creation for non-members", async () => {
    const { cookie: ownerCookie } = await createAuthSession("asset-owner@example.com");
    const { cookie: outsiderCookie } = await createAuthSession("asset-outsider@example.com");
    const createdProject = await createProject(ownerCookie, "Owner Project");

    const response = await SELF.fetch(
      `https://example.com/projects/${createdProject.id}/assets/upload-session`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: outsiderCookie,
        },
        body: JSON.stringify({
          fileName: "clip.mp4",
          mime: "video/mp4",
          size: 64,
          type: "video",
        }),
      },
    );

    expect(response.status).toBe(404);
    const body = SApiError.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("completes uploads when object exists in R2 and marks asset uploaded", async () => {
    const { cookie } = await createAuthSession("asset-complete@example.com");
    const createdProject = await createProject(cookie, "Upload Complete");
    const uploadSession = await createUploadSession(cookie, createdProject.id, {
      size: 10,
      mime: "video/mp4",
      type: "video",
    });

    await env.MEDIA_BUCKET.put(uploadSession.r2Key, new TextEncoder().encode("0123456789"));

    const response = await completeAssetUpload(cookie, uploadSession.assetId, {
      size: 10,
      durationMs: 42000,
      width: 1920,
      height: 1080,
      checksumSha256: "sha256-placeholder",
    });

    expect(response.status).toBe(200);
    const body = STAssetResponse.parse(await response.json());
    expect(body.asset.status).toBe("uploaded");
    expect(body.asset.durationMs).toBe(42000);
    expect(body.asset.width).toBe(1920);
    expect(body.asset.height).toBe(1080);
    expect(body.asset.posterAssetId).toBeNull();
  });

  it("rejects completion when object is missing in R2", async () => {
    const { cookie } = await createAuthSession("asset-missing-object@example.com");
    const createdProject = await createProject(cookie, "Missing Object");
    const uploadSession = await createUploadSession(cookie, createdProject.id, {
      size: 99,
      mime: "video/mp4",
      type: "video",
    });

    const response = await completeAssetUpload(cookie, uploadSession.assetId, {
      size: 99,
    });

    expect(response.status).toBe(400);
    const body = SApiError.parse(await response.json());
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("streams asset bytes for authorized users", async () => {
    const { cookie } = await createAuthSession("asset-file-stream@example.com");
    const createdProject = await createProject(cookie, "File Stream");
    const uploadSession = await createUploadSession(cookie, createdProject.id, {
      size: 10,
      mime: "video/mp4",
      type: "video",
    });
    await env.MEDIA_BUCKET.put(uploadSession.r2Key, new TextEncoder().encode("abcdefghij"));
    await completeAssetUpload(cookie, uploadSession.assetId, { size: 10 });

    const response = await SELF.fetch(
      `https://example.com/assets/${uploadSession.assetId}/file`,
      {
        headers: { cookie },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    const payload = await response.text();
    expect(payload).toBe("abcdefghij");
  });

  it("returns ranged responses for partial file reads", async () => {
    const { cookie } = await createAuthSession("asset-file-range@example.com");
    const createdProject = await createProject(cookie, "Range Stream");
    const uploadSession = await createUploadSession(cookie, createdProject.id, {
      size: 10,
      mime: "video/mp4",
      type: "video",
    });
    await env.MEDIA_BUCKET.put(uploadSession.r2Key, new TextEncoder().encode("abcdefghij"));
    await completeAssetUpload(cookie, uploadSession.assetId, { size: 10 });

    const response = await SELF.fetch(
      `https://example.com/assets/${uploadSession.assetId}/file`,
      {
        headers: {
          cookie,
          range: "bytes=2-5",
        },
      },
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    const payload = await response.text();
    expect(payload).toBe("cdef");
  });

  it("rejects asset file reads for non-members", async () => {
    const { cookie: ownerCookie } = await createAuthSession("asset-stream-owner@example.com");
    const { cookie: outsiderCookie } = await createAuthSession("asset-stream-outsider@example.com");
    const createdProject = await createProject(ownerCookie, "Private Asset");
    const uploadSession = await createUploadSession(ownerCookie, createdProject.id, {
      size: 6,
      mime: "video/mp4",
      type: "video",
    });
    await env.MEDIA_BUCKET.put(uploadSession.r2Key, new TextEncoder().encode("secret"));
    await completeAssetUpload(ownerCookie, uploadSession.assetId, { size: 6 });

    const response = await SELF.fetch(
      `https://example.com/assets/${uploadSession.assetId}/file`,
      {
        headers: {
          cookie: outsiderCookie,
        },
      },
    );

    expect(response.status).toBe(404);
    const body = SApiError.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("lists project assets with filters and ordering", async () => {
    const { cookie } = await createAuthSession("asset-list@example.com");
    const createdProject = await createProject(cookie, "Asset Listing");

    const firstUpload = await createUploadSession(cookie, createdProject.id, {
      fileName: "first.mp4",
      mime: "video/mp4",
      size: 5,
      type: "video",
    });
    await env.MEDIA_BUCKET.put(firstUpload.r2Key, new TextEncoder().encode("first"));
    await completeAssetUpload(cookie, firstUpload.assetId, { size: 5 });

    await new Promise((resolve) => setTimeout(resolve, 3));

    const secondUpload = await createUploadSession(cookie, createdProject.id, {
      fileName: "second.mp4",
      mime: "video/mp4",
      size: 6,
      type: "video",
    });
    await env.MEDIA_BUCKET.put(secondUpload.r2Key, new TextEncoder().encode("second"));
    await completeAssetUpload(cookie, secondUpload.assetId, { size: 6 });

    const response = await SELF.fetch(
      `https://example.com/projects/${createdProject.id}/assets?type=video&status=uploaded&limit=1`,
      {
        headers: {
          cookie,
        },
      },
    );

    expect(response.status).toBe(200);
    const body = STProjectAssetListResponse.parse(await response.json());
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe(secondUpload.assetId);
    expect(body.assets[0]?.status).toBe("uploaded");
    expect(body.assets[0]?.type).toBe("video");
  });

  it("creates a timeline and loads latest timeline for a project", async () => {
    const { cookie } = await createAuthSession("timeline-create@example.com");
    const createdProject = await createProject(cookie, "Timeline Create");

    const createResponse = await createTimeline(cookie, createdProject.id, {
      name: "Main Timeline",
    });
    expect(createResponse.status).toBe(201);
    const created = STTimelineWithLatestResponse.parse(
      await createResponse.json(),
    );

    expect(created.timeline.projectId).toBe(createdProject.id);
    expect(created.timeline.latestVersion).toBe(1);
    expect(created.latestVersion.version).toBe(1);
    expect(created.latestVersion.source).toBe("system");
    expect(created.latestVersion.data.schemaVersion).toBe(1);

    const latestResponse = await getLatestProjectTimeline(cookie, createdProject.id);
    expect(latestResponse.status).toBe(200);
    const latest = STTimelineWithLatestResponse.parse(await latestResponse.json());
    expect(latest.timeline.id).toBe(created.timeline.id);
    expect(latest.latestVersion.version).toBe(1);
  });

  it("patches timelines and increments version", async () => {
    const { cookie } = await createAuthSession("timeline-patch@example.com");
    const createdProject = await createProject(cookie, "Timeline Patch");
    const createResponse = await createTimeline(cookie, createdProject.id, {});
    const created = STTimelineWithLatestResponse.parse(
      await createResponse.json(),
    );

    const subtitleTrack = created.latestVersion.data.tracks.find(
      (track) => track.kind === "subtitle",
    );
    expect(subtitleTrack).toBeTruthy();

    const nextData = {
      ...created.latestVersion.data,
      tracks: created.latestVersion.data.tracks.map((track) => {
        if (track.kind !== "subtitle") {
          return track;
        }

        return {
          ...track,
          clips: [
            ...track.clips,
            {
              id: "subtitle-1",
              type: "subtitle" as const,
              trackId: track.id,
              assetId: null,
              startMs: 500,
              endMs: 2000,
              sourceStartMs: 0,
              volume: null,
              text: "Hello world",
            },
          ],
        };
      }),
    };

    const patchResponse = await patchTimeline(cookie, created.timeline.id, {
      baseVersion: created.timeline.latestVersion,
      source: "autosave",
      data: nextData,
    });
    expect(patchResponse.status).toBe(200);
    const patched = STTimelineWithLatestResponse.parse(
      await patchResponse.json(),
    );
    expect(patched.timeline.latestVersion).toBe(2);
    expect(patched.latestVersion.version).toBe(2);
    expect(patched.latestVersion.source).toBe("autosave");

    const getResponse = await getTimeline(cookie, created.timeline.id);
    expect(getResponse.status).toBe(200);
    const fetched = STTimelineWithLatestResponse.parse(await getResponse.json());
    expect(fetched.latestVersion.version).toBe(2);
    expect(
      fetched.latestVersion.data.tracks
        .flatMap((track) => track.clips)
        .some((clip) => clip.id === "subtitle-1"),
    ).toBe(true);
  });

  it("rejects stale timeline versions with BAD_REQUEST", async () => {
    const { cookie } = await createAuthSession("timeline-conflict@example.com");
    const createdProject = await createProject(cookie, "Timeline Conflict");
    const createResponse = await createTimeline(cookie, createdProject.id, {});
    const created = STTimelineWithLatestResponse.parse(
      await createResponse.json(),
    );

    const firstPatch = await patchTimeline(cookie, created.timeline.id, {
      baseVersion: created.timeline.latestVersion,
      source: "autosave",
      data: created.latestVersion.data,
    });
    expect(firstPatch.status).toBe(200);

    const conflictResponse = await patchTimeline(cookie, created.timeline.id, {
      baseVersion: created.timeline.latestVersion,
      source: "autosave",
      data: created.latestVersion.data,
    });
    expect(conflictResponse.status).toBe(400);
    const conflictBody = SApiError.parse(await conflictResponse.json());
    expect(conflictBody.error.code).toBe("BAD_REQUEST");
  });
  it("returns NOT_FOUND for timeline access by non-members", async () => {
    const { cookie: ownerCookie } = await createAuthSession("timeline-owner@example.com");
    const { cookie: outsiderCookie } = await createAuthSession("timeline-outsider@example.com");
    const createdProject = await createProject(ownerCookie, "Timeline Private");
    const createResponse = await createTimeline(ownerCookie, createdProject.id, {});
    const created = STTimelineWithLatestResponse.parse(
      await createResponse.json(),
    );

    const outsiderRead = await getTimeline(outsiderCookie, created.timeline.id);
    expect(outsiderRead.status).toBe(404);
    const outsiderBody = SApiError.parse(await outsiderRead.json());
    expect(outsiderBody.error.code).toBe("NOT_FOUND");

    const outsiderPatch = await patchTimeline(outsiderCookie, created.timeline.id, {
      baseVersion: created.timeline.latestVersion,
      source: "autosave",
      data: created.latestVersion.data,
    });
    expect(outsiderPatch.status).toBe(404);
    const outsiderPatchBody = SApiError.parse(await outsiderPatch.json());
    expect(outsiderPatchBody.error.code).toBe("NOT_FOUND");
  });
});
