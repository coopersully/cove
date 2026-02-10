export const GatewayOpcodes = {
  Dispatch: 0,
  Heartbeat: 1,
  Identify: 2,
  HeartbeatAck: 3,
  Resume: 4,
  Reconnect: 5,
  InvalidSession: 6,
  Hello: 7,
} as const;

export type GatewayOpcode = (typeof GatewayOpcodes)[keyof typeof GatewayOpcodes];
