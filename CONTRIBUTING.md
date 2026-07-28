# Contributing

Thank you for helping make kitchen schedules more reliable.

## Before opening an issue

1. Run `simmersync validate` on the plan.
2. Reduce the case to the smallest YAML that still reproduces the behavior.
3. Remove personal names, addresses, private recipe text, and unrelated notes.
4. Include the command, exit code, Node version, expected constraint, and actual result.

Scheduling questions need a reproducible plan. Screenshots alone are not enough to verify resource
or dependency behavior.

## Development

```bash
npm ci
npm run check
npm run benchmark
```

Add a failing test first for scheduler fixes. New output formats need escaping tests and an
acceptance check. Do not add network calls, telemetry, generated recipe corpora, or AI dependencies
without prior discussion; they conflict with the project's local-first boundary.

## Pull requests

- Keep one concern per pull request.
- Explain the user-visible behavior and algorithmic trade-off.
- Update English and Chinese user-facing docs when commands change.
- Add a changelog entry.
- Confirm `npm run check` and `npm run release:verify` where packaging changes.

By contributing, you agree that your changes are licensed under the MIT License.
