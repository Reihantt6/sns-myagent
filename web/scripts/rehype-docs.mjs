/**
 * Rehype plugins for docs rendering (run after remark, on the hast tree).
 *
 * rehypeWrapTables: wraps every <table> in <div class="table-wrap"> so wide
 * tables scroll horizontally on mobile instead of widening the page. The first
 * column is pinned via sticky CSS (see docs.css).
 *
 * rehypeLazyImages: marks docs images as lazy + async-decoded so long pages
 * do not fetch every screenshot up front.
 */
import { SKIP, visit } from "unist-util-visit";

export function rehypeWrapTables() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || index === undefined || !parent) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-wrap"] },
        children: [node],
      };
      // Skip the replaced node so the wrapped table is not re-visited (which
      // would wrap it again and recurse).
      return SKIP;
    });
  };
}

export function rehypeLazyImages() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;
      node.properties ??= {};
      node.properties.loading = "lazy";
      node.properties.decoding = "async";
    });
  };
}
