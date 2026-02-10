import type { Snowflake } from "@hearth/shared";
import type { HttpClient } from "../http.js";
import type {
  ChannelListResponse,
  ChannelResponse,
  CreateChannelRequest,
  SuccessResponse,
  UpdateChannelRequest,
} from "../types.js";

export interface ChannelResource {
  list(serverId: Snowflake): Promise<ChannelListResponse>;
  create(serverId: Snowflake, data: CreateChannelRequest): Promise<ChannelResponse>;
  update(id: Snowflake, data: UpdateChannelRequest): Promise<ChannelResponse>;
  delete(id: Snowflake): Promise<SuccessResponse>;
}

export function createChannelResource(http: HttpClient): ChannelResource {
  return {
    list: (serverId) => http.get<ChannelListResponse>(`/servers/${serverId}/channels`),
    create: (serverId, data) => http.post<ChannelResponse>(`/servers/${serverId}/channels`, data),
    update: (id, data) => http.patch<ChannelResponse>(`/channels/${id}`, data),
    delete: (id) => http.delete<SuccessResponse>(`/channels/${id}`),
  };
}
