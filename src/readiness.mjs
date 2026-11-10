import { canonicalJson } from "./canonical.mjs";

const ROOT_PATTERN = /^sha256:[0-9a-f]{64}$/;

function hasRoot(value) {
  return typeof value === "string" && ROOT_PATTERN.test(value);
}

function allTrue(record) {
  return Object.values(record).every((value) => value === true);
}

export function assessCanaryReadiness({ policy, gateInput, gateDecision, context, expectedFrozenHeads }) {
  const live = gateDecision?.live_execution_checks ?? {};
  const authoritySeparation = context?.treasury_authority_separation ?? {};

  const hardSafetyChecks = {
    frozen_protocol_heads_unchanged:
      canonicalJson(context?.frozen_protocol_heads) === canonicalJson(expectedFrozenHeads),
    transaction_submission_surface_absent: context?.transaction_submission_surface_present === false,
    policy_transaction_submission_disabled: policy?.transaction_submission === false,
    policy_asset_execution_disabled: policy?.asset_execution_enabled === false,
    implementation_ceiling_is_proposal_only: policy?.implementation_ceiling === "PROPOSAL_ONLY",
    global_asset_authorization_absent: gateInput?.permit?.global_asset_authorization === false,
    spending_limits_disabled: policy?.spending_limits_enabled === false,
    prohibited_voter_key_holders_absent:
      gateDecision?.proposal_checks?.prohibited_voter_key_holders_absent === true,
    treasury_authority_separation_preserved:
      Object.keys(authoritySeparation).length > 0 &&
      Object.values(authoritySeparation).every((value) => value === false),
    asset_recovery_executor_disarmed: policy?.asset_recovery_executor === "DISARMED"
  };

  const activationChecks = {
    current_state_is_proposal_only: context?.current_operational_state === "PROPOSAL_ONLY",
    repository_canary_authorization_ceiling_allows: false,
    protocol_finality_live_verified: live.protocol_freeze_live_finalized === true,
    separate_a4_finality_live_verified: live.a4_freeze_live_finalized === true,
    pocc_finalized_live_verified: live.pocc_live_verified === true,
    challenge_closed_live_verified: live.challenge_live_closed === true,
    responsibility_coverage_live_verified: live.responsibility_live_verified === true,
    initial_dual_rpc_live_verified: live.initial_rpc_live_verified === true,
    pre_execution_dual_rpc_live_verified: live.pre_execution_rpc_live_verified === true,
    timelock_live_verified: live.timelock_live_verified === true,
    transaction_specific_permit_live_verified: live.permit_live_verified === true,
    permit_authorizes_canary_capped: live.permit_authorizes_canary_capped === true,
    treasury_3_of_4_live_approval_verified: live.treasury_approvals_cryptographically_verified === true,
    independent_executor_live_verified: live.independent_executor_authorized === true,
    exact_transaction_gate_live_verified: gateDecision?.live_execution_prerequisites_satisfied === true,
    canary_caps_rooted:
      context?.canary_caps?.scope === "EXACT_TRANSACTION_ONLY" &&
      hasRoot(context?.canary_caps?.policy_root),
    release_council_distinct_and_rooted:
      context?.release_council?.present === true &&
      context?.release_council?.distinct_from_treasury === true &&
      hasRoot(context?.release_council?.authorization_root),
    emergency_stop_independently_attested:
      context?.emergency_stop?.independently_operable === true &&
      hasRoot(context?.emergency_stop?.attestation_root),
    treasury_funding_ready: context?.treasury_funding_readiness === "READY"
  };

  const blockers = Object.entries(activationChecks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key)
    .sort();
  const hardSafetyInvariantsSatisfied = allTrue(hardSafetyChecks);
  const activationPrerequisitesSatisfied = allTrue(activationChecks);

  return {
    artifact_type: "AssetExecutionCanaryReadinessAudit",
    artifact_version: "1.0.0",
    protocol_epoch: "lifepp.asset-execution.v1",
    claim_label: "[A]",
    evidence_class: "CURRENT_FAIL_CLOSED_READINESS_AUDIT",
    requested_transition: "PROPOSAL_ONLY_TO_CANARY_CAPPED",
    source_protocol_heads: context.frozen_protocol_heads,
    asset_execution_policy_root: policy.asset_execution_policy_root,
    simulated_gate_decision_root: gateDecision.decision_root,
    hard_safety_checks: hardSafetyChecks,
    activation_checks: activationChecks,
    hard_safety_invariants_satisfied: hardSafetyInvariantsSatisfied,
    activation_prerequisites_satisfied: activationPrerequisitesSatisfied,
    blockers,
    canary_capped_authorized: hardSafetyInvariantsSatisfied && activationPrerequisitesSatisfied,
    transaction_submission: false,
    asset_execution_enabled: false,
    asset_recovery_executor: "DISARMED"
  };
}
