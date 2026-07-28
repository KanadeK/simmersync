# Scheduling algorithm

SimmerSync treats a meal as a directed acyclic graph of steps plus renewable resources.

## Model

- Every dish is an ordered chain. A step implicitly depends on the previous step.
- `after` adds cross-dish or additional same-dish dependencies.
- Every step has an integer duration in minutes.
- A resource has a capacity. A step can consume one or more units for its full duration.
- An `active` step automatically consumes one unit of `defaults.attentionResource` when configured.
- The last step of a dish has a deadline equal to the target serve time plus `serveOffset`.

## Latest-fit scheduling

1. Validate ids, references, resource demands, ranges, and timezone.
2. Build the dependency graph and reject cycles.
3. Start at the target serve time and work backwards.
4. Among steps whose successors are already placed, prefer the latest deadline.
5. For equal deadlines, prefer the dish with the smallest `maxHold`, then the longer step, then
   stable input order.
6. Search backwards minute by minute for the latest interval where every resource remains within
   capacity.
7. Reserve that interval and repeat until every step is placed.
8. Recheck dependencies, dish deadlines, resource peaks, hold times, and warnings in acceptance
   tests.

This is a deterministic serial schedule-generation heuristic. It always emits a capacity-safe
schedule when it finds one, but it is not an exact optimizer and can reject a plan that a more
expensive global solver might fit. That trade-off keeps the engine fast, transparent, dependency
free, and easy to debug.

For `T` tasks, horizon `H`, and average resource count `R`, the conservative worst case is roughly
`O(T² + T × H × R)`. The included benchmark schedules 200 steps ten times and enforces a generous
2.5-second ceiling on CI-grade hardware.

## Interpreting output

- `startOffset` and `endOffset` are integer minutes relative to service; `-15` means 15 minutes
  before serving.
- `dependencySlack` is how far a step was moved earlier than its requested latest finish because
  of resource contention.
- `holdMinutes` is the gap between a dish becoming ready and its desired time.
- Resource utilization is used unit-minutes divided by capacity multiplied by the total schedule
  span. It is a diagnostic, not a guarantee of where the bottleneck occurs.
