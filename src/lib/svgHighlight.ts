/**
 * A tiny, dependency-free XML/SVG tokenizer for read-only syntax highlighting
 * of the exported markup. It is NOT a validating parser — just enough structure
 * to color tags, attributes, and values. The one hard invariant: concatenating
 * every token's `text` reproduces the input byte-for-byte, so highlighting can
 * never alter the markup the user sees or copies (see svgHighlight.test.ts).
 *
 * ponytail: `<[^>]+>` treats the first `>` as the tag end, so a literal `>`
 * inside an attribute value would split the tag. Real exporter output never
 * emits one; add a quote-aware scan if that ever changes.
 */
export type SvgToken = {
  cls: "tag" | "attr" | "val" | "punct" | "com" | "txt";
  text: string;
};

// Splits the source into comments, tags (`<…>`), and everything between.
const SEGMENT = /<!--[\s\S]*?-->|<[^>]+>|[^<]+/g;

// Within a tag: opening punct + name | attr name + `=` + quoted value |
// closing punct | any leftover run (whitespace, bare attrs, `<?xml …?>`).
const TAG_PART = /(<\/?)([\w:.-]+)|([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')|(\/?\??>)|([^]+?)/g;

export function highlightSvg(src: string): SvgToken[] {
  const tokens: SvgToken[] = [];
  for (const [seg] of src.matchAll(SEGMENT)) {
    if (seg.startsWith("<!--")) {
      tokens.push({ cls: "com", text: seg });
    } else if (seg.startsWith("<")) {
      tokenizeTag(seg, tokens);
    } else {
      tokens.push({ cls: "txt", text: seg });
    }
  }
  return tokens;
}

function tokenizeTag(tag: string, out: SvgToken[]): void {
  for (const m of tag.matchAll(TAG_PART)) {
    if (m[1] !== undefined) {
      out.push({ cls: "punct", text: m[1] }, { cls: "tag", text: m[2] });
    } else if (m[3] !== undefined) {
      out.push(
        { cls: "attr", text: m[3] },
        { cls: "punct", text: m[4] },
        { cls: "val", text: m[5] },
      );
    } else if (m[6] !== undefined) {
      out.push({ cls: "punct", text: m[6] });
    } else {
      out.push({ cls: "txt", text: m[7] });
    }
  }
}
