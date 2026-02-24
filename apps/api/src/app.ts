import { mkdirSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { errorHandler } from "./middleware/index.js";
import {
  attachmentRoutes,
  authRoutes,
  channelRoutes,
  customEmojiRoutes,
  dmRoutes,
  friendRoutes,
  messageRoutes,
  pinRoutes,
  reactionRoutes,
  readStateRoutes,
  serverRoutes,
  userRoutes,
} from "./routes/index.js";

export const app = new Hono();

app.onError(errorHandler);
app.use(cors());

if (process.env.STORAGE_BACKEND !== "s3") {
  const uploadRoot = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  // @hono/node-server serveStatic expects a cwd-relative root path.
  const staticRoot = isAbsolute(uploadRoot)
    ? relative(process.cwd(), uploadRoot) || "."
    : uploadRoot;
  mkdirSync(staticRoot, { recursive: true });
  app.use(
    "/uploads/*",
    serveStatic({
      root: staticRoot,
      rewriteRequestPath: (path) => path.replace(/^\/uploads\//, ""),
    }),
  );
}

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "cove-api",
    timestamp: new Date().toISOString(),
  });
});

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/servers", serverRoutes);
app.route("/", channelRoutes);
app.route("/", dmRoutes);
app.route("/", friendRoutes);
app.route("/", messageRoutes);
app.route("/", pinRoutes);
app.route("/", reactionRoutes);
app.route("/", readStateRoutes);
app.route("/", attachmentRoutes);
app.route("/", customEmojiRoutes);
