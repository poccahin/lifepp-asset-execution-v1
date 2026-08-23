import { artifactRoot, withoutField } from "./canonical.mjs";

const ROOT = /^sha256:[0-9a-f]{64}$/;

export function createFinalizedReceipt(input) {
  if (input.evidence_class !== "LIVE_VERIFIED") throw new Error("receipt requires live verified external evidence");
  if (input.submission_observed_by_independent_executor !== true) throw new Error("receipt requires independent executor observation");
  if (input.asset_execution_permit_verified !== true || input.treasury_approval_verified !== true) throw new Error("receipt requires verified permit and treasury approval");
  if (input.chain_finality_status !== "FINALIZED") throw new Error("receipt requires finalized chain state");
  if (input.confirmed_slot < input.submission_slot) throw new Error("confirmed slot precedes submission slot");
  if (input.post_state_root !== input.expected_post_state_root) throw new Error("finalized post-state root mismatch");
  for (const key of ["transaction_message_root","asset_execution_policy_root","permit_root","timelock_root","pocc_certificate_root","treasury_approval_root","post_state_root","independent_executor_attestation_root"]) {
    if (!ROOT.test(input[key])) throw new Error(`invalid receipt root: ${key}`);
  }
  if (!Array.isArray(input.initial_simulation_roots) || input.initial_simulation_roots.length !== 2 || !input.initial_simulation_roots.every((root)=>ROOT.test(root))) throw new Error("receipt requires two initial simulation roots");
  if (!Array.isArray(input.pre_execution_simulation_roots) || input.pre_execution_simulation_roots.length !== 2 || !input.pre_execution_simulation_roots.every((root)=>ROOT.test(root))) throw new Error("receipt requires two pre-execution simulation roots");
  if (typeof input.transaction_signature !== "string" || input.transaction_signature.length === 0) throw new Error("receipt requires transaction signature");
  const receipt = {
    artifact_type: "AssetExecutionReceipt",
    artifact_version: "1.0.0",
    claim_label: "[RET]",
    evidence_class: input.evidence_class,
    chain_id: input.chain_id,
    transaction_signature: input.transaction_signature,
    transaction_message_root: input.transaction_message_root,
    asset_execution_policy_root: input.asset_execution_policy_root,
    permit_root: input.permit_root,
    timelock_root: input.timelock_root,
    pocc_certificate_root: input.pocc_certificate_root,
    treasury_approval_root: input.treasury_approval_root,
    initial_simulation_roots: input.initial_simulation_roots,
    pre_execution_simulation_roots: input.pre_execution_simulation_roots,
    submission_slot: input.submission_slot,
    confirmed_slot: input.confirmed_slot,
    chain_finality_status: input.chain_finality_status,
    post_state_root: input.post_state_root,
    independent_executor_attestation_root: input.independent_executor_attestation_root,
    transaction_submission_observed: true,
    asset_execution_permit_verified: true,
    treasury_approval_verified: true
  };
  return {
    ...receipt,
    receipt_root: artifactRoot("lifepp.asset-execution-receipt.v1", withoutField(receipt, "receipt_root"))
  };
}
