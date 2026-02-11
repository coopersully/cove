import type { ApiErrorResponse, TokenResponse } from "./types.js";

export interface TokenProvider {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  onTokensRefreshed(accessToken: string, refreshToken: string): void;
  onAuthFailure(): void;
}

export interface HttpClientConfig {
  readonly baseUrl: string;
  readonly tokenProvider?: TokenProvider;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly tokenProvider: TokenProvider | undefined;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.tokenProvider = config.tokenProvider;
  }

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return this.request<T>(url, init);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: "DELETE" });
  }

  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private async request<T>(url: string, init: RequestInit, isRetry = false): Promise<T> {
    const headers = new Headers(init.headers);
    const accessToken = this.tokenProvider?.getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401 && !isRetry && this.tokenProvider) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(url, init, true);
      }
    }

    if (!response.ok) {
      const body = (await response.json()) as ApiErrorResponse;
      throw new ApiError(body.error.code, body.error.message, response.status);
    }

    return response.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.tokenProvider) {
      return false;
    }

    const refreshToken = this.tokenProvider.getRefreshToken();
    if (!refreshToken) {
      this.tokenProvider.onAuthFailure();
      return false;
    }

    // Deduplicate concurrent refresh attempts
    if (!this.refreshPromise) {
      this.refreshPromise = this.executeRefresh(refreshToken);
    }

    try {
      await this.refreshPromise;
      return true;
    } catch {
      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async executeRefresh(refreshToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.tokenProvider?.onAuthFailure();
        throw new Error("Refresh failed");
      }

      const data = (await response.json()) as TokenResponse;
      this.tokenProvider?.onTokensRefreshed(data.accessToken, data.refreshToken);
    } catch (error) {
      this.tokenProvider?.onAuthFailure();
      throw error;
    }
  }
}
