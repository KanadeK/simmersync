import type { PlanInput } from "../src/types.js";

export function simplePlan(): PlanInput {
  return {
    version: 1,
    title: "Test dinner",
    timezone: "UTC",
    resources: {
      cook: { capacity: 1, label: "Cook" },
      oven: { capacity: 1, label: "Oven" },
    },
    defaults: {
      attentionResource: "cook",
      horizonMinutes: 180,
    },
    dishes: [
      {
        id: "main",
        name: "Main dish",
        maxHold: 20,
        steps: [
          {
            id: "prep",
            name: "Prep",
            duration: 10,
            mode: "active",
          },
          {
            id: "bake",
            name: "Bake",
            duration: 30,
            mode: "passive",
            resources: { oven: 1 },
          },
          {
            id: "plate",
            name: "Plate",
            duration: 5,
            mode: "active",
          },
        ],
      },
      {
        id: "side",
        name: "Side dish",
        maxHold: 20,
        steps: [
          {
            id: "chop",
            name: "Chop",
            duration: 8,
            mode: "active",
          },
          {
            id: "roast",
            name: "Roast",
            duration: 20,
            mode: "passive",
            resources: { oven: 1 },
          },
        ],
      },
    ],
  };
}
