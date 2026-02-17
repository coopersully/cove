import { db, embeds } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestChannel, createTestServer, createTestUser } from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";
import { extractUrls } from "./embeds.js";

describe("Embed URL Extraction", () => {
  it("extracts URLs from message content", () => {
    const urls = extractUrls("Check out https://example.com and http://test.org");
    expect(urls).toEqual(["https://example.com", "http://test.org"]);
  });

  it("returns empty array for no URLs", () => {
    expect(extractUrls("Hello world!")).toEqual([]);
  });

  it("deduplicates URLs", () => {
    const urls = extractUrls("https://example.com twice https://example.com");
    expect(urls).toEqual(["https://example.com"]);
  });

  it("limits to 5 URLs", () => {
    const content = Array.from({ length: 10 }, (_, i) => `https://site${String(i)}.com`).join(" ");
    const urls = extractUrls(content);
    expect(urls).toHaveLength(5);
  });
});

describe("Embed Routes - GET /messages with embeds", () => {
  it("returns empty embeds array for messages without links", async () => {
    const alice = await createTestUser({ username: "emb_alice1" });
    const server = await createTestServer(alice.id);
    const channel = await createTestChannel(server.id);

    await apiRequest("POST", `/channels/${channel.id}/messages`, {
      token: alice.token,
      body: { content: "No links here" },
    });

    const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
      token: alice.token,
    });

    expect(status).toBe(200);
    const messages = body.messages as Record<string, unknown>[];
    expect(messages[0]?.embeds).toEqual([]);
  });

  it("includes pre-existing embeds in message listing", async () => {
    const alice = await createTestUser({ username: "emb_alice2" });
    const server = await createTestServer(alice.id);
    const channel = await createTestChannel(server.id);

    // Create a message
    const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
      token: alice.token,
      body: { content: "Check https://example.com" },
    });
    const messageId = (createBody.message as Record<string, unknown>).id as string;

    // Manually insert an embed (simulating async generation)
    const embedId = generateSnowflake();
    await db.insert(embeds).values({
      id: BigInt(embedId),
      messageId: BigInt(messageId),
      url: "https://example.com",
      title: "Example Site",
      description: "An example website",
      siteName: "Example",
    });

    const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
      token: alice.token,
    });

    expect(status).toBe(200);
    const messages = body.messages as Record<string, unknown>[];
    const embedList = messages[0]?.embeds as Record<string, unknown>[];
    expect(embedList).toHaveLength(1);
    expect(embedList[0]?.url).toBe("https://example.com");
    expect(embedList[0]?.title).toBe("Example Site");
    expect(embedList[0]?.description).toBe("An example website");
    expect(embedList[0]?.siteName).toBe("Example");
  });

  it("cascades embed deletion when message is deleted", async () => {
    const alice = await createTestUser({ username: "emb_alice3" });
    const server = await createTestServer(alice.id);
    const channel = await createTestChannel(server.id);

    const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
      token: alice.token,
      body: { content: "Will be deleted" },
    });
    const messageId = (createBody.message as Record<string, unknown>).id as string;

    const embedId = generateSnowflake();
    await db.insert(embeds).values({
      id: BigInt(embedId),
      messageId: BigInt(messageId),
      url: "https://example.com",
      title: "Test",
    });

    await apiRequest("DELETE", `/messages/${messageId}`, {
      token: alice.token,
    });

    const rows = await db
      .select()
      .from(embeds)
      .where(eq(embeds.id, BigInt(embedId)));
    expect(rows).toHaveLength(0);
  });

  it("supports multiple embeds per message", async () => {
    const alice = await createTestUser({ username: "emb_alice4" });
    const server = await createTestServer(alice.id);
    const channel = await createTestChannel(server.id);

    const { body: createBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
      token: alice.token,
      body: { content: "Two links" },
    });
    const messageId = (createBody.message as Record<string, unknown>).id as string;

    await db.insert(embeds).values([
      {
        id: BigInt(generateSnowflake()),
        messageId: BigInt(messageId),
        url: "https://site1.com",
        title: "Site 1",
      },
      {
        id: BigInt(generateSnowflake()),
        messageId: BigInt(messageId),
        url: "https://site2.com",
        title: "Site 2",
      },
    ]);

    const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
      token: alice.token,
    });

    const messages = body.messages as Record<string, unknown>[];
    const embedList = messages[0]?.embeds as Record<string, unknown>[];
    expect(embedList).toHaveLength(2);
  });
});
