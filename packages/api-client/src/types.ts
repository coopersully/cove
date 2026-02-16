import type { Snowflake } from "@cove/shared";

// ── Entity types ──────────────────────────────────────

export interface User {
  readonly id: Snowflake;
  readonly username: string;
  readonly displayName: string | null;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly status: string | null;
  readonly bio: string | null;
  readonly pronouns: string | null;
  readonly statusEmoji: string | null;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface Server {
  readonly id: Snowflake;
  readonly name: string;
  readonly description: string | null;
  readonly iconUrl: string | null;
  readonly ownerId: Snowflake;
  readonly isPublic: boolean;
  readonly createdAt: string;
}

export interface Channel {
  readonly id: Snowflake;
  readonly serverId: Snowflake | null;
  readonly name: string;
  readonly type: "text" | "voice" | "dm";
  readonly position: number;
  readonly topic: string | null;
  readonly createdAt: string;
}

export interface MessageAuthor {
  readonly id: Snowflake;
  readonly username: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly statusEmoji: string | null;
}

export interface Message {
  readonly id: Snowflake;
  readonly channelId: Snowflake;
  readonly content: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly author: MessageAuthor;
}

// ── Request types ─────────────────────────────────────

export interface RegisterRequest {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RefreshRequest {
  readonly refreshToken: string;
}

export interface UpdateProfileRequest {
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly status?: string | null;
  readonly bio?: string | null;
  readonly pronouns?: string | null;
  readonly statusEmoji?: string | null;
}

export interface ForgotPasswordRequest {
  readonly email: string;
}

export interface ValidateResetTokenRequest {
  readonly token: string;
}

export interface ResetPasswordRequest {
  readonly token: string;
  readonly password: string;
}

export interface CreateServerRequest {
  readonly name: string;
  readonly description?: string | undefined;
  readonly isPublic?: boolean | undefined;
}

export interface UpdateServerRequest {
  readonly name?: string;
  readonly description?: string | null;
  readonly iconUrl?: string | null;
  readonly isPublic?: boolean;
}

export interface JoinServerRequest {
  readonly inviteCode?: string;
}

export interface CreateChannelRequest {
  readonly name: string;
  readonly type: "text" | "voice";
  readonly topic?: string;
}

export interface UpdateChannelRequest {
  readonly name?: string;
  readonly topic?: string | null;
  readonly position?: number;
}

export interface CreateMessageRequest {
  readonly content: string;
}

export interface UpdateMessageRequest {
  readonly content: string;
}

export interface CreateDmRequest {
  readonly recipientId: Snowflake;
}

export interface ListMessagesParams {
  readonly before?: Snowflake | undefined;
  readonly limit?: number | undefined;
}

// ── Response types ────────────────────────────────────

export interface AuthResponse {
  readonly user: User;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface UserResponse {
  readonly user: User;
}

export interface UserProfileResponse {
  readonly user: Omit<User, "email">;
}

export interface ServerResponse {
  readonly server: Server;
}

export interface ServerListResponse {
  readonly servers: readonly Server[];
}

export interface ChannelResponse {
  readonly channel: Channel;
}

export interface ChannelListResponse {
  readonly channels: readonly Channel[];
}

export interface MessageResponse {
  readonly message: Message;
}

export interface MessageListResponse {
  readonly messages: readonly Message[];
}

export interface ValidateResetTokenResponse {
  readonly valid: boolean;
}

export interface SuccessResponse {
  readonly success: true;
}

export interface CheckAvailabilityResponse {
  readonly available: boolean;
}

export interface DmChannelWithRecipient extends Channel {
  readonly recipient: MessageAuthor;
}

export interface DmChannelResponse {
  readonly channel: Channel;
  readonly members: readonly MessageAuthor[];
}

export interface DmChannelListResponse {
  readonly channels: readonly DmChannelWithRecipient[];
}

export interface UserSearchResponse {
  readonly users: readonly MessageAuthor[];
}

// ── Friend types ─────────────────────────────────────

export interface FriendshipUser {
  readonly id: Snowflake;
  readonly username: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly statusEmoji: string | null;
}

export interface FriendRequest {
  readonly id: Snowflake;
  readonly user: FriendshipUser;
  readonly status: "pending" | "accepted";
  readonly createdAt: string;
}

export interface SendFriendRequestRequest {
  readonly username: string;
}

export interface FriendListResponse {
  readonly friends: readonly FriendshipUser[];
}

export interface FriendRequestListResponse {
  readonly requests: readonly FriendRequest[];
}

export interface FriendRequestResponse {
  readonly request: FriendRequest;
}

// ── Read State types ─────────────────────────────────

export interface ReadState {
  readonly channelId: Snowflake;
  readonly lastReadMessageId: Snowflake | null;
  readonly updatedAt: string;
}

export interface ReadStateListResponse {
  readonly readStates: readonly ReadState[];
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
