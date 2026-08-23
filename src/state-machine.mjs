export const ASSET_EXECUTION_STATES = Object.freeze([
  "DISARMED",
  "SHADOW",
  "SIMULATION_ONLY",
  "PROPOSAL_ONLY",
  "CANARY_CAPPED",
  "LIMITED_LIVE",
  "BOUNDED_PRODUCTION"
]);

export const IMPLEMENTATION_CEILING = "PROPOSAL_ONLY";

export function stateIndex(state) {
  const index = ASSET_EXECUTION_STATES.indexOf(state);
  if (index === -1) throw new Error(`unknown asset execution state: ${state}`);
  return index;
}

export function assertTransition(current, next, evidence = {}) {
  const currentIndex = stateIndex(current);
  const nextIndex = stateIndex(next);
  if (nextIndex !== currentIndex + 1) throw new Error("state transitions must be sequential");
  if (nextIndex > stateIndex(IMPLEMENTATION_CEILING)) {
    throw new Error("live asset state exceeds the authorized implementation ceiling");
  }
  if (next === "SHADOW" && evidence.shadow_boundary_verified !== true) {
    throw new Error("SHADOW requires verified executor boundary evidence");
  }
  if (next === "SIMULATION_ONLY" && evidence.deterministic_simulation_verified !== true) {
    throw new Error("SIMULATION_ONLY requires deterministic simulation evidence");
  }
  if (next === "PROPOSAL_ONLY" && evidence.transaction_specific_gates_satisfied !== true) {
    throw new Error("PROPOSAL_ONLY requires all transaction-specific gates");
  }
  return { current, next, authorized: true, claim_label: "[D]" };
}

