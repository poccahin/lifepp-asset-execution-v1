import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { artifactRoot, withoutField } from "../src/canonical.mjs";
import { buildSchemaManifest } from "../src/schema-manifest.mjs";

const names=[
  "a4-schema-manifest",
  "asset-execution-policy",
  "transaction-message",
  "rpc-simulation",
  "asset-execution-timelock",
  "asset-execution-permit",
  "asset-execution-gate-decision",
  "unsigned-proposal",
  "asset-execution-receipt",
  "canary-readiness-audit"
];

test("all A4 schemas are closed and define every required property",async()=>{
  for(const name of names){
    const schema=JSON.parse(await readFile(new URL(`../schemas/${name}.schema.json`,import.meta.url),"utf8"));
    assert.equal(schema.$schema,"https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id,/lifepp\.asset-execution\.v1/);
    assert.equal(schema.additionalProperties,false,name);
    for(const required of schema.required)assert.ok(Object.hasOwn(schema.properties,required),`${name}:${required}`);
  }
});

test("receipt schema cannot silently discard rooted execution evidence",async()=>{
  const schema=JSON.parse(await readFile(new URL("../schemas/asset-execution-receipt.schema.json",import.meta.url),"utf8"));
  for(const key of ["permit_root","timelock_root","pocc_certificate_root","treasury_approval_root","initial_simulation_roots","pre_execution_simulation_roots","independent_executor_attestation_root"]){
    assert.ok(schema.required.includes(key));
    assert.ok(Object.hasOwn(schema.properties,key));
  }
});

test("A4 policy binds the byte-exact source-versioned schema manifest",async()=>{
  const manifest=await buildSchemaManifest(new URL("../schemas/",import.meta.url));
  const policy=JSON.parse(await readFile(new URL("../config/default-policy.json",import.meta.url),"utf8"));
  assert.equal(manifest.schema_count,names.length);
  assert.equal(manifest.schemas.length,names.length);
  assert.equal(policy.schema_manifest_root,manifest.schema_manifest_root);
  assert.equal(
    manifest.schema_manifest_root,
    artifactRoot("lifepp.asset-execution-schema-manifest.v1",withoutField(manifest,"schema_manifest_root"))
  );
  const changed=structuredClone(withoutField(manifest,"schema_manifest_root"));
  changed.schemas[0].raw_sha256=`sha256:${"0".repeat(64)}`;
  assert.notEqual(
    artifactRoot("lifepp.asset-execution-schema-manifest.v1",changed),
    manifest.schema_manifest_root
  );
});
