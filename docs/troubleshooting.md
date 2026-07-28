# Troubleshooting and repair loop

## Exit codes

| Code | Meaning | First action |
| --- | --- | --- |
| `0` | Valid plan or successful schedule | Open the generated Cook Mode |
| `1` | Unexpected runtime or filesystem error | Check the printed path and permissions, then rerun |
| `2` | Invalid plan or CLI arguments | Fix every printed `path: message` item |
| `3` | No feasible schedule inside the horizon | Apply one of the printed capacity or timing fixes |

## Validation failure

Run:

```bash
simmersync validate plan.yaml
```

Fix all reported paths, then rerun validation until it prints `VALID`. Common causes are duplicate
step ids, a misspelled resource, an unknown `after` reference, and a dependency cycle.

## Schedule conflict

Use this repair order:

1. Confirm passive steps do not incorrectly consume `cook`.
2. Confirm a resource is occupied for the whole stated duration. Split a step when attention is
   only needed at its beginning or end.
3. Increase the real capacity, such as `oven: { capacity: 2 }`, only when the kitchen truly has it.
4. Raise `defaults.horizonMinutes` or pass `--horizon` so prep can begin earlier.
5. Move cold or make-ahead dishes earlier with a negative `serveOffset`.
6. Rerun the same command. SimmerSync is deterministic, so unchanged input will not produce a
   mysteriously different answer.

## Long-hold warning

The schedule is valid, but a dish becomes ready more than `maxHold` minutes early. Reduce another
dish's final active work, change dish `maxHold` values to reflect priorities, add a second cook when
true, or make the early dish's `serveOffset` explicit.

## Release verification failure

Run the gates separately to locate the first failure:

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run coverage
npm run build
npm run acceptance
npm run release:build
npm run release:verify
```

Do not tag or publish a release until every command exits zero. If a generated checksum differs,
delete `release/`, rebuild it, and verify again; never edit an asset after `SHA256SUMS` is created.
