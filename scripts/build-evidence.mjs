import { readFile, writeFile } from "node:fs/promises";
import { artifactRoot, canonicalJson } from "../src/canonical.mjs";
import { evaluateTransactionGate, policyRoot } from "../src/gates.mjs";
import { buildUnsignedProposal } from "../src/proposal.mjs";
import { buildSimulatedGateInput } from "../src/shadow-vector.mjs";

const policy = JSON.parse(await readFile(new URL("../config/default-policy.json", import.meta.url), "utf8"));
const context = JSON.parse(await readFile(new URL("../config/frozen-context.json", import.meta.url), "utf8"));
const schemaScan = JSON.parse(await readFile(new URL("../config/frozen-protocol-schema-scan.json", import.meta.url), "utf8"));
const rootedPolicy = { ...policy, asset_execution_policy_root: policyRoot(policy) };
const rootedSchemaAudit = {
  ...schemaScan,
  audit_root: artifactRoot("lifepp.frozen-protocol-asset-schema-scan.v1", schemaScan)
};
const gateInput = buildSimulatedGateInput(policy);
const decision = evaluateTransactionGate(gateInput);
if (decision.proposal_only_authorized !== true) throw new Error("SIMULATED_PROPOSAL_VECTOR_FAILED");
if (decision.live_execution_prerequisites_satisfied !== false) throw new Error("LIVE_EXECUTION_OVERCLAIM");
const proposal = buildUnsignedProposal(gateInput.message, decision);
const proposalPackagePayload = {
  artifact_type:"AssetExecutionSimulatedProposalPackage",
  artifact_version:"1.0.0",
  protocol_epoch:"lifepp.asset-execution.v1",
  claim_label:"[SIM]",
  evidence_class:"SIMULATED_PROPOSAL_ONLY",
  input:gateInput,
  decision,
  unsigned_proposal:proposal,
  real_transaction_permit_present:false,
  real_treasury_approval_present:false,
  real_protocol_finality_present:false,
  real_a4_finality_present:false,
  transaction_submission:false,
  asset_execution_enabled:false,
  asset_recovery_executor:"DISARMED"
};
const proposalPackage = {
  ...proposalPackagePayload,
  package_root:artifactRoot("lifepp.asset-execution-simulated-proposal-package.v1", proposalPackagePayload)
};

await writeFile(new URL("../evidence/asset-execution-policy.json", import.meta.url), `${canonicalJson(rootedPolicy)}\n`);
await writeFile(new URL("../evidence/frozen-protocol-asset-schema-audit.json", import.meta.url), `${canonicalJson(rootedSchemaAudit)}\n`);
await writeFile(new URL("../evidence/simulated-proposal-package.json", import.meta.url), `${canonicalJson(proposalPackage)}\n`);

const certificate = {
  artifact_type: "AssetExecutionShadowEvidenceCertificate",
  artifact_version: "2.0.0",
  protocol_epoch: "lifepp.asset-execution.v1",
  claim_label: "[A]",
  evidence_class: "SHADOW_IMPLEMENTATION",
  source_protocol_heads: context.frozen_protocol_heads,
  frozen_protocol_asset_schema_audit_root: rootedSchemaAudit.audit_root,
  asset_execution_schema_root_binding_found: rootedSchemaAudit.asset_execution_schema_root_binding_found,
  asset_execution_policy_root: rootedPolicy.asset_execution_policy_root,
  simulated_proposal_package_root: proposalPackage.package_root,
  simulated_gate_decision_root: decision.decision_root,
  unsigned_proposal_root: proposal.proposal_root,
  implementation_ceiling: "PROPOSAL_ONLY",
  current_operational_state: "DISARMED",
  shadow_implementation_complete: true,
  simulation_vector_complete: true,
  proposal_only_package_complete: true,
  separate_a4_finality_required: true,
  a4_finality_proved: false,
  real_transaction_permit_present: false,
  real_release_authority_present: false,
  live_execution_prerequisites_satisfied: false,
  transaction_submission_surface_present: false,
  transaction_submission: false,
  asset_execution_enabled: false,
  asset_recovery_executor: "DISARMED",
  treasury_configuration: context.treasury,
  treasury_authority_separation: context.authority_separation,
  schema_bindings: [
    "asset-execution-policy.schema.json",
    "transaction-message.schema.json",
    "rpc-simulation.schema.json",
    "asset-execution-permit.schema.json",
    "asset-execution-gate-decision.schema.json",
    "unsigned-proposal.schema.json",
    "asset-execution-receipt.schema.json"
  ],
  fail_closed_reasons: [
    "LIVE_EXTERNAL_ACTIVATION_AUTHORITY_THRESHOLD_ABSENT",
    "PROTOCOL_FREEZE_CERTIFICATE_ABSENT",
    "SEPARATE_A4_FINALITY_ABSENT",
    "LIVE_TRANSACTION_SPECIFIC_PERMIT_ABSENT",
    "LIVE_TREASURY_3_OF_4_APPROVAL_ABSENT",
    "INDEPENDENT_RELEASE_AUTHORITY_ABSENT",
    "INDEPENDENT_EXECUTOR_AUTHORIZATION_ABSENT"
  ],
  autonomous_merge_authorized: false,
  production_deployment_authorized: false,
  protocol_finality_proved: false,
  planetary_live_scale_proved: false
};
const rootedCertificate = {
  ...certificate,
  certificate_root: artifactRoot("lifepp.asset-execution-shadow-evidence.v2", certificate)
};
await writeFile(new URL("../evidence/asset-execution-shadow-certificate.json", import.meta.url), `${canonicalJson(rootedCertificate)}\n`);
console.log(JSON.stringify({
  frozen_protocol_asset_schema_audit_root: rootedSchemaAudit.audit_root,
  asset_execution_policy_root: rootedPolicy.asset_execution_policy_root,
  simulated_proposal_package_root: proposalPackage.package_root,
  certificate_root: rootedCertificate.certificate_root,
  current_operational_state: rootedCertificate.current_operational_state,
  live_execution_prerequisites_satisfied:false,
  transaction_submission: false,
  asset_execution_enabled: false,
  asset_recovery_executor: "DISARMED"
}));
