import { artifactRoot, withoutField } from "./canonical.mjs";

const ROOT = /^sha256:[0-9a-f]{64}$/;

export function policyRoot(policy) {
  return artifactRoot("lifepp.asset-execution-policy.v1", withoutField(policy, "asset_execution_policy_root"));
}

export function transactionMessageRoot(message) {
  return artifactRoot("lifepp.asset-transaction-message.v1", withoutField(message, "transaction_message_root"));
}

export function simulationRoot(simulation) {
  return artifactRoot("lifepp.asset-rpc-simulation.v1", withoutField(simulation, "simulation_root"));
}

export function approvalRoot(approval) {
  return artifactRoot("lifepp.asset-treasury-approval-reference.v1", withoutField(approval, "approval_root"));
}

export function permitRoot(permit) {
  return artifactRoot("lifepp.asset-execution-permit.v1", withoutField(permit, "permit_root"));
}

export function timelockRoot(timelock) {
  return artifactRoot("lifepp.asset-execution-timelock.v1", withoutField(timelock, "timelock_root"));
}

function distinct(values) {
  return new Set(values).size === values.length;
}

function rootedSimulations(simulations, expectedMessageRoot, expectedPolicyRoot) {
  return Array.isArray(simulations)
    && simulations.length === 2
    && simulations.every((item) => item.transaction_message_root === expectedMessageRoot
      && item.asset_execution_policy_root === expectedPolicyRoot
      && item.simulation_root === simulationRoot(item)
      && item.result === "WOULD_SUCCEED"
      && ROOT.test(item.post_state_root));
}

function simulationSetChecks(simulations, expectedMessageRoot, expectedPolicyRoot) {
  const list = Array.isArray(simulations) ? simulations : [];
  const domains = list.map((item) => item.control_domain);
  const endpoints = list.map((item) => item.rpc_endpoint_id);
  const postStateRoots = list.map((item) => item.post_state_root);
  return {
    two_results_present: list.length === 2,
    records_rooted_and_exact: rootedSimulations(list, expectedMessageRoot, expectedPolicyRoot),
    control_domains_distinct: list.length === 2 && distinct(domains),
    endpoints_distinct: list.length === 2 && distinct(endpoints),
    post_state_roots_equal: list.length === 2 && postStateRoots[0] === postStateRoots[1]
  };
}

export function evaluateTransactionGate(input) {
  const {
    policy,
    message,
    simulations,
    protocol_freeze_certificate: protocolFreeze,
    a4_freeze_certificate: a4Freeze,
    pocc_certificate: pocc,
    challenge,
    responsibility,
    treasury,
    timelock,
    permit,
    pre_execution_simulations: preExecution,
    evaluation_time: evaluationTime
  } = input;

  const expectedPolicyRoot = policyRoot(policy);
  const expectedMessageRoot = transactionMessageRoot(message);
  const initialSimulationChecks = simulationSetChecks(simulations, expectedMessageRoot, expectedPolicyRoot);
  const preExecutionChecks = simulationSetChecks(preExecution, expectedMessageRoot, expectedPolicyRoot);
  const initialPostStateRoot = Array.isArray(simulations) && simulations.length === 2 ? simulations[0].post_state_root : null;
  const preExecutionPostStateRoot = Array.isArray(preExecution) && preExecution.length === 2 ? preExecution[0].post_state_root : null;
  const preExecutionTimes = Array.isArray(preExecution) ? preExecution.map((item) => item.simulated_at_epoch_seconds) : [];
  const approvals = Array.isArray(permit.approvals) ? permit.approvals : [];
  const approvedVoterIds = approvals.map((item) => item.voter_member_id);
  const roster = Array.isArray(treasury.voter_member_ids) ? treasury.voter_member_ids : [];
  const permitTtl = permit.expires_at_epoch_seconds - permit.valid_from_epoch_seconds;

  const proposalChecks = {
    policy_root_exact: policy.asset_execution_policy_root === expectedPolicyRoot,
    message_root_exact: message.transaction_message_root === expectedMessageRoot,
    spending_limits_disabled: policy.spending_limits_enabled === false && policy.live_execution_caps === null,
    policy_ceiling_proposal_only: policy.implementation_ceiling === "PROPOSAL_ONLY",
    initial_dual_rpc_results_present: initialSimulationChecks.two_results_present,
    initial_rpc_records_rooted_and_exact: initialSimulationChecks.records_rooted_and_exact,
    initial_rpc_control_domains_distinct: initialSimulationChecks.control_domains_distinct,
    initial_rpc_endpoints_distinct: initialSimulationChecks.endpoints_distinct,
    initial_rpc_post_state_roots_equal: initialSimulationChecks.post_state_roots_equal,
    pocc_finalized_exact: pocc.status === "FINALIZED"
      && pocc.transaction_message_root === expectedMessageRoot
      && pocc.asset_execution_policy_root === expectedPolicyRoot
      && pocc.consciousness_proved === false
      && ROOT.test(pocc.certificate_root),
    challenge_closed: challenge.status === "CLOSED"
      && challenge.transaction_message_root === expectedMessageRoot
      && ROOT.test(challenge.challenge_root),
    responsibility_coverage_sufficient: responsibility.coverage >= policy.required_responsibility_coverage
      && responsibility.transaction_message_root === expectedMessageRoot
      && ROOT.test(responsibility.responsibility_root),
    treasury_vault_exact: treasury.vault_address === message.treasury_vault_address,
    treasury_threshold_exact: treasury.multisig_threshold === policy.required_treasury_threshold,
    treasury_voter_count_exact: treasury.voter_member_count === policy.required_treasury_voters,
    treasury_roster_complete: roster.length === policy.required_treasury_voters && distinct(roster),
    treasury_onchain_verified: treasury.onchain_verification === "VERIFIED"
      && Number.isSafeInteger(treasury.configuration_slot)
      && treasury.configuration_slot >= 0
      && typeof treasury.configuration_transaction_signature === "string"
      && treasury.configuration_transaction_signature.length > 0,
    timelock_root_exact: timelock.timelock_root === timelockRoot(timelock),
    timelock_matured: timelock.transaction_message_root === expectedMessageRoot
      && timelock.asset_execution_policy_root === expectedPolicyRoot
      && evaluationTime >= timelock.release_at_epoch_seconds
      && evaluationTime <= timelock.expires_at_epoch_seconds,
    permit_root_exact: permit.permit_root === permitRoot(permit),
    permit_transaction_exact: permit.transaction_message_root === expectedMessageRoot,
    permit_policy_exact: permit.asset_execution_policy_root === expectedPolicyRoot,
    permit_timelock_exact: permit.timelock_root === timelock.timelock_root,
    permit_state_exact: permit.authorized_state === "PROPOSAL_ONLY",
    permit_unexpired: evaluationTime >= permit.valid_from_epoch_seconds && evaluationTime <= permit.expires_at_epoch_seconds,
    permit_ttl_bounded: permitTtl > 0 && permitTtl <= policy.permit_max_ttl_seconds,
    permit_approval_count_satisfies_3_of_4: approvals.length >= treasury.multisig_threshold
      && approvals.length <= treasury.voter_member_count,
    permit_approval_voters_distinct: distinct(approvedVoterIds),
    permit_approval_voters_in_roster: approvedVoterIds.every((id) => roster.includes(id)),
    permit_approval_roots_exact: approvals.every((approval) => approval.approval_root === approvalRoot(approval)
      && approval.transaction_message_root === expectedMessageRoot
      && approval.asset_execution_policy_root === expectedPolicyRoot),
    permit_not_global: permit.scope === "EXACT_TRANSACTION_ONLY" && permit.global_asset_authorization === false,
    pre_execution_dual_rpc_results_present: preExecutionChecks.two_results_present,
    pre_execution_rpc_records_rooted_and_exact: preExecutionChecks.records_rooted_and_exact,
    pre_execution_rpc_control_domains_distinct: preExecutionChecks.control_domains_distinct,
    pre_execution_rpc_endpoints_distinct: preExecutionChecks.endpoints_distinct,
    pre_execution_rpc_post_state_roots_equal: preExecutionChecks.post_state_roots_equal,
    pre_execution_root_matches_initial_dual_rpc: initialPostStateRoot !== null && preExecutionPostStateRoot === initialPostStateRoot,
    pre_execution_fresh: preExecutionTimes.length === 2 && preExecutionTimes.every((time) => Number.isSafeInteger(time)
      && time <= evaluationTime
      && evaluationTime - time <= policy.pre_execution_simulation_max_age_seconds),
    no_transaction_submission_capability: policy.transaction_submission === false,
    asset_execution_disabled: policy.asset_execution_enabled === false,
    recovery_executor_disarmed: policy.asset_recovery_executor === "DISARMED",
    prohibited_voter_key_holders_absent: Array.isArray(treasury.voter_key_custody_holders)
      && treasury.voter_key_custody_holders.every((holder) => !policy.prohibited_voter_key_holders.includes(holder.toUpperCase()))
  };

  const liveExecutionChecks = {
    repository_live_execution_ceiling_allows: false,
    protocol_freeze_live_finalized: protocolFreeze.status === "FINALIZED"
      && protocolFreeze.evidence_class === "LIVE_VERIFIED"
      && protocolFreeze.protocol_finality_proved === true
      && protocolFreeze.root_verification === "VERIFIED"
      && ROOT.test(protocolFreeze.external_verifier_attestation_root)
      && ROOT.test(protocolFreeze.certificate_root),
    a4_freeze_live_finalized: a4Freeze.status === "FINALIZED"
      && a4Freeze.evidence_class === "LIVE_VERIFIED"
      && a4Freeze.asset_execution_epoch_finality_proved === true
      && a4Freeze.root_verification === "VERIFIED"
      && ROOT.test(a4Freeze.external_verifier_attestation_root)
      && ROOT.test(a4Freeze.certificate_root),
    pocc_live_verified: pocc.evidence_class === "LIVE_VERIFIED" && pocc.root_verification === "VERIFIED" && ROOT.test(pocc.external_verifier_attestation_root),
    challenge_live_closed: challenge.evidence_class === "LIVE_VERIFIED" && challenge.root_verification === "VERIFIED" && ROOT.test(challenge.external_verifier_attestation_root),
    responsibility_live_verified: responsibility.evidence_class === "LIVE_VERIFIED" && responsibility.root_verification === "VERIFIED" && ROOT.test(responsibility.external_verifier_attestation_root),
    treasury_approvals_cryptographically_verified: approvals.length >= treasury.multisig_threshold
      && approvals.every((approval) => approval.evidence_class === "LIVE_VERIFIED" && approval.signature_verification === "VERIFIED"),
    permit_live_verified: permit.evidence_class === "LIVE_VERIFIED" && permit.signature_verification === "VERIFIED",
    independent_executor_authorized: input.executor?.evidence_class === "LIVE_VERIFIED"
      && input.executor?.role === "INDEPENDENT_EXECUTOR"
      && input.executor?.transaction_message_root === expectedMessageRoot
      && input.executor?.authorization_verification === "VERIFIED"
      && ROOT.test(input.executor?.authorization_attestation_root)
      && input.executor?.holds_voter_key === false
  };

  const proposalOnlyAuthorized = Object.values(proposalChecks).every(Boolean);
  const liveExecutionPrerequisitesSatisfied = proposalOnlyAuthorized && Object.values(liveExecutionChecks).every(Boolean);
  const decision = {
    artifact_type: "AssetExecutionGateDecision",
    artifact_version: "2.0.0",
    claim_label: proposalOnlyAuthorized ? "[SIM]" : "[A]",
    evidence_class: proposalOnlyAuthorized ? "SIMULATED_PROPOSAL_VECTOR" : "FAIL_CLOSED_AUDIT",
    transaction_message_root: expectedMessageRoot,
    asset_execution_policy_root: expectedPolicyRoot,
    proposal_checks: proposalChecks,
    live_execution_checks: liveExecutionChecks,
    proposal_only_authorized: proposalOnlyAuthorized,
    live_execution_prerequisites_satisfied: liveExecutionPrerequisitesSatisfied,
    transaction_submission_authorized: false,
    asset_execution_authorized: false,
    maximum_authorized_state: proposalOnlyAuthorized ? "PROPOSAL_ONLY" : "DISARMED"
  };
  return {...decision, decision_root: artifactRoot("lifepp.asset-execution-gate-decision.v2", decision)};
}
