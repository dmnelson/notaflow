import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";

import type { NfseDraft, UnknownRecord } from "./types.js";

export async function readDataFile(file: string): Promise<UnknownRecord> {
  const source = await readFile(file, "utf8");
  const extension = path.extname(file).toLowerCase();
  const parsed: unknown =
    extension === ".json" ? JSON.parse(source) : parse(source);

  if (!isRecord(parsed)) {
    throw new Error(`${file} must contain an object/mapping at the top level`);
  }
  return parsed;
}

export async function writeDraft(file: string, draft: NfseDraft): Promise<void> {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(
    file,
    stringify(draft, {
      lineWidth: 0,
      defaultStringType: "QUOTE_DOUBLE",
      defaultKeyType: "PLAIN",
    }),
    "utf8",
  );
}

export async function writeTextFile(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, contents, "utf8");
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}
