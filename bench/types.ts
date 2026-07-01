import type { MergeModel } from "./models";

export type TestCase = {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
};

export type TestSuite = {
  id?: string;
  name: string;
  description?: string;
  system_prompt: string;
  tests: TestCase[];
};

export type RunnerConfig = {
  apiKey: string;
  baseUrl: string;
  suitePath: string;
  version: string;
  models: MergeModel[];
  runsPerModel: number;
  concurrency: number;
  timeoutSeconds: number;
  temperature: number;
  outputDirectory: string;
  useCache: boolean;
};

export type RunResult = {
  model: string;
  modelId: string;
  testIndex: number;
  runNumber: number;
  prompt: string;
  expectedAnswers: string[];
  negativeAnswers?: string[];
  text?: string;
  correct: boolean;
  reused: boolean;
  duration: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
};
