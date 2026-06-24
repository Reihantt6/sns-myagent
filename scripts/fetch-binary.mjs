#!/usr/bin/env node
// fetch-binary.mjs — Node.js postinstall for @sns-myagent/cli (Opsi B: dual-runtime npm support)
//
// Downloads the prebuilt `snscoder` binary from the latest GitHub release
// and unpacks it to <repo>/bin/. Runs under plain Node 18+ (no `npm install`
// dependencies allowed — npm postinstall executes BEFORE package deps install).
//
// Strategy:
//   1. Detect platform + arch (process.platform, process.arch).
//   2. On linux, attempt a musl probe via `ldd /proc/self/exe` — if no glibc
//      dependency is reported we pick the musl asset, otherwise the glibc one.
//      If the probe fails or is inconclusive, fall back to glibc.
//   3. GET https://api.github.com/repos/Reihantt6/sns-myagent/releases/latest
//      (honors GITHUB_TOKEN env var for 60-req/hr anonymous → 5000-req/hr auth).
//   4. Find the matching asset, download its zip, and unpack into bin/.
//      Unix uses `unzip -o`; Windows uses `Expand-Archive` via PowerShell.
//   5. chmod 755 the resulting binary on unix.
//   6. On any failure path (no release, missing asset, network down) print a
//      friendly warning and exit 0 — we must NOT break `npm install`.
//
// Spec conventions assumed for release assets (Bun-style):
//   snscoder-linux-x64.zip       (glibc fallback)
//   snscoder-linux-x64-musl.zip  (musl/alpine)
//   snscoder-linux-arm64.zip
//   snscoder-darwin-x64.zip
//   snscoder-darwin-arm64.zip
//   snscoder-windows-x64.zip
//   Each archive contains a single file named `snscoder` (or `snscoder.exe`).

import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const REPO = "Reihantt6/sns-myagent";
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const UA = "sns-myagent-fetch-binary/0.1.0 (npm postinstall)";

// Resolve repo root: this script lives at <repo>/scripts/fetch-binary.mjs
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const BIN_DIR = join(REPO_ROOT, "bin");

const isWin = process.platform === "win32";

// --- Pretty logging ---------------------------------------------------------

const c = {
	reset: "\u001b[0m",
	dim: "\u001b[2m",
	red: "\u001b[31m",
	green: "\u001b[32m",
	yellow: "\u001b[33m",
	cyan: "\u001b[36m",
	bold: "\u001b[1m",
};

function info(msg) {
	process.stdout.write(`${c.cyan}info${c.reset}  ${msg}\n`);
}
function warn(msg) {
	process.stdout.write(`${c.yellow}warn${c.reset}  ${msg}\n`);
}
function error(msg) {
	process.stdout.write(`${c.red}error${c.reset} ${msg}\n`);
}
function ok(msg) {
	process.stdout.write(`${c.green}ok${c.reset}    ${msg}\n`);
}

// --- Platform / asset mapping ----------------------------------------------

/**
 * Map (platform, arch, isMusl) → asset filename.
 * Returns null when the platform/arch combo is unsupported.
 */
function pickAssetName(platform, arch, isMusl) {
	if (platform === "linux") {
		if (arch === "x64") return isMusl ? "snscoder-linux-x64-musl.zip" : "snscoder-linux-x64.zip";
		if (arch === "arm64") return "snscoder-linux-arm64.zip";
		return null;
	}
	if (platform === "darwin") {
		if (arch === "x64") return "snscoder-darwin-x64.zip";
		if (arch === "arm64") return "snscoder-darwin-arm64.zip";
		return null;
	}
	if (platform === "win32") {
		if (arch === "x64") return "snscoder-windows-x64.zip";
		return null;
	}
	return null;
}

/**
 * Musl heuristic: run `ldd /proc/self/exe` and look for `libc.so.*` (glibc).
 * - musl systems (Alpine, Void with musl, etc.) print "Not a valid dynamic
 *   program" or `ldd: can't find dynamic linker info` AND no `libc.so.6` line.
 * - glibc systems show `libc.so.6 => /lib64/libc.so.6` etc.
 *
 * Heuristic limitations:
 * - Static binaries report "not a dynamic executable" — we conservatively
 *   treat that as glibc (more common on developer machines).
 * - BusyBox `ldd` is a shell wrapper; it sometimes prints to stdout but not
 *   stderr. We merge both streams before scanning.
 */
function detectMuslLinux() {
	if (process.platform !== "linux") return false;
	try {
		const out = execFileSync("ldd", ["/proc/self/exe"], {
			stdio: ["ignore", "pipe", "pipe"],
			encoding: "utf8",
			timeout: 3000,
		});
		// glibc leaves a libc.so.6 line; musl leaves musl libc.so line.
		if (/libc\.so\.6/.test(out)) return false;
		if (/musl/.test(out)) return true;
		// No glibc marker found and not explicitly musl → assume musl
		// (Alpine, Void-musl, etc.). Falls back wrong on static binaries
		// — see heuristic note above.
		return true;
	} catch {
		// ldd missing OR failed → can't tell. Default to glibc (most common).
		return false;
	}
}

// --- HTTP helpers -----------------------------------------------------------

/**
 * https.get wrapper that returns a Buffer and follows up to 3 redirects
 * (GitHub release redirects to S3, which redirects to Cloudfront).
 */
function fetchBuffer(url, redirectsLeft = 3) {
	return new Promise((resolveP, rejectP) => {
		const headers = {
			"User-Agent": UA,
			Accept: "application/octet-stream",
		};
		if (process.env.GITHUB_TOKEN) {
			headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}

		const req = https.get(url, { headers }, (res) => {
			const status = res.statusCode ?? 0;
			// Follow redirects (GitHub release downloads 302 to S3 → Cloudfront)
			if (status >= 300 && status < 400 && res.headers.location) {
				res.resume();
				if (redirectsLeft <= 0) {
					rejectP(new Error(`too many redirects for ${url}`));
					return;
				}
				resolveP(fetchBuffer(res.headers.location, redirectsLeft - 1));
				return;
			}
			if (status === 404) {
				res.resume();
				rejectP(Object.assign(new Error("not found"), { httpStatus: 404 }));
				return;
			}
			if (status !== 200) {
				res.resume();
				rejectP(new Error(`HTTP ${status} for ${url}`));
				return;
			}

			const chunks = [];
			res.on("data", (c2) => chunks.push(c2));
			res.on("end", () => resolveP(Buffer.concat(chunks)));
			res.on("error", rejectP);
		});

		req.on("error", rejectP);
		req.setTimeout(30_000, () => {
			req.destroy(new Error(`timeout after 30s: ${url}`));
		});
	});
}

function fetchJson(url) {
	return new Promise((resolveP, rejectP) => {
		const headers = {
			"User-Agent": UA,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};
		if (process.env.GITHUB_TOKEN) {
			headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		}

		const req = https.get(url, { headers }, (res) => {
			const status = res.statusCode ?? 0;
			const chunks = [];
			res.on("data", (c2) => chunks.push(c2));
			res.on("end", () => {
				const body = Buffer.concat(chunks).toString("utf8");
				if (status === 404) {
					rejectP(Object.assign(new Error("release not found"), { httpStatus: 404 }));
					return;
				}
				if (status !== 200) {
					rejectP(new Error(`GitHub API HTTP ${status}: ${body.slice(0, 200)}`));
					return;
				}
				try {
					resolveP(JSON.parse(body));
				} catch (e) {
					rejectP(new Error(`invalid JSON from GitHub: ${e.message}`));
				}
			});
			res.on("error", rejectP);
		});

		req.on("error", rejectP);
		req.setTimeout(30_000, () => {
			req.destroy(new Error(`timeout after 30s: ${url}`));
		});
	});
}

// --- Zip unpack (delegates to system tools) --------------------------------

/**
 * Unzip an archive into destDir. On unix uses `unzip -o`; on Windows uses
 * PowerShell's `Expand-Archive`. Both are preinstalled on the respective
 * platforms (unzip is on virtually every macOS/Linux dev box; Expand-Archive
 * ships with PowerShell 5+).
 *
 * Throws if neither tool is available — caller decides whether that's fatal.
 */
function unzip(archivePath, destDir) {
	if (isWin) {
		// PowerShell Expand-Archive needs a non-existent OR empty dest dir.
		execFileSync(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
			],
			{ stdio: ["ignore", "inherit", "inherit"] },
		);
	} else {
		execFileSync("unzip", ["-o", archivePath, "-d", destDir], {
			stdio: ["ignore", "inherit", "inherit"],
		});
	}
}

// --- Main flow --------------------------------------------------------------

async function main() {
	const platform = process.platform;
	const arch = process.arch;
	const isMusl = detectMuslLinux();
	const assetName = pickAssetName(platform, arch, isMusl);

	if (!assetName) {
		warn(
			`unsupported platform/arch combo: ${platform}/${arch}. ` +
				`Build from source instead: https://github.com/${REPO}#from-source`,
		);
		return;
	}

	info(`target: ${platform}/${arch}${isMusl ? " (musl)" : ""} → ${assetName}`);

	let release;
	try {
		release = await fetchJson(RELEASE_API);
	} catch (e) {
		if (e.httpStatus === 404) {
			warn(
				`no release found at github.com/${REPO}/releases — ` +
					`maintainer must publish v0.1.0 first. Falling back to Bun install.`,
			);
			return;
		}
		warn(
			`could not reach GitHub API (${e.message}). ` +
				`Skipping binary fetch. Run 'npm rebuild' after going online.`,
		);
		return;
	}

	const asset = (release.assets ?? []).find((a) => a.name === assetName);
	if (!asset || !asset.browser_download_url) {
		warn(
			`release ${release.tag_name ?? "(unknown)"} has no asset '${assetName}'. ` +
				`Available: ${(release.assets ?? []).map((a) => a.name).join(", ") || "(none)"}. ` +
				`Falling back to Bun install.`,
		);
		return;
	}

	// Download into a temp dir so a half-finished install never clobbers bin/.
	const tmp = await mkdtemp(join(tmpdir(), "snscoder-"));
	const archivePath = join(tmp, assetName);
	info(`downloading ${asset.browser_download_url}`);

	let zipBuf;
	try {
		zipBuf = await fetchBuffer(asset.browser_download_url);
	} catch (e) {
		warn(`download failed (${e.message}). Skipping binary fetch.`);
		await rm(tmp, { recursive: true, force: true });
		return;
	}

	await new Promise((resolveP, rejectP) => {
		const ws = createWriteStream(archivePath);
		ws.on("error", rejectP);
		ws.on("finish", resolveP);
		ws.end(zipBuf);
	});

	info(`extracting → ${BIN_DIR}`);
	mkdirSync(BIN_DIR, { recursive: true });
	try {
		unzip(archivePath, BIN_DIR);
	} catch (e) {
		warn(`unzip failed (${e.message}). Binaries like 'unzip' or PowerShell Expand-Archive are required.`);
		await rm(tmp, { recursive: true, force: true });
		return;
	}

	const binaryName = isWin ? "snscoder.exe" : "snscoder";
	const binaryPath = join(BIN_DIR, binaryName);

	if (!existsSync(binaryPath)) {
		// Sometimes archives use a different internal name — try to discover.
		const entries = await readdir(BIN_DIR);
		warn(
			`expected '${binaryName}' in archive but found: ${entries.join(", ") || "(empty)"}. ` +
				`Adjust scripts/fetch-binary.mjs to match the release asset layout.`,
		);
		await rm(tmp, { recursive: true, force: true });
		return;
	}

	if (!isWin) {
		await chmod(binaryPath, 0o755);
	}
	const st = await stat(binaryPath);
	ok(`${binaryName} ready (${(st.size / 1024 / 1024).toFixed(2)} MB)`);

	await rm(tmp, { recursive: true, force: true });
}

main().catch((e) => {
	// Catch-all: never break npm install. Print + exit 0.
	error(`unexpected: ${e?.stack ?? e?.message ?? e}`);
	process.exit(0);
});
