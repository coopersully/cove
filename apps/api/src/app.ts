import { Hono } from "hono";

import { errorHandler } from "./middleware/index.js";
import {
  authRoutes,
  channelRoutes,
  messageRoutes,
  serverRoutes,
  userRoutes,
} from "./routes/index.js";

export const app = new Hono();

app.onError(errorHandler);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "hearth-api",
    timestamp: new Date().toISOString(),
  });
});

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/servers", serverRoutes);
app.route("/", channelRoutes);
app.route("/", messageRoutes);
