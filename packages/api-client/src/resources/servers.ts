import type { Snowflake } from "@hearth/shared";
import type { HttpClient } from "../http.js";
import type {
  CreateServerRequest,
  JoinServerRequest,
  ServerListResponse,
  ServerResponse,
  SuccessResponse,
  UpdateServerRequest,
} from "../types.js";

export interface ServerResource {
  create(data: CreateServerRequest): Promise<ServerResponse>;
  list(): Promise<ServerListResponse>;
  get(id: Snowflake): Promise<ServerResponse>;
  update(id: Snowflake, data: UpdateServerRequest): Promise<ServerResponse>;
  delete(id: Snowflake): Promise<SuccessResponse>;
  join(id: Snowflake, data?: JoinServerRequest): Promise<SuccessResponse>;
  leave(id: Snowflake): Promise<SuccessResponse>;
}

export function createServerResource(http: HttpClient): ServerResource {
  return {
    create: (data) => http.post<ServerResponse>("/servers", data),
    list: () => http.get<ServerListResponse>("/servers"),
    get: (id) => http.get<ServerResponse>(`/servers/${id}`),
    update: (id, data) => http.patch<ServerResponse>(`/servers/${id}`, data),
    delete: (id) => http.delete<SuccessResponse>(`/servers/${id}`),
    join: (id, data) => http.post<SuccessResponse>(`/servers/${id}/join`, data),
    leave: (id) => http.post<SuccessResponse>(`/servers/${id}/leave`),
  };
}
