import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Config } from "@netlify/functions";
import app from "@mindmap/api/app";

// The Express app is a plain Node request listener. Rather than re-implementing
// its routing on top of the Web Request API, bind it to a loopback server once
// per container and forward the incoming request to it. The server is created
// lazily and reused across warm invocations.
let serverOrigin: Promise<string> | null = null;

function getServerOrigin(): Promise<string> {
  serverOrigin ??= (async () => {
    const server: Server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  })();

  return serverOrigin;
}

export default async (req: Request): Promise<Response> => {
  const origin = await getServerOrigin();
  const { pathname, search } = new URL(req.url);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  return fetch(`${origin}${pathname}${search}`, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });
};

export const config: Config = {
  path: "/api/*",
};
