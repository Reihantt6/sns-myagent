/**
 * Render a code or markdown cell with optional output section.
 */
import { Markdown, visibleWidth } from "@oh-my-pi/pi-tui";
import chalk from "chalk";
import { getMarkdownTheme, highlightCode, type Theme } from "../modes/theme/theme";
import {
	formatDuration,
	formatExpandHint,
	formatMoreItems,
	formatStatusIcon,
	replaceTabs,
} from "../tools/render-utils";
import { renderOutputBlock } from "./output-block";
import type { State } from "./types";

export interface CodeCellOptions {
	code: string;
	language?: string;
	index?: number;
	total?: number;
	title?: string;
	status?: "pending" | "running" | "warning" | "complete" | "error";
	spinnerFrame?: number;
	duration?: number;
	output?: string;
	outputMaxLines?: number;
	codeMaxLines?: number;
	/**
	 * Show the LAST `codeMaxLines` rows (the live streaming edge) instead of the
	 * first, with a "… N earlier lines" marker on top. Lets a pending preview
	 * follow code as it is written while staying bounded. Ignored when `expanded`.
	 */
	codeTail?: boolean;
	expanded?: boolean;
	/**
	 * Prefix the header with the cell's language icon (resolved through the
	 * active symbol preset: nerd-font devicon, unicode emoji, or ascii
	 * shorthand). Opt-in so only the eval kernel renderer labels each cell;
	 * read/write/browser code cells stay icon-free.
	 */
	showLanguage?: boolean;
	width: number;
	codeStartLine?: number;
	codeLineNumbers?: Array<number | null>;
}

function getState(status?: CodeCellOptions["status"]): State | undefined {
	if (!status) return undefined;
	if (status === "complete") return "success";
	if (status === "error") return "error";
	if (status === "warning") return "warning";
	if (status === "running") return "running";
	return "pending";
}

function formatHeader(options: CodeCellOptions, theme: Theme): { title: string; meta?: string } {
	const { index, total, title, status, spinnerFrame, duration, language, showLanguage } = options;
	const parts: string[] = [];
	if (showLanguage && language) {
		const langIcon = theme.getLangIconStyled(language);
		if (langIcon) parts.push(langIcon);
	}
	if (status) {
		const icon = formatStatusIcon(
			status === "complete"
				? "done"
				: status === "error"
					? "error"
					: status === "warning"
						? "warning"
						: status === "running"
							? "running"
							: "pending",
			theme,
			spinnerFrame,
		);
		if (status === "pending" || status === "running") {
			parts.push(`${icon} ${theme.fg("muted", status)}`);
		} else {
			parts.push(icon);
		}
	}
	if (index !== undefined && total !== undefined) {
		parts.push(theme.fg("accent", `[${index + 1}/${total}]`));
	}
	if (title) {
		parts.push(theme.fg("toolTitle", title));
	}
	const headerTitle = parts.length > 0 ? parts.join(" ") : theme.fg("toolTitle", "Code");

	const metaParts: string[] = [];
	if (duration !== undefined) {
		metaParts.push(theme.fg("dim", `(${formatDuration(duration)})`));
	}
	if (metaParts.length === 0) return { title: headerTitle };
	return { title: headerTitle, meta: metaParts.join(theme.fg("dim", theme.sep.dot)) };
}

/**
 * Normalize terminal control characters that would otherwise corrupt TUI rendering:
 * - Collapse `\r\n` to `\n`.
 * - Within a line, treat `\r` as a cursor-return overwrite by keeping only the
 *   final segment (mirrors how rsync/curl/pip progress bars render to a terminal).
 * Splits on `\n` and returns the cleaned lines.
 */
function sanitizeTerminalLines(text: string): string[] {
	return text.split(/\r?\n/).map(collapseCarriageReturns);
}

function collapseCarriageReturns(line: string): string {
	const idx = line.lastIndexOf("\r");
	return idx < 0 ? line : line.slice(idx + 1);
}
export function renderCodeCell(options: CodeCellOptions, theme: Theme): string[] {
	const {
		code,
		language,
		output,
		expanded = false,
		outputMaxLines = 6,
		codeMaxLines = 12,
		width,
		codeStartLine,
		codeLineNumbers,
	} = options;
	const { title, meta } = formatHeader(options, theme);
	const state = getState(options.status);

	const normalizedCode = replaceTabs(code ?? "");
	const rawCodeLines = sanitizeTerminalLines(normalizedCode);
	const maxCodeLines = expanded ? rawCodeLines.length : Math.min(rawCodeLines.length, codeMaxLines);
	const hiddenCodeLines = rawCodeLines.length - maxCodeLines;
	const tail = options.codeTail === true && !expanded && hiddenCodeLines > 0;
	const startIndex = tail ? rawCodeLines.length - maxCodeLines : 0;
	const visibleCode = rawCodeLines.slice(startIndex, startIndex + maxCodeLines).join("\n");
	const codeLines = highlightCode(visibleCode, language);

	let visibleLineNumbers: Array<number | null> | undefined;
	let lineNumberWidth = 0;
	if (codeLineNumbers) {
		visibleLineNumbers = codeLineNumbers.slice(startIndex, startIndex + maxCodeLines);
	} else if (codeStartLine !== undefined) {
		visibleLineNumbers = Array.from({ length: maxCodeLines }, (_, i) => codeStartLine + startIndex + i);
	}

	if (visibleLineNumbers) {
		const validLineNums = visibleLineNumbers.filter((n): n is number => n !== null && n !== undefined);
		const maxVal = validLineNums.length > 0 ? Math.max(...validLineNums) : 0;
		if (maxVal > 0) {
			lineNumberWidth = Math.max(2, String(maxVal).length);
		}
	}

	if (lineNumberWidth > 0 && visibleLineNumbers) {
		for (let i = 0; i < codeLines.length; i++) {
			const lineNum = visibleLineNumbers[i];
			const gutter =
				lineNum !== null && lineNum !== undefined
					? String(lineNum).padStart(lineNumberWidth, " ")
					: " ".repeat(lineNumberWidth);
			codeLines[i] = theme.fg("dim", `${gutter} `) + codeLines[i];
		}
	}

	if (hiddenCodeLines > 0) {
		const hint = formatExpandHint(theme, expanded, hiddenCodeLines > 0);
		const gutterPad = lineNumberWidth > 0 ? " ".repeat(lineNumberWidth + 1) : "";
		if (tail) {
			// Earlier rows scrolled above the live tail window — mark them on top so
			// the newest streamed line stays pinned to the bottom of the box.
			const earlier = `… ${hiddenCodeLines} earlier line${hiddenCodeLines === 1 ? "" : "s"}${hint ? ` ${hint}` : ""}`;
			codeLines.unshift(theme.fg("dim", gutterPad + earlier));
		} else {
			const moreLine = `${formatMoreItems(hiddenCodeLines, "line")}${hint ? ` ${hint}` : ""}`;
			codeLines.push(theme.fg("dim", gutterPad + moreLine));
		}
	}

	const outputLines: string[] = [];
	if (output?.trim()) {
		const rawLines = sanitizeTerminalLines(output);
		const maxLines = expanded ? rawLines.length : Math.min(rawLines.length, outputMaxLines);
		const displayLines = rawLines
			.slice(0, maxLines)
			.map(line => (line.includes("\x1b[") ? replaceTabs(line) : theme.fg("toolOutput", replaceTabs(line))));
		outputLines.push(...displayLines);
		const remaining = rawLines.length - maxLines;
		if (remaining > 0) {
			const hint = formatExpandHint(theme, expanded, remaining > 0);
			const moreLine = `${formatMoreItems(remaining, "line")}${hint ? ` ${hint}` : ""}`;
			outputLines.push(theme.fg("dim", moreLine));
		}
	}

	const sections: Array<{ label?: string; lines: string[] }> = [{ lines: codeLines }];
	if (outputLines.length > 0) {
		sections.push({ label: theme.fg("toolTitle", "Output"), lines: outputLines });
	}

	return renderOutputBlock({ header: title, headerMeta: meta, state, sections, width }, theme);
}

export interface MarkdownCellOptions {
	content: string;
	index?: number;
	total?: number;
	title?: string;
	status?: "pending" | "running" | "warning" | "complete" | "error";
	spinnerFrame?: number;
	duration?: number;
	output?: string;
	outputMaxLines?: number;
	contentMaxLines?: number;
	expanded?: boolean;
	width: number;
}

// ── Collapsible tool output helpers ──

const COLLAPSE_BORDER = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
} as const;

/**
 * Render a collapsible section for tool output.
 * When collapsed: shows header + line count hint.
 * When expanded: shows full output in bordered block.
 */
export function renderCollapsibleOutput(
  label: string,
  content: string,
  expanded: boolean,
  width: number,
  theme: Theme,
  maxLines: number = 8,
): string[] {
  const lines: string[] = [];
  const inner = Math.max(20, width - 4);

  if (!expanded) {
    // Collapsed: just header + hint
    const lineCount = content.split("\n").length;
    const hint = chalk.dim(` (${lineCount} lines, click to expand)`);
    lines.push(`  ${chalk.cyan("▸")} ${chalk.bold(label)}${hint}`);
    return lines;
  }

  // Expanded: bordered block
  const accent = chalk.cyan;

  	// Expanded: bordered block
  	const accentFn = (s: string) => chalk.cyan(s);

  // Header
  const headerText = ` ${label} `;
  const headerFill = COLLAPSE_BORDER.horizontal.repeat(
    Math.max(0, inner - headerText.length - 2),
  );
  lines.push(accent(COLLAPSE_BORDER.topLeft + COLLAPSE_BORDER.horizontal) + chalk.bold(headerText) + accent(headerFill + COLLAPSE_BORDER.topRight));

  // Content
  const rawLines = content.split("\n");
  const visibleLines = rawLines.slice(0, maxLines);
  for (const line of visibleLines) {
    const visLen = visibleWidth(line);
    const fill = " ".repeat(Math.max(0, inner - visLen));
    lines.push(accent(COLLAPSE_BORDER.vertical) + " " + line + fill + " " + accent(COLLAPSE_BORDER.vertical));
  }

  // Hidden lines hint
  const remaining = rawLines.length - maxLines;
  if (remaining > 0) {
    const moreText = `  ... +${remaining} more lines`;
    const moreFill = " ".repeat(Math.max(0, inner - moreText.length));
    lines.push(accent(COLLAPSE_BORDER.vertical) + chalk.dim(moreText) + moreFill + accent(COLLAPSE_BORDER.vertical));
  }

  // Footer
  lines.push(accent(COLLAPSE_BORDER.bottomLeft + COLLAPSE_BORDER.horizontal.repeat(inner) + COLLAPSE_BORDER.bottomRight));

  return lines;
}

/**
 * Render a collapsible tool output cell with gradient border.
 * Wraps renderCodeCell with collapsible behavior.
 */
export function renderCollapsibleCodeCell(options: {
  code: string;
  language?: string;
  title?: string;
  status?: "pending" | "running" | "warning" | "complete" | "error";
  output?: string;
  expanded?: boolean;
  width: number;
}, theme: Theme): string[] {
  const { expanded = false, ...rest } = options;
  return renderCodeCell({ ...rest, codeMaxLines: expanded ? 200 : 8, outputMaxLines: expanded ? 50 : 4, expanded }, theme);
}

export function renderMarkdownCell(options: MarkdownCellOptions, theme: Theme): string[] {
	const { content, output, expanded = false, outputMaxLines = 6, contentMaxLines = 12, width } = options;
	const codeOptions: CodeCellOptions = {
		code: "",
		index: options.index,
		total: options.total,
		title: options.title,
		status: options.status,
		spinnerFrame: options.spinnerFrame,
		duration: options.duration,
		width,
	};
	const { title, meta } = formatHeader(codeOptions, theme);
	const state = getState(options.status);

	// Markdown component manages its own wrapping at the inner content width.
	// `renderOutputBlock` adds a `│ ` prefix + `│` suffix → 3 visible columns.
	const innerWidth = Math.max(20, width - 3);
	const allLines = content.trim() ? new Markdown(content, 0, 0, getMarkdownTheme()).render(innerWidth) : [];
	const maxContentLines = expanded ? allLines.length : Math.min(allLines.length, contentMaxLines);
	const contentLines = allLines.slice(0, maxContentLines);
	const hiddenContentLines = allLines.length - maxContentLines;
	if (hiddenContentLines > 0) {
		const hint = formatExpandHint(theme, expanded, hiddenContentLines > 0);
		const moreLine = `${formatMoreItems(hiddenContentLines, "line")}${hint ? ` ${hint}` : ""}`;
		contentLines.push(theme.fg("dim", moreLine));
	}

	const outputLines: string[] = [];
	if (output?.trim()) {
		const rawLines = sanitizeTerminalLines(output);
		const maxLines = expanded ? rawLines.length : Math.min(rawLines.length, outputMaxLines);
		const displayLines = rawLines
			.slice(0, maxLines)
			.map(line => (line.includes("\x1b[") ? replaceTabs(line) : theme.fg("toolOutput", replaceTabs(line))));
		outputLines.push(...displayLines);
		const remaining = rawLines.length - maxLines;
		if (remaining > 0) {
			const hint = formatExpandHint(theme, expanded, remaining > 0);
			const moreLine = `${formatMoreItems(remaining, "line")}${hint ? ` ${hint}` : ""}`;
			outputLines.push(theme.fg("dim", moreLine));
		}
	}

	const sections: Array<{ label?: string; lines: string[] }> = [{ lines: contentLines }];
	if (outputLines.length > 0) {
		sections.push({ label: theme.fg("toolTitle", "Output"), lines: outputLines });
	}

	return renderOutputBlock({ header: title, headerMeta: meta, state, sections, width }, theme);
}
