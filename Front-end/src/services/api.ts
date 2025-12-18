import { API_BASE_URL } from "./url";
import { ExpenseField, ExpenseRecord, User } from "./types";
import { handleLoginSuccess } from "@/utils/auth";

/* =====================================================
   TOKEN STORAGE
===================================================== */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setAuthTokens = (access: string | null, refresh: string | null) => {
  accessToken = access;
  refreshToken = refresh;

  if (access) localStorage.setItem("accessToken", access);
  else localStorage.removeItem("accessToken");

  if (refresh) localStorage.setItem("refreshToken", refresh);
  else localStorage.removeItem("refreshToken");
};

export const getAccessToken = (): string | null =>
  accessToken || localStorage.getItem("accessToken");

export const getRefreshToken = (): string | null =>
  refreshToken || localStorage.getItem("refreshToken");

/* =====================================================
   TYPES
===================================================== */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

/* =====================================================
   CONSTANTS
===================================================== */

const AUTH_HEADERS = { "Content-Type": "application/json" };
const TOKEN_ENDPOINT = `${API_BASE_URL}/token/`;
const REFRESH_ENDPOINT = `${API_BASE_URL}/token/refresh/`;
const ME_ENDPOINT = `${API_BASE_URL}/me/`;

/* =====================================================
   HELPERS
===================================================== */

const normalizeUser = (data: any, fallbackEmail = ""): User => {
  const user: User = {
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
  };

  return user;
};

const fetchWithAuth = async (url: string, token: string) => {
  const res = await fetch(url, {
    headers: { ...AUTH_HEADERS, Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Authentication failed");
    }
    throw new Error(`Request failed: ${res.statusText}`);
  }

  return res.json();
};

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const createDefaultUser = (email: string): User => ({
  id: 0,
  email,
  user_type: "staff",
  is_superuser: false,
  is_staff: true,
  is_active: true,
  first_name: "",
  last_name: "",
  groups: [],
  user_permissions: [],
  last_login: null,
  date_joined: new Date().toISOString(),
});

/* =====================================================
   UNIVERSAL FETCH API
===================================================== */

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  app: "laundry" | "hotel" | 'auth' = "laundry"
): Promise<T> {
  const token = getAccessToken();

  let baseUrl = `${API_BASE_URL}/Laundry/`;
  if (app === "hotel") baseUrl = `${API_BASE_URL}/Hotel/`;
  if (app === "auth") baseUrl = `${API_BASE_URL}/`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await authApi.refreshToken();
    const newToken = getAccessToken();
    if (!newToken) throw new Error("Unauthorized");

    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  }

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`API Error: ${response.status} - ${msg || response.statusText}`);
  }

  return response.json();
}

/* =====================================================
   AUTH API
===================================================== */

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Invalid credentials");
    }

    const tokenData = await res.json();

    // Get user data from /me/ endpoint
    const userData = await fetchWithAuth(ME_ENDPOINT, tokenData.access);
    const user = normalizeUser(userData, credentials.email);

    handleLoginSuccess({
      access: tokenData.access,
      refresh: tokenData.refresh,
      user: user
    });

    return { access: tokenData.access, refresh: tokenData.refresh, user };
  },

  refreshToken: async (): Promise<{ access: string }> => {
    const refresh = getRefreshToken();
    if (!refresh) throw new Error("No refresh token available");

    const res = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Token refresh failed");
    }

    const data = await res.json();
    setAuthTokens(data.access, refresh);
    return { access: data.access };
  },

  logout: async () => {
    setAuthTokens(null, null);
    localStorage.removeItem("current_user");
    localStorage.removeItem("selected_shop");
  },

  me: async (): Promise<{ user: User }> => {
    const token = getAccessToken();
    if (!token) throw new Error("No authentication token available");

    const userData = await fetchWithAuth(ME_ENDPOINT, token);
    const user = normalizeUser(userData);

    handleLoginSuccess({
      access: token,
      refresh: getRefreshToken() || '',
      user: user
    });

    return { user };
  },

  getCurrentUser: async (): Promise<User> => {
    try {
      const { user } = await authApi.me();
      return user;
    } catch {
      const storedUser = getStoredUser();
      if (storedUser) {
        return storedUser;
      }
      return createDefaultUser("unknown@example.com");
    }
  },

  checkUserRole: async (): Promise<'admin' | 'staff'> => {
    const user = await authApi.getCurrentUser();

    if (user.user_type === 'admin' || user.is_superuser) {
      return 'admin';
    }

    return 'staff';
  }
};

/* =====================================================
   EXPENSE APIs
===================================================== */

export const expenseFieldsApi = {
  getAll: () => fetchApi<ExpenseField[]>("expense-fields/"),
  getById: (id: number) => fetchApi<ExpenseField>(`expense-fields/${id}/`),
  create: (data: { label: string }) =>
    fetchApi<ExpenseField>("expense-fields/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<ExpenseField>) =>
    fetchApi<ExpenseField>(`expense-fields/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchApi<void>(`expense-fields/${id}/`, { method: "DELETE" }),
};

export const expenseRecordsApi = {
  getAll: () => fetchApi<ExpenseRecord[]>("Hotelexpense-records/"),
  getById: (id: number) => fetchApi<ExpenseRecord>(`Hotelexpense-records/${id}/`),
  create: (data: Omit<ExpenseRecord, "id">) =>
    fetchApi<ExpenseRecord>("Hotelexpense-records/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<ExpenseRecord>) =>
    fetchApi<ExpenseRecord>(`Hotelexpense-records/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchApi<void>(`Hotelexpense-records/${id}/`, { method: "DELETE" }),
};

/* =====================================================
   MISC HELPERS
===================================================== */

export const isAuthenticated = () =>
  !!getAccessToken() && !!localStorage.getItem("current_user");

export const getSelectedShop = (): "laundry" | "hotel" | null => {
  const shop = localStorage.getItem("selected_shop");
  return shop === "laundry" || shop === "hotel" ? shop : null;
};

export const setSelectedShop = (shop: "laundry" | "hotel") =>
  localStorage.setItem("selected_shop", shop);

export const clearUserData = () => {
  localStorage.clear();
};