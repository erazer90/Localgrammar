# LingoTweaker 0.2.8

The browser glue and WebAssembly binary are unchanged from the `web/` entry point of `lingotweaker-wasm@0.2.8`. The two unchanged gzip packs are from `lingotweaker-data-de@0.2.8` and `lingotweaker-data-en@0.2.8`. The pack manifests record the pinned LanguageTool data baseline. Its details are in [upstream.json](notices/upstream.json).

Corresponding engine source and build instructions are available at the release tag, commit `819dc354224c9087ff486708adfd413ecb45f466`. The browser module and data packs are separate replaceable files. The upstream build scripts and pack generation tools are in that repository. [LingoTweaker source and build instructions](https://github.com/fiduswriter/LingoTweaker/tree/v0.2.8)

LingoTweaker is licensed under LGPL-2.1-or-later. The data retains its upstream component licenses, including CC BY-SA 4.0 for the German POS dictionary and GPL licensing choices for the German Hunspell dictionary. The upstream notices document the English dictionary provenance gaps. See the included [license](notices/LICENSE), [third-party notices](notices/THIRD_PARTY_NOTICES.md), and [license and provenance index](notices/README.md). The pack release also preserves the per-file provenance manifests in the upstream source. [Upstream data manifest](https://github.com/fiduswriter/LingoTweaker/blob/v0.2.8/data/manifest.json)

## SHA-256

```text
f997ea001ea04218380b07e174b347bb09aff335cd299df09e35ba894d8dbbe3  lt_wasm.js
5bdfeaacec8fb315ba26917a2dc3e2eeb41f8bc2b4ea6028c599ee2004bf81ce  lt_wasm_bg.wasm
25f6618e45a0bce2686e7bd96a1e0097f0a61c6a33e838d604780cc84f8e131c  packs/de.pack.gz
0e7fdce86116ef0fea2dcd0b35f209c6fcfe7d1995edaacdfebeadf4cdc7ccae  packs/en.pack.gz
```
