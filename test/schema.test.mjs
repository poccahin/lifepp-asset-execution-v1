import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const names=[
  "asset-execution-policy",
  "transaction-message",
  "rpc-simulation",
  "asset-execution-permit",
  "asset-execution-gate-decision",
  "unsigned-proposal",
  "asset-execution-receipt"
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
