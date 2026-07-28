import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PORT) || 25601;

serve({ fetch: app.fetch, port }, (info) => {
  console.info(`Cove API listening on http://localhost:${String(info.port)}`);
});
