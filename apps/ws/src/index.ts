import { GatewayOpcodes } from "@hearth/gateway";

const port = Number(process.env.WS_PORT) || 4000;
const opcodeCount = Object.keys(GatewayOpcodes).length;

console.info(
  `Hearth WebSocket gateway starting on port ${String(port)} (${String(opcodeCount)} opcodes defined)`,
);
