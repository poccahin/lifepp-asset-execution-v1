# Life++ Asset Execution v1

`[A]` This is a new, separate A4 protocol surface because the frozen Genesis Reachability v2.1 Heads do not commit an asset-execution schema. It does not modify those Heads and does not inherit their eventual finality automatically.

## Frozen context

- `[M]` PoCC `8902b22c04511ac60d81f9f6e6d24d48350aa4d9`
- `[M]` AHIN `1dc061616ab16c48cfef1b165f925a2fda99db1c`
- `[M]` CAI `6048008a0e34897b172a9c3171d34ac12c692ada`
- `[M]` ChainRank `c2cf581c786eb35fc2f9ec789838db9a98e1829b`
- `[M]` Treasury vault `5Cohfz6H7vHzQpp7fEdUgtrpqzG2ff2VvZTrrCUgCzRo`, threshold `3-of-4`, on-chain configuration `VERIFIED`

Treasury governance signatures do not count as activation authorities, observer seats, ChainRank weight, PoCC finality, or merge authorization.

## State machine

```text
DISARMED
  -> SHADOW
  -> SIMULATION_ONLY
  -> PROPOSAL_ONLY
  -> CANARY_CAPPED
  -> LIMITED_LIVE
  -> BOUNDED_PRODUCTION
```

`[A]` This implementation supports validation only through `PROPOSAL_ONLY`. The current operational state remains `DISARMED` because real protocol finality, A4 finality, a transaction-specific permit, and independent release authority do not exist here.

`[D]` A transaction gate binds one exact canonical message root to one policy root, two independently controlled RPC simulation results, a finalized PoCC certificate, a closed challenge, responsibility coverage, a verified 3-of-4 treasury, a matured timelock, an unexpired transaction-specific permit, and a pre-execution re-simulation.

`[A]` There is deliberately no transaction-submit function in this repository.

```text
AUTONOMOUS_MERGE_AUTHORIZED=false
PRODUCTION_DEPLOYMENT_AUTHORIZED=false
PROTOCOL_FINALITY_PROVED=false
A4_FINALITY_PROVED=false
TRANSACTION_SUBMISSION=false
ASSET_EXECUTION_ENABLED=false
ASSET_RECOVERY_EXECUTOR=DISARMED
```

