/**
 * Remark plugin: add `id` attributes to h2/h3 headings so the docs TOC can
 * deep-link to sections. Slug algorithm matches src/utils/slug.ts.
 */
export function remarkHeadingIds() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
        const text = node.children
          .filter((c) => c.type === "text" || c.type === "inlineCode")
          .map((c) => c.value)
          .join("");
        const id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
        if (id) node.data ??= { hProperties: {} };
        if (id) node.data.hProperties ??= {};
        if (id) node.data.hProperties.id = id;
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
