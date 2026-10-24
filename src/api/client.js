const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
).replace(/\/+$/, "");
const CSRF_HEADER = "x-aegis-csrf";
const LOGOUT_EVENT = "aegis:auth-failed";

let refreshRequest;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function signalLogout() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOGOUT_EVENT));
  }
}

function refreshSession() {
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

async function responseError(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return new ApiError(
    payload?.message || `Request failed with status ${response.status}`,
    response.status,
    payload?.code
  );
}

async function parseResponse(response) {
  if (!response.ok) {
    throw await responseError(response);
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

async function request(path, options = {}, retryOnUnauthorized = true) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set(CSRF_HEADER, "1");
  }

  const requestOptions = {
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
    let refreshed;
    try {
      refreshed = await refreshSession();
    } catch (error) {
      signalLogout();
      throw error;
    }

    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, requestOptions);
      if (retryResponse.status === 401) {
        signalLogout();
      }
      return parseResponse(retryResponse);
    }

    signalLogout();
  }

  return parseResponse(response);
}

export async function login(credentials) {
  const response = await request(
    "/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    },
    false
  );
  return response.user;
}

export function logout() {
  return request("/auth/logout", { method: "POST" }, false);
}

export async function getMe() {
  const response = await request("/auth/me");
  return response.user;
}

export function getDashboard() {
  return request("/dashboard");
}

export function getTools(filters = {}, options = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  return request(`/tools${query}`, options);
}

export function createTool(tool) {
  return request("/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
}
