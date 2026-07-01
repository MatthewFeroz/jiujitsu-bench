import Image from "next/image";
import {
  Activity,
  BadgeCheck,
  Braces,
  Clock3,
  Database,
  GitBranch,
  Swords,
  Trophy
} from "lucide-react";
import suite from "../bench/tests/jiujitsu-terminology-situations.json";
import { skateBenchModels } from "../bench/models";

type TestCase = {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
};

type Suite = {
  name: string;
  description: string;
  tests: TestCase[];
};

const typedSuite = suite as Suite;

const providerLogos: Record<string, string> = {
  anthropic: "/assets/logos/claude.svg",
  deepseek: "/assets/logos/deepseek.svg",
  google: "/assets/logos/gemini.svg",
  minimax: "/assets/logos/minimax.svg",
  moonshot: "/assets/logos/kimi.svg",
  openai: "/assets/logos/openai.svg",
  xai: "/assets/logos/grok.svg",
  zai: "/assets/logos/glm.svg"
};

const coverage = [
  { label: "Top Pins", count: 3, color: "var(--accent-orange)" },
  { label: "Back Control", count: 1, color: "var(--accent-green)" },
  { label: "Closed / Half Guard", count: 2, color: "var(--accent-cyan)" },
  { label: "Leg Entanglement", count: 1, color: "var(--accent-red)" }
];

const sampleQuestions = typedSuite.tests.map((test, index) => ({
  id: String(index + 1).padStart(2, "0"),
  prompt: test.prompt,
  answer: test.answers[0]
}));

const modelRows = skateBenchModels.map((model) => {
  const provider = model.model.split("/")[0];
  return {
    ...model,
    provider,
    logo: providerLogos[provider] ?? null
  };
});

const providerCount = new Set(modelRows.map((model) => model.provider)).size;
const totalAcceptedAnswers = typedSuite.tests.reduce(
  (total, test) => total + test.answers.length,
  0
);
const totalNegativeAnswers = typedSuite.tests.reduce(
  (total, test) => total + (test.negative_answers?.length ?? 0),
  0
);

function Stat({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="metric">
      <Icon aria-hidden="true" size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FamilyBar({
  label,
  count,
  color
}: {
  label: string;
  count: number;
  color: string;
}) {
  const width = `${Math.max(12, (count / typedSuite.tests.length) * 100)}%`;
  return (
    <div className="coverage-row">
      <div className="coverage-label">
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <div className="coverage-track" aria-hidden="true">
        <span style={{ width, background: color }} />
      </div>
    </div>
  );
}

function ProviderMark({
  logo,
  provider
}: {
  logo: string | null;
  provider: string;
}) {
  if (!logo) {
    return <span className="provider-fallback">{provider.slice(0, 2)}</span>;
  }

  return (
    <span className="provider-logo">
      <Image src={logo} width={18} height={18} alt="" />
    </span>
  );
}

export default function Home() {
  return (
    <main className="site-shell">
      <div className="noise" />

      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Swords aria-hidden="true" size={21} />
          </span>
          <span>
            <strong>Jiu Jitsu Bench</strong>
            <em>positional terminology</em>
          </span>
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#suite">Suite</a>
          <a href="#models">Models</a>
          <a href="https://github.com/MatthewFeroz/jiujitsu-bench">GitHub</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            Merge Gateway runner online
          </p>
          <h1>
            Ranking models by Jiu Jitsu positional knowledge.
          </h1>
          <p className="hero-lede">
            A SkateBench-style benchmark where models identify core pins,
            guards, back control, and leg entanglements from concise grappling
            situations.
          </p>

          <div className="hero-actions">
            <a className="button primary" href="#suite">
              View Suite
            </a>
            <a className="button secondary" href="#models">
              Model Roster
            </a>
          </div>
        </div>

        <div className="hero-panel" aria-label="Benchmark mat map">
          <div className="panel-header">
            <span>Suite Matrix</span>
            <strong>{typedSuite.tests.length} prompts</strong>
          </div>
          <div className="mat-map">
            <span className="zone zone-a">Mount</span>
            <span className="zone zone-b">Back</span>
            <span className="zone zone-c">Guard</span>
            <span className="zone zone-d">Side</span>
            <span className="zone zone-e">Ashi</span>
            <span className="mat-line horizontal" />
            <span className="mat-line vertical" />
          </div>
          <div className="terminal-strip">
            <span>score: substring + negative answer guardrails</span>
            <span>temperature: 0</span>
          </div>
        </div>
      </section>

      <section className="metrics-band" aria-label="Benchmark statistics">
        <Stat icon={Database} label="Questions" value={`${typedSuite.tests.length}`} />
        <Stat icon={Braces} label="Accepted Answers" value={`${totalAcceptedAnswers}`} />
        <Stat icon={BadgeCheck} label="Negative Answers" value={`${totalNegativeAnswers}`} />
        <Stat icon={Trophy} label="Models" value={`${skateBenchModels.length}`} />
        <Stat icon={GitBranch} label="Providers" value={`${providerCount}`} />
        <Stat icon={Clock3} label="Runs" value="configurable" />
      </section>

      <section id="suite" className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">
            <span />
            Active suite
          </p>
          <h2>{typedSuite.name}</h2>
          <p>
            SkateBench-v1-sized and positional-only: seven foundational body
            configurations, repeated per model for stability.
          </p>
        </div>

        <div className="coverage-panel">
          <div className="panel-header">
            <span>Coverage</span>
            <strong>{typedSuite.tests.length} total</strong>
          </div>
          <div className="coverage-list">
            {coverage.map((item) => (
              <FamilyBar key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="question-bank" aria-label="Sample benchmark prompts">
        {sampleQuestions.map((question) => (
          <article className="question-row" key={question.id}>
            <span className="question-id">{question.id}</span>
            <p>{question.prompt}</p>
            <strong>{question.answer}</strong>
          </article>
        ))}
      </section>

      <section id="models" className="models-section">
        <div className="section-heading compact">
          <p className="eyebrow">
            <span />
            SkateBench parity
          </p>
          <h2>Same model roster, routed through Merge.</h2>
        </div>

        <div className="model-table">
          <div className="model-table-head">
            <span>Model</span>
            <span>Merge ID</span>
            <span>Reasoning</span>
          </div>
          {modelRows.map((model) => (
            <div className="model-row" key={model.name}>
              <span className="model-name">
                <ProviderMark logo={model.logo} provider={model.provider} />
                {model.name}
              </span>
              <span className="model-id">{model.model}</span>
              <span className="reasoning">
                {model.reasoningEffort ?? "default"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
