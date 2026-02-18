export { ApiError, HttpClient, NetworkError } from "./http.js";
export type { HttpClientConfig, TokenProvider } from "./http.js";

export { createAuthResource } from "./resources/auth.js";
export type { AuthResource } from "./resources/auth.js";

export { createChannelResource } from "./resources/channels.js";
export type { ChannelResource } from "./resources/channels.js";

export { createDmResource } from "./resources/dms.js";
export type { DmResource } from "./resources/dms.js";

export { createFriendsResource } from "./resources/friends.js";
export type { FriendsResource } from "./resources/friends.js";

export { createMessageResource } from "./resources/messages.js";
export type { MessageResource } from "./resources/messages.js";

export { createPinResource } from "./resources/pins.js";
export type { PinResource } from "./resources/pins.js";

export { createReactionResource } from "./resources/reactions.js";
export type { ReactionResource } from "./resources/reactions.js";

export { createReadStateResource } from "./resources/read-states.js";
export type { ReadStateResource } from "./resources/read-states.js";

export { createServerResource } from "./resources/servers.js";
export type { ServerResource } from "./resources/servers.js";

export { createUserResource } from "./resources/users.js";
export type { UserResource } from "./resources/users.js";

export * from "./types.js";

import { HttpClient } from "./http.js";
import type { HttpClientConfig } from "./http.js";
import { createAuthResource } from "./resources/auth.js";
import { createChannelResource } from "./resources/channels.js";
import { createDmResource } from "./resources/dms.js";
import { createFriendsResource } from "./resources/friends.js";
import { createMessageResource } from "./resources/messages.js";
import { createPinResource } from "./resources/pins.js";
import { createReactionResource } from "./resources/reactions.js";
import { createReadStateResource } from "./resources/read-states.js";
import { createServerResource } from "./resources/servers.js";
import { createUserResource } from "./resources/users.js";

export interface ApiClient {
  readonly auth: ReturnType<typeof createAuthResource>;
  readonly users: ReturnType<typeof createUserResource>;
  readonly servers: ReturnType<typeof createServerResource>;
  readonly channels: ReturnType<typeof createChannelResource>;
  readonly dms: ReturnType<typeof createDmResource>;
  readonly friends: ReturnType<typeof createFriendsResource>;
  readonly messages: ReturnType<typeof createMessageResource>;
  readonly pins: ReturnType<typeof createPinResource>;
  readonly reactions: ReturnType<typeof createReactionResource>;
  readonly readStates: ReturnType<typeof createReadStateResource>;
}

export function createApiClient(config: HttpClientConfig): ApiClient {
  const http = new HttpClient(config);
  return {
    auth: createAuthResource(http),
    users: createUserResource(http),
    servers: createServerResource(http),
    channels: createChannelResource(http),
    dms: createDmResource(http),
    friends: createFriendsResource(http),
    messages: createMessageResource(http),
    pins: createPinResource(http),
    reactions: createReactionResource(http),
    readStates: createReadStateResource(http),
  };
}
