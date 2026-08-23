import { readdir, readFile } from "node:fs/promises";
import { artifactRoot, sha256 } from "./canonical.mjs";

export async function buildSchemaManifest(schemaDirectoryUrl) {
  const filenames = (await readdir(schemaDirectoryUrl))
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
  const schemas = [];
  for (const filename of filenames) {
    const bytes = await readFile(new URL(filename, schemaDirectoryUrl));
    schemas.push({ path: `schemas/${filename}`, raw_sha256: sha256(bytes) });
  }
  const payload = {
    artifact_type: "AssetExecutionSchemaManifest",
    artifact_version: "1.0.0",
    protocol_epoch: "lifepp.asset-execution.v1",
    claim_label: "[M]",
    hash_algorithm: "SHA-256",
    schema_count: schemas.length,
    schemas
  };
  return {
    ...payload,
    schema_manifest_root: artifactRoot("lifepp.asset-execution-schema-manifest.v1", payload)
  };
}
