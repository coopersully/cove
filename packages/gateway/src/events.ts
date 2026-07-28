export const GatewayEvents = {
  Ready: "READY",
  Resumed: "RESUMED",
  MessageCreate: "MESSAGE_CREATE",
  MessageUpdate: "MESSAGE_UPDATE",
  MessageDelete: "MESSAGE_DELETE",
  MessageReactionAdd: "MESSAGE_REACTION_ADD",
  MessageReactionRemove: "MESSAGE_REACTION_REMOVE",
  PresenceUpdate: "PRESENCE_UPDATE",
  ChannelCreate: "CHANNEL_CREATE",
  ChannelUpdate: "CHANNEL_UPDATE",
  ChannelDelete: "CHANNEL_DELETE",
  VoiceStateUpdate: "VOICE_STATE_UPDATE",
  TypingStart: "TYPING_START",
} as const;

export type GatewayEvent = (typeof GatewayEvents)[keyof typeof GatewayEvents];
