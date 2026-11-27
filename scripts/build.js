import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildExtension, root } from "./extension.js";

const { values } = parseArgs({ options: { tag: { type: "string", default: "" } } });
const { filename, archive, digest } = await buildExtension(root, values.tag);
const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, filename), archive);
await writeFile(resolve(dist, "SHA256SUMS"), `${digest}  ${filename}\n`);
console.log(`Built dist/${filename} (${archive.length} bytes, SHA-256 ${digest}).`);
