type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
  position?: { start: { line: number }; end: { line: number } };
};

/** Obsidian-style ==highlight== support. Code nodes are intentionally untouched. */
export function remarkObsidianHighlight() {
  return (tree: MarkdownNode) => {
    function transform(node: MarkdownNode) {
      if (!node.children) return;

      const transformed: MarkdownNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value?.includes("==")) {
          transform(child);
          transformed.push(child);
          continue;
        }

        const pattern = /==(?=\S)([^\n]*?\S)==/g;
        let cursor = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(child.value)) !== null) {
          if (match.index > cursor) transformed.push({ type: "text", value: child.value.slice(cursor, match.index) });
          transformed.push({
            type: "strong",
            data: { hName: "mark", hProperties: { className: "markdown-highlight" } },
            children: [{ type: "text", value: match[1] }],
          });
          cursor = match.index + match[0].length;
        }
        if (cursor === 0) transformed.push(child);
        else if (cursor < child.value.length) transformed.push({ type: "text", value: child.value.slice(cursor) });
      }
      node.children = transformed;
    }

    transform(tree);
  };
}

export function remarkChangedLines(changedLines: ReadonlyMap<number, "added" | "removed">) {
  return () => (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      const blockTypes = new Set(["heading", "paragraph", "blockquote", "list", "listItem", "code", "thematicBreak", "table"]);
      if (node.position && blockTypes.has(node.type)) {
        for (let line = node.position.start.line; line <= node.position.end.line; line += 1) {
          const kind = changedLines.get(line);
          if (!kind) continue;
          node.data ??= {};
          node.data.hProperties = { ...node.data.hProperties, className: `markdown-changed-block markdown-changed-${kind}` };
          return;
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
