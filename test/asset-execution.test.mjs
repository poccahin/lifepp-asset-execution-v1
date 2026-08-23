import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as proposalModule from "../src/proposal.mjs";
import { policyRoot, transactionMessageRoot, evaluateTransactionGate } from "../src/gates.mjs";
import { assertTransition } from "../src/state-machine.mjs";
import { createFinalizedReceipt } from "../src/receipt.mjs";

const basePolicy = JSON.parse(await readFile(new URL("../config/default-policy.json", import.meta.url), "utf8"));
const policy = { ...basePolicy, asset_execution_policy_root: policyRoot(basePolicy) };
const baseMessage = {
  artifact_type: "CanonicalAssetTransactionMessage",
  artifact_version: "1.0.0",
  chain_id: "solana:mainnet",
  treasury_vault_address: "5Cohfz6H7vHzQpp7fEdUgtrpqzG2ff2VvZTrrCUgCzRo",
  destination: "[SIM]-destination-public-key",
  asset: "SOL",
  amount_base_units: "1",
  recent_block_reference: "[SIM]-block-reference",
  instruction_set: [{ program: "system", operation: "transfer" }]
};
const message = { ...baseMessage, transaction_message_root: transactionMessageRoot(baseMessage) };

function validGateInput() {
  const root = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  return {
    policy,
    message,
    simulations: [
      { control_domain: "[SIM]-rpc-domain-a", rpc_endpoint_id: "[SIM]-rpc-a", transaction_message_root: message.transaction_message_root, post_state_root: root },
      { control_domain: "[SIM]-rpc-domain-b", rpc_endpoint_id: "[SIM]-rpc-b", transaction_message_root: message.transaction_message_root, post_state_root: root }
    ],
    pocc_certificate: { status: "FINALIZED", transaction_message_root: message.transaction_message_root, asset_execution_policy_root: policy.asset_execution_policy_root },
    challenge: { status: "CLOSED", transaction_message_root: message.transaction_message_root },
    responsibility: { coverage: 1, transaction_message_root: message.transaction_message_root },
    treasury: {
      vault_address: message.treasury_vault_address,
      multisig_threshold: 3,
      voter_member_count: 4,
      onchain_verification: "VERIFIED",
      voter_key_custody_holders: ["[SIM]-independent-voter-a", "[SIM]-independent-voter-b", "[SIM]-independent-voter-c", "[SIM]-independent-voter-d"]
    },
    timelock: { transaction_message_root: message.transaction_message_root, release_at_epoch_seconds: 100 },
    permit: {
      artifact_type: "AssetExecutionPermit",
      artifact_version: "1.0.0",
      scope: "EXACT_TRANSACTION_ONLY",
      authorized_state: "PROPOSAL_ONLY",
      transaction_message_root: message.transaction_message_root,
      asset_execution_policy_root: policy.asset_execution_policy_root,
      valid_from_epoch_seconds: 90,
      expires_at_epoch_seconds: 190,
      approval_references: ["[SIM]-approval-a", "[SIM]-approval-b", "[SIM]-approval-c"],
      global_asset_authorization: false
    },
    pre_execution_simulation: { transaction_message_root: message.transaction_message_root, post_state_root: root },
    evaluation_time: 120
  };
}

test("state machine permits only sequential states through PROPOSAL_ONLY", () => {
  assert.equal(assertTransition("DISARMED", "SHADOW", { shadow_boundary_verified: true }).authorized, true);
  assert.equal(assertTransition("SHADOW", "SIMULATION_ONLY", { deterministic_simulation_verified: true }).authorized, true);
  assert.equal(assertTransition("SIMULATION_ONLY", "PROPOSAL_ONLY", { transaction_specific_gates_satisfied: true }).authorized, true);
});

test("state skipping fails closed", () => {
  assert.throws(() => assertTransition("DISARMED", "PROPOSAL_ONLY", {}), /sequential/);
});

test("live state is outside the implementation ceiling", () => {
  assert.throws(() => assertTransition("PROPOSAL_ONLY", "CANARY_CAPPED", {}), /ceiling/);
});

test("complete simulated vector can construct only an unsigned proposal", () => {
  const decision = evaluateTransactionGate(validGateInput());
  assert.equal(decision.proposal_only_authorized, true);
  assert.equal(decision.transaction_submission_authorized, false);
  const proposal = proposalModule.buildUnsignedProposal(message, decision);
  assert.deepEqual(proposal.signatures, []);
  assert.equal(proposal.transaction_submission, false);
});

test("dual RPC root mismatch fails closed", () => {
  const input = validGateInput();
  input.simulations[1].post_state_root = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  assert.equal(evaluateTransactionGate(input).proposal_only_authorized, false);
});

test("duplicate RPC control domain fails closed", () => {
  const input = validGateInput();
  input.simulations[1].control_domain = input.simulations[0].control_domain;
  assert.equal(evaluateTransactionGate(input).checks.rpc_control_domains_distinct, false);
});

test("expired permit fails closed", () => {
  const input = validGateInput();
  input.evaluation_time = 191;
  assert.equal(evaluateTransactionGate(input).checks.permit_unexpired, false);
});

test("global authorization fails closed", () => {
  const input = validGateInput();
  input.permit.global_asset_authorization = true;
  assert.equal(evaluateTransactionGate(input).checks.permit_not_global, false);
});

test("spending limit activation fails closed", () => {
  const input = validGateInput();
  input.policy = { ...policy, spending_limits_enabled: true };
  input.policy.asset_execution_policy_root = policyRoot(input.policy);
  input.permit.asset_execution_policy_root = input.policy.asset_execution_policy_root;
  input.pocc_certificate.asset_execution_policy_root = input.policy.asset_execution_policy_root;
  assert.equal(evaluateTransactionGate(input).checks.spending_limits_disabled, false);
});

test("prohibited voter-key custody fails closed", () => {
  const input = validGateInput();
  input.treasury.voter_key_custody_holders[0] = "CODEX";
  assert.equal(evaluateTransactionGate(input).checks.prohibited_voter_key_holders_absent, false);
});

test("proposal module exports no submission surface", () => {
  assert.equal(proposalModule.assertNoSubmissionSurface(proposalModule), true);
});

test("receipt rejects non-finalized chain state", () => {
  assert.throws(
    () => createFinalizedReceipt({ chain_finality_status: "CONFIRMED", submission_slot: 1, confirmed_slot: 2, post_state_root: "x", expected_post_state_root: "x" }),
    /finalized/
  );
});

test("receipt binds finalized post-state without submitting", () => {
  const receipt = createFinalizedReceipt({
    chain_finality_status: "FINALIZED",
    transaction_signature: "[SIM]-external-signature",
    transaction_message_root: message.transaction_message_root,
    asset_execution_policy_root: policy.asset_execution_policy_root,
    submission_slot: 10,
    confirmed_slot: 42,
    post_state_root: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    expected_post_state_root: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  });
  assert.equal(receipt.chain_finality_status, "FINALIZED");
  assert.match(receipt.receipt_root, /^sha256:[0-9a-f]{64}$/);
});

