#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const MAX_LINES = Number(process.env.BLOXSMITH_MAX_FILE_LINES || 900);
const TARGET_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".lua"]);
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".output", ".tanstack"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TARGET_EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

function countLines(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length;
}

function hasPattern(file, pattern) {
  return pattern.test(readFileSync(file, "utf8"));
}

const files = existsSync(SRC) ? walk(SRC) : [];
const oversized = files
  .map((file) => ({ file: relative(ROOT, file), lines: countLines(file) }))
  .filter((x) => x.lines > MAX_LINES)
  .sort((a, b) => b.lines - a.lines);

const criticalFiles = [
  "src/lib/sync-validation.ts",
  "src/lib/ai-quality.ts",
  "src/lib/plugin-project-access.server.ts",
  "src/lib/generator-credits.server.ts",
  "src/lib/content-safety.server.ts",
  "src/components/PluginStatus.tsx",
  "src/components/PlaytestPanel.tsx",
];

const missingCritical = criticalFiles.filter((file) => !existsSync(join(ROOT, file)));
const possibleUnsafe = files
  .filter((file) => hasPattern(file, /\b(any\b|@ts-ignore|@ts-expect-error|TODO|FIXME)/))
  .map((file) => relative(ROOT, file));

console.log("\nBloxSmith Project Audit");
console.log("=======================");
console.log(`Scanned files: ${files.length}`);
console.log(`Large-file threshold: ${MAX_LINES} lines`);

if (missingCritical.length) {
  console.log("\nMissing critical reliability files:");
  for (const file of missingCritical) console.log(`- ${file}`);
} else {
  console.log("\nCritical reliability files: OK");
}

if (oversized.length) {
  console.log("\nFiles that should be split soon:");
  for (const item of oversized.slice(0, 25)) console.log(`- ${item.file} (${item.lines} lines)`);
} else {
  console.log("\nOversized files: OK");
}

if (possibleUnsafe.length) {
  console.log("\nFiles with TODO/FIXME/any/TS suppression markers to review:");
  for (const file of possibleUnsafe.slice(0, 30)) console.log(`- ${file}`);
  if (possibleUnsafe.length > 30) console.log(`...and ${possibleUnsafe.length - 30} more`);
} else {
  console.log("\nNo obvious TODO/FIXME/any/TS suppression markers found.");
}

const fail = missingCritical.length > 0;
console.log(fail ? "\nAudit failed: missing critical files.\n" : "\nAudit finished. Use this before pushing big AI changes.\n");
process.exit(fail ? 1 : 0);
