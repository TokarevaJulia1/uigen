// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("next/server", () => ({
  NextRequest: class {},
}));

import { createSession, getSession } from "../auth";

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets a JWT cookie with correct options", async () => {
  await createSession("user-123", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];

  expect(name).toBe(COOKIE_NAME);
  expect(typeof token).toBe("string");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.secure).toBe(false);
  expect(options.expires).toBeInstanceOf(Date);

  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("createSession sets expiry 7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const options = mockCookieStore.set.mock.calls[0][2];
  const expiryTime = options.expires.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  expect(expiryTime).toBeGreaterThanOrEqual(before + sevenDays);
  expect(expiryTime).toBeLessThanOrEqual(after + sevenDays);
});

test("getSession returns payload for valid token", async () => {
  // Create a session first to get a real token
  await createSession("user-456", "user@example.com");
  const token = mockCookieStore.set.mock.calls[0][1];

  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-456");
  expect(session!.email).toBe("user@example.com");
});

test("getSession returns null when no cookie exists", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for invalid token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "invalid-token" });

  const session = await getSession();
  expect(session).toBeNull();
});
