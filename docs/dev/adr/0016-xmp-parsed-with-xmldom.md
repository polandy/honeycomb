# 0016 – XMP sidecars are parsed with @xmldom/xmldom and modelled by our own code

- Status: accepted
- Date: 2026-11-10

## Context

M5 reads and writes the XMP sidecars of digiKam, darktable and Lightroom
([`06-xmp-interop.md`](../06-xmp-interop.md), ADR 0005). Reading, the mapping and the serialized
form are a pure TypeScript module in `src/logic/` without DOM or network (ADR 0006), tested in
Vitest under Node, and its output must equal Framehive's canonical form byte for byte (CORE-009,
Framehive ADR 0039). Sidecars come from other programs, so the parser reads untrusted input: it
must refuse what is not well-formed, report a position, and never expand entities. Every RDF form
must give the same model and every unknown property must survive a rewrite, so the XML layer has
to be namespace aware and keep every element, attribute and text.

The options:

- **The browser's `DOMParser`:** no dependency, but not in Node, so the module would need a DOM
  and could not run in Vitest without a DOM emulation; errors come back as a `parsererror`
  document that differs per browser.
- **`@xmldom/xmldom` 0.9:** a W3C DOM in pure JavaScript, namespace aware, no dependencies, MIT,
  maintained (0.9.12, August 2026); runs the same in Node and the browser, reports fatal errors
  with line and column through its `onError` hook, and does not expand entities declared in a
  document type.
- **`saxes`:** a strict, namespace-aware SAX parser; one dependency (`xmlchars`), last release
  2022. Events only, so we would also build the tree.
- **`fast-xml-parser`:** fast, but maps XML to plain objects; namespace handling by prefix only and
  five dependencies.
- **Our own tokenizer:** no dependency, but XML well-formedness is easy to get subtly wrong.

## Decision

honeycomb uses **`@xmldom/xmldom`**, pinned to an exact version in `package.json`, only to turn
bytes into a namespace-aware element tree. Exactly one module, `src/logic/xmp/parse.ts`, imports
it. The XMP data model (simple values, structs, arrays, qualifiers, language alternatives), the
RDF reading, the merge and the canonical serializer are our own code, as in Framehive, so the
library stays replaceable. Bytes are decoded with a fatal `TextDecoder('utf-8')` before parsing,
a document type declaration is refused before any entity could be used, and any parser warning or
error refuses the sidecar.

## Consequences

- One runtime dependency more in the frontend bundle (about 30 KB minified), with Dependabot like
  every npm package.
- The serializer writes text itself; `@xmldom/xmldom`'s serializer is not used, so the canonical
  form does not depend on the library.
- Sidecars are parsed on the client; the backend only stores the bytes the client produced with
  the checked save (ADR 0006).
