import { getRequestListener } from "@hono/node-server";
import app from "../server/app.js";

export default getRequestListener(app.fetch);
