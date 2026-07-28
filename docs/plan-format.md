# Plan format

Plans may be YAML or JSON and must declare `version: 1`.

```yaml
version: 1
title: Dinner for four
timezone: Europe/London

resources:
  cook: { capacity: 1, label: Cook attention }
  oven: { capacity: 2, label: Oven shelves }
  burner: { capacity: 2, label: Hob burners }

defaults:
  attentionResource: cook
  horizonMinutes: 240

dishes:
  - id: roast
    name: Roast chicken
    maxHold: 20
    steps:
      - id: season
        name: Season the chicken
        duration: 10
        mode: active
      - id: bake
        name: Roast
        duration: 55
        mode: passive
        resources: { oven: 1 }
```

The canonical JSON Schema is
[`schema/simmersync.schema.json`](../schema/simmersync.schema.json).

## Resources

Resources model anything that cannot be used without limit:

- `cook` for focused human attention
- `oven` for shelves or zones
- `burner` for hob rings
- `counter` for prep areas
- appliances such as `blender`, `rice-cooker`, or `mixer`

Capacity is an integer from 1 to 16. A step's demand is held for the entire step, so do not assign
an oven to cooling or a cook to unattended simmering.

## Steps

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Lowercase local id using numbers and hyphens |
| `name` | yes | Human-readable instruction |
| `duration` | yes | Integer minutes from 1 to 1440 |
| `mode` | yes | `active` or `passive` |
| `resources` | no | Resource id to demanded units |
| `after` | no | Extra dependencies |
| `notes` | no | Short instruction carried into every output |

Steps in a dish are already sequential. Use a local id in `after` for the same dish, or
`dish-id.step-id` for another dish:

```yaml
after:
  - roast-chicken.roast
```

## Dish timing

- `serveOffset: -10` asks for the dish ten minutes before the main target.
- `maxHold` is a freshness warning threshold and a scheduling priority. It is not a hard
  constraint in v0.1.
- A six-digit `color` is optional; SimmerSync assigns a deterministic palette when omitted.
