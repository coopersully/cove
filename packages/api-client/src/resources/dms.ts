import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type { CreateDmRequest, DmChannelListResponse, DmChannelResponse } from "../types.js";

export interface DmResource {
  list(): Promise<DmChannelListResponse>;
  create(data: CreateDmRequest): Promise<DmChannelResponse>;
  get(channelId: Snowflake): Promise<DmChannelResponse>;
}

export function createDmResource(http: HttpClient): DmResource {
  return {
    list: () => http.get<DmChannelListResponse>("/dms"),
    create: (data) => http.post<DmChannelResponse>("/dms", data),
    get: (channelId) => http.get<DmChannelResponse>(`/dms/${channelId}`),
  };
}
