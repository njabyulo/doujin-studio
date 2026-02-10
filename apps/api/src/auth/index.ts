import { createDb } from "@doujin/database/client";
import * as dbSchema from "@doujin/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import type { AppBindings } from "../types";

const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 50_000;
const PASSWORD_SALT_BYTES = 16;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left[i] ^ right[i];
  }
  return out === 0;
}

async function hashPassword(password: string) {
  const normalized = password.normalize("NFKC");
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const derived = new Uint8Array(bits);
  return `${PASSWORD_HASH_PREFIX}:${PASSWORD_ITERATIONS}:${toBase64Url(salt)}:${toBase64Url(derived)}`;
}

async function verifyPassword(args: { hash: string; password: string }) {
  const parts = args.hash.split(":");
  if (parts.length !== 4) {
    return false;
  }

  const [prefix, iterationsRaw, saltRaw, derivedRaw] = parts;
  if (prefix !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw ?? "", 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64Url(saltRaw ?? "");
    expected = fromBase64Url(derivedRaw ?? "");
  } catch {
    return false;
  }

  const normalized = args.password.normalize("NFKC");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    key,
    expected.length * 8,
  );
  const derived = new Uint8Array(bits);
  return constantTimeEqual(derived, expected);
}

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function getTrustedOrigins(bindings: AppBindings) {
  const origins = new Set<string>();
  const add = (value: string) => {
    const normalized = toOrigin(value).trim();
    if (normalized) {
      origins.add(normalized);
    }
  };

  add(bindings.CORS_ORIGIN);
  add("http://localhost:8787");
  add("http://127.0.0.1:8787");
  add("http://doujin.njabulomajozi.com");
  add("https://doujin.njabulomajozi.com");

  return [...origins];
}

export function createAuth(bindings: AppBindings) {
  const baseURL = toOrigin(bindings.CORS_ORIGIN);
  const db = createDb(bindings.DB);

  return betterAuth({
    appName: "doujin",
    basePath: "/api/auth",
    baseURL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: dbSchema,
      usePlural: false,
      camelCase: false,
    }),
    secret: bindings.AUTH_SECRET,
    trustedOrigins: getTrustedOrigins(bindings),
    emailAndPassword: {
      enabled: true,
      disableSignUp: bindings.APP_ENV === "production",
      requireEmailVerification: false,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    plugins: [jwt()],
  });
}

export function toAuthRequest(request: Request): Request {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/auth")) {
    return request;
  }

  url.pathname = `/api${url.pathname}`;

  return new Request(url.toString(), request);
}
