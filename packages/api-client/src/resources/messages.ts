import type { Snowflake } from "@hearth/shared";
import type { HttpClient } from "../http.js";
import type {
  CreateMessageRequest,
  ListMessagesParams,
  MessageListResponse,
  MessageResponse,
  SuccessResponse,
  UpdateMessageRequest,
} from "../types.js";

export interface MessageResource {
  list(channelId: Snowflake, params?: ListMessagesParams): Promise<MessageListResponse>;
  create(channelId: Snowflake, data: CreateMessageRequest): Promise<MessageResponse>;
  update(id: Snowflake, data: UpdateMessageRequest): Promise<MessageResponse>;
  delete(id: Snowflake): Promise<SuccessResponse>;
}

export function createMessageResource(http: HttpClient): MessageResource {
  return {
    list: (channelId, params) =>
      http.get<MessageListResponse>(`/channels/${channelId}/messages`, {
        before: params?.before,
        limit: params?.limit?.toString(),
      }),
    create: (channelId, data) =>
      http.post<MessageResponse>(`/channels/${channelId}/messages`, data),
    update: (id, data) => http.patch<MessageResponse>(`/messages/${id}`, data),
    delete: (id) => http.delete<SuccessResponse>(`/messages/${id}`),
  };
}
