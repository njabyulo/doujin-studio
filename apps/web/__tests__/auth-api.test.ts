import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../lib/assets-api";
import {
  getSessionOrMe,
  signInEmail,
  signOut,
  signUpEmail,
} from "../lib/auth-api";

describe("auth api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls sign in endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }) as Response);

    await signInEmail({ email: "test@example.com", password: "Password123!" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/sign-in/email"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("maps auth errors to ApiClientError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid" } }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      ) as Response,
    );

    await expect(
      signInEmail({ email: "test@example.com", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it("supports sign up and sign out", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }) as Response);

    await signUpEmail({
      name: "Test User",
      email: "test@example.com",
      password: "Password123!",
    });
    await signOut();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches current session user", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "u1", email: "a@b.com", name: null, image: null },
          tenant: { type: "user", id: "u1" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ) as Response,
    );

    const me = await getSessionOrMe();
    expect(me.user.id).toBe("u1");
  });
});
