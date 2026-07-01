#!/usr/bin/env bun
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { listMergeModels } from "./merge-client";
import { findModels, skateBenchModels } from "./models";
import { findSuites, runBenchmark } from "./runner";

const DEFAULT_BASE_URL = "https://api-gateway.merge.dev/v1";

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]) {
  const args: Args = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index++;
    }
  }
  return args;
}

function value(args: Args, key: string, fallback: string) {
  const candidate = args[key];
  return typeof candidate === "string" ? candidate : fallback;
}

function numberValue(args: Args, key: string, fallback: number) {
  const candidate = Number(args[key]);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

function printHelp() {
  console.log(`Jiu Jitsu Bench

Usage:
  bun run bench
  bun run bench --models all --runs 1
  bun run bench --models gpt-5-high,claude-4.6-sonnet --runs 3
  bun run bench:list-models
  bun run bench:validate-models

Options:
  --suite <path>         Test suite JSON. Defaults to the only file in bench/tests.
  --models <selection>   Comma-separated SkateBench names, Merge model IDs, or "all".
  --runs <n>             Runs per model per test. Defaults to 1.
  --concurrency <n>      Parallel requests. Defaults to 4.
  --timeout <seconds>    Request timeout. Defaults to 120.
  --temperature <n>      Model temperature. Defaults to 0.
  --version <label>      Result version label. Defaults to today's date.
  --output <dir>         Output directory. Defaults to results.
  --no-cache             Disable per-run response cache.
  --list-models          Print configured SkateBench-parity models and exit.
  --validate-models      Check configured model IDs against GET /models and exit.

Environment:
  MERGE_API_KEY or MERGE_GATEWAY_API_KEY is required to run or validate models.
  MERGE_GATEWAY_BASE_URL can override ${DEFAULT_BASE_URL}.
`);
}

function printConfiguredModels() {
  for (const [index, model] of skateBenchModels.entries()) {
    const reasoning = model.reasoningEffort
      ? ` reasoning=${model.reasoningEffort}`
      : "";
    const note = model.note ? ` (${model.note})` : "";
    console.log(`${index + 1}. ${model.name} -> ${model.model}${reasoning}${note}`);
  }
}

function todayVersion() {
  return new Date().toISOString().slice(0, 10);
}

function extractModelIds(catalog: any) {
  const candidates = Array.isArray(catalog)
    ? catalog
    : Array.isArray(catalog?.data)
      ? catalog.data
      : Array.isArray(catalog?.models)
        ? catalog.models
        : [];

  return new Set(
    candidates
      .flatMap((entry: any) => [entry?.id, entry?.model, entry?.name])
      .filter((id: unknown): id is string => typeof id === "string")
  );
}

function selectModels(selection: string | undefined) {
  if (!selection) return undefined;
  const tokens = selection
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1 && tokens[0] === "all") return findModels("all");

  const expanded = tokens.map((token) => {
    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= skateBenchModels.length) {
      return skateBenchModels[numeric - 1].name;
    }
    return token;
  });

  return findModels(expanded.join(","));
}

async function promptIfNeeded(args: Args) {
  const suites = await findSuites();
  let suite = value(args, "suite", "");
  let models = typeof args.models === "string" ? args.models : "";

  if (!suite) {
    if (suites.length === 1) {
      suite = suites[0];
    } else if (process.stdin.isTTY) {
      const rl = createInterface({ input, output });
      console.log("Available suites:");
      suites.forEach((path, index) => console.log(`${index + 1}. ${path}`));
      const answer = await rl.question("Select suite number: ");
      rl.close();
      const index = Number(answer);
      if (!Number.isInteger(index) || index < 1 || index > suites.length) {
        throw new Error(`Invalid suite selection: ${answer}`);
      }
      suite = suites[index - 1];
    } else {
      throw new Error("Use --suite when multiple test suites exist in non-interactive mode.");
    }
  }

  if (!models) {
    if (process.stdin.isTTY) {
      const rl = createInterface({ input, output });
      console.log("Available SkateBench-parity models:");
      printConfiguredModels();
      models = await rl.question("Select models by number/name, comma-separated, or all [all]: ");
      rl.close();
      models = models.trim() || "all";
    } else {
      models = "all";
    }
  }

  return { suite, models };
}

async function validateModels(input: { apiKey: string; baseUrl: string }) {
  const catalog = await listMergeModels(input);
  const ids = extractModelIds(catalog);
  if (ids.size === 0) {
    console.log("Could not infer model IDs from the Merge catalog response.");
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  let missing = 0;
  for (const model of skateBenchModels) {
    const ok = ids.has(model.model);
    if (!ok) missing++;
    console.log(`${ok ? "ok " : "miss"} ${model.name} -> ${model.model}`);
  }

  if (missing > 0) {
    console.log(`${missing} configured model(s) were not found in the catalog.`);
  } else {
    console.log("All configured model IDs were found in the catalog.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args["list-models"]) {
    printConfiguredModels();
    return;
  }

  const baseUrl =
    value(args, "base-url", "") ||
    process.env.MERGE_GATEWAY_BASE_URL ||
    DEFAULT_BASE_URL;
  const apiKey =
    process.env.MERGE_API_KEY || process.env.MERGE_GATEWAY_API_KEY || "";

  if (args["validate-models"]) {
    if (!apiKey) {
      throw new Error("Set MERGE_API_KEY or MERGE_GATEWAY_API_KEY to validate models.");
    }
    await validateModels({ apiKey, baseUrl });
    return;
  }

  if (!apiKey) {
    throw new Error("Set MERGE_API_KEY or MERGE_GATEWAY_API_KEY to run the benchmark.");
  }

  const selected = await promptIfNeeded(args);
  const models = selectModels(selected.models) || findModels("all");

  await runBenchmark({
    apiKey,
    baseUrl,
    suitePath: selected.suite,
    version: value(args, "version", todayVersion()),
    models,
    runsPerModel: numberValue(args, "runs", 1),
    concurrency: numberValue(args, "concurrency", 4),
    timeoutSeconds: numberValue(args, "timeout", 120),
    temperature: Number(value(args, "temperature", "0")),
    outputDirectory: value(args, "output", "results"),
    useCache: !args["no-cache"]
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
