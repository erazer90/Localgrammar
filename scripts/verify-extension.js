import { verifyExtension } from "./extension.js";

const { files, version } = await verifyExtension();
console.log(`Verified extension ${version} and ${files.length} bundled files.`);
