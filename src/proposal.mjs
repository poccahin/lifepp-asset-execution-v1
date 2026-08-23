import { artifactRoot, canonicalJson } from "./canonical.mjs";

export function buildUnsignedProposal(message, gateDecision) {
  if (gateDecision.proposal_only_authorized !== true) {
    throw new Error("fail closed: proposal gates are not satisfied");
  }
  const proposal = {
    artifact_type: "UnsignedAssetExecutionProposal",
    artifact_version: "2.0.0",
    claim_label: "[SIM]",
    evidence_class: "SIMULATED_PROPOSAL_ONLY",
    canonical_message: canonicalJson(message),
    transaction_message_root: message.transaction_message_root,
    gate_decision_root: gateDecision.decision_root,
    signatures: [],
    private_keys_received: false,
    voter_key_custody: false,
    transaction_submission: false,
    asset_execution_enabled: false
  };
  return {...proposal, proposal_root: artifactRoot("lifepp.asset-unsigned-proposal.v2", proposal)};
}

export function assertNoSubmissionSurface(moduleExports) {
  const forbidden = ["submitTransaction", "signAndSend", "broadcastTransaction", "executeAssetTransfer"];
  for (const name of forbidden) {
    if (typeof moduleExports[name] === "function") throw new Error(`forbidden transaction surface exported: ${name}`);
  }
  return true;
}
