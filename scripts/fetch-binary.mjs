#!/usr/bin/env node
// fetch-binary.mjs — Node.js postinstall for @sns-myagent/cli
//
// Downloads the prebuilt `snsagent` binary from the latest GitHub release
// into <prefix>/bin/, then symlinks the active one to <prefix>/bin/snsagent
// so `npm install -g @sns-myagent/cli` puts a working `snsagent` on PATH.
//
// Asset layout matches what .github/workflows/build-release.yml produces:
//   snsagent-linux-x64          (raw, not zipped)
//   snsagent-linux-arm64
//   snsagent-darwin-x64
//   snsagent-darwin-arm64
//   snsagent-windows-x64.exe
//
// Falls back to musl variant on Linux if glibc asset unavailable.
// Never breaks `npm install` — on any failure prints warning + exits 0.

import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, lstatSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const REPO = "Reihantt6/sns-myagent";
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const UA = "sns-myagent-fetch-binary/0.2.0 (npm postinstall)";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// npm install -g layout: <prefix>/lib/node_modules/@sns-myagent/cli/scripts/fetch-binary.mjs
// <prefix>/lib/node_modules/@sns-myagent/cli/node_modules/.bin/snsagent  (npm symlinks bin)
// We want to download into <prefix>/lib/node_modules/@sns-myagent/cli/bin/
// so npm auto-symlinks it into <prefix>/bin/snsagent.
const REPO_ROOT = resolve(__dirname, "..");
const BIN_DIR = join(REPO_ROOT, "bin");

const isWin = process.platform === "win32";

const c = {
	reset: "\u001b[0m",
	red: "\u001b[31m",
	green: "\u001b[32m",
	yellow: "\u001b[33m",
	cyan: "\u001b[36m",
};
const info = (m) => process.stdout.write(`${c.cyan}info${c.reset}  ${m}\n`);
const warn = (m) => process.stdout.write(`${c.yellow}warn${c.reset}  ${m}\n`);
const err = (m) => process.stdout.write(`${c.red}error${c.reset} ${m}\n`);
const ok = (m) => process.stdout.write(`${c.green}ok${c.reset}    ${m}\n`);

function pickAssetName(platform, arch, isMusl) {
	const x = (a) => (a === "x64" ? "x64" : a === "arm64" ? "arm64" : null);
	if (platform === "linux") {
		const a = x(arch);
		if (!a) return null;
		// Release ships glibc variant by default. If user is on musl/alpine,
		// try musl fallback (may 404 on releases that don't have it).
		return isMusl ? [`snsagent-linux-${a}-musl`, `snsagent-linux-${a}`] : [`snsagent-linux-${a}`];
	}
	if (platform === "darwin") {
		const a = x(arch);
		if (!a) return null;
		return [`snsagent-darwin-${a}`];
	}
	if (platform === "win32") {
		return arch === "x64" ? [`snsagent-windows-x64.exe`] : null;
	}
	return null;
}

function detectMuslLinux() {
	if (process.platform !== "linux") return false;
	try {
		const out = execFileSync("ldd", ["/proc/self/exe"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 3000 });
		if (/libc\.so\.6/.test(out)) return false;
		if (/musl/.test(out)) return true;
		return true; // alpine/void default to musl
	} catch {
		return false; // can't tell — glibc default
	}
}

function fetchBuffer(url, redirectsLeft = 5) {
	return new Promise((resolveP, rejectP) => {
		const headers = { "User-Agent": UA, Accept: "application/octet-stream" };
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		const req = https.get(url, { headers }, (res) => {
			const status = res.statusCode ?? 0;
			if (status >= 300 && status < 400 && res.headers.location) {
				res.resume();
				if (redirectsLeft <= 0) return rejectP(new Error("too many redirects"));
				return resolveP(fetchBuffer(res.headers.location, redirectsLeft - 1));
			}
			if (status === 404) {
				res.resume();
				return rejectP(Object.assign(new Error("not found"), { httpStatus: 404 }));
			}
			if (status !== 200) {
				res.resume();
				return rejectP(new Error(`HTTP ${status} for ${url}`));
			}
			const chunks = [];
			res.on("data", (c2) => chunks.push(c2));
			res.on("end", () => resolveP(Buffer.concat(chunks)));
			res.on("error", rejectP);
		});
		req.on("error", rejectP);
		req.setTimeout(60_000, () => req.destroy(new Error(`timeout 60s: ${url}`)));
	});
}

function fetchJson(url) {
	return new Promise((resolveP, rejectP) => {
		const headers = {
			"User-Agent": UA,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		const req = https.get(url, { headers }, (res) => {
			const status = res.statusCode ?? 0;
			const chunks = [];
			res.on("data", (c2) => chunks.push(c2));
			res.on("end", () => {
				const body = Buffer.concat(chunks).toString("utf8");
				if (status === 404) return rejectP(Object.assign(new Error("release not found"), { httpStatus: 404 }));
				if (status === 403) return rejectP(Object.assign(new Error("rate limited"), { httpStatus: 403 }));
				if (status !== 200) return rejectP(new Error(`GitHub API HTTP ${status}: ${body.slice(0, 200)}`));
				try {
					resolveP(JSON.parse(body));
				} catch (e) {
					rejectP(new Error(`invalid JSON: ${e.message}`));
				}
			});
		});
		req.on("error", rejectP);
		req.setTimeout(30_000, () => req.destroy(new Error(`timeout 30s: ${url}`)));
	});
}

async function main() {
	const platform = process.platform;
	const arch = process.arch;
	const isMusl = detectMuslLinux();
	const candidates = pickAssetName(platform, arch, isMusl);

	if (!candidates) {
		warn(`unsupported platform/arch: ${platform}/${arch}. Build from source: https://github.com/${REPO}#from-source`);
		return;
	}

	info(`target: ${platform}/${arch}${isMusl ? " (musl)" : ""}`);

	let release;
	try {
		release = await fetchJson(RELEASE_API);
	} catch (e) {
		if (e.httpStatus === 404) {
			warn(`no release at github.com/${REPO}/releases. Falling back to Bun install.`);
		} else if (e.httpStatus === 403) {
			warn(`GitHub API rate-limited. Set GITHUB_TOKEN env var to retry. Falling back to Bun install.`);
		} else {
			warn(`could not reach GitHub API (${e.message}). Skipping binary fetch.`);
		}
		return;
	}

	const available = release.assets ?? [];
	const asset =
		candidates.map((n) => available.find((a) => a.name === n)).find(Boolean) ?? null;

	if (!asset?.browser_download_url) {
		warn(
			`release ${release.tag_name ?? "(unknown)"} has no matching asset. ` +
				`Wanted one of: ${candidates.join(", ")}. Available: ${available.map((a) => a.name).join(", ") || "(none)"}.`,
		);
		return;
	}

	const tmp = await mkdtemp(join(tmpdir(), "snsagent-"));
	const tmpFile = join(tmp, asset.name);
	info(`downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(2)} MB)`);

	let buf;
	try {
		buf = await fetchBuffer(asset.browser_download_url);
	} catch (e) {
		warn(`download failed: ${e.message}`);
		await rm(tmp, { recursive: true, force: true });
		return;
	}

	await new Promise((resolveP, rejectP) => {
		const ws = createWriteStream(tmpFile);
		ws.on("error", rejectP);
		ws.on("finish", resolveP);
		ws.end(buf);
	});

	mkdirSync(BIN_DIR, { recursive: true });
	const target = join(BIN_DIR, asset.name);
	if (existsSync(target)) {
		try {
			unlinkSync(target);
		} catch {}
	}

	// Move from tmp into bin/
	const { copyFile } = await import("node:fs/promises");
	await copyFile(tmpFile, target);
	await rm(tmp, { recursive: true, force: true });

	if (!isWin) {
		await chmod(target, 0o755);
	}

	// Shim file (referenced by package.json "bin"): bin/snsagent.js
	// It execs the platform-specific binary that postinstall downloaded.
	const shim = isWin ? "snsagent.cmd" : "snsagent.js";
	const shimPath = join(BIN_DIR, shim);

	if (isWin) {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(
			shimPath,
			`@echo off\r\n"%~dp0${asset.name}" %*\r\n`,
		);
	} else {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(
			shimPath,
			`#!/usr/bin/env node\n// Auto-generated by fetch-binary.mjs — execs the platform binary.\nimport { spawn } from "node:child_process";\nimport { fileURLToPath } from "node:url";\nimport { dirname, join } from "node:path";\nconst here = dirname(fileURLToPath(import.meta.url));\nconst bin = join(here, "${asset.name}");\nconst r = spawn(bin, process.argv.slice(2), { stdio: "inherit" });\nr.on("exit", (c) => process.exit(c ?? 0));\n`,
		);
		await chmod(shimPath, 0o755);
	}

	const st = await stat(target);
	ok(`${asset.name} ready (${(st.size / 1024 / 1024).toFixed(2)} MB) → bin/${shim}`);
}

main().catch((e) => {
	err(`unexpected: ${e?.stack ?? e?.message ?? e}`);
	process.exit(1); // hard-fail so user knows postinstall broke
});
