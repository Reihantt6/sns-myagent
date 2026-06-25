#!/usr/bin/env node
/**
 * Apply the pi-natives JS-only fallback patch after bun install.
 *
 * The patched loader-state.js returns a no-op Proxy stub when the native
 * .node addon is unavailable in a compiled Bun binary (no embed:native step).
 * This lets the binary start in "JS-only mode" instead of crashing.
 *
 * Re-run: node scripts/apply-pi-natives-patch.js
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const target = join(
  root,
  "node_modules",
  "@oh-my-pi",
  "pi-natives",
  "native",
  "loader-state.js",
);

if (!existsSync(target)) {
  console.warn("[patch] pi-natives not installed, skipping.");
  process.exit(0);
}

const src = readFileSync(target, "utf8");

// Already patched?
if (src.includes("JS-only fallback")) {
  console.log("[patch] loader-state.js already patched, skipping.");
  process.exit(0);
}

const marker = "If you need support for this platform, please open an issue.";
const idx = src.indexOf(marker);
if (idx === -1) {
  console.error("[patch] Could not locate injection point in loader-state.js");
  process.exit(1);
}

// Find the end of the "Unsupported platform" throw block (next closing brace + newline)
const afterMarker = src.indexOf("\n\t);", idx) + 4; // after the );\n

const patch = `
\t// --- JS-only fallback: return a no-op stub proxy so the binary can ---
\t// --- start up even when pi_natives .node files are unavailable.     ---
\tif (ctx.isCompiledBinary) {
\t\tconst details = errors.map(error => \`- \${error}\`).join("\\n");
\t\tstartupMarker(\`native:loadNative:jsOnlyFallback:\${details}\`);
\t\ttry {
\t\t\tfs.writeSync(2, \`[pi-natives] JS-only mode: native addon unavailable for \${ctx.addonLabel}\\n\`);
\t\t\tfs.writeSync(2, \`[pi-natives] Tried:\\n\${details}\\n\`);
\t\t\tfs.writeSync(2, \`[pi-natives] Native features (grep, pty, shell, clipboard, syntax highlighting, etc.) are disabled.\\n\`);
\t\t} catch {
\t\t\t// stderr unavailable
\t\t}

\t\tconst noop = new Proxy(function () {}, {
\t\t\tget(_target, prop) {
\t\t\t\tif (prop === Symbol.toPrimitive) return () => "";
\t\t\t\tif (prop === Symbol.toStringTag) return "NativeStub";
\t\t\t\tif (prop === "then") return undefined;
\t\t\t\tif (prop === Symbol.iterator) return function* () {};
\t\t\t\tif (prop === "length") return 0;
\t\t\t\treturn noop;
\t\t\t},
\t\t\tapply(_target, _thisArg, args) {
\t\t\t\treturn noop;
\t\t\t},
\t\t\tconstruct(_target, _args) {
\t\t\t\treturn noop;
\t\t\t},
\t\t});
\t\treturn noop;
\t}
`;

const patched = src.slice(0, afterMarker) + patch + src.slice(afterMarker);
writeFileSync(target, patched, "utf8");
console.log("[patch] Applied pi-natives JS-only fallback patch.");
