import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

function walk(dir) {
  const out = [];
  const entries = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true })
    : [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function findRouteHandlersUnder(dir) {
  return walk(dir).filter((file) => {
    const base = path.basename(file);
    return /^route\.[cm]?[jt]sx?$/.test(base);
  });
}

const offenders = [];

offenders.push(
  ...findRouteHandlersUnder(
    path.join(workspaceRoot, "apps", "web", "app", "api"),
  ),
);
offenders.push(
  ...walk(path.join(workspaceRoot, "apps", "web", "pages", "api")),
);

if (offenders.length > 0) {
  const rel = offenders.map((f) => path.relative(workspaceRoot, f)).sort();
  console.error("Web-owned API entrypoints are not allowed.");
  console.error(
    "Move these endpoints to apps/api and delete them from apps/web:",
  );
  for (const file of rel) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}
