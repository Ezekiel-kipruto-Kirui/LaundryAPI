import { API_BASE_URL } from "./url";
import { ExpenseField, ExpenseRecord, User } from "./types";
import { handleLoginSuccess } from "@/utils/auth";

/* =====================================================
   TOKEN MANAGEMENT
===================================================== */

let accessToken: string | null = null;
let refreshToken: string | null = null;

// Token storage utilities
const tokenStore = {
  getAccess: (): string | null => accessToken || localStorage.getItem("accessToken"),
  getRefresh: (): string | null => refreshToken || localStorage.getItem("refreshToken"),
  set: (access: string | null, refresh: string | null): void => {
    accessToken = access;
    refreshToken = refresh;

    if (access) localStorage.setItem("accessToken", access);
    else localStorage.removeItem("accessToken");

    if (refresh) localStorage.setItem("refreshToken", refresh);
    else localStorage.removeItem("refreshToken");
  },
  clear: (): void => {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
};

// Export token functions (maintaining public API)
export const getAccessToken = tokenStore.getAccess;
export const getRefreshToken = tokenStore.getRefresh;
export const setAuthTokens = tokenStore.set;

/* =====================================================
   CONSTANTS
===================================================== */

const ENDPOINTS = {
  TOKEN: `${API_BASE_URL}/token/`,
  REFRESH: `${API_BASE_URL}/token/refresh/`,
  ME: `${API_BASE_URL}/me/`
} as const;

const DEFAULT_HEADERS = { "Content-Type": "application/json" };

/* =====================================================
   USER UTILITIES
===================================================== */

const normalizeUser = (data: any, fallbackEmail = ""): User => ({
  id: data?.id || data?.pk || 0,
  email: data?.email || fallbackEmail,
  user_type: data?.user_type || (data?.is_superuser ? "admin" : "staff"),
  is_superuser: !!data?.is_superuser,
  is_staff: !!data?.is_staff,
  is_active: data?.is_active ?? true,
  first_name: data?.first_name || "",
  last_name: data?.last_name || "",
  groups: data?.groups || [],
  user_permissions: data?.user_permissions || [],
  last_login: data?.last_login || null,
  date_joined: data?.date_joined || new Date().toISOString(),
});

const createDefaultUser = (email: string): User => normalizeUser({ email });

/* =====================================================
   CORE FETCH UTILITIES
===================================================== */

const createHeaders = (token?: string | null): Record<string, string> => {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const createUrl = (endpoint: string, app: "laundry" | "hotel" | "auth"): string => {
  const base = `${API_BASE_URL}/`;
  switch (app) {
    case "laundry": return `${base}Laundry/${endpoint}`;
    case "hotel": return `${base}Hotel/${endpoint}`;
    case "auth": return `${base}${endpoint}`;
  }
};

const handleError = async (response: Response): Promise<never> => {
  const message = await response.text().catch(() => response.statusText);
  throw new Error(`API Error: ${response.status} - ${message || "Unknown error"}`);
};

/* =====================================================
   MAIN FETCH API (Maintaining same interface)
===================================================== */

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  app: "laundry" | "hotel" | "auth" = "laundry"
): Promise<T> {
  const url = createUrl(endpoint, app);
  const token = tokenStore.getAccess();

  const makeRequest = async (authToken?: string) => {
    const headers = createHeaders(authToken);
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle 401 by trying to refresh token once
      if (response.status === 401 && authToken && !options?.body?.toString().includes("refresh")) {
        try {
          await authApi.refreshToken();
          const newToken = tokenStore.getAccess();
          if (newToken) {
            return makeRequest(newToken);
          }
        } catch (refreshError) {
          // Refresh failed, proceed with original error
        }
      }
      return handleError(response);
    }

    return response.json();
  };

  return makeRequest(token);
}

/* =====================================================
   AUTH API (Maintaining same interface)
===================================================== */

const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch(ENDPOINTS.TOKEN, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Invalid credentials");
    }

    const tokenData = await response.json();

    // Get user info
    const userResponse = await fetch(ENDPOINTS.ME, {
      headers: { ...DEFAULT_HEADERS, Authorization: `Bearer ${tokenData.access}` },
    });

    if (!userResponse.ok) throw new Error("Failed to fetch user data");

    const userData = await userResponse.json();
    const user = normalizeUser(userData, credentials.email);

    // Store tokens and user
    tokenStore.set(tokenData.access, tokenData.refresh);
    localStorage.setItem("current_user", JSON.stringify(user));
    handleLoginSuccess({ access: tokenData.access, refresh: tokenData.refresh, user });

    return { access: tokenData.access, refresh: tokenData.refresh, user };
  },

  refreshToken: async () => {
    const refresh = tokenStore.getRefresh();
    if (!refresh) throw new Error("No refresh token available");

    const response = await fetch(ENDPOINTS.REFRESH, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Token refresh failed");
    }

    const data = await response.json();
    tokenStore.set(data.access, refresh);
    return { access: data.access };
  },

  logout: () => {
    tokenStore.clear();
    localStorage.removeItem("current_user");
    localStorage.removeItem("selected_shop");
  },

  me: async () => {
    const token = tokenStore.getAccess();
    if (!token) throw new Error("No authentication token available");

    const response = await fetch(ENDPOINTS.ME, {
      headers: createHeaders(token),
    });

    if (!response.ok) throw new Error("Failed to fetch user data");

    const userData = await response.json();
    const user = normalizeUser(userData);

    // Update local storage
    localStorage.setItem("current_user", JSON.stringify(user));
    handleLoginSuccess({
      access: token,
      refresh: tokenStore.getRefresh() || '',
      user
    });

    return { user };
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const { user } = await authApi.me();
      return user;
    } catch {
      const storedUser = localStorage.getItem("current_user");
      if (storedUser) {
        try {
          return JSON.parse(storedUser);
        } catch {
          // JSON parse failed, continue to default
        }
      }
      return createDefaultUser("unknown@example.com");
    }
  },

  checkUserRole: async (): Promise<'admin' | 'staff'> => {
    const user = await authApi.getCurrentUser();
    return (user.user_type === 'admin' || user.is_superuser) ? 'admin' : 'staff';
  }
};

export { authApi };

/* =====================================================
   EXPENSE APIs (Maintaining same interface)
===================================================== */

const createCrudApi = <T>(endpoint: string, app: "laundry" | "hotel" | "auth" = "hotel") => ({
  getAll: () => fetchApi<T[]>(endpoint, undefined, app),
  getById: (id: number) => fetchApi<T>(`${endpoint}${id}/`, undefined, app),
  create: (data: any) => fetchApi<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data)
  }, app),
  update: (id: number, data: Partial<T>) => fetchApi<T>(`${endpoint}${id}/`, {
    method: "PUT",
    body: JSON.stringify(data)
  }, app),
  delete: (id: number) => fetchApi<void>(`${endpoint}${id}/`, {
    method: "DELETE"
  }, app),
});

export const expenseFieldsApi = createCrudApi<ExpenseField>("expense-fields/");
export const expenseRecordsApi = createCrudApi<ExpenseRecord>("expense-records/");

/* =====================================================
   AUTH UTILITIES (Maintaining same interface)
===================================================== */

export const isAuthenticated = () =>
  !!tokenStore.getAccess() && !!localStorage.getItem("current_user");

export const getSelectedShop = (): "laundry" | "hotel" | null => {
  const shop = localStorage.getItem("selected_shop");
  return shop === "laundry" || shop === "hotel" ? shop : null;
};

export const setSelectedShop = (shop: "laundry" | "hotel") =>
  localStorage.setItem("selected_shop", shop);

export const clearUserData = () => {
  tokenStore.clear();
  localStorage.removeItem("current_user");
  localStorage.removeItem("selected_shop");
};