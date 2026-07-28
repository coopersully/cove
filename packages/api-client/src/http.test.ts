import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "./http.js";

describe("HttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined for a 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const client = new HttpClient({ baseUrl: "https://api.example.test" });

    await expect(client.put<void>("/channels/1/ack", { messageId: "1" })).resolves.toBeUndefined();
  });

  it("normalizes a non-JSON error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Service unavailable", { status: 503 })),
    );
    const client = new HttpClient({ baseUrl: "https://api.example.test" });

    await expect(client.get("/health")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 503,
    });
  });
});
