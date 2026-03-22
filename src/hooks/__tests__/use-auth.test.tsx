import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { useAuth } from "../use-auth";

// --- Mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (input: unknown) => mockCreateProject(input),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Tests ---

describe("useAuth", () => {
  describe("signIn", () => {
    test("returns result and sets isLoading during call", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid" });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("a@b.com", "pass");
      });

      expect(result.current.isLoading).toBe(false);
      expect(returnValue).toEqual({ success: false, error: "Invalid" });
      expect(mockSignIn).toHaveBeenCalledWith("a@b.com", "pass");
    });

    test("migrates anonymous work on successful sign in", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: { files: {} },
      });
      mockCreateProject.mockResolvedValue({ id: "proj-anon" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "hello" }],
          data: { files: {} },
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-anon");
    });

    test("redirects to most recent project when no anon work", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "proj-1" },
        { id: "proj-2" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    test("creates new project when no anon work and no existing projects", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "proj-new" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
      expect(mockPush).toHaveBeenCalledWith("/proj-new");
    });

    test("does not redirect on failed sign in", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Wrong password" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading even if signIn throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(result.current.signIn("a@b.com", "pass")).rejects.toThrow(
          "Network error"
        );
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("calls signUp action and migrates anon work on success", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "hi" }],
        fileSystemData: {},
      });
      mockCreateProject.mockResolvedValue({ id: "proj-signup" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@user.com", "pass123");
      });

      expect(mockSignUp).toHaveBeenCalledWith("new@user.com", "pass123");
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-signup");
    });

    test("does not redirect on failed sign up", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email taken" });

      const { result } = renderHook(() => useAuth());

      const returnValue = await act(async () => {
        return await result.current.signUp("taken@b.com", "pass");
      });

      expect(returnValue).toEqual({ success: false, error: "Email taken" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading even if signUp throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(
          result.current.signUp("a@b.com", "pass")
        ).rejects.toThrow("Server error");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("treats anon work with empty messages as no anon work", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      mockGetProjects.mockResolvedValue([{ id: "proj-existing" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      // Should skip anon work migration and go to existing project
      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-existing");
    });
  });
});
