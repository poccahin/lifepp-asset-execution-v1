import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { artifactRoot, withoutField } from "../src/canonical.mjs";
import { policyRoot } from "../src/gates.mjs";

const policy = JSON.parse(await readFile(new URL("../evidence/asset-execution-policy.json", import.meta.url), "utf8"));
const certificate = JSON.parse(await readFile(new URL("../evidence/asset-execution-shadow-certificate.json", import.meta.url), "utf8"));
assert.equal(policy.asset_execution_policy_root, policyRoot(policy));
assert.equal(certificate.asset_execution_policy_root, policy.asset_execution_policy_root);
assert.equal(
  certificate.certificate_root,
  artifactRoot("lifepp.asset-execution-shadow-evidence.v1", withoutField(certificate, "certificate_root"))
);
assert.equal(certificate.current_operational_state, "DISARMED");
assert.equal(certificate.implementation_ceiling, "PROPOSAL_ONLY");
assert.equal(certificate.a4_finality_proved, false);
assert.equal(certificate.transaction_submission_surface_present, false);
assert.equal(certificate.transaction_submission, false);
assert.equal(certificate.asset_execution_enabled, false);
assert.equal(certificate.asset_recovery_executor, "DISARMED");
console.log(JSON.stringify({ evidence_verified: true, certificate_root: certificate.certificate_root }));

