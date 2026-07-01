import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "out");
const portArg = process.argv.findIndex((arg) => arg === "--port");
const port =
  portArg >= 0 && process.argv[portArg + 1]
    ? Number(process.argv[portArg + 1])
    : Number(process.env.PORT || 3000);

const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function fileForPath(pathname: string) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(root, clean === "/" ? "index.html" : clean);

  if (existsSync(candidate) && !candidate.endsWith("/")) return candidate;
  const index = join(candidate, "index.html");
  if (existsSync(index)) return index;
  return join(root, "404.html");
}

Bun.serve({
  port,
  fetch(request: Request) {
    const url = new URL(request.url);
    const filePath = fileForPath(url.pathname);
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": types[extname(filePath)] || "application/octet-stream"
      },
      status: existsSync(filePath) ? 200 : 404
    });
  }
});

console.log(`Serving ${root} at http://localhost:${port}`);
