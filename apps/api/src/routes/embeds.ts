import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db, embeds } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { inArray } from "drizzle-orm";

interface EmbedData {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  siteName: string | null;
  color: string | null;
}

const URL_REGEX = /https?:\/\/[^\s<>]+/g;
const MAX_REDIRECTS = 3;
const MAX_HTML_SIZE_BYTES = 2 * 1024 * 1024;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

const EMPTY_OG_METADATA: OgMetadata = {
  title: undefined,
  description: undefined,
  image: undefined,
  siteName: undefined,
};

// Extract URLs from message content
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) {
    return [];
  }
  // Deduplicate and limit to 5 embeds per message
  return [...new Set(matches)].slice(0, 5);
}

// Generate embeds for a message (fire-and-forget after message creation)
export async function generateEmbedsForMessage(
  messageId: string,
  content: string,
): Promise<EmbedData[]> {
  const urls = extractUrls(content);
  if (urls.length === 0) {
    return [];
  }

  const results: EmbedData[] = [];

  for (const url of urls) {
    try {
      const metadata = await fetchOpenGraphMetadata(url);
      if (!(metadata.title || metadata.description)) {
        continue;
      }

      const embedId = generateSnowflake();
      const [created] = await db
        .insert(embeds)
        .values({
          id: BigInt(embedId),
          messageId: BigInt(messageId),
          url,
          title: metadata.title?.slice(0, 256) ?? null,
          description: metadata.description?.slice(0, 4096) ?? null,
          thumbnailUrl: metadata.image ?? null,
          siteName: metadata.siteName?.slice(0, 256) ?? null,
        })
        .onConflictDoNothing() // Unique on (messageId, url)
        .returning();

      if (created) {
        results.push({
          id: String(created.id),
          url: created.url,
          title: created.title,
          description: created.description,
          thumbnailUrl: created.thumbnailUrl,
          siteName: created.siteName,
          color: created.color,
        });
      }
    } catch {
      // Skip failed URL fetches
    }
  }

  return results;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true; // ULA
  }
  if (normalized.startsWith("fe80")) {
    return true; // Link-local
  }
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.replace("::ffff:", ""));
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    return isPrivateIpv4(address);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(address);
  }
  return true;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")
  );
}

async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) {
    return true;
  }

  if (isIP(hostname)) {
    return isPrivateAddress(hostname);
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      return true;
    }
    return addresses.some((entry) => isPrivateAddress(entry.address));
  } catch {
    return true;
  }
}

function isAllowedExternalUrl(url: URL): boolean {
  if (!(url.protocol === "http:" || url.protocol === "https:")) {
    return false;
  }
  if (url.username || url.password) {
    return false;
  }
  return true;
}

async function fetchSafeHtml(url: string, signal: AbortSignal): Promise<string | null> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(url);
  } catch {
    return null;
  }

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!isAllowedExternalUrl(currentUrl)) {
      return null;
    }

    if (await resolvesToPrivateAddress(currentUrl.hostname)) {
      return null;
    }

    const response = await fetch(currentUrl, {
      signal,
      headers: { "User-Agent": "CoveBot/1.0 (Link Preview)" },
      redirect: "manual",
    });

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return null;
      }

      try {
        currentUrl = new URL(location, currentUrl);
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_HTML_SIZE_BYTES) {
      return null;
    }

    const html = await response.text();
    if (html.length > MAX_HTML_SIZE_BYTES) {
      return null;
    }
    return html;
  }

  return null;
}

// Fetch Open Graph metadata from a URL
async function fetchOpenGraphMetadata(url: string): Promise<OgMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const html = await fetchSafeHtml(url, controller.signal);
    if (!html) {
      return EMPTY_OG_METADATA;
    }
    return parseOpenGraphTags(html);
  } finally {
    clearTimeout(timeout);
  }
}

interface OgMetadata {
  title: string | undefined;
  description: string | undefined;
  image: string | undefined;
  siteName: string | undefined;
}

// Parse OG tags from HTML
function parseOpenGraphTags(html: string): OgMetadata {
  const result: Record<string, string> = {};

  const metaRegex =
    /<meta\s+(?:[^>]*?\s+)?(?:property|name)=["']og:(\w+)["']\s+content=["']([^"']*)["']/gi;
  let match = metaRegex.exec(html);
  while (match !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value) {
      result[key] = value;
    }
    match = metaRegex.exec(html);
  }

  // Also try reversed attribute order: content before property
  const metaRegex2 =
    /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:property|name)=["']og:(\w+)["']/gi;
  match = metaRegex2.exec(html);
  while (match !== null) {
    const value = match[1];
    const key = match[2];
    if (key && value && !result[key]) {
      result[key] = value;
    }
    match = metaRegex2.exec(html);
  }

  // Fallback to <title> tag if no og:title
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];
      if (title) {
        result.title = title.trim();
      }
    }
  }

  // Fallback to meta description if no og:description
  if (!result.description) {
    const descMatch = html.match(
      /<meta\s+(?:[^>]*?\s+)?name=["']description["']\s+content=["']([^"']*)["']/i,
    );
    if (descMatch) {
      const description = descMatch[1];
      if (description) {
        result.description = description;
      }
    }
  }

  return {
    title: result.title,
    description: result.description,
    image: result.image,
    siteName: result.site_name,
  };
}

// Helper: fetch embeds for a list of message IDs
export async function getEmbedsForMessages(
  messageIds: bigint[],
): Promise<Map<string, EmbedData[]>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await db.select().from(embeds).where(inArray(embeds.messageId, messageIds));

  const byMessage = new Map<string, EmbedData[]>();

  for (const row of rows) {
    const key = String(row.messageId);
    if (!byMessage.has(key)) {
      byMessage.set(key, []);
    }
    byMessage.get(key)?.push({
      id: String(row.id),
      url: row.url,
      title: row.title,
      description: row.description,
      thumbnailUrl: row.thumbnailUrl,
      siteName: row.siteName,
      color: row.color,
    });
  }

  return byMessage;
}
