import { GatewayOpcodes } from "@cove/gateway";

const port = Number(process.env.WS_PORT) || 4101;
const opcodeCount = Object.keys(GatewayOpcodes).length;

console.info(
  `Cove WebSocket gateway starting on port ${String(port)} (${String(opcodeCount)} opcodes defined)`,
);
