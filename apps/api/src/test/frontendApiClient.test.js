import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getDashboard } from "../../../../src/api/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend API client session refresh", () => {
  it("refreshes once and retries the original request with cookie credentials", async () => {
    const dashboard = { kpis: { totalTools: 4 } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      }), { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dashboard), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDashboard()).resolves.toEqual(dashboard);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshOptions] = fetchMock.mock.calls[1];
    expect(refreshUrl).toContain("/auth/refresh");
    expect(refreshOptions.credentials).toBe("include");
    expect(refreshOptions.headers["x-aegis-csrf"]).toBe("1");

    const [retryUrl, retryOptions] = fetchMock.mock.calls[2];
    expect(retryUrl).toContain("/dashboard");
    expect(retryOptions.credentials).toBe("include");
  });

  it("fails with the original API error and signals logout when refresh fails", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 401,
        code: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is invalid or expired",
      }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = getDashboard();
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication is required",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
