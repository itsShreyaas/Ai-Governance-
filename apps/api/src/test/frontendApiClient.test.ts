import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@aegisai/shared";
import { ApiError, getDashboard } from "../../../../src/api/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend API client session refresh", () => {
  it("refreshes once and retries the original request with cookie credentials", async () => {
    const dashboard: DashboardResponse = {
      kpis: {
        totalTools: 4,
        approvedTools: 2,
        pendingTools: 1,
        restrictedTools: 1,
        toolsAddedThisMonth: 0,
        avgReviewDays: null,
        openAssessments: 0,
      },
      statusChartData: [],
      riskChartData: [],
      toolsNeedingReview: [],
      recentAudits: [],
    };
    const fetchMock = vi.fn<typeof fetch>()
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

    const refreshCall = fetchMock.mock.calls[1];
    expect(String(refreshCall?.[0])).toContain("/auth/refresh");
    expect(refreshCall?.[1]?.credentials).toBe("include");
    expect(new Headers(refreshCall?.[1]?.headers).get("x-aegis-csrf")).toBe("1");

    const retryCall = fetchMock.mock.calls[2];
    expect(String(retryCall?.[0])).toContain("/dashboard");
    expect(retryCall?.[1]?.credentials).toBe("include");
  });

  it("fails with the original API error and signals logout when refresh fails", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetchMock = vi.fn<typeof fetch>()
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
