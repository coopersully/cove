import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type { MessageListResponse } from "../types.js";

export interface PinResource {
  pin(channelId: Snowflake, messageId: Snowflake): Promise<void>;
  unpin(channelId: Snowflake, messageId: Snowflake): Promise<void>;
  list(channelId: Snowflake): Promise<MessageListResponse>;
}

export function createPinResource(http: HttpClient): PinResource {
  return {
    pin: (channelId, messageId) => http.put<void>(`/channels/${channelId}/pins/${messageId}`, {}),
    unpin: (channelId, messageId) => http.delete<void>(`/channels/${channelId}/pins/${messageId}`),
    list: (channelId) => http.get<MessageListResponse>(`/channels/${channelId}/pins`),
  };
}
