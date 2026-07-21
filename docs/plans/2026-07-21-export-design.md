# Export — design

**Date:** 2026-07-21
**Status:** approved, not yet implemented

Get the words out. A writer can export one chapter or compile a whole book to
Markdown, DOCX or EPUB, and hand the result to someone.

Supabase persistence and auth remain deferred. Everything here runs in the
browser.

## The serialization layer

All three formats are a walk over the same Tiptap document JSON. The node set is
small and closed:

- blocks: `paragraph`, `heading`, `blockquote`, `bulletList`, `orderedList`,
  `listItem`, `codeBlock`, `horizontalRule`, `hardBreak`
- marks: `bold`, `italic`, `strike`, `code`, `underline`, `link`

Tiptap ships no HTML or Markdown serializer in this install — there is no
`@tiptap/html` in the tree — so these are hand-written. That is a feature
rather than a cost: they become pure `JSONContent → string` functions with no
dependencies, which is the most testable shape available.

DOCX is different in kind. It maps to the `docx` library's object model rather
than to a string, so it gets its own mapping. The traversal shape is the same;
the output is not.

`horizontalRule` renders as a scene break — centred asterisks — rather than a
horizontal line, matching how the editor already styles it and how a printed
book sets one.

## Dependencies

Two, both loaded lazily:

| Package | For | Size |
| --- | --- | --- |
| `docx` | DOCX object model | ~1MB |
| `jszip` | EPUB container | ~100KB |

Both are `await import(...)`-ed inside the export handler. A writer who never
exports never downloads them, so the editor bundle is unchanged. This is the
main reason not to import them at module scope.

## Everything client-side

Blob → `URL.createObjectURL` → anchor click. No server route, no upload.

Consequences worth stating: export works offline, and no manuscript ever leaves
the machine. When Supabase lands, that stays true — export has no reason to
become a server concern.

Export reads chapter bodies through `library-store`'s `getBody` rather than
touching localStorage directly, so the invariant that one module owns storage
survives this phase.

## The missing field: author

Standard manuscript format needs a name on the first page, and EPUB's OPF needs
a `dc:creator`. The book record has no author, so one is added.

Per-book rather than a global setting: a pen name can differ between books, and
a global "your name" would be wrong the first time someone uses one. Editable in
the export dialog and remembered after the first time, rather than prompted for
on every export.

The field is optional. An export with no author set omits the byline rather
than blocking.

## DOCX: standard manuscript format

This is the whole reason DOCX earns its dependency, so it follows the Shunn
convention rather than approximating it:

- Times New Roman, 12pt
- double-spaced
- 1 inch margins on all sides
- first-line indent 0.5", no extra space between paragraphs
- each chapter starts on a new page, title centred
- running header: `Surname / Title / page number`

A toggle produces a clean document instead — same text, none of the manuscript
furniture — for a writer sending a draft to a friend rather than an agent.

## EPUB 3

Two details produce most invalid EPUBs, and both are handled explicitly:

1. `mimetype` must be the **first** entry in the zip **and** stored
   uncompressed. JSZip will happily do neither by default.
2. EPUB 3 requires a `nav.xhtml` navigation document; `toc.ncx` alone is the
   EPUB 2 shape.

Layout:

```
mimetype                     (first, stored)
META-INF/container.xml
OEBPS/content.opf
OEBPS/nav.xhtml
OEBPS/chapter-01.xhtml
OEBPS/chapter-02.xhtml
...
```

## Where it lives

An export dialog, reachable from two places:

- the shelf, per book — exports the whole book
- the editor — this chapter, or the whole book it belongs to

Scope and format are both chosen in the dialog. Filenames are slugified from
the book title: `the-salt-road.docx`.

## Testing

Markdown and XHTML serializers get real unit tests, including the cases that
break naive implementations:

- nested marks, and a link inside bold
- empty paragraphs
- the scene-break rule
- ordered and nested lists
- characters needing escaping per format — `*` and `_` in Markdown, `&` and `<`
  in XHTML

EPUB's `content.opf`, `container.xml` and chapter XHTML are asserted as
strings. Zip bytes are not asserted — that would be testing JSZip.

DOCX gets its paragraph mapping tested, not the binary.

## Deliberately excluded

- A title page.
- Per-chapter EPUB export. An e-book of one chapter is not a thing anyone
  wants; EPUB is whole-book only.
- PDF. It is a typesetting problem, not a serialization one, and the honest
  path is to export DOCX and print from there.
