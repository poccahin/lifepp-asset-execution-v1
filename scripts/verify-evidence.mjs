import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { artifactRoot, withoutField } from "../src/canonical.mjs";
import { evaluateTransactionGate, policyRoot } from "../src/gates.mjs";
import { assessCanaryReadiness } from "../src/readiness.mjs";
import { buildSchemaManifest } from "../src/schema-manifest.mjs";

const policy = JSON.parse(await readFile(new URL("../evidence/asset-execution-policy.json", import.meta.url), "utf8"));
const schemaAudit = JSON.parse(await readFile(new URL("../evidence/frozen-protocol-asset-schema-audit.json", import.meta.url), "utf8"));
const proposalPackage = JSON.parse(await readFile(new URL("../evidence/simulated-proposal-package.json", import.meta.url), "utf8"));
const certificate = JSON.parse(await readFile(new URL("../evidence/asset-execution-shadow-certificate.json", import.meta.url), "utf8"));
const readinessAudit = JSON.parse(await readFile(new URL("../evidence/canary-readiness-audit.json", import.meta.url), "utf8"));
const readinessContext = JSON.parse(await readFile(new URL("../config/canary-readiness-context.json", import.meta.url), "utf8"));
const frozenContext = JSON.parse(await readFile(new URL("../config/frozen-context.json", import.meta.url), "utf8"));
const schemaManifest = JSON.parse(await readFile(new URL("../evidence/a4-schema-manifest.json", import.meta.url), "utf8"));
const recalculatedSchemaManifest = await buildSchemaManifest(new URL("../schemas/", import.meta.url));

assert.equal(policy.asset_execution_policy_root, policyRoot(policy));
assert.deepEqual(schemaManifest, recalculatedSchemaManifest);
assert.equal(policy.schema_manifest_root, schemaManifest.schema_manifest_root);
assert.equal(
  schemaAudit.audit_root,
  artifactRoot("lifepp.frozen-protocol-asset-schema-scan.v1", withoutField(schemaAudit,"audit_root"))
);
assert.equal(schemaAudit.asset_execution_schema_root_binding_found,false);
assert.equal(schemaAudit.requires_separate_a4_epoch,true);

const { package_root: recordedPackageRoot, ...proposalPackagePayload } = proposalPackage;
assert.equal(recordedPackageRoot,artifactRoot("lifepp.asset-execution-simulated-proposal-package.v1",proposalPackagePayload));
const recalculatedDecision=evaluateTransactionGate(proposalPackage.input);
assert.deepEqual(recalculatedDecision,proposalPackage.decision);
assert.equal(proposalPackage.decision.proposal_only_authorized,true);
assert.equal(proposalPackage.decision.live_execution_prerequisites_satisfied,false);
assert.equal(proposalPackage.decision.transaction_submission_authorized,false);
assert.equal(proposalPackage.decision.asset_execution_authorized,false);
assert.deepEqual(proposalPackage.unsigned_proposal.signatures,[]);
assert.equal(proposalPackage.unsigned_proposal.private_keys_received,false);
assert.equal(proposalPackage.unsigned_proposal.voter_key_custody,false);

const expectedReadinessAudit = assessCanaryReadiness({
  policy,
  gateInput: proposalPackage.input,
  gateDecision: proposalPackage.decision,
  context: readinessContext,
  expectedFrozenHeads: frozenContext.frozen_protocol_heads
});
assert.deepEqual(withoutField(readinessAudit, "readiness_audit_root"), expectedReadinessAudit);
assert.equal(
  readinessAudit.readiness_audit_root,
  artifactRoot("lifepp.asset-execution-canary-readiness-audit.v1", expectedReadinessAudit)
);
assert.equal(readinessAudit.hard_safety_invariants_satisfied, true);
assert.equal(readinessAudit.activation_prerequisites_satisfied, false);
assert.equal(readinessAudit.canary_capped_authorized, false);
assert.ok(readinessAudit.blockers.length > 0);

assert.equal(certificate.asset_execution_policy_root, policy.asset_execution_policy_root);
assert.equal(certificate.schema_manifest_root, schemaManifest.schema_manifest_root);
assert.equal(certificate.frozen_protocol_asset_schema_audit_root,schemaAudit.audit_root);
assert.equal(certificate.simulated_proposal_package_root,recordedPackageRoot);
assert.equal(
  certificate.certificate_root,
  artifactRoot("lifepp.asset-execution-shadow-evidence.v2", withoutField(certificate, "certificate_root"))
);
assert.equal(certificate.current_operational_state, "DISARMED");
assert.equal(certificate.implementation_ceiling, "PROPOSAL_ONLY");
assert.equal(certificate.shadow_implementation_complete,true);
assert.equal(certificate.simulation_vector_complete,true);
assert.equal(certificate.proposal_only_package_complete,true);
assert.equal(certificate.canary_readiness_audit_present,true);
assert.equal(certificate.canary_readiness_audit_root,readinessAudit.readiness_audit_root);
assert.equal(certificate.canary_capped_authorized,false);
assert.equal(certificate.a4_finality_proved, false);
assert.equal(certificate.live_execution_prerequisites_satisfied,false);
assert.equal(certificate.transaction_submission_surface_present, false);
assert.equal(certificate.transaction_submission, false);
assert.equal(certificate.asset_execution_enabled, false);
assert.equal(certificate.asset_recovery_executor, "DISARMED");
console.log(JSON.stringify({
  evidence_verified: true,
  schema_audit_root:schemaAudit.audit_root,
  schema_manifest_root:schemaManifest.schema_manifest_root,
  simulated_proposal_package_root:recordedPackageRoot,
  canary_readiness_audit_root:readinessAudit.readiness_audit_root,
  certificate_root: certificate.certificate_root,
  live_execution_prerequisites_satisfied:false
}));
