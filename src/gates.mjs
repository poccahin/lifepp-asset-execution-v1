import { artifactRoot, withoutField } from "./canonical.mjs";

export function policyRoot(policy) {
  return artifactRoot("lifepp.asset-execution-policy.v1", withoutField(policy, "asset_execution_policy_root"));
}

export function transactionMessageRoot(message) {
  return artifactRoot("lifepp.asset-transaction-message.v1", withoutField(message, "transaction_message_root"));
}

function distinct(values) {
  return new Set(values).size === values.length;
}

export function evaluateTransactionGate(input) {
  const {
    policy,
    message,
    simulations,
    pocc_certificate: pocc,
    challenge,
    responsibility,
    treasury,
    timelock,
    permit,
    pre_execution_simulation: preExecution,
    evaluation_time: evaluationTime
  } = input;

  const simulationRoots = simulations.map((item) => item.post_state_root);
  const simulationDomains = simulations.map((item) => item.control_domain);
  const simulationEndpoints = simulations.map((item) => item.rpc_endpoint_id);
  const expectedPolicyRoot = policyRoot(policy);
  const expectedMessageRoot = transactionMessageRoot(message);
  const permitTtl = permit.expires_at_epoch_seconds - permit.valid_from_epoch_seconds;

  const checks = {
    policy_root_exact: policy.asset_execution_policy_root === expectedPolicyRoot,
    message_root_exact: message.transaction_message_root === expectedMessageRoot,
    spending_limits_disabled: policy.spending_limits_enabled === false && policy.live_execution_caps === null,
    policy_ceiling_proposal_only: policy.implementation_ceiling === "PROPOSAL_ONLY",
    two_rpc_results_present: simulations.length === policy.required_rpc_control_domains,
    rpc_control_domains_distinct: distinct(simulationDomains),
    rpc_endpoints_distinct: distinct(simulationEndpoints),
    rpc_post_state_roots_equal: simulationRoots.length === 2 && simulationRoots[0] === simulationRoots[1],
    rpc_message_roots_exact: simulations.every((item) => item.transaction_message_root === expectedMessageRoot),
    pocc_finalized_exact: pocc.status === "FINALIZED" && pocc.transaction_message_root === expectedMessageRoot && pocc.asset_execution_policy_root === expectedPolicyRoot,
    challenge_closed: challenge.status === "CLOSED" && challenge.transaction_message_root === expectedMessageRoot,
    responsibility_coverage_sufficient: responsibility.coverage >= policy.required_responsibility_coverage && responsibility.transaction_message_root === expectedMessageRoot,
    treasury_vault_exact: treasury.vault_address === message.treasury_vault_address,
    treasury_threshold_exact: treasury.multisig_threshold === policy.required_treasury_threshold,
    treasury_voter_count_exact: treasury.voter_member_count === policy.required_treasury_voters,
    treasury_onchain_verified: treasury.onchain_verification === "VERIFIED",
    timelock_matured: timelock.transaction_message_root === expectedMessageRoot && evaluationTime >= timelock.release_at_epoch_seconds,
    permit_transaction_exact: permit.transaction_message_root === expectedMessageRoot,
    permit_policy_exact: permit.asset_execution_policy_root === expectedPolicyRoot,
    permit_state_exact: permit.authorized_state === "PROPOSAL_ONLY",
    permit_unexpired: evaluationTime >= permit.valid_from_epoch_seconds && evaluationTime <= permit.expires_at_epoch_seconds,
    permit_ttl_bounded: permitTtl > 0 && permitTtl <= policy.permit_max_ttl_seconds,
    permit_threshold_met: permit.approval_references.length >= treasury.multisig_threshold && distinct(permit.approval_references),
    permit_not_global: permit.scope === "EXACT_TRANSACTION_ONLY" && permit.global_asset_authorization === false,
    pre_execution_message_exact: preExecution.transaction_message_root === expectedMessageRoot,
    pre_execution_root_matches_dual_rpc: simulationRoots.length === 2 && preExecution.post_state_root === simulationRoots[0],
    no_transaction_submission_capability: policy.transaction_submission === false,
    asset_execution_disabled: policy.asset_execution_enabled === false,
    recovery_executor_disarmed: policy.asset_recovery_executor === "DISARMED",
    prohibited_voter_key_holders_absent: treasury.voter_key_custody_holders.every(
      (holder) => !policy.prohibited_voter_key_holders.includes(holder.toUpperCase())
    )
  };

  const proposalOnlyAuthorized = Object.values(checks).every(Boolean);
  return {
    artifact_type: "AssetExecutionGateDecision",
    artifact_version: "1.0.0",
    claim_label: proposalOnlyAuthorized ? "[SIM]" : "[A]",
    checks,
    proposal_only_authorized: proposalOnlyAuthorized,
    transaction_submission_authorized: false,
    asset_execution_authorized: false,
    maximum_authorized_state: proposalOnlyAuthorized ? "PROPOSAL_ONLY" : "DISARMED"
  };
}

