#!/usr/bin/env node
/**
 * Apply the pi-natives JS-only fallback patch after bun install.
 *
 * The patched loader-state.js returns a no-op Proxy stub when the native
 * .node addon is unavailable in a compiled Bun binary (no embed:native step).
 * This lets the binary start in "JS-only mode" instead of crashing.
 *
 * The patch REPLACES the trailing `throw new Error("Failed to load ...")` block
 * with an `if (ctx.isCompiledBinary) return noopProxy; else throw;` block. The
 * earlier version of this patch only APPENDED a fallback after the throw — but
 * `throw` is unconditional and aborts the function, so the fallback was dead
 * code. This rewrite uses string replacement to convert the throw into a
 * conditional re-throw.
 *
 * Re-run: node scripts/apply-pi-natives-patch.js
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const target = join(root, "node_modules", "@oh-my-pi", "pi-natives", "native", "loader-state.js");

if (!existsSync(target)) {
	console.warn("[patch] pi-natives not installed, skipping.");
	process.exit(0);
}

const src = readFileSync(target, "utf8");

// Idempotent: already fully patched with the conditional version
if (src.includes("JS-only mode: native addon unavailable")) {
	console.log("[patch] loader-state.js already fully patched, skipping.");
	process.exit(0);
}

// Idempotent: old incomplete patch applied (has dead code after throw)
// — restore by removing the dead append, then re-apply below.
let working = src;
const deadBlockMarker = "\t// --- JS-only fallback: return a no-op stub proxy so the binary can ---";
const deadIdx = working.indexOf(deadBlockMarker);
if (deadIdx !== -1) {
	// Remove everything from the dead block marker to end of file or to next
	// standalone `}\n\n}` (end of function). Conservative: remove marker + 60 lines.
	const lines = working.split("\n");
	const markerLine = lines.findIndex((l) => l.includes(deadBlockMarker));
	// Find the trailing closing brace of the loadNative function (single `}\n` at col 0
	// or `\n}` at start of line preceded by blank line)
	let endLine = lines.length;
	for (let i = markerLine + 1; i < lines.length; i++) {
		if (lines[i] === "}") {
			endLine = i + 1;
			break;
		}
	}
	lines.splice(markerLine, endLine - markerLine);
	working = lines.join("\n");
	console.log("[patch] Removed dead JS-only fallback block from prior incomplete patch.");
}

// Locate the trailing throw new Error("Failed to load pi_natives...") block.
const throwStart = 'throw new Error(\n\t\t`Failed to load pi_natives native addon';
const throwIdx = working.indexOf(throwStart);
if (throwIdx === -1) {
	console.error("[patch] Could not locate `throw new Error` block to replace.");
	process.exit(1);
}
const throwEnd = working.indexOf("\n\t);", throwIdx) + 4;
const oldThrowBlock = working.substring(throwIdx, throwEnd);

// New conditional block: when compiled binary, return noop Proxy stub;
// otherwise re-throw the original error.
const replacement = [
	"\t// --- JS-only fallback (patched by scripts/apply-pi-natives-patch.js): ---",
	"\t// --- when compiled binary can't load native .node, return a no-op    ---",
	"\t// --- Proxy stub so the binary still starts. Plain Node mode keeps    ---",
	"\t// --- the original throw so missing-native is a hard failure there.   ---",
	"\tif (ctx.isCompiledBinary) {",
	"\t\tconst fallbackDetails = errors.map(error => `- ${error}`).join(\"\\n\");",
	"\t\tstartupMarker(`native:loadNative:jsOnlyFallback:${fallbackDetails}`);",
	"\t\ttry {",
	"\t\t\tfs.writeSync(2, `[pi-natives] JS-only mode: native addon unavailable for ${ctx.addonLabel}\\n`);",
	"\t\t\tfs.writeSync(2, `[pi-natives] Native features (grep, pty, shell, clipboard, syntax highlighting, etc.) are disabled.\\n`);",
	"\t\t} catch {",
	"\t\t\t// stderr unavailable",
	"\t\t}",
	"",
	"\t\tconst noop = new Proxy(function () {}, {",
	"\t\t\tget(_target, prop) {",
	"\t\t\t\tif (prop === Symbol.toPrimitive) return () => \"\";",
	"\t\t\t\tif (prop === Symbol.toStringTag) return \"NativeStub\";",
	"\t\t\t\tif (prop === \"then\") return undefined;",
	"\t\t\t\tif (prop === Symbol.iterator) return function* () {};",
	"\t\t\t\tif (prop === \"length\") return 0;",
	"\t\t\t\treturn noop;",
	"\t\t\t},",
	"\t\t\tapply(_target, _thisArg, _args) { return noop; },",
	"\t\t\tconstruct(_target, _args) { return noop; },",
	"\t\t});",
	"\t\treturn noop;",
	"\t}",
	"\tthrow new Error(",
	"\t\t`Failed to load pi_natives native addon for ${ctx.addonLabel}.\\n\\nTried:\\n${details}\\n\\n${buildHelpMessage(ctx)}`,",
	"\t);",
].join("\n");

const patched = working.replace(oldThrowBlock, replacement);
writeFileSync(target, patched, "utf8");
console.log("[patch] Applied pi-natives JS-only fallback patch (conditional version).");