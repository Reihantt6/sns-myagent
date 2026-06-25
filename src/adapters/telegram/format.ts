/**
 * Markdown → Telegram MarkdownV2 converter.
 *
 * Telegram MarkdownV2 rules:
 *   - Inside `*bold*`, `_italic_`, `__underline__`, `~strike~`,
 *     `` `code` ``, ` ```block``` `, `||spoiler||`, `[text](url)`:
 *     all chars in the special set `_*[]()~\`>#+-=|{}.!` MUST be escaped
 *     by prepending `\` (the only exceptions are the formatting delimiters
 *     themselves and the brackets/parens of inline links).
 *   - Outside those constructs, the same char set MUST be escaped
 *     to be displayed literally.
 *
 * Conversion strategy (deterministic, no parser dep):
 *   1. Tokenize protected spans: inline code `...`, fenced code blocks,
 *      and inline links `[label](url)`.
 *   2. Apply block transforms: `**x**` → `*x*`, `~~x~~` → `~x~`,
 *      `__x__` → `__x__` (already compatible), `# heading` → `*heading*`.
 *   3. Inside each non-code span, escape every MarkdownV2 special char
 *      EXCEPT the formatting delimiters we just inserted.
 *   4. Escape remaining special chars in code spans / link labels /
 *      URLs only where Telegram requires it.
 */

const MD_SPECIAL = /([_*\[\]()~`>#+\-=|{}.!\\])/g;
const MD_SPECIAL_NO_DELIM = /([\[\]()#+\-=|{}.!\\])/g;

/** Format delimiters used in our converted output. */
const DELIMS = ["*", "_", "__", "~", "||", "`", "```"] as const;

/**
 * Escape every MarkdownV2 special char EXCEPT the given delimiter
 * characters (which must be preserved as formatting markers).
 */
function escapeSpan(text: string, preserve: ReadonlySet<string> = new Set()): string {
	return text.replace(MD_SPECIAL, (ch) => (preserve.has(ch) ? ch : `\\${ch}`));
}

/** Escape a URL inside `[label](url)` — parens and backslash are the only hazards. */
function escapeUrl(url: string): string {
	return url.replace(/([)\\])/g, "\\$1");
}

/**
 * Public entry. Convert a standard-Markdown string into one Telegram
 * accepts when sent with `parse_mode: "MarkdownV2"`. Output is always
 * safe to send (escaped where required, delimiters preserved).
 *
 * NOTE: if the input contains unbalanced delimiters or malformed links
 * we fall through to "escape everything"; Telegram's parser will then
 * render the text literally, which is the safe degenerate behaviour.
 */
export function markdownToTelegram(input: string): string {
	if (!input) return "";

	// --- 1. Tokenize protected spans. We walk character-by-character to
	//        correctly handle nested escapes (escaped backticks inside
	//        code spans) without depending on a markdown parser.
	type Token =
		| { kind: "code"; text: string }
		| { kind: "fence"; text: string }
		| { kind: "link"; label: string; url: string }
		| { kind: "text"; text: string };

	const tokens: Token[] = [];
	let buf = "";
	let i = 0;

	const flushText = (): void => {
		if (buf.length > 0) {
			tokens.push({ kind: "text", text: buf });
			buf = "";
		}
	};

	while (i < input.length) {
		const ch = input[i] ?? "";
		const next = input[i + 1] ?? "";

		// Fenced code block: ```...``` (single-line only for chat; multi-line is rare in Telegram)
		if (ch === "`" && input.slice(i, i + 3) === "```") {
			const end = input.indexOf("```", i + 3);
			if (end !== -1) {
				flushText();
				tokens.push({ kind: "fence", text: input.slice(i + 3, end) });
				i = end + 3;
				continue;
			}
		}

		// Inline code: `...` (no nested backticks until closer)
		if (ch === "`") {
			const end = input.indexOf("`", i + 1);
			if (end !== -1) {
				flushText();
				tokens.push({ kind: "code", text: input.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}

		// Inline link: [label](url)
		if (ch === "[" && next !== "") {
			const closeBracket = input.indexOf("]", i + 1);
			if (closeBracket !== -1 && input[closeBracket + 1] === "(") {
				const closeParen = input.indexOf(")", closeBracket + 2);
				if (closeParen !== -1) {
					flushText();
					tokens.push({
						kind: "link",
						label: input.slice(i + 1, closeBracket),
						url: input.slice(closeBracket + 2, closeParen),
					});
					i = closeParen + 1;
					continue;
				}
			}
		}

		buf += ch;
		i += 1;
	}
	flushText();

	// --- 2. Convert text spans, then re-emit.
	const out: string[] = [];

	for (const token of tokens) {
		if (token.kind === "code") {
			// Inside inline code: escape ` and \ only.
			const inner = token.text.replace(/([`\\])/g, "\\$1");
			out.push(`\`${inner}\``);
			continue;
		}
		if (token.kind === "fence") {
			const inner = token.text.replace(/([`\\])/g, "\\$1");
			out.push(`\`\`\`\n${inner}\n\`\`\``);
			continue;
		}
		if (token.kind === "link") {
			const label = escapeSpan(token.label, new Set(["*", "_", "~"]));
			const url = escapeUrl(token.url);
			out.push(`[${label}](${url})`);
			continue;
		}

		// Text span: apply block transforms, then escape.
		let t = token.text;

		// **bold** → *bold*
		t = t.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
		// ~~strike~~ → ~strike~ (MarkdownV2 uses single tilde)
		t = t.replace(/~~([^~\n]+)~~/g, "~$1~");
		// __underline__ stays as __underline__ (already compatible)
		// # heading → *heading* (no native heading in MarkdownV2)
		t = t.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

		out.push(escapeSpan(t, new Set(["*", "_", "~"])));
	}

	// --- 3. Final safety net: if the result is suspiciously unbalanced
	//        (e.g. odd number of a delimiter), re-escape the raw input
	//        so Telegram shows it as literal text rather than throwing.
	const result = out.join("");
	if (isBalanced(result)) return result;

	let fallback = "";
	for (const ch of input) {
		fallback += ch.match(MD_SPECIAL) ? `\\${ch}` : ch;
	}
	return fallback;
}

/** Quick sanity check: every delimiter must appear an even number of times. */
function isBalanced(text: string): boolean {
	const counts: Record<string, number> = { "*": 0, _: 0, "~": 0, "|": 0 };
	let inCode = false;
	let inFence = false;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i] ?? "";
		if (ch === "\\") {
			i += 1; // skip escaped char
			continue;
		}
		if (!inCode && !inFence && ch === "`") {
			if (text.slice(i, i + 3) === "```") {
				inFence = !inFence;
				i += 2;
			} else {
				inCode = !inCode;
			}
			continue;
		}
		if (!inFence && !inCode) {
			if (ch in counts) counts[ch] = (counts[ch] ?? 0) + 1;
		}
	}
	return counts["*"]! % 2 === 0 && counts._! % 2 === 0 && counts["~"]! % 2 === 0 && counts["|"]! % 2 === 0;
}

/** Strip ALL MarkdownV2 formatting — plain-text echo for /chat fallback. */
export function stripMarkdown(input: string): string {
	if (!input) return "";
	let out = input;
	out = out.replace(/```[\s\S]*?```/g, "");
	out = out.replace(/`([^`]+)`/g, "$1");
	out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
	out = out.replace(/__([^_]+)__/g, "$1");
	out = out.replace(/_([^_]+)_/g, "$1");
	out = out.replace(/~~([^~]+)~~/g, "$1");
	out = out.replace(/~([^~]+)~/g, "$1");
	out = out.replace(/\|([^|]+)\|/g, "$1");
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
	out = out.replace(/^#{1,6}\s+/gm, "");
	return out;
}