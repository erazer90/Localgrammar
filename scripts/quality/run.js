import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { median, percentile } from "./timing.js";
import { parseM2 } from "./falko-merlin.js";
import { score } from "./scoring.js";

const { values } = parseArgs({ options: {
  corpus: { type: "string", default: "tests/fixtures/de-quality.json" },
  engine: { type: "string", default: "." },
  languagetool: { type: "string" },
  sample: { type: "string" },
  output: { type: "string" }
} });
const source = await readFile(values.corpus, "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const engineRoot = resolve(values.engine);
const corpus = values.corpus.endsWith(".m2") ? parseM2(source) : JSON.parse(source);
const sample = values.sample ? Number(values.sample) : corpus.length;
if (!Number.isSafeInteger(sample) || sample < 1) throw new Error("sample must be a positive integer");
const rows = sample < corpus.length ? corpus.map(row => ({ row, sort: hash(row.id) }))
  .sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, sample).map(item => item.row) : corpus;
if (!rows.length || rows.some(row => !row.id || typeof row.text !== "string" || !Array.isArray(row.edits))) {
  throw new Error("Expected texts with id, text and edits");
}

async function localGrammar() {
  const { checkWithWasm } = await import(pathToFileURL(join(engineRoot, "engine/lingotweaker.js")).href);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.protocol !== "file:") throw new Error("Benchmark engine must run offline");
    return new Response(await readFile(url), {
      headers: { "Content-Type": url.pathname.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" }
    });
  };
  try {
    const output = [];
    const startUp = performance.now();
    await checkWithWasm("Der Test läuft lokal.", "de", "", [], [], false);
    const coldMs = performance.now() - startUp;
    const timings = [];
    for (const row of rows) {
      const start = performance.now();
      const result = await checkWithWasm(row.text, "de", "", [], [], false);
      timings.push(performance.now() - start);
      output.push(result.issues);
    }
    return { metrics: score(rows, output), timing: { coldMs, p50Ms: median(timings), p95Ms: percentile(timings, 0.95) } };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function languageTool(jar) {
  const directory = await mkdtemp(join(tmpdir(), "lgp-quality-"));
  try {
    const path = join(directory, "corpus.txt");
    const lines = rows.map(row => row.text.replace(/[\r\n]/gu, " "));
    await writeFile(path, lines.join("\n") + "\n");
    const { stdout } = await promisify(execFile)("java", [
      "-Xmx1g", "-jar", resolve(jar), "-c", "UTF-8", "-l", "de-DE", "-b", "--json", path
    ], { maxBuffer: 64 * 1024 * 1024 });
    const { matches, software } = JSON.parse(stdout);
    let row = 0;
    let offset = 0;
    const output = rows.map(() => []);
    for (const match of matches.sort((a, b) => a.offset - b.offset)) {
      while (row + 1 < lines.length && match.offset >= offset + lines[row].length + 1) offset += lines[row++].length + 1;
      const start = match.offset - offset;
      const end = start + match.length;
      if (start < 0 || end > lines[row].length || ["style", "typographical"].includes(match.rule.issueType)) continue;
      output[row].push({ start, end, suggestions: match.replacements.map(r => r.value) });
    }
    return { version: software.version, metrics: score(rows, output) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const manifest = JSON.parse(await readFile(join(engineRoot, "manifest.json"), "utf8"));
const engines = (await readdir(join(engineRoot, "engine"), { recursive: true }))
  .filter(file => /(?:\.js|\.wasm|de\.pack\.gz)$/u.test(file)).sort();
const revision = hash((await Promise.all(engines.map(async file =>
  [file, hash(await readFile(join(engineRoot, "engine", file)))]))).flat().join("\n"));
const result = { corpus: values.corpus, corpusSha256: hash(source), sample: rows.length,
  selectionSha256: hash(JSON.stringify(rows.map(row => row.id))),
  localGrammar: { version: manifest.version, engineSha256: revision, ...await localGrammar() } };
if (values.languagetool) result.languageTool = await languageTool(values.languagetool);
const serialized = JSON.stringify(result, null, 2) + "\n";
if (values.output) await writeFile(values.output, serialized);
else process.stdout.write(serialized);
