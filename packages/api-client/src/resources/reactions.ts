import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";

export interface ReactionResource {
  add(channelId: Snowflake, messageId: Snowflake, emoji: string): Promise<void>;
  remove(channelId: Snowflake, messageId: Snowflake, emoji: string): Promise<void>;
}

export function createReactionResource(http: HttpClient): ReactionResource {
  return {
    add: (channelId, messageId, emoji) =>
      http.put<void>(
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        {},
      ),
    remove: (channelId, messageId, emoji) =>
      http.delete<void>(
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      ),
  };
}
