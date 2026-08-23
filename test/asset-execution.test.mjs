import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as proposalModule from "../src/proposal.mjs";
import {
  approvalRoot,
  evaluateTransactionGate,
  permitRoot,
  policyRoot,
  simulationRoot,
  transactionMessageRoot
} from "../src/gates.mjs";
import { assertTransition } from "../src/state-machine.mjs";
import { createFinalizedReceipt } from "../src/receipt.mjs";
import { buildSimulatedGateInput } from "../src/shadow-vector.mjs";

const basePolicy = JSON.parse(await readFile(new URL("../config/default-policy.json", import.meta.url), "utf8"));
const root=(character)=>`sha256:${character.repeat(64)}`;

function validGateInput() {
  return buildSimulatedGateInput(basePolicy);
}

function rerootPermit(input) {
  input.permit.approvals=input.permit.approvals.map((approval)=>({...approval,approval_root:approvalRoot(approval)}));
  input.permit.permit_root=permitRoot(input.permit);
}

test("policy and transaction roots bind exact canonical bytes",()=>{
  const input=validGateInput();
  assert.equal(input.policy.asset_execution_policy_root,policyRoot(input.policy));
  assert.equal(input.message.transaction_message_root,transactionMessageRoot(input.message));
  const changed=structuredClone(input.message);
  changed.amount_base_units="2";
  assert.notEqual(transactionMessageRoot(changed),input.message.transaction_message_root);
});

test("state machine permits only sequential states through PROPOSAL_ONLY", () => {
  assert.equal(assertTransition("DISARMED", "SHADOW", { shadow_boundary_verified: true }).authorized, true);
  assert.equal(assertTransition("SHADOW", "SIMULATION_ONLY", { deterministic_simulation_verified: true }).authorized, true);
  assert.equal(assertTransition("SIMULATION_ONLY", "PROPOSAL_ONLY", { transaction_specific_gates_satisfied: true }).authorized, true);
});

test("state skipping and every live state fail closed", () => {
  assert.throws(() => assertTransition("DISARMED", "PROPOSAL_ONLY", {}), /sequential/);
  assert.throws(() => assertTransition("PROPOSAL_ONLY", "CANARY_CAPPED", {}), /ceiling/);
});

test("complete simulated vector constructs only a rooted unsigned proposal", () => {
  const input=validGateInput();
  const decision = evaluateTransactionGate(input);
  assert.equal(decision.proposal_only_authorized, true);
  assert.equal(decision.live_execution_prerequisites_satisfied,false);
  assert.equal(decision.transaction_submission_authorized, false);
  assert.equal(decision.asset_execution_authorized,false);
  assert.match(decision.decision_root,/^sha256:[0-9a-f]{64}$/);
  assert.ok(Object.values(decision.proposal_checks).every(Boolean));
  const proposal = proposalModule.buildUnsignedProposal(input.message, decision);
  assert.deepEqual(proposal.signatures, []);
  assert.equal(proposal.private_keys_received,false);
  assert.equal(proposal.voter_key_custody,false);
  assert.equal(proposal.transaction_submission, false);
  assert.match(proposal.proposal_root,/^sha256:[0-9a-f]{64}$/);
});

test("dual RPC root mismatch and duplicate control domain fail closed", () => {
  const mismatch = validGateInput();
  mismatch.simulations[1].post_state_root = root("b");
  mismatch.simulations[1].simulation_root=simulationRoot(mismatch.simulations[1]);
  assert.equal(evaluateTransactionGate(mismatch).proposal_checks.initial_rpc_post_state_roots_equal, false);

  const duplicate = validGateInput();
  duplicate.simulations[1].control_domain = duplicate.simulations[0].control_domain;
  duplicate.simulations[1].simulation_root=simulationRoot(duplicate.simulations[1]);
  assert.equal(evaluateTransactionGate(duplicate).proposal_checks.initial_rpc_control_domains_distinct, false);
});

test("tampered RPC simulation root fails closed",()=>{
  const input=validGateInput();
  input.simulations[0].simulation_root=root("0");
  assert.equal(evaluateTransactionGate(input).proposal_checks.initial_rpc_records_rooted_and_exact,false);
});

test("expired, global, or tampered permit fails closed", () => {
  const expired = validGateInput();
  expired.evaluation_time = 191;
  assert.equal(evaluateTransactionGate(expired).proposal_checks.permit_unexpired, false);

  const global = validGateInput();
  global.permit.global_asset_authorization = true;
  global.permit.permit_root=permitRoot(global.permit);
  assert.equal(evaluateTransactionGate(global).proposal_checks.permit_not_global, false);

  const tampered = validGateInput();
  tampered.permit.permit_root=root("0");
  assert.equal(evaluateTransactionGate(tampered).proposal_checks.permit_root_exact,false);
});

test("3-of-4 approvals require distinct roster members and exact roots",()=>{
  const duplicate=validGateInput();
  duplicate.permit.approvals[2].voter_member_id=duplicate.permit.approvals[1].voter_member_id;
  rerootPermit(duplicate);
  assert.equal(evaluateTransactionGate(duplicate).proposal_checks.permit_approval_voters_distinct,false);

  const outsider=validGateInput();
  outsider.permit.approvals[2].voter_member_id="voter-5";
  rerootPermit(outsider);
  assert.equal(evaluateTransactionGate(outsider).proposal_checks.permit_approval_voters_in_roster,false);
});

test("pre-execution re-simulation must be dual, equal, exact, and fresh",()=>{
  const stale=validGateInput();
  stale.pre_execution_simulations.forEach((simulation)=>{
    simulation.simulated_at_epoch_seconds=80;
    simulation.simulation_root=simulationRoot(simulation);
  });
  assert.equal(evaluateTransactionGate(stale).proposal_checks.pre_execution_fresh,false);

  const divergent=validGateInput();
  divergent.pre_execution_simulations[1].post_state_root=root("b");
  divergent.pre_execution_simulations[1].simulation_root=simulationRoot(divergent.pre_execution_simulations[1]);
  assert.equal(evaluateTransactionGate(divergent).proposal_checks.pre_execution_rpc_post_state_roots_equal,false);
});

test("spending limits and prohibited voter-key custody fail closed", () => {
  const spending = validGateInput();
  spending.policy.spending_limits_enabled = true;
  spending.policy.asset_execution_policy_root = policyRoot(spending.policy);
  assert.equal(evaluateTransactionGate(spending).proposal_checks.spending_limits_disabled, false);

  const custody = validGateInput();
  custody.treasury.voter_key_custody_holders[0] = "CODEX";
  assert.equal(evaluateTransactionGate(custody).proposal_checks.prohibited_voter_key_holders_absent, false);
});

test("even externally verified inputs cannot cross this repository's proposal-only ceiling",()=>{
  const input=validGateInput();
  input.protocol_freeze_certificate.evidence_class="LIVE_VERIFIED";
  input.protocol_freeze_certificate.protocol_finality_proved=true;
  input.protocol_freeze_certificate.root_verification="VERIFIED";
  input.protocol_freeze_certificate.external_verifier_attestation_root=root("1");
  input.a4_freeze_certificate.evidence_class="LIVE_VERIFIED";
  input.a4_freeze_certificate.asset_execution_epoch_finality_proved=true;
  input.a4_freeze_certificate.root_verification="VERIFIED";
  input.a4_freeze_certificate.external_verifier_attestation_root=root("2");
  input.pocc_certificate.evidence_class="LIVE_VERIFIED";
  input.pocc_certificate.root_verification="VERIFIED";
  input.pocc_certificate.external_verifier_attestation_root=root("3");
  input.challenge.evidence_class="LIVE_VERIFIED";
  input.challenge.root_verification="VERIFIED";
  input.challenge.external_verifier_attestation_root=root("4");
  input.responsibility.evidence_class="LIVE_VERIFIED";
  input.responsibility.root_verification="VERIFIED";
  input.responsibility.external_verifier_attestation_root=root("5");
  input.executor.evidence_class="LIVE_VERIFIED";
  input.executor.authorization_verification="VERIFIED";
  input.executor.authorization_attestation_root=root("6");
  input.permit.evidence_class="LIVE_VERIFIED";
  input.permit.signature_verification="VERIFIED";
  input.permit.approvals=input.permit.approvals.map((approval)=>({...approval,evidence_class:"LIVE_VERIFIED",signature_verification:"VERIFIED"}));
  rerootPermit(input);
  const decision=evaluateTransactionGate(input);
  assert.equal(decision.live_execution_checks.repository_live_execution_ceiling_allows,false);
  assert.ok(Object.entries(decision.live_execution_checks).filter(([key])=>key!=="repository_live_execution_ceiling_allows").every(([,value])=>value===true));
  assert.equal(decision.live_execution_prerequisites_satisfied,false);
  assert.equal(decision.transaction_submission_authorized,false);
  assert.equal(decision.asset_execution_authorized,false);
  assert.equal(decision.maximum_authorized_state,"PROPOSAL_ONLY");
});

test("proposal module exports no signing or submission surface", () => {
  assert.equal(proposalModule.assertNoSubmissionSurface(proposalModule), true);
});

test("receipt rejects non-live, non-finalized, or unobserved claims", () => {
  assert.throws(() => createFinalizedReceipt({ evidence_class:"SIMULATED" }), /live verified/);
  assert.throws(() => createFinalizedReceipt({ evidence_class:"LIVE_VERIFIED",submission_observed_by_independent_executor:false }), /independent executor/);
});

test("receipt binds externally observed finalized post-state without submitting", () => {
  const receipt = createFinalizedReceipt({
    evidence_class:"LIVE_VERIFIED",
    submission_observed_by_independent_executor:true,
    asset_execution_permit_verified:true,
    treasury_approval_verified:true,
    chain_finality_status:"FINALIZED",
    chain_id:"solana:mainnet",
    transaction_signature:"external-transaction-signature",
    transaction_message_root:root("1"),
    asset_execution_policy_root:root("2"),
    permit_root:root("3"),
    timelock_root:root("4"),
    pocc_certificate_root:root("5"),
    treasury_approval_root:root("6"),
    initial_simulation_roots:[root("7"),root("8")],
    pre_execution_simulation_roots:[root("9"),root("a")],
    submission_slot:10,
    confirmed_slot:42,
    post_state_root:root("c"),
    expected_post_state_root:root("c"),
    independent_executor_attestation_root:root("d")
  });
  assert.equal(receipt.chain_finality_status,"FINALIZED");
  assert.equal(receipt.transaction_submission_observed,true);
  assert.match(receipt.receipt_root,/^sha256:[0-9a-f]{64}$/);
});
