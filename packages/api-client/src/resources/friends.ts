import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type {
  FriendListResponse,
  FriendRequestListResponse,
  FriendRequestResponse,
  SendFriendRequestRequest,
} from "../types.js";

export interface FriendsResource {
  list(): Promise<FriendListResponse>;
  incomingRequests(): Promise<FriendRequestListResponse>;
  outgoingRequests(): Promise<FriendRequestListResponse>;
  sendRequest(data: SendFriendRequestRequest): Promise<FriendRequestResponse>;
  acceptRequest(requestId: Snowflake): Promise<FriendRequestResponse>;
  declineRequest(requestId: Snowflake): Promise<void>;
  remove(userId: Snowflake): Promise<void>;
}

export function createFriendsResource(http: HttpClient): FriendsResource {
  return {
    list: () => http.get<FriendListResponse>("/friends"),
    incomingRequests: () =>
      http.get<FriendRequestListResponse>("/friends/requests/incoming"),
    outgoingRequests: () =>
      http.get<FriendRequestListResponse>("/friends/requests/outgoing"),
    sendRequest: (data) =>
      http.post<FriendRequestResponse>("/friends/requests", data),
    acceptRequest: (requestId) =>
      http.post<FriendRequestResponse>(
        `/friends/requests/${requestId}/accept`,
        {},
      ),
    declineRequest: (requestId) =>
      http.delete<void>(`/friends/requests/${requestId}`),
    remove: (userId) => http.delete<void>(`/friends/${userId}`),
  };
}
