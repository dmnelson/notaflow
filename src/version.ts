import { createRequire } from "node:module";

interface PackageMetadata {
  name: string;
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as PackageMetadata;

export const PACKAGE_NAME = packageMetadata.name;
export const PACKAGE_VERSION = packageMetadata.version;
export const APPLICATION_VERSION = `${PACKAGE_NAME}/${PACKAGE_VERSION}`;
