/**
 * BlackBook AI API Client
 * Centralized API service for communicating with the Express backend (/api/v1/*)
 * Handles CSRF double-submit token fetching and header inclusion automatically.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
let cachedCsrfToken: string | null = null;

/**
 * Fetch a fresh CSRF token from the backend
 */
export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/csrf-token`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to obtain CSRF token");
    const data = await res.json();
    cachedCsrfToken = data.csrfToken;
    return data.csrfToken;
  } catch (error) {
    console.error("CSRF Fetch Error:", error);
    return "";
  }
}

/**
 * Reset CSRF token cache when token becomes invalid or session changes
 */
export function invalidateCsrfToken() {
  cachedCsrfToken = null;
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipCsrf?: boolean;
}

/**
 * Generic API fetch wrapper
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, skipCsrf = false, headers: customHeaders, body, method = "GET", ...rest } = options;

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let url = API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;

  // Build query string if params exist
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  // Add CSRF token for state-changing HTTP methods
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  const isSafeMethod = safeMethods.includes(method.toUpperCase());

  if (!isSafeMethod && !skipCsrf) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }
  }

  // Set JSON content-type if body is an object/JSON (and not FormData)
  if (body && typeof body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
    ...rest,
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 403 && data?.message?.includes("csrf")) {
      invalidateCsrfToken();
    }
    const errorMessage =
      (typeof data === "object" && (data.error || data.message)) ||
      `Request failed with status ${response.status}`;
    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

// -----------------------------------------------------------------------------
// ENDPOINT HELPERS
// -----------------------------------------------------------------------------

export const api = {
  // Auth
  auth: {
    getCsrf: () => getCsrfToken(),
    register: (data: { name: string; email: string; password: string }) =>
      apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () =>
      apiRequest("/api/v1/auth/logout", {
        method: "POST",
      }),
    forgotPassword: (email: string) =>
      apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (newPassword: string, token: string) =>
      apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ newPassword, token }),
      }),
    verifyEmail: (token: string) =>
      apiRequest(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: "GET",
      }),
  },

  // User Profile
  user: {
    getProfile: () => apiRequest("/api/v1/users/me"),
    updateProfile: (data: Partial<{ name: string; collegeName: string; branch: string; guideName: string }>) =>
      apiRequest("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    uploadAvatar: (formData: FormData) =>
      apiRequest("/api/v1/users/me/avatar", {
        method: "POST",
        body: formData,
      }),
    exportData: () => apiRequest("/api/v1/users/me/export-data"),
    deleteAccount: () =>
      apiRequest("/api/v1/users/me", {
        method: "DELETE",
      }),
  },

  // Credits
  credits: {
    getBalance: () => apiRequest("/api/v1/credits/balance"),
  },

  // Projects
  projects: {
    getProjects: () => apiRequest("/api/v1/projects"),
    getProjectDetails: (id: string) => apiRequest(`/api/v1/projects/${id}`),
    createProject: (title: string) =>
      apiRequest("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    updateProject: (id: string, title: string) =>
      apiRequest(`/api/v1/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    deleteProject: (id: string) =>
      apiRequest(`/api/v1/projects/${id}`, {
        method: "DELETE",
      }),
  },

  // Template Engine
  templateEngine: {
    uploadTemplate: (projectId: string, file: File) => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("template", file);
      return apiRequest("/api/v1/template-engine/template", {
        method: "POST",
        body: formData,
      });
    },
    uploadRawData: (projectId: string, file: File) => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("raw", file);
      return apiRequest("/api/v1/template-engine/raw", {
        method: "POST",
        body: formData,
      });
    },
    generate: (projectId: string, templateAssetId: string, rawAssetId: string) =>
      apiRequest("/api/v1/template-engine/generate", {
        method: "POST",
        body: JSON.stringify({ projectId, templateAssetId, rawAssetId }),
      }),
    trainAnalyze: (projectId: string, filledDoc: File) => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("filledDoc", filledDoc);
      return apiRequest("/api/v1/template-engine/train/analyze", {
        method: "POST",
        body: formData,
      });
    },
    trainConfirm: (data: {
      projectId: string;
      sourceAssetId: string;
      approvedMapping: Record<string, string>;
      templateName?: string;
    }) =>
      apiRequest("/api/v1/template-engine/train/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Assets
  assets: {
    getAssets: () => apiRequest("/api/v1/assets"),
    deleteAsset: (assetId: string) =>
      apiRequest(`/api/v1/assets/${assetId}`, {
        method: "DELETE",
      }),
    downloadUrl: (assetId: string) => `${API_BASE_URL}/api/v1/assets/${assetId}/download`,
  },

  // Payment
  payment: {
    createCheckout: (data: {
      purpose: string;
      amount: number;
      currency: string;
      idempotencyKey: string;
      planPurchased: "none" | "normal" | "pro" | "premium";
    }) =>
      apiRequest("/api/v1/payment/checkout", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyPayment: (data: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) =>
      apiRequest("/api/v1/payment/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getOrders: () => apiRequest("/api/v1/payment/orders"),
    getOrder: (orderId: string) => apiRequest(`/api/v1/payment/orders/${orderId}`),
  },

  // Notifications
  notifications: {
    getNotifications: () => apiRequest("/api/v1/notifications"),
    markRead: (notificationId: string) =>
      apiRequest(`/api/v1/notifications/${notificationId}/read`, {
        method: "PATCH",
      }),
    markAllRead: () =>
      apiRequest("/api/v1/notifications/mark-all-read", {
        method: "POST",
      }),
  },
};
