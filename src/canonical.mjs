import { createHash } from "node:crypto";

function normalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    );
  }
  throw new TypeError(`non-canonical value: ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function artifactRoot(domain, value) {
  return sha256(`${domain}\0${canonicalJson(value)}`);
}

export function withoutField(value, field) {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

