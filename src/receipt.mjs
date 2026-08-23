import { artifactRoot, withoutField } from "./canonical.mjs";

export function createFinalizedReceipt(input) {
  if (input.chain_finality_status !== "FINALIZED") throw new Error("receipt requires finalized chain state");
  if (input.confirmed_slot < input.submission_slot) throw new Error("confirmed slot precedes submission slot");
  if (input.post_state_root !== input.expected_post_state_root) throw new Error("finalized post-state root mismatch");
  const receipt = {
    artifact_type: "AssetExecutionReceipt",
    artifact_version: "1.0.0",
    claim_label: "[RET]",
    transaction_signature: input.transaction_signature,
    transaction_message_root: input.transaction_message_root,
    asset_execution_policy_root: input.asset_execution_policy_root,
    submission_slot: input.submission_slot,
    confirmed_slot: input.confirmed_slot,
    chain_finality_status: input.chain_finality_status,
    post_state_root: input.post_state_root,
    transaction_submission_observed: true
  };
  return {
    ...receipt,
    receipt_root: artifactRoot("lifepp.asset-execution-receipt.v1", withoutField(receipt, "receipt_root"))
  };
}

