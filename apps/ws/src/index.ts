import { WebSocketServer } from "ws";

import { createRedisClient, createRedisSubscriber, subscribeToEvents } from "@cove/gateway";

import { handleConnection } from "./connection.js";
import { Dispatcher } from "./dispatcher.js";

const port = Number(process.env.WS_PORT) || 4101;

const redis = createRedisClient();
const subscriber = createRedisSubscriber();
const dispatcher = new Dispatcher(redis);

const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
	handleConnection(ws, dispatcher, redis);
});

void subscribeToEvents(subscriber, (event) => {
	dispatcher.dispatch(event);
});

console.info(`Cove WebSocket gateway listening on port ${String(port)}`);
