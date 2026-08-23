# Repository operating boundary

This repository is the separate A4 shadow implementation for `lifepp.asset-execution.v1`.

- Every claim must carry one of `[M]`, `[D]`, `[C]`, `[A]`, `[SIM]`, `[EXP]`, or `[RET]`.
- The four frozen protocol Heads are immutable inputs and must never be rewritten from this repository.
- The implementation ceiling is `PROPOSAL_ONLY`; `CANARY_CAPPED`, `LIMITED_LIVE`, and `BOUNDED_PRODUCTION` are fail-closed.
- No private key, wallet seed, voter key, transaction signature, or chain submission capability may be added.
- Codex, the current operator, Cloudflare, ahin.io, and their shared control domains may not hold treasury voter keys through this implementation.
- Automation may construct an unsigned proposal or act as an independently authorized executor only after a later A4 freeze. It may never become a voter.
- Every transaction requires an exact, expiring, transaction-specific permit. There is no global asset enable flag.
- `asset_recovery_executor` remains `DISARMED` until a separate A4 freeze authorizes it.

