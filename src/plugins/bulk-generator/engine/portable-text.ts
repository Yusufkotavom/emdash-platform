/**
 * Generate a random short key for Portable Text blocks
 */
function randomKey(): string {
  return Math.random().toString(36).substring(2, 10);
}

export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal" | "h1" | "h2" | "h3" | "h4" | "blockquote";
  listItem?: "bullet" | "number";
  level?: number;
  children: Array<{
    _type: "span";
    _key: string;
    text: string;
    marks?: string[];
  }>;
  markDefs?: unknown[];
}

/**
 * Converts markdown text into Portable Text JSON blocks
 */
export function markdownToPortableText(markdown: string): PortableTextBlock[] {
  if (!markdown || !markdown.trim()) {
    return [
      {
        _type: "block",
        _key: randomKey(),
        style: "normal",
        children: [{ _type: "span", _key: randomKey(), text: "", marks: [] }],
        markDefs: [],
      },
    ];
  }

  const lines = markdown.split(/\r?\n/);
  const blocks: PortableTextBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#### ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "h4",
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^####\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else if (line.startsWith("### ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "h3",
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^###\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else if (line.startsWith("## ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "h2",
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^##\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else if (line.startsWith("# ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "h1",
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^#\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else if (line.startsWith("> ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "blockquote",
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^>\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "normal",
        listItem: "bullet",
        level: 1,
        children: [{ _type: "span", _key: randomKey(), text: line.replace(/^[-*]\s+/, ""), marks: [] }],
        markDefs: [],
      });
    } else {
      blocks.push({
        _type: "block",
        _key: randomKey(),
        style: "normal",
        children: [{ _type: "span", _key: randomKey(), text: line, marks: [] }],
        markDefs: [],
      });
    }
  }

  return blocks;
}
