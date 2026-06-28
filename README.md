# jiujitsu-bench

A position-first benchmark scaffold for testing model reasoning about Jiu Jitsu.

The source of truth is JSON so changes are easy to review in Git. SQLite is generated from that JSON so benchmark runners and analysis tools can query terms, aliases, and relationships.

## Structure

- `data/glossary.json`: canonical glossary, aliases, relationships, and benchmark category weights.
- `schema.sql`: normalized SQLite schema and convenience views.
- `scripts/build-sqlite.mjs`: validates the glossary and builds the SQLite database.
- `database/jiujitsu-bench.sqlite`: generated SQLite database.
- `bench/tests/`: SkateBench-style seed benchmark suites.

## Build The Database

```bash
npm run build:db
```

Query common submissions by position:

```bash
npm run query:submissions
```

Or query directly:

```bash
sqlite3 database/jiujitsu-bench.sqlite "SELECT * FROM position_submissions WHERE position_id = 'k_guard';"
```

## Data Model

The core tables are:

- `terms`: canonical positions, variations, controls, grips, concepts, and submissions.
- `aliases`: common names, abbreviations, and standard Japanese/Judo names where they exist.
- `relationships`: directed links such as `variation_of`, `transitions_to`, `common_control_from`, and `has_common_submission`.
- `benchmark_categories`: initial benchmark weights for move knowledge, history, and positional submission reasoning.

The benchmark is intentionally position-first: positions and variations connect to controls, transitions, and plausible submissions.
