import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { createMergeResponse } from "./merge-client";
import type { RunResult, RunnerConfig, TestSuite } from "./types";

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFilename(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hash(input: unknown) {
  return createHash("sha1").update(JSON.stringify(input)).digest("hex").slice(0, 12);
}

function isCorrect(input: {
  answers: string[];
  negativeAnswers?: string[];
  text: string;
}) {
  const lower = input.text.toLowerCase();
  if (
    input.negativeAnswers?.some((answer) =>
      lower.includes(answer.toLowerCase())
    )
  ) {
    return false;
  }
  return input.answers.some((answer) => lower.includes(answer.toLowerCase()));
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function suiteId(suite: TestSuite, suitePath: string) {
  return suite.id || slug(basename(suitePath, extname(suitePath)) || suite.name);
}

function cachePath(input: {
  outputDirectory: string;
  suiteId: string;
  version: string;
  modelName: string;
  signatureHash: string;
  runNumber: number;
}) {
  return join(
    input.outputDirectory,
    "cache",
    input.suiteId,
    input.version,
    `${safeFilename(input.modelName)}__run${input.runNumber}__${input.signatureHash}.json`
  );
}

async function readCache(path: string): Promise<RunResult | undefined> {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, "utf8")) as RunResult;
  } catch {
    return undefined;
  }
}

async function writeCache(path: string, result: RunResult) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(result, null, 2), "utf8");
}

async function writeRunOutputs(input: {
  config: RunnerConfig;
  suite: TestSuite;
  suiteId: string;
  results: RunResult[];
}) {
  const { config, suite, results } = input;
  const outputDir = join(config.outputDirectory, input.suiteId, config.version);
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const correct = results.filter((result) => !result.error && result.correct).length;
  const incorrect = results.filter((result) => !result.error && !result.correct).length;
  const errors = results.filter((result) => result.error).length;

  const metadata = {
    timestamp: new Date().toISOString(),
    testSuite: suite.name,
    suiteId: input.suiteId,
    version: config.version,
    totalTests: results.length,
    correct,
    incorrect,
    errors,
    successful: correct,
    failed: incorrect + errors,
    models: config.models.map((model) => model.name),
    config: {
      provider: "merge-gateway",
      baseUrl: config.baseUrl,
      runsPerModel: config.runsPerModel,
      concurrency: config.concurrency,
      timeoutSeconds: config.timeoutSeconds,
      temperature: config.temperature,
      useCache: config.useCache
    }
  };

  const detailPath = join(outputDir, `test-results-${timestamp}.json`);
  await writeFile(
    detailPath,
    JSON.stringify({ metadata, results }, null, 2),
    "utf8"
  );

  const statsByModel = new Map<
    string,
    {
      modelId: string;
      correct: number;
      incorrect: number;
      errors: number;
      totalDuration: number;
      totalTests: number;
      totalCost: number;
      inputTokens: number;
      outputTokens: number;
    }
  >();

  for (const result of results) {
    const stats =
      statsByModel.get(result.model) ||
      {
        modelId: result.modelId,
        correct: 0,
        incorrect: 0,
        errors: 0,
        totalDuration: 0,
        totalTests: 0,
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0
      };
    stats.totalTests++;
    stats.totalDuration += result.duration;
    stats.totalCost += result.cost;
    stats.inputTokens += result.inputTokens;
    stats.outputTokens += result.outputTokens;
    if (result.error) stats.errors++;
    else if (result.correct) stats.correct++;
    else stats.incorrect++;
    statsByModel.set(result.model, stats);
  }

  const rankings = Array.from(statsByModel.entries())
    .map(([model, stats]) => ({
      model,
      modelId: stats.modelId,
      correct: stats.correct,
      incorrect: stats.incorrect,
      errors: stats.errors,
      totalTests: stats.totalTests,
      successRate:
        stats.totalTests > 0 ? (stats.correct / stats.totalTests) * 100 : 0,
      errorRate:
        stats.totalTests > 0 ? (stats.errors / stats.totalTests) * 100 : 0,
      averageDuration:
        stats.totalTests > 0
          ? Math.round(stats.totalDuration / stats.totalTests)
          : 0,
      totalCost: stats.totalCost,
      averageCostPerTest:
        stats.totalTests > 0 ? stats.totalCost / stats.totalTests : 0,
      totalInputTokens: stats.inputTokens,
      totalOutputTokens: stats.outputTokens,
      tokensPerSecond:
        stats.totalDuration > 0
          ? stats.outputTokens / (stats.totalDuration / 1000)
          : 0
    }))
    .sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return a.averageDuration - b.averageDuration;
    });

  const summary = {
    rankings,
    metadata: {
      ...metadata,
      totalModels: rankings.length,
      totalTestsRun: results.length,
      overallCorrect: correct,
      overallIncorrect: incorrect,
      overallErrors: errors,
      overallSuccessRate:
        results.length > 0 ? (correct / results.length) * 100 : 0,
      overallErrorRate:
        results.length > 0 ? (errors / results.length) * 100 : 0,
      totalCost: results.reduce((sum, result) => sum + result.cost, 0),
      averageCostPerTest:
        results.length > 0
          ? results.reduce((sum, result) => sum + result.cost, 0) / results.length
          : 0
    }
  };

  const summaryPath = join(outputDir, `summary-${timestamp}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return { detailPath, summaryPath, summary };
}

export async function findSuites(testsDirectory = "bench/tests") {
  const entries = await readdir(testsDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(testsDirectory, entry.name));
}

export async function runBenchmark(config: RunnerConfig) {
  const suite = await readJson<TestSuite>(config.suitePath);
  const id = suiteId(suite, config.suitePath);
  const jobs = suite.tests.flatMap((test, testIndex) =>
    config.models.flatMap((model) =>
      Array.from({ length: config.runsPerModel }, (_, index) => ({
        model,
        test,
        testIndex,
        runNumber: index + 1
      }))
    )
  );

  console.log(
    `Running ${jobs.length} jobs: ${suite.tests.length} tests x ${config.models.length} models x ${config.runsPerModel} run(s)`
  );

  const results: RunResult[] = [];
  let cursor = 0;

  async function worker(workerId: number) {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const signature = {
        provider: "merge-gateway",
        model: job.model,
        system: suite.system_prompt,
        prompt: job.test.prompt,
        answers: job.test.answers,
        negativeAnswers: job.test.negative_answers,
        version: config.version
      };
      const signatureHash = hash(signature);
      const cacheFile = cachePath({
        outputDirectory: config.outputDirectory,
        suiteId: id,
        version: config.version,
        modelName: job.model.name,
        signatureHash,
        runNumber: job.runNumber
      });

      if (config.useCache) {
        const cached = await readCache(cacheFile);
        if (cached) {
          results.push({ ...cached, reused: true });
          console.log(
            `[${workerId}] reused ${job.model.name} test ${job.testIndex + 1}.${job.runNumber}`
          );
          continue;
        }
      }

      const start = Date.now();
      try {
        const response = await createMergeResponse({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: job.model,
          system: suite.system_prompt,
          prompt: job.test.prompt,
          timeoutSeconds: config.timeoutSeconds,
          temperature: config.temperature
        });
        const duration = Date.now() - start;
        const correct = isCorrect({
          answers: job.test.answers,
          negativeAnswers: job.test.negative_answers,
          text: response.text
        });
        const result: RunResult = {
          model: job.model.name,
          modelId: job.model.model,
          testIndex: job.testIndex,
          runNumber: job.runNumber,
          prompt: job.test.prompt,
          expectedAnswers: job.test.answers,
          negativeAnswers: job.test.negative_answers,
          text: response.text,
          correct,
          reused: false,
          duration,
          cost: response.cost,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens
        };
        results.push(result);
        if (config.useCache) await writeCache(cacheFile, result);
        console.log(
          `[${workerId}] ${correct ? "ok" : "miss"} ${job.model.name} test ${job.testIndex + 1}.${job.runNumber} ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - start;
        const result: RunResult = {
          model: job.model.name,
          modelId: job.model.model,
          testIndex: job.testIndex,
          runNumber: job.runNumber,
          prompt: job.test.prompt,
          expectedAnswers: job.test.answers,
          negativeAnswers: job.test.negative_answers,
          correct: false,
          reused: false,
          duration,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          error: error instanceof Error ? error.message : String(error)
        };
        results.push(result);
        console.log(
          `[${workerId}] error ${job.model.name} test ${job.testIndex + 1}.${job.runNumber}: ${result.error}`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, jobs.length) }, (_, index) =>
      worker(index + 1)
    )
  );

  const output = await writeRunOutputs({
    config,
    suite,
    suiteId: id,
    results
  });

  console.log(`Results: ${output.detailPath}`);
  console.log(`Summary: ${output.summaryPath}`);
  return output;
}
