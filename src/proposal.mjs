import { canonicalJson } from "./canonical.mjs";

export function buildUnsignedProposal(message, gateDecision) {
  if (gateDecision.proposal_only_authorized !== true) {
    throw new Error("fail closed: proposal gates are not satisfied");
  }
  return {
    artifact_type: "UnsignedAssetExecutionProposal",
    artifact_version: "1.0.0",
    claim_label: "[SIM]",
    canonical_message: canonicalJson(message),
    transaction_message_root: message.transaction_message_root,
    signatures: [],
    private_keys_received: false,
    transaction_submission: false,
    asset_execution_enabled: false
  };
}

export function assertNoSubmissionSurface(moduleExports) {
  const forbidden = ["submitTransaction", "signAndSend", "broadcastTransaction", "executeAssetTransfer"];
  for (const name of forbidden) {
    if (typeof moduleExports[name] === "function") throw new Error(`forbidden transaction surface exported: ${name}`);
  }
  return true;
}

