// Uploads the lease PDFs in samples/leases/ without the browser, through an
// internal action (needs the Convex CLI login or a deploy key).
//
//   npm run upload:leases            # dev deployment
//   npm run upload:leases -- --prod  # production
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "samples", "leases");
const prod = process.argv.includes("--prod");
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
// Call the CLI through node (no shell), so the JSON argument keeps its quotes
// on Windows too.
const cli = join(process.cwd(), "node_modules", "convex", "bin", "main.js");

let added = 0;
let skipped = 0;
for (const filename of files) {
  const base64 = readFileSync(join(dir, filename)).toString("base64");
  const args = [cli, "run", "documentsNode:importFromAdmin", JSON.stringify({ filename, base64 })];
  if (prod) args.push("--prod");
  const out = execFileSync(process.execPath, args, { encoding: "utf8" }).trim();
  if (out === "null") skipped += 1;
  else added += 1;
  process.stdout.write(`\r${added + skipped}/${files.length} (${added} added, ${skipped} already there)`);
}
process.stdout.write("\n");
