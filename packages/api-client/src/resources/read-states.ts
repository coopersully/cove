import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type { ReadStateListResponse } from "../types.js";

export interface ReadStateResource {
  ack(channelId: Snowflake, messageId: Snowflake): Promise<void>;
  list(): Promise<ReadStateListResponse>;
}

export function createReadStateResource(http: HttpClient): ReadStateResource {
  return {
    ack: (channelId, messageId) => http.put<void>(`/channels/${channelId}/ack`, { messageId }),
    list: () => http.get<ReadStateListResponse>("/read-states"),
  };
}
