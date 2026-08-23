import { readFile, writeFile } from "node:fs/promises";
import { artifactRoot, withoutField } from "../src/canonical.mjs";
import { policyRoot } from "../src/gates.mjs";

const policy = JSON.parse(await readFile(new URL("../config/default-policy.json", import.meta.url), "utf8"));
const context = JSON.parse(await readFile(new URL("../config/frozen-context.json", import.meta.url), "utf8"));
const rootedPolicy = { ...policy, asset_execution_policy_root: policyRoot(policy) };
await writeFile(new URL("../evidence/asset-execution-policy.json", import.meta.url), `${JSON.stringify(rootedPolicy)}\n`);

const certificate = {
  artifact_type: "AssetExecutionShadowEvidenceCertificate",
  artifact_version: "1.0.0",
  protocol_epoch: "lifepp.asset-execution.v1",
  claim_label: "[A]",
  evidence_class: "SHADOW_IMPLEMENTATION",
  source_protocol_heads: context.frozen_protocol_heads,
  asset_execution_policy_root: rootedPolicy.asset_execution_policy_root,
  implementation_ceiling: "PROPOSAL_ONLY",
  current_operational_state: "DISARMED",
  separate_a4_finality_required: true,
  a4_finality_proved: false,
  real_transaction_permit_present: false,
  real_release_authority_present: false,
  transaction_submission_surface_present: false,
  transaction_submission: false,
  asset_execution_enabled: false,
  asset_recovery_executor: "DISARMED",
  treasury_configuration: context.treasury,
  treasury_authority_separation: context.authority_separation,
  schema_bindings: [
    "asset-execution-policy.schema.json",
    "asset-execution-permit.schema.json",
    "asset-execution-receipt.schema.json",
    "transaction-message.schema.json"
  ],
  fail_closed_reasons: [
    "LIVE_EXTERNAL_ACTIVATION_AUTHORITY_THRESHOLD_ABSENT",
    "PROTOCOL_FREEZE_CERTIFICATE_ABSENT",
    "SEPARATE_A4_FINALITY_ABSENT",
    "TRANSACTION_SPECIFIC_PERMIT_ABSENT",
    "INDEPENDENT_RELEASE_AUTHORITY_ABSENT"
  ],
  autonomous_merge_authorized: false,
  production_deployment_authorized: false,
  protocol_finality_proved: false
};
const rootedCertificate = {
  ...certificate,
  certificate_root: artifactRoot("lifepp.asset-execution-shadow-evidence.v1", withoutField(certificate, "certificate_root"))
};
await writeFile(new URL("../evidence/asset-execution-shadow-certificate.json", import.meta.url), `${JSON.stringify(rootedCertificate)}\n`);
console.log(JSON.stringify({
  asset_execution_policy_root: rootedPolicy.asset_execution_policy_root,
  certificate_root: rootedCertificate.certificate_root,
  current_operational_state: rootedCertificate.current_operational_state,
  transaction_submission: false,
  asset_execution_enabled: false,
  asset_recovery_executor: "DISARMED"
}));

