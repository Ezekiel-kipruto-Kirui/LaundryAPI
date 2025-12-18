// utils/auth.ts

import { User } from "@/services/types";
export type UserRole = 'admin' | 'staff';
export type ShopType = 'Shop A' | 'Shop B' | null;

const isBrowser = () => typeof window !== 'undefined';

/* ------------------------------------------------------------------ */
/* Core helpers                                                        */
/* ------------------------------------------------------------------ */

const getFromStorage = <T = any>(key: string): T | null => {
    if (!isBrowser()) return null;

    const value = localStorage.getItem(key);
    if (!value) return null;

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const setToStorage = (key: string, value: any): void => {
    if (!isBrowser()) return;

    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
    } catch {
        // Silently fail on storage errors
    }
};

const removeFromStorage = (key: string): void => {
    if (!isBrowser()) return;
    localStorage.removeItem(key);
};

/* ------------------------------------------------------------------ */
/* Token Management                                                    */
/* ------------------------------------------------------------------ */

export const getAccessToken = (): string | null => {
    if (!isBrowser()) return null;
    return localStorage.getItem('access_token') || localStorage.getItem('accessToken');
};

export const getRefreshToken = (): string | null => {
    if (!isBrowser()) return null;
    return localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
};

export const setAuthTokens = (accessToken: string, refreshToken: string): void => {
    if (!isBrowser()) return;

    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    // Backward compatibility
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
};

export const clearAuthTokens = (): void => {
    if (!isBrowser()) return;

    ['access_token', 'refresh_token', 'accessToken', 'refreshToken', 'token'].forEach(
        token => {
            localStorage.removeItem(token);
            sessionStorage.removeItem(token);
        }
    );
};

/* ------------------------------------------------------------------ */
/* User Data Management                                                */
/* ------------------------------------------------------------------ */

export const getUserData = (): User | null => {
    const data = getFromStorage<User>('current_user');
    return data;
};

export const setUserData = (userData: User): void => {
    if (!isBrowser()) return;
    setToStorage('current_user', userData);
};

export const setUserEmail = (email: string): void => {
    const userData = getUserData();
    if (!userData) return;

    const updatedUser: User = {
        ...userData,
        email: email
    };

    setUserData(updatedUser);
};

/* ------------------------------------------------------------------ */
/* Shop Management                                                     */
/* ------------------------------------------------------------------ */

export const getSelectedShop = (): ShopType => {
    if (!isBrowser()) return null;

    const shop = localStorage.getItem('selected_shop') as ShopType;
    return shop || null;
};

export const setSelectedShop = (shop: ShopType): void => {
    if (!isBrowser()) return;

    if (shop) {
        localStorage.setItem('selected_shop', shop);
    } else {
        localStorage.removeItem('selected_shop');
    }
};

export const setSelectedShopByType = (shopType: 'laundry' | 'hotel'): void => {
    if (!isBrowser()) return;

    const shopMapping: Record<'laundry' | 'hotel', ShopType> = {
        'laundry': 'Shop A',
        'hotel': 'Shop B'
    };

    const shop = shopMapping[shopType];
    setSelectedShop(shop);
};

export const getSelectedShopType = (): 'laundry' | 'hotel' | null => {
    const shop = getSelectedShop();
    if (!shop) return null;

    const shopMapping: Record<ShopType, 'laundry' | 'hotel'> = {
        'Shop A': 'laundry',
        'Shop B': 'hotel'
    };

    return shopMapping[shop] || null;
};

export const clearSelectedShop = (): void => {
    if (!isBrowser()) return;
    localStorage.removeItem('selected_shop');
};

/* ------------------------------------------------------------------ */
/* User & role helpers                                                 */
/* ------------------------------------------------------------------ */

export const getUserRole = (): UserRole | null => {
    const user = getUserData();
    if (!user) return null;

    if (user.user_type === 'admin' || user.is_superuser) {
        return 'admin';
    }

    if (user.user_type === 'staff' || user.is_staff) {
        return 'staff';
    }

    return null;
};

export const isAdmin = () => getUserRole() === 'admin';
export const isStaff = () => getUserRole() === 'staff';

export const getUserEmail = (): string =>
    getUserData()?.email ?? '';

export const getUserFullName = (): string => {
    const user = getUserData();
    if (!user) return '';

    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return fullName || user.email || '';
};

/* ------------------------------------------------------------------ */
/* Auth state validation                                               */
/* ------------------------------------------------------------------ */

export const validateAuthState = (): boolean => {
    if (!isBrowser()) return false;

    const token = getAccessToken();
    const user = getUserData();

    if (!token || !user) return false;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        return !isExpired;
    } catch {
        return true;
    }
};

export const isAuthenticated = (): boolean => {
    return validateAuthState();
};

/* ------------------------------------------------------------------ */
/* Complete Auth cleanup                                               */
/* ------------------------------------------------------------------ */

export const clearAuthData = (): void => {
    if (!isBrowser()) return;

    removeFromStorage('current_user');
    clearAuthTokens();
    clearSelectedShop();

    ['current_user', 'user', 'selected_shop', 'shop_preference'].forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
};

/* ------------------------------------------------------------------ */
/* Helper functions for API integration                                */
/* ------------------------------------------------------------------ */

export const getAuthHeaders = (): Record<string, string> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
};

export const handleLoginSuccess = (data: {
    access: string;
    refresh: string;
    user: User;
}): void => {
    setAuthTokens(data.access, data.refresh);
    setUserData(data.user);
};

export const handleLogout = (): void => {
    clearAuthData();
};