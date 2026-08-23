import { artifactRoot } from "./canonical.mjs";
import {
  approvalRoot,
  permitRoot,
  policyRoot,
  simulationRoot,
  timelockRoot,
  transactionMessageRoot
} from "./gates.mjs";

const POST_STATE_ROOT = `sha256:${"a".repeat(64)}`;

function rooted(domain, value, rootField) {
  return {...value, [rootField]: artifactRoot(domain, value)};
}

function simulation(controlDomain, endpointId, simulatedAt, messageRoot, executionPolicyRoot, phase) {
  const value = {
    artifact_type: "AssetRpcSimulation",
    artifact_version: "1.0.0",
    claim_label: "[SIM]",
    evidence_class: "SIMULATED",
    phase,
    control_domain: controlDomain,
    rpc_endpoint_id: endpointId,
    transaction_message_root: messageRoot,
    asset_execution_policy_root: executionPolicyRoot,
    simulated_at_epoch_seconds: simulatedAt,
    result: "WOULD_SUCCEED",
    post_state_root: POST_STATE_ROOT
  };
  return {...value, simulation_root: simulationRoot(value)};
}

function approval(voterMemberId, messageRoot, executionPolicyRoot) {
  const value = {
    artifact_type: "TreasuryApprovalReference",
    artifact_version: "1.0.0",
    claim_label: "[SIM]",
    evidence_class: "SIMULATED",
    voter_member_id: voterMemberId,
    voter_public_key_fingerprint: `sha256:${voterMemberId.slice(-1).repeat(64)}`,
    transaction_message_root: messageRoot,
    asset_execution_policy_root: executionPolicyRoot,
    approval_reference: `[SIM]-approval-${voterMemberId}`,
    signature_verification: "SIMULATED_ONLY"
  };
  return {...value, approval_root: approvalRoot(value)};
}

export function buildSimulatedGateInput(basePolicy) {
  const policy = {...basePolicy, asset_execution_policy_root: policyRoot(basePolicy)};
  const messageValue = {
    artifact_type: "CanonicalAssetTransactionMessage",
    artifact_version: "1.0.0",
    claim_label: "[SIM]",
    evidence_class: "SIMULATED",
    chain_id: "solana:mainnet",
    treasury_vault_address: "5Cohfz6H7vHzQpp7fEdUgtrpqzG2ff2VvZTrrCUgCzRo",
    destination: "[SIM]-destination-public-key",
    asset: "SOL",
    amount_base_units: "1",
    recent_block_reference: "[SIM]-block-reference",
    instruction_set: [{program:"system",operation:"transfer"}]
  };
  const message = {...messageValue, transaction_message_root: transactionMessageRoot(messageValue)};
  const executionPolicyRoot = policy.asset_execution_policy_root;
  const messageRoot = message.transaction_message_root;
  const simulations = [
    simulation("[SIM]-rpc-control-domain-a","[SIM]-rpc-endpoint-a",80,messageRoot,executionPolicyRoot,"INITIAL"),
    simulation("[SIM]-rpc-control-domain-b","[SIM]-rpc-endpoint-b",81,messageRoot,executionPolicyRoot,"INITIAL")
  ];
  const protocolFreeze = rooted("lifepp.simulated-protocol-freeze-certificate.v1",{
    artifact_type:"SimulatedProtocolFreezeCertificate",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    status:"FINALIZED",
    root_verification:"SIMULATED_ONLY",
    external_verifier_attestation_root:null,
    protocol_finality_proved:false,
    autonomous_merge_authorized:false
  },"certificate_root");
  const a4Freeze = rooted("lifepp.simulated-a4-freeze-certificate.v1",{
    artifact_type:"SimulatedA4FreezeCertificate",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    status:"FINALIZED",
    root_verification:"SIMULATED_ONLY",
    external_verifier_attestation_root:null,
    asset_execution_epoch_finality_proved:false
  },"certificate_root");
  const pocc = rooted("lifepp.simulated-pocc-asset-certificate.v1",{
    artifact_type:"SimulatedPoCCAssetCertificate",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    status:"FINALIZED",
    root_verification:"SIMULATED_ONLY",
    external_verifier_attestation_root:null,
    transaction_message_root:messageRoot,
    asset_execution_policy_root:executionPolicyRoot,
    consciousness_proved:false
  },"certificate_root");
  const challenge = rooted("lifepp.simulated-asset-challenge.v1",{
    artifact_type:"SimulatedAssetChallengeClosure",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    status:"CLOSED",
    root_verification:"SIMULATED_ONLY",
    external_verifier_attestation_root:null,
    transaction_message_root:messageRoot
  },"challenge_root");
  const responsibility = rooted("lifepp.simulated-asset-responsibility.v1",{
    artifact_type:"SimulatedResponsibilityCoverage",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    root_verification:"SIMULATED_ONLY",
    external_verifier_attestation_root:null,
    transaction_message_root:messageRoot,
    coverage:1
  },"responsibility_root");
  const treasury = {
    artifact_type:"TreasuryConfigurationReference",
    artifact_version:"1.0.0",
    claim_label:"[M]",
    vault_address:message.treasury_vault_address,
    multisig_threshold:3,
    voter_member_count:4,
    voter_member_ids:["voter-1","voter-2","voter-3","voter-4"],
    voter_roster_root:`sha256:${"d".repeat(64)}`,
    onchain_verification:"VERIFIED",
    configuration_transaction_signature:"W5mrupG7NiRhuBoNfTdJi2kvkWW1mBpEMJXtAcWmX6CUqp3HRDENr3RMN8gQZtVjiqGzNKtAZ9TAgi58HTUHp7X",
    configuration_slot:432189448,
    voter_key_custody_holders:["INDEPENDENT_VOTER_1","INDEPENDENT_VOTER_2","INDEPENDENT_VOTER_3","INDEPENDENT_VOTER_4"]
  };
  const timelockValue = {
    artifact_type:"AssetExecutionTimelock",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    transaction_message_root:messageRoot,
    asset_execution_policy_root:executionPolicyRoot,
    created_at_epoch_seconds:90,
    release_at_epoch_seconds:110,
    expires_at_epoch_seconds:190
  };
  const timelock = {...timelockValue,timelock_root:timelockRoot(timelockValue)};
  const approvals = ["voter-1","voter-2","voter-3"].map((id)=>approval(id,messageRoot,executionPolicyRoot));
  const permitValue = {
    artifact_type:"AssetExecutionPermit",
    artifact_version:"1.0.0",
    claim_label:"[SIM]",
    evidence_class:"SIMULATED",
    scope:"EXACT_TRANSACTION_ONLY",
    authorized_state:"PROPOSAL_ONLY",
    transaction_message_root:messageRoot,
    asset_execution_policy_root:executionPolicyRoot,
    timelock_root:timelock.timelock_root,
    valid_from_epoch_seconds:90,
    expires_at_epoch_seconds:190,
    approvals,
    signature_verification:"SIMULATED_ONLY",
    global_asset_authorization:false
  };
  const permit = {...permitValue,permit_root:permitRoot(permitValue)};
  const preExecutionSimulations = [
    simulation("[SIM]-rpc-control-domain-a","[SIM]-rpc-endpoint-a",119,messageRoot,executionPolicyRoot,"PRE_EXECUTION"),
    simulation("[SIM]-rpc-control-domain-b","[SIM]-rpc-endpoint-b",119,messageRoot,executionPolicyRoot,"PRE_EXECUTION")
  ];
  return {
    policy,
    message,
    simulations,
    protocol_freeze_certificate:protocolFreeze,
    a4_freeze_certificate:a4Freeze,
    pocc_certificate:pocc,
    challenge,
    responsibility,
    treasury,
    timelock,
    permit,
    pre_execution_simulations:preExecutionSimulations,
    executor:{
      artifact_type:"SimulatedExecutorDeclaration",
      artifact_version:"1.0.0",
      claim_label:"[SIM]",
      evidence_class:"SIMULATED",
      role:"INDEPENDENT_EXECUTOR",
      transaction_message_root:messageRoot,
      authorization_verification:"SIMULATED_ONLY",
      authorization_attestation_root:null,
      holds_voter_key:false
    },
    evaluation_time:120
  };
}
