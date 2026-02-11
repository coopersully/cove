import { Hono } from "hono";
import { cors } from "hono/cors";

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
app.use(cors());

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
