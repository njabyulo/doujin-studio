import { ApiClientError } from "./assets-api";

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  tenant: {
    type: "user";
    id: string;
  };
};

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function createApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function authRequest(path: string, payload?: unknown) {
  const response = await fetch(createApiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    // Clone response to read text body for debugging without consuming the stream for the json call below
    const errorBody = await response.clone().text();
    console.error(`[auth-api] Request to ${path} failed with status ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });
  }

  const body = (await readJson(response)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.message ?? "Request failed",
    );
  }
}

async function getRequest<T>(path: string) {
  const response = await fetch(createApiUrl(path), {
    method: "GET",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
  });

  const body = (await readJson(response)) as
    | T
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      typeof body === "object" && body && "error" in body
        ? (body.error?.code ?? "INTERNAL_ERROR")
        : "INTERNAL_ERROR",
      typeof body === "object" && body && "error" in body
        ? (body.error?.message ?? "Request failed")
        : "Request failed",
    );
  }

  return body as T;
}

export async function signInEmail(input: { email: string; password: string }) {
  return authRequest("/api/auth/sign-in/email", input);
}

export async function signUpEmail(input: {
  name: string;
  email: string;
  password: string;
}) {
  return authRequest("/api/auth/sign-up/email", input);
}

export async function signOut() {
  return authRequest("/api/auth/sign-out");
}

export async function getSessionOrMe() {
  return getRequest<MeResponse>("/api/me");
}
