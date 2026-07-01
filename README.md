# jiujitsu-bench

A SkateBench-style benchmark for testing whether models can name Jiu Jitsu positions from short grappling situations.

The source of truth is JSON so changes are easy to review in Git. SQLite is generated from that JSON so benchmark runners and analysis tools can query terms, aliases, and relationships.

## Structure

- `data/glossary.json`: canonical glossary, aliases, relationships, and benchmark category weights.
- `schema.sql`: normalized SQLite schema and convenience views.
- `scripts/build-sqlite.mjs`: validates the glossary and builds the SQLite database.
- `database/jiujitsu-bench.sqlite`: generated SQLite database.
- `bench/tests/`: SkateBench-style benchmark suites.
- `bench/`: Merge Gateway benchmark runner and SkateBench-parity model list.

## Build The Database

```bash
bun run build:db
```

Query positional terms:

```bash
bun run query:positions
```

Or query directly:

```bash
sqlite3 database/jiujitsu-bench.sqlite "SELECT id, name, type, family FROM terms WHERE family = 'open_guard';"
```

## Benchmark Shape

The first benchmark is intentionally one-to-one with SkateBench:

```json
{
  "prompt": "The top player is sitting on the opponent's torso with both knees controlling either side of the body. What is the position?",
  "answers": ["mount", "tate-shiho-gatame", "tate shiho gatame"],
  "negative_answers": ["knee on belly", "side control", "closed guard"]
}
```

The model gets a body-configuration situation and should answer with the most specific common positional term. The active v1 suite mirrors SkateBench v1 scale with 7 foundational positions: mount, side control, knee on belly, back control, closed guard, half guard, and ashi garami. It intentionally excludes submissions for now.

## Run The Benchmark

Set your Merge Gateway key:

```bash
export MERGE_API_KEY="your_key_here"
```

List the configured SkateBench-parity models:

```bash
bun run bench:list-models
```

Validate configured model IDs against your Merge catalog:

```bash
bun run bench:validate-models
```

Run interactively:

```bash
bun run bench
```

Run selected models directly:

```bash
bun run bench --models gpt-5-high,claude-4.6-sonnet --runs 1
```

Run all configured models:

```bash
bun run bench --models all --runs 1
```

Useful options:

- `--runs 30`: SkateBench-style repeated runs per model per test.
- `--concurrency 8`: number of parallel Merge requests.
- `--version 2026-06-28`: result grouping label.
- `--temperature 0`: deterministic terminology answers by default.
- `--no-cache`: force fresh requests instead of reusing cached responses.

Results are written under `results/<suite>/<version>/` with detailed run JSON and a ranked summary JSON.

## Homepage

The project includes a SkateBench-inspired Next homepage that reads from the active positional benchmark suite and the Merge model roster.

Run it locally:

```bash
bun run dev
```

Build the deployable static site:

```bash
bun run build
```

Preview the exported site:

```bash
bun run preview --port 3000
```

The production output is written to `out/`, so it can be deployed to a static host. For platforms that run package scripts, use `bun run build` as the build command and `out` as the output directory.

## Data Model

The core tables are:

- `terms`: canonical positions, variations, controls, grips, concepts, and submissions. The active benchmark currently uses positional terms only.
- `aliases`: common names, abbreviations, and standard Japanese/Judo names where they exist.
- `relationships`: directed links such as `variation_of`, `transitions_to`, `common_control_from`, and `has_common_submission`.
- `benchmark_categories`: metadata for future grouping, currently secondary to the terminology-situation benchmark.

The glossary remains position-first because aliases, Japanese/Judo names, and position relationships are useful for generating and validating situation prompts.
