import {
  AuditEventListItemSchema,
  AuditVerificationResponseSchema,
  AuthUserResponseSchema,
  DashboardResponseSchema,
  ToolResponseSchema,
  paginatedResponseSchema,
  type AuditEventListItem,
  type AuditExportQuery,
  type AuditListQuery,
  type AuditVerificationResponse,
  type AuthUser,
  type CreateToolInput,
  type DashboardResponse,
  type LoginInput,
  type PaginatedResponse,
  type ToolListQuery,
  type ToolResponse,
} from "@aegisai/shared";
import { z, type ZodType } from "zod";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const CSRF_HEADER = "x-aegis-csrf";
const LOGOUT_EVENT = "aegis:auth-failed";

let refreshRequest: Promise<boolean> | undefined;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code: string | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function signalLogout(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOGOUT_EVENT));
  }
}

function queryString(filters: object): string {
  const searchParams = new URLSearchParams();
  for (const key of Object.keys(filters)) {
    const value: unknown = Reflect.get(filters, key);
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  return searchParams.size > 0 ? `?${searchParams.toString()}` : "";
}

function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { [CSRF_HEADER]: "1" },
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshRequest = undefined;
      });
  }
  return refreshRequest;
}

async function responseError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const message =
    isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}`;
  const code = isRecord(payload) && typeof payload.code === "string" ? payload.code : undefined;
  return new ApiError(message, response.status, code);
}

async function parseResponse<T>(
  response: Response,
  schema: ZodType<T>,
  responseType: "json" | "blob"
): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  if (response.status === 204) {
    return schema.parse(undefined);
  }
  const payload: unknown = responseType === "blob" ? await response.blob() : await response.json();
  return schema.parse(payload);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true,
  schema: ZodType<T>,
  responseType: "json" | "blob" = "json"
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set(CSRF_HEADER, "1");
  }

  const requestOptions: RequestInit = {
    ...options,
    method,
    credentials: "include",
    headers,
  };
  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    !["/auth/login", "/auth/logout", "/auth/refresh"].includes(path)
  ) {
    let refreshed: boolean;
    try {
      refreshed = await refreshSession();
    } catch (error: unknown) {
      signalLogout();
      throw error;
    }

    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, requestOptions);
      if (retryResponse.status === 401) {
        signalLogout();
      }
      return parseResponse(retryResponse, schema, responseType);
    }

    signalLogout();
  }

  return parseResponse(response, schema, responseType);
}

const EmptyResponseSchema = z.undefined();
const BlobResponseSchema = z.instanceof(Blob);
const ToolListResponseSchema = paginatedResponseSchema(ToolResponseSchema);
const AuditListResponseSchema = paginatedResponseSchema(AuditEventListItemSchema);

export async function login(credentials: LoginInput): Promise<AuthUser> {
  const response = await request(
    "/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    },
    false,
    AuthUserResponseSchema
  );
  return response.user;
}

export function logout(): Promise<void> {
  return request("/auth/logout", { method: "POST" }, false, EmptyResponseSchema);
}

export async function getMe(): Promise<AuthUser> {
  const response = await request("/auth/me", {}, true, AuthUserResponseSchema);
  return response.user;
}

export function getDashboard(options: Pick<RequestInit, "signal"> = {}): Promise<DashboardResponse> {
  return request("/dashboard", options, true, DashboardResponseSchema);
}

export function getTools(
  filters: Partial<ToolListQuery> = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<PaginatedResponse<ToolResponse>> {
  return request(`/tools${queryString(filters)}`, options, true, ToolListResponseSchema);
}

export function createTool(tool: CreateToolInput): Promise<ToolResponse> {
  return request(
    "/tools",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tool),
    },
    true,
    ToolResponseSchema
  );
}

export function getAudit(
  filters: AuditFilters = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<PaginatedResponse<AuditEventListItem>> {
  return request(`/audit${queryString(filters)}`, options, true, AuditListResponseSchema);
}

export function getAuditExport(filters: AuditFilters = {}): Promise<Blob> {
  return request(`/audit/export${queryString(filters)}`, {}, true, BlobResponseSchema, "blob");
}

export function verifyAuditChain(): Promise<AuditVerificationResponse> {
  return request("/audit/verify", {}, true, AuditVerificationResponseSchema);
}

type AuditFilters = Omit<Partial<AuditListQuery & AuditExportQuery>, "from" | "to"> & {
  from?: Date | string;
  to?: Date | string;
};
