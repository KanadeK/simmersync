# Landscape and project rationale

Research date: 2026-07-28

## What was checked

The project was selected after reviewing the owner's existing public repositories and earlier
project discussions, then searching current open-source recipe and meal-planning projects. The
existing portfolio is heavily weighted toward developer tooling, repository analysis, agent
workflows, image utilities, simulation, and Minecraft. No prior cooking scheduler or
multi-dish kitchen project was found.

Current public signals:

| Project or signal | What it already does | Gap relevant to SimmerSync |
| --- | --- | --- |
| [Cooklang](https://cooklang.org/) | Portable, local-first recipe markup with ingredients, cookware, and timers | Timers live inside individual recipes; there is no resource-capacity scheduler for several dishes |
| [Mealie](https://github.com/mealie-recipes/mealie) | Mature self-hosted recipe manager, meal planner, and shopping list | It is a server application rather than a small scheduling engine |
| [Mealie discussion #7099](https://github.com/mealie-recipes/mealie/discussions/7099) | A 2026 request explicitly asks for merged multi-recipe ingredients, interleaved active/passive steps, and ready-by scheduling | The request demonstrates current user demand for the exact coordination layer |
| [RecipeSage](https://recipesage.com/) | Open-source recipe keeper, planner, and shopping list | Focuses on recipe ownership and weekly planning, not execution-time resource conflicts |
| Generic multi-timers | Run several named countdowns | Do not infer start times, dependency order, or conflicts between one cook, burners, and oven shelves |

The conclusion is deliberately narrow: open source has excellent recipe storage and excellent
timers, but a small reusable engine for turning several dishes into one capacity-safe,
backward-planned service timeline is still a credible gap. SimmerSync does not claim that no
related experiment exists.

## Why this direction can earn attention

- The result is visible in one screenshot: four dishes converge on one serve line.
- The problem is understandable outside software engineering.
- Holiday meals, dinner parties, batch cooking, and small catering create recurring use cases.
- A single YAML file and generated offline HTML keep the first-run cost low.
- The core can later plug into Cooklang, Mealie, Home Assistant, or mobile shells without becoming
  another recipe database.
- Deterministic output makes examples, bug reports, and contributions reproducible.

Stars cannot be guaranteed. Discoverability depends on a clear demonstration, useful integrations,
and ongoing maintenance. The repository therefore ships a working demo bundle, bilingual
documentation, shareable visuals, and a focused roadmap instead of speculative breadth.

## Explicit non-goals

- Scraping recipes or republishing copyrighted recipe text
- AI-generated cooking instructions
- Nutrition or food-safety advice
- Accounts, cloud sync, telemetry, or a hosted recipe database
- Claiming globally optimal scheduling; v0.1 uses a documented deterministic heuristic
