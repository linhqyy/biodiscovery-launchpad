"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  captureEvent,
  subscribeToHeroVariant,
} from "../lib/analytics";

type DiscoveryType = "screening" | "structure" | "repurposing" | "safety";
type InputType = "target" | "sequence" | "compound" | "disease" | "early";
type OutcomeType = "workflow" | "literature" | "tools" | "brief";

type PlannerState = {
  objective: string;
  discoveryType: DiscoveryType | "";
  inputType: InputType | "";
  outcome: OutcomeType | "";
};

type WorkflowStep = {
  label: string;
  description: string;
  output: string;
};

type LiteratureItem = {
  id: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  abstract: string;
  citedByCount: number;
  url: string;
};

type LiteratureState = {
  status: "idle" | "loading" | "ready" | "fallback" | "error";
  message?: string;
  results: LiteratureItem[];
};

type LeadForm = {
  email: string;
  organization: string;
  role: string;
  teamSize: string;
  timeline: string;
  useCase: string;
};

type LeadScore = {
  score: number;
  segment: string;
  reasons: string[];
  nextAction: string;
};

const discoveryOptions: Array<{
  value: DiscoveryType;
  code: string;
  title: string;
  description: string;
}> = [
  {
    value: "screening",
    code: "01",
    title: "Small-molecule screening",
    description: "Find and prioritize candidate compounds for a known target.",
  },
  {
    value: "structure",
    code: "02",
    title: "Protein structure analysis",
    description: "Retrieve, predict, and assess a protein or complex structure.",
  },
  {
    value: "repurposing",
    code: "03",
    title: "Drug repurposing",
    description: "Explore approved compounds for a new disease or pathway.",
  },
  {
    value: "safety",
    code: "04",
    title: "Safety & ADMET review",
    description: "Assess early developability and safety risks for a compound set.",
  },
];

const inputOptions: Array<{ value: InputType; title: string; detail: string }> = [
  { value: "target", title: "Protein or gene name", detail: "e.g. KRAS G12C" },
  { value: "sequence", title: "Protein sequence", detail: "FASTA or UniProt" },
  { value: "compound", title: "Compound structure", detail: "SMILES or identifier" },
  { value: "disease", title: "Disease or pathway", detail: "e.g. AML / FLT3" },
  { value: "early", title: "An early hypothesis", detail: "No structured data yet" },
];

const outcomeOptions: Array<{ value: OutcomeType; title: string; detail: string }> = [
  { value: "workflow", title: "Execution sequence", detail: "Recommended stages and outputs" },
  { value: "literature", title: "Evidence context", detail: "Research context and source links" },
  { value: "tools", title: "Tool-selection criteria", detail: "Inputs, outputs, and limitations" },
  { value: "brief", title: "Team-ready summary", detail: "A concise, printable decision brief" },
];

const workflowLibrary: Record<DiscoveryType, WorkflowStep[]> = {
  screening: [
    {
      label: "Target evidence scan",
      description: "Confirm the target, disease context, known ligands, and relevant binding evidence.",
      output: "Evidence map",
    },
    {
      label: "Structure preparation",
      description: "Retrieve or predict a target structure, then inspect binding-site readiness.",
      output: "Prepared target",
    },
    {
      label: "Library triage",
      description: "Normalize a compound set and remove unsuitable or duplicate structures.",
      output: "Screen-ready library",
    },
    {
      label: "Virtual screening",
      description: "Rank candidate binders with an appropriate docking or interaction method.",
      output: "Ranked hits",
    },
    {
      label: "ADMET & prioritization",
      description: "Flag early safety and developability risks before selecting candidates.",
      output: "Prioritized shortlist",
    },
  ],
  structure: [
    {
      label: "Sequence & evidence review",
      description: "Confirm the construct, domains, homologs, and available experimental structures.",
      output: "Validated input",
    },
    {
      label: "Method selection",
      description: "Choose retrieval, homology, or foundation-model prediction based on available evidence.",
      output: "Modeling plan",
    },
    {
      label: "Structure generation",
      description: "Generate candidate structures and preserve model provenance.",
      output: "Candidate models",
    },
    {
      label: "Confidence review",
      description: "Compare confidence, geometry, interfaces, and biologically important regions.",
      output: "Quality assessment",
    },
  ],
  repurposing: [
    {
      label: "Disease–target mapping",
      description: "Connect the disease phenotype to pathways, targets, and measurable mechanisms.",
      output: "Target landscape",
    },
    {
      label: "Approved-drug landscape",
      description: "Assemble drugs, targets, indications, and known safety information.",
      output: "Candidate universe",
    },
    {
      label: "Interaction prioritization",
      description: "Rank plausible drug–target relationships using structural and biological context.",
      output: "Ranked candidates",
    },
    {
      label: "Evidence cross-check",
      description: "Review literature, trials, contraindications, and competing hypotheses.",
      output: "Evidence-backed shortlist",
    },
  ],
  safety: [
    {
      label: "Compound normalization",
      description: "Standardize structures, resolve identifiers, and detect problematic inputs.",
      output: "Clean compound set",
    },
    {
      label: "Property profiling",
      description: "Review physicochemical properties and basic drug-likeness indicators.",
      output: "Property matrix",
    },
    {
      label: "ADMET prediction",
      description: "Estimate absorption, distribution, metabolism, excretion, and toxicity risks.",
      output: "ADMET profile",
    },
    {
      label: "Risk review",
      description: "Aggregate alerts, uncertainty, and next-step validation requirements.",
      output: "Decision brief",
    },
  ],
};

const quickPrompts = [
  "Screen small molecules against KRAS G12C",
  "Assess the structure of a protein complex",
  "Explore repurposing candidates for FLT3-ITD AML",
];

const initialPlanner: PlannerState = {
  objective: "",
  discoveryType: "",
  inputType: "",
  outcome: "",
};

const initialLeadForm: LeadForm = {
  email: "",
  organization: "",
  role: "",
  teamSize: "",
  timeline: "",
  useCase: "",
};

const stepNames = ["objective", "discovery_type", "input_type", "outcome"];

const inputGuidance: Record<InputType, string> = {
  target: "Resolve the target identifier, organism, isoform, and disease context before choosing tools.",
  sequence: "Validate sequence quality, construct boundaries, and relevant domains before modeling.",
  compound: "Normalize the supplied structure and resolve identifiers before comparison or scoring.",
  disease: "Translate the disease or pathway into testable targets and biological mechanisms first.",
  early: "Begin by turning the early hypothesis into a defined target, mechanism, and decision criterion.",
};

const outcomeGuidance: Record<OutcomeType, string> = {
  workflow: "End with an ordered, reviewable execution plan and explicit decision points.",
  literature: "Attach public evidence to each major assumption and preserve the source links.",
  tools: "Compare candidate public tools by input requirements, output, and limitations.",
  brief: "Summarize the rationale, expected outputs, uncertainties, and next decision for the team.",
};

const outcomeOutputs: Record<OutcomeType, string> = {
  workflow: "Execution plan",
  literature: "Evidence map",
  tools: "Selection criteria",
  brief: "Decision brief",
};

export default function Home() {
  const [planner, setPlanner] = useState<PlannerState>(initialPlanner);
  const [step, setStep] = useState(1);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [heroVariant, setHeroVariant] = useState<"control" | "action-oriented">(
    "control",
  );
  const [literature, setLiterature] = useState<LiteratureState>({
    status: "idle",
    results: [],
  });
  const [leadForm, setLeadForm] = useState<LeadForm>(initialLeadForm);
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null);
  const [leadStatus, setLeadStatus] = useState<
    "idle" | "submitting" | "complete" | "error"
  >("idle");
  const plannerStartedRef = useRef(false);
  const plannerRunIdRef = useRef("");
  const literatureAbortRef = useRef<AbortController | null>(null);

  const workflow = useMemo(() => {
    if (!planner.discoveryType) return [];

    const baseWorkflow = workflowLibrary[planner.discoveryType];
    return baseWorkflow.map((item, index) => {
      const isFirst = index === 0;
      const isLast = index === baseWorkflow.length - 1;

      return {
        ...item,
        description: [
          isFirst && planner.inputType
            ? inputGuidance[planner.inputType]
            : "",
          item.description,
          isLast && planner.outcome
            ? outcomeGuidance[planner.outcome]
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        output:
          isLast && planner.outcome
            ? outcomeOutputs[planner.outcome]
            : item.output,
      };
    });
  }, [planner.discoveryType, planner.inputType, planner.outcome]);

  const canContinue =
    (step === 1 && planner.objective.trim().length >= 8) ||
    (step === 2 && Boolean(planner.discoveryType)) ||
    (step === 3 && Boolean(planner.inputType)) ||
    (step === 4 && Boolean(planner.outcome));

  const currentRunId = useCallback(() => {
    if (!plannerRunIdRef.current) plannerRunIdRef.current = crypto.randomUUID();
    return plannerRunIdRef.current;
  }, []);

  const markPlannerStarted = useCallback(
    (entryPoint: "hero" | "nav" | "planner") => {
      if (plannerStartedRef.current) return;
      const captured = captureEvent("planner_started", {
        entry_point: entryPoint,
        hero_variant: heroVariant,
        planner_run_id: currentRunId(),
      });
      if (captured) plannerStartedRef.current = true;
    },
    [currentRunId, heroVariant],
  );

  useEffect(() => {
    plannerRunIdRef.current = crypto.randomUUID();
    let unsubscribe = subscribeToHeroVariant(setHeroVariant);
    const resubscribe = () => {
      unsubscribe();
      unsubscribe = subscribeToHeroVariant(setHeroVariant);
    };
    window.addEventListener("biodiscovery-analytics-consent", resubscribe);
    return () => {
      unsubscribe();
      window.removeEventListener("biodiscovery-analytics-consent", resubscribe);
    };
  }, []);

  async function loadLiterature() {
    literatureAbortRef.current?.abort();
    const controller = new AbortController();
    literatureAbortRef.current = controller;
    setLiterature({ status: "loading", results: [] });

    try {
      const response = await fetch("/api/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: planner.objective }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Literature request failed");

      const payload = (await response.json()) as {
        mode: "live" | "prototype-fallback";
        message?: string;
        results: LiteratureItem[];
      };
      if (literatureAbortRef.current !== controller) return;
      const status = payload.mode === "live" ? "ready" : "fallback";
      setLiterature({
        status,
        message: payload.message,
        results: payload.results,
      });
      captureEvent("literature_loaded", {
        mode: payload.mode,
        result_count: payload.results.length,
        discovery_type: planner.discoveryType || undefined,
        planner_run_id: currentRunId(),
      });
    } catch {
      if (controller.signal.aborted || literatureAbortRef.current !== controller) {
        return;
      }
      setLiterature({
        status: "error",
        message: "Literature could not be loaded. Your workflow is still available.",
        results: [],
      });
      captureEvent("literature_failed", {
        discovery_type: planner.discoveryType || undefined,
        planner_run_id: currentRunId(),
      });
    }
  }

  function updatePlanner<Key extends keyof PlannerState>(
    key: Key,
    value: PlannerState[Key],
  ) {
    setPlanner((current) => ({ ...current, [key]: value }));
    setShowWorkflow(false);
  }

  function updateLead<Key extends keyof LeadForm>(
    key: Key,
    value: LeadForm[Key],
  ) {
    setLeadForm((current) => ({ ...current, [key]: value }));
    setLeadScore(null);
    setLeadStatus("idle");
  }

  function nextStep() {
    if (!canContinue) return;
    captureEvent("planner_step_completed", {
      step_number: step,
      step_name: stepNames[step - 1],
      discovery_type: step >= 2 ? planner.discoveryType || undefined : undefined,
      input_type: step >= 3 ? planner.inputType || undefined : undefined,
      outcome_type: step >= 4 ? planner.outcome || undefined : undefined,
      planner_run_id: currentRunId(),
    });
    if (step < 4) {
      setStep((current) => current + 1);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".planner-step")?.focus(),
      );
      return;
    }
    setShowWorkflow(true);
    void loadLiterature();
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".workflow-result")?.focus(),
    );
    captureEvent("workflow_generated", {
      discovery_type: planner.discoveryType || undefined,
      input_type: planner.inputType || undefined,
      outcome_type: planner.outcome || undefined,
      stage_count: workflow.length,
      planner_run_id: currentRunId(),
    });
  }

  function restart() {
    setPlanner(initialPlanner);
    setStep(1);
    setShowWorkflow(false);
    setLiterature({ status: "idle", results: [] });
    setLeadForm(initialLeadForm);
    setLeadScore(null);
    setLeadStatus("idle");
    literatureAbortRef.current?.abort();
    literatureAbortRef.current = null;
    plannerStartedRef.current = false;
    plannerRunIdRef.current = crypto.randomUUID();
  }

  function scrollToPlanner(entryPoint: "hero" | "nav") {
    markPlannerStarted(entryPoint);
    document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" });
  }

  function printWorkflow() {
    captureEvent("workflow_printed", {
      discovery_type: planner.discoveryType || undefined,
      planner_run_id: currentRunId(),
    });
    window.print();
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadStatus("submitting");
    setLeadScore(null);

    try {
      const response = await fetch("/api/lead-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      const payload = (await response.json()) as LeadScore & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to score lead");

      setLeadScore(payload);
      setLeadStatus("complete");
      captureEvent("lead_submitted", {
        discovery_type: planner.discoveryType || undefined,
        score_band:
          payload.score >= 60 ? "high" : payload.score >= 35 ? "medium" : "low",
        planner_run_id: currentRunId(),
      });
    } catch {
      setLeadStatus("error");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="BioDiscovery Launchpad home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BioDiscovery</span>
          <span className="brand-light">Launchpad</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#planner" onClick={() => markPlannerStarted("nav")}>Planner</a>
          <button className="nav-cta" onClick={() => scrollToPlanner("nav")}>Build a workflow</button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> Independent portfolio prototype</div>
          <h1>From research question to <em>clear next steps.</em></h1>
          <p className="hero-lede">
            Shape an early life-science hypothesis into an explainable computational workflow—before committing time, tools, or compute.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => scrollToPlanner("hero")}>
              {heroVariant === "action-oriented" ? "Build my research plan" : "Plan your workflow"} <span aria-hidden="true">↗</span>
            </button>
            <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="trust-line">
            <span>Built for early exploration</span>
            <span>Explainable recommendations</span>
            <span>Public evidence sources</span>
          </div>
        </div>

        <div className="workflow-card" aria-label="Example discovery workflow">
          <div className="workflow-card-top">
            <div>
              <span className="micro-label">EXAMPLE WORKFLOW</span>
              <h2>KRAS G12C inhibitor screen</h2>
            </div>
            <span className="live-pill">Plan ready</span>
          </div>
          <div className="workflow-visual">
            <div className="workflow-node active">
              <span className="node-number">01</span>
              <div><strong>Evidence scan</strong><small>Target context</small></div>
              <span className="node-state">Complete</span>
            </div>
            <div className="workflow-connector" />
            <div className="workflow-node active">
              <span className="node-number">02</span>
              <div><strong>Structure prep</strong><small>Binding pocket</small></div>
              <span className="node-state">Complete</span>
            </div>
            <div className="workflow-connector" />
            <div className="workflow-node current">
              <span className="node-number">03</span>
              <div><strong>Virtual screen</strong><small>Candidate ranking</small></div>
              <span className="node-state">Next</span>
            </div>
            <div className="workflow-connector muted" />
            <div className="workflow-node">
              <span className="node-number">04</span>
              <div><strong>Safety filter</strong><small>ADMET review</small></div>
              <span className="node-state">Planned</span>
            </div>
          </div>
          <div className="workflow-card-footer">
            <div><strong>4</strong><span>stages</span></div>
            <div><strong>3</strong><span>decision points</span></div>
            <div><strong>1</strong><span>shareable brief</span></div>
          </div>
        </div>
      </section>

      <section className="principle-strip" aria-label="Product principles">
        <p>Good discovery starts with a better question.</p>
        <div className="principles">
          <span><b>01</b> Clarify intent</span>
          <span><b>02</b> Structure decisions</span>
          <span><b>03</b> Preserve evidence</span>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <span className="micro-label">HOW IT WORKS</span>
          <h2>A useful first plan—not a black box.</h2>
        </div>
        <div className="how-grid">
          <article>
            <span className="article-index">01</span>
            <h3>Describe the goal</h3>
            <p>Start with the scientific decision you need to make, even if the inputs are incomplete.</p>
          </article>
          <article>
            <span className="article-index">02</span>
            <h3>Shape the workflow</h3>
            <p>We map the goal to transparent stages, expected outputs, and practical limitations.</p>
          </article>
          <article>
            <span className="article-index">03</span>
            <h3>Take the plan forward</h3>
            <p>Use the brief to evaluate tools, align a team, and decide what evidence to collect next.</p>
          </article>
        </div>
      </section>

      <section
        className="planner-section"
        id="planner"
        onFocusCapture={() => markPlannerStarted("planner")}
        onPointerDownCapture={() => markPlannerStarted("planner")}
      >
        <div className="planner-intro">
          <span className="micro-label">WORKFLOW PLANNER / BETA</span>
          <h2>What are you trying to discover?</h2>
          <p>
            Give us the intent first. We’ll turn it into a structured starting point in four short steps.
          </p>
          <div className="planner-note">
            <span aria-hidden="true">i</span>
            <p>This prototype supports research planning only. It does not perform or validate scientific experiments.</p>
          </div>
        </div>

        <div className="planner-shell">
          {!showWorkflow ? (
            <>
              <div className="progress-header">
                <span>Step {step} of 4</span>
                <div className="progress-track" aria-label={`Step ${step} of 4`}>
                  {[1, 2, 3, 4].map((number) => (
                    <span key={number} className={number <= step ? "filled" : ""} />
                  ))}
                </div>
              </div>

              {step === 1 && (
                <div className="planner-step" tabIndex={-1}>
                  <label htmlFor="objective">Describe your research objective</label>
                  <p className="field-help">Focus on the decision or outcome, not a specific tool.</p>
                  <p className="privacy-note">Use public search terms only. When you generate a plan, this text is sent to Europe PMC for the literature preview and is not stored by this prototype.</p>
                  <textarea
                    id="objective"
                    value={planner.objective}
                    onChange={(event) => updatePlanner("objective", event.target.value)}
                    placeholder="e.g. Identify promising small-molecule inhibitors for..."
                    rows={5}
                  />
                  <div className="quick-prompts">
                    <span>Try an example</span>
                    {quickPrompts.map((prompt) => (
                      <button key={prompt} onClick={() => updatePlanner("objective", prompt)}>{prompt}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <fieldset className="planner-step" tabIndex={-1}>
                  <legend>Which discovery path fits best?</legend>
                  <p className="field-help">Choose the closest match. You can refine it later.</p>
                  <div className="option-grid discovery-options">
                    {discoveryOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={planner.discoveryType === option.value ? "option-card selected" : "option-card"}
                        onClick={() => updatePlanner("discoveryType", option.value)}
                        aria-pressed={planner.discoveryType === option.value}
                      >
                        <span className="option-code">{option.code}</span>
                        <strong>{option.title}</strong>
                        <small>{option.description}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 3 && (
                <fieldset className="planner-step" tabIndex={-1}>
                  <legend>What input do you have?</legend>
                  <p className="field-help">We’ll use this to keep the first stage practical.</p>
                  <div className="option-list">
                    {inputOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={planner.inputType === option.value ? "list-option selected" : "list-option"}
                        onClick={() => updatePlanner("inputType", option.value)}
                        aria-pressed={planner.inputType === option.value}
                      >
                        <span className="radio-dot" />
                        <strong>{option.title}</strong>
                        <small>{option.detail}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 4 && (
                <fieldset className="planner-step" tabIndex={-1}>
                  <legend>What should your report emphasize?</legend>
                  <p className="field-help">This choice changes the guidance and final output.</p>
                  <div className="option-grid outcome-options">
                    {outcomeOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={planner.outcome === option.value ? "option-card selected" : "option-card"}
                        onClick={() => updatePlanner("outcome", option.value)}
                        aria-pressed={planner.outcome === option.value}
                      >
                        <strong>{option.title}</strong>
                        <small>{option.detail}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="planner-controls">
                <button
                  className="back-button"
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                  disabled={step === 1}
                >
                  ← Back
                </button>
                <button className="continue-button" onClick={nextStep} disabled={!canContinue}>
                  {step === 4 ? "Build my workflow" : "Continue"} <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          ) : (
            <div className="workflow-result" aria-live="polite" tabIndex={-1}>
              <div className="result-header">
                <div>
                  <span className="micro-label">YOUR STARTING WORKFLOW</span>
                  <h3>{discoveryOptions.find((item) => item.value === planner.discoveryType)?.title}</h3>
                  <p>{planner.objective}</p>
                  <div className="result-context">
                    <span>Input · {inputOptions.find((item) => item.value === planner.inputType)?.title}</span>
                    <span>Emphasis · {outcomeOptions.find((item) => item.value === planner.outcome)?.title}</span>
                  </div>
                </div>
                <span className="result-count">{workflow.length} stages</span>
              </div>
              <ol className="result-steps">
                {workflow.map((item, index) => (
                  <li key={item.label}>
                    <span className="result-index">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <span className="output-tag">{item.output}</span>
                  </li>
                ))}
              </ol>

              <section className="literature-preview" aria-live="polite">
                <div className="literature-heading">
                  <div>
                    <span className="micro-label">PUBLIC EVIDENCE PREVIEW</span>
                    <h4>Related literature</h4>
                  </div>
                  {literature.status === "ready" && literature.results.length > 0 && (
                    <span className="source-status live">Live · Europe PMC</span>
                  )}
                  {literature.status === "fallback" && (
                    <span className="source-status">Fallback state</span>
                  )}
                </div>

                {literature.status === "loading" && (
                  <div className="literature-loading">
                    <span />
                    <span />
                    <span />
                    <p>Searching Europe PMC…</p>
                  </div>
                )}

                {(literature.status === "fallback" || literature.status === "error") && (
                  <div className="literature-message">
                    <strong>Live evidence is unavailable right now.</strong>
                    <p>{literature.message}</p>
                  </div>
                )}

                {literature.status === "ready" && literature.results.length === 0 && (
                  <div className="literature-message">
                    <strong>No matching publications found.</strong>
                    <p>{literature.message ?? "Try a more specific target, pathway, or disease name."}</p>
                  </div>
                )}

                {literature.results.length > 0 && (
                  <div className="literature-list">
                    {literature.results.map((item, index) => (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        key={item.id}
                        onClick={() =>
                          captureEvent("literature_result_opened", {
                            result_rank: index + 1,
                            publication_year: item.year,
                            source: "europe_pmc",
                            planner_run_id: currentRunId(),
                          })
                        }
                      >
                        <div className="literature-meta">
                          <span>{item.year}</span>
                          <span>{item.journal}</span>
                          <span>{item.citedByCount} citations</span>
                        </div>
                        <strong>{item.title}</strong>
                        <p>{item.abstract}</p>
                        <small>{item.authors}</small>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <div className="result-actions">
                <button className="continue-button" onClick={printWorkflow}>Print workflow</button>
                <button className="back-button" onClick={restart}>Plan another</button>
              </div>
              <p className="result-disclaimer">
                Planning aid only. Recommendations require review by qualified scientific professionals.
              </p>

              <section className="lead-capture">
                <div className="lead-capture-copy">
                  <span className="micro-label">GROWTH AUTOMATION DEMO</span>
                  <h4>See how this inquiry would be routed.</h4>
                  <p>
                    Submit a prototype inquiry to run transparent, rules-based lead qualification. Nothing is stored, emailed, or sent to a sales team.
                  </p>
                </div>

                <form onSubmit={submitLead}>
                  <label>
                    Work email
                    <input
                      type="email"
                      required
                      value={leadForm.email}
                      onChange={(event) => updateLead("email", event.target.value)}
                      placeholder="you@organization.org"
                    />
                  </label>
                  <label>
                    Organization
                    <input
                      required
                      value={leadForm.organization}
                      onChange={(event) => updateLead("organization", event.target.value)}
                      placeholder="Research institute or company"
                    />
                  </label>
                  <label>
                    Role
                    <input
                      required
                      value={leadForm.role}
                      onChange={(event) => updateLead("role", event.target.value)}
                      placeholder="e.g. Computational scientist"
                    />
                  </label>
                  <div className="lead-form-row">
                    <label>
                      Team size
                      <select
                        required
                        value={leadForm.teamSize}
                        onChange={(event) => updateLead("teamSize", event.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="1">Just me</option>
                        <option value="2-4">2–4</option>
                        <option value="5-20">5–20</option>
                        <option value="21+">21+</option>
                      </select>
                    </label>
                    <label>
                      Timeline
                      <select
                        required
                        value={leadForm.timeline}
                        onChange={(event) => updateLead("timeline", event.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="now">Now</option>
                        <option value="quarter">This quarter</option>
                        <option value="later">Later / exploring</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Intended use
                    <textarea
                      required
                      minLength={24}
                      rows={3}
                      value={leadForm.useCase}
                      onChange={(event) => updateLead("useCase", event.target.value)}
                      placeholder="Briefly describe what your team wants to decide or test…"
                    />
                  </label>
                  <button className="continue-button" disabled={leadStatus === "submitting"}>
                    {leadStatus === "submitting" ? "Scoring…" : "Score prototype inquiry"}
                  </button>
                  {leadStatus === "error" && (
                    <p className="form-error">The prototype could not score this inquiry. Check the fields and try again.</p>
                  )}
                </form>

                {leadScore && (
                  <div className="lead-score-result" aria-live="polite">
                    <div><span>Prototype score</span><strong>{leadScore.score}<small>/100</small></strong></div>
                    <div><span>Suggested route</span><strong>{leadScore.segment}</strong></div>
                    <p>{leadScore.nextAction}</p>
                    <ul>{leadScore.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BioDiscovery Launchpad</span>
        </div>
        <p>Independent portfolio project · Built for transparent scientific planning</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
