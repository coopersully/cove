export { ApiError, HttpClient } from "./http.js";
export type { HttpClientConfig, TokenProvider } from "./http.js";

export { createAuthResource } from "./resources/auth.js";
export type { AuthResource } from "./resources/auth.js";

export { createChannelResource } from "./resources/channels.js";
export type { ChannelResource } from "./resources/channels.js";

export { createMessageResource } from "./resources/messages.js";
export type { MessageResource } from "./resources/messages.js";

export { createServerResource } from "./resources/servers.js";
export type { ServerResource } from "./resources/servers.js";

export { createUserResource } from "./resources/users.js";
export type { UserResource } from "./resources/users.js";

export * from "./types.js";

import { HttpClient } from "./http.js";
import type { HttpClientConfig } from "./http.js";
import { createAuthResource } from "./resources/auth.js";
import { createChannelResource } from "./resources/channels.js";
import { createMessageResource } from "./resources/messages.js";
import { createServerResource } from "./resources/servers.js";
import { createUserResource } from "./resources/users.js";

export interface ApiClient {
  readonly auth: ReturnType<typeof createAuthResource>;
  readonly users: ReturnType<typeof createUserResource>;
  readonly servers: ReturnType<typeof createServerResource>;
  readonly channels: ReturnType<typeof createChannelResource>;
  readonly messages: ReturnType<typeof createMessageResource>;
}

export function createApiClient(config: HttpClientConfig): ApiClient {
  const http = new HttpClient(config);
  return {
    auth: createAuthResource(http),
    users: createUserResource(http),
    servers: createServerResource(http),
    channels: createChannelResource(http),
    messages: createMessageResource(http),
  };
}
