/**
 * Remark plugin — converts `> **Note**: ...` / `> **Tip**: ...` style
 * blockquotes into styled callout blocks:
 *
 *   > **Tip**: use `--verbose` for more output
 *
 * becomes:
 *
 *   <div class="callout callout-tip"><span class="callout-icon">Tip</span><div class="callout-body"> ... </div></div>
 *
 * Supported labels: Note, Tip, Warning, Important, Pitfall, Caution.
 * Unknown labels fall back to callout-info.
 *
 * Implementation note: the replacement is built from mdast nodes carrying
 * `data.hName` / `data.hProperties`, never from hand-built hast nodes via
 * `data.hChildren`. Passing mdast (e.g. blockquote paragraphs) through
 * `hChildren` leaks `paragraph` nodes into the hast tree and crashes
 * `hast-util-raw` ("Cannot compile `paragraph` node").
 */
import { visit } from "unist-util-visit";

const LABELS = {
  note: "info",
  tip: "tip",
  warning: "warn",
  important: "warn",
  pitfall: "warn",
  caution: "warn",
};

export function remarkCallouts() {
  return (tree) => {
    visit(tree, "blockquote", (node, index, parent) => {
      if (!node.children?.length || index === undefined || !parent) return;

      const first = node.children[0];
      if (first.type !== "paragraph" || first.children?.[0]?.type !== "strong") return;

      const strong = first.children[0];
      const labelText = String(strong.children?.[0]?.value ?? "").trim().toLowerCase();
      const tone = LABELS[labelText];
      if (!tone) return;

      // Drop the label from the first paragraph; keep the rest of the content
      first.children = first.children.slice(1);
      // Strip a leading ": " or ":" after the label
      const firstChild = first.children[0];
      if (firstChild?.type === "text") {
        firstChild.value = firstChild.value.replace(/^:\s*/, "");
      }
      if (first.children.length === 0) {
        node.children.shift();
      }

      const label = labelText.charAt(0).toUpperCase() + labelText.slice(1);

      // Icon label: a text node that the converter wraps in <span class="callout-icon">
      const icon = {
        type: "text",
        value: label,
        data: {
          hName: "span",
          hProperties: { className: ["callout-icon"] },
        },
      };

      // Body: the (label-stripped) blockquote children wrapped in <div class="callout-body">
      const body = {
        type: "paragraph",
        data: {
          hName: "div",
          hProperties: { className: ["callout-body"] },
        },
        children: node.children,
      };

      const callout = {
        type: "paragraph",
        data: {
          hName: "div",
          hProperties: { className: ["callout", `callout-${tone}`] },
        },
        children: [icon, body],
      };

      parent.children.splice(index, 1, callout);
      return index; // do not descend into the replacement
    });
  };
}
