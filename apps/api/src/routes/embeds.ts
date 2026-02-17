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

// Extract URLs from message content
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  // Deduplicate and limit to 5 embeds per message
  return [...new Set(matches)].slice(0, 5);
}

// Generate embeds for a message (fire-and-forget after message creation)
export async function generateEmbedsForMessage(
  messageId: string,
  content: string,
): Promise<EmbedData[]> {
  const urls = extractUrls(content);
  if (urls.length === 0) return [];

  const results: EmbedData[] = [];

  for (const url of urls) {
    try {
      const metadata = await fetchOpenGraphMetadata(url);
      if (!metadata.title && !metadata.description) continue;

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

// Fetch Open Graph metadata from a URL
async function fetchOpenGraphMetadata(url: string): Promise<OgMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CoveBot/1.0 (Link Preview)" },
      redirect: "follow",
    });

    if (!response.ok) return { title: undefined, description: undefined, image: undefined, siteName: undefined };

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return { title: undefined, description: undefined, image: undefined, siteName: undefined };

    const html = await response.text();
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

  const metaRegex = /<meta\s+(?:[^>]*?\s+)?(?:property|name)=["']og:(\w+)["']\s+content=["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    result[match[1]!] = match[2]!;
  }

  // Also try reversed attribute order: content before property
  const metaRegex2 = /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["']\s+(?:property|name)=["']og:(\w+)["']/gi;
  while ((match = metaRegex2.exec(html)) !== null) {
    if (!result[match[2]!]) {
      result[match[2]!] = match[1]!;
    }
  }

  // Fallback to <title> tag if no og:title
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1]!.trim();
    }
  }

  // Fallback to meta description if no og:description
  if (!result.description) {
    const descMatch = html.match(/<meta\s+(?:[^>]*?\s+)?name=["']description["']\s+content=["']([^"']*)["']/i);
    if (descMatch) {
      result.description = descMatch[1]!;
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
  if (messageIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(embeds)
    .where(inArray(embeds.messageId, messageIds));

  const byMessage = new Map<string, EmbedData[]>();

  for (const row of rows) {
    const key = String(row.messageId);
    if (!byMessage.has(key)) {
      byMessage.set(key, []);
    }
    byMessage.get(key)!.push({
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
