import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

export const root = fileURLToPath(new URL("../", import.meta.url));
const runtimeFiles = ["README.md", "LICENSES.md", "PRIVACY.md", "DISTRIBUTION.md", "manifest.json", "background.js", "settings.js"];
const runtimeDirs = ["content", "engine", "icons", "ui"];
const vendorFiles = ["lt_wasm.js", "lt_wasm_bg.wasm", "packs/de.pack.gz", "packs/en.pack.gz"];

async function walk(directory, relative) {
  const children = await readdir(resolve(directory, relative), { withFileTypes: true });
  const files = [];
  for (const child of children) {
    if (child.name.startsWith(".")) continue;
    const path = `${relative}/${child.name}`;
    if (child.isDirectory()) files.push(...await walk(directory, path));
    else if (child.isFile()) files.push(path);
    else throw new Error(`Unexpected extension entry: ${path}`);
  }
  return files;
}

export async function listRuntimeFiles(directory = root) {
  for (const path of runtimeFiles) {
    if (!(await lstat(resolve(directory, path))).isFile()) throw new Error(`Expected a file: ${path}`);
  }
  const groups = await Promise.all(runtimeDirs.map(async path => {
    if (!(await lstat(resolve(directory, path))).isDirectory()) throw new Error(`Expected a directory: ${path}`);
    return walk(directory, path);
  }));
  return [...runtimeFiles, ...groups.flat()].sort();
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyExtension(directory = root, tag = "") {
  const files = await listRuntimeFiles(directory);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error("Expected Manifest V3");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(manifest.version)) {
    throw new Error("Expected a three-component version in manifest.json");
  }
  if (tag && tag !== `v${manifest.version}`) {
    throw new Error(`Tag ${tag} does not match manifest version ${manifest.version}`);
  }

  const paths = new Set(files);
  const pagePaths = [manifest.action.default_popup, manifest.options_ui.page, "engine/offscreen.html", "ui/selection.html"];
  const references = [
    ...pagePaths, manifest.background.service_worker,
    ...Object.values(manifest.action.default_icon), ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap(entry => [...(entry.js ?? []), ...(entry.css ?? [])])
  ];
  for (const path of references) {
    if (!paths.has(path)) throw new Error(`Missing bundled asset: ${path}`);
  }
  for (const page of pagePaths) {
    const html = await readFile(resolve(directory, page), "utf8");
    const folder = page.slice(0, page.lastIndexOf("/") + 1);
    for (const [, ref] of html.matchAll(/<(?:script|link|img)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gu)) {
      const url = new URL(ref, `https://extension.invalid/${folder}`);
      if (url.origin !== "https://extension.invalid" || !paths.has(url.pathname.slice(1))) {
        throw new Error(`Missing or non-local asset in ${page}: ${ref}`);
      }
    }
  }
  const csp = manifest.content_security_policy.extension_pages.split(";").map(value => value.trim());
  const connect = csp.filter(value => /^connect-src(?:\s|$)/u.test(value));
  if (connect.length !== 1 || connect[0] !== "connect-src 'self'") {
    throw new Error("Expected extension requests to stay on the extension origin");
  }

  const source = await readFile(resolve(directory, "engine/vendor/SOURCE.md"), "utf8");
  const hashes = new Map(Array.from(source.matchAll(/^([0-9a-f]{64}) {2}([^\r\n]+)$/gmu),
    ([, hash, name]) => [name, hash]));
  for (const path of vendorFiles) {
    const bytes = await readFile(resolve(directory, "engine/vendor", path));
    if (sha256(bytes) !== hashes.get(path)) throw new Error(`Vendor checksum mismatch: ${path}`);
    if (path.endsWith(".pack.gz")) {
      const lang = path.slice(6, 8);
      const pack = JSON.parse(await readFile(resolve(directory, `engine/vendor/${lang}.manifest.json`), "utf8"))
        .languages[lang].pack;
      if (pack.file !== path || pack.bytes !== bytes.length || pack.sha256 !== hashes.get(path)) {
        throw new Error(`Pack manifest mismatch: ${path}`);
      }
    }
  }
  return { files, version: manifest.version };
}

export async function buildExtension(directory = root, tag = "") {
  const { files, version } = await verifyExtension(directory, tag);
  const contents = await Promise.all(files.map(path => readFile(resolve(directory, path))));
  const entries = Object.fromEntries(files.map((path, index) => [
    `LocalGrammarPro/${path}`, [contents[index], { level: /\.(?:gz|png)$/u.test(path) ? 0 : 6 }]
  ]));
  const filename = `LocalGrammarPro-${version}.zip`;
  // DOS timestamps use local time in the ZIP format. A fixed local timestamp
  // keeps the archive identical across build times and time zones.
  const archive = zipSync(entries, { mtime: new Date(1980, 0, 1) });
  return { filename, archive, digest: sha256(archive) };
}
