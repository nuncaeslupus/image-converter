# image-converter

**This repository is retired: the tool now lives at [Image to SVG](https://nuncaeslupus.github.io/image-to-svg/) ([source](https://github.com/nuncaeslupus/image-to-svg)).**

It only serves the GitHub Pages redirect for the old address, so existing links and installed copies keep working.

## How it works

Every page (`index.html`, `es/`, `faq/`, `es/faq/` and `404.html`) is the same static stub. When a browser opens an old URL it:

- unregisters the old app's service worker and deletes its caches, so a previously installed copy stops serving the old app offline;
- maps the old path onto the new site, keeping the rest of the path, query and hash:
  `/image-converter/es/faq/` -> `https://nuncaeslupus.github.io/image-to-svg/es/faq/`;
- falls back to a `<meta http-equiv="refresh">` and a visible link when JavaScript is off.

Pages are marked `noindex` with a canonical link to the new site.

## Related projects

- [claude-arsenal](https://github.com/nuncaeslupus/claude-arsenal) — spec-driven Claude Code workflow and gated task queue.
- [drawspec](https://github.com/nuncaeslupus/drawspec) — declarative diagram spec → clean SVG/PNG/text, writable by LLMs; MCP server included.
- [doc-control](https://github.com/nuncaeslupus/doc-control) — lets AI agents edit Word documents as tracked changes.
- [literary-critic](https://github.com/nuncaeslupus/literary-critic) — LLM manuscript analysis the way a professional editor would.
- [integral-job-search](https://github.com/nuncaeslupus/integral-job-search) — candidate-centred job search run in Claude Code.

## License

MIT — see [LICENSE](LICENSE).
