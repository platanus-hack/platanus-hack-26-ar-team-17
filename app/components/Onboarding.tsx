"use client";

import React, { useEffect, useRef, useState } from "react";

/* ----------------------------- live status ticker ------------------------- */

type TickerLine = { id: number; ts: string; msg: string };

const STEP_LOG: Record<string, string> = {
  welcome:  "session.init       handshake ok · tls 1.3",
  email:    "auth.handle        awaiting input",
  phone:    "sms.gateway        ready · 200 OK",
  document: "doc.tee            secure enclave attached",
  face:     "biometric.engine   liveness model loaded",
  agent:    "agent.kms          ed25519 keypair generated",
  verified: "identity.attest    token issued · welcome",
};

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const Ticker = ({ lines }: { lines: TickerLine[] }) => (
  <div className="ticker">
    <div className="ticker-head">
      <span>zero · live status</span>
      <span className="live">live</span>
    </div>
    {lines.slice(-3).map((l) => (
      <div key={l.id} className="ticker-line fade">
        <span className="ts">{l.ts}</span>
        <span className="arrow">›</span>
        <span>{l.msg}</span>
      </div>
    ))}
    <div className="ticker-line">
      <span className="ts">--:--:--</span>
      <span className="arrow">›</span>
      <span><span className="caret"></span></span>
    </div>
  </div>
);

/* ------------------------------ logo + icons ------------------------------ */

const ZeroLogo = ({ size = 40 }: { size?: number; accent?: string }) => (
  <span
    aria-label="zero"
    style={{
      fontSize: size,
      lineHeight: 1,
      letterSpacing: "-0.04em",
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "baseline",
    }}
  >
    <span style={{ color: "rgba(255,255,255,0.9)" }}>zero</span>
    <span style={{ color: "#a3e635" }}>.</span>
  </span>
);

/* ---------------------------------- steps --------------------------------- */

const STEPS = [
  { id: "welcome", num: "00", label: "Identity" },
  { id: "email", num: "01", label: "Account" },
  { id: "phone", num: "02", label: "Phone" },
  { id: "document", num: "03", label: "Document" },
  { id: "face", num: "04", label: "Liveness" },
  { id: "agent", num: "05", label: "Bind agent" },
  { id: "verified", num: "06", label: "Verified" },
] as const;

type FormState = {
  email: string;
  handle: string;
  password: string;
  country: string;
  phone: string;
  docType: string;
  agentName: string;
  scopes: string[];
};

/* ---------------------------------- left ---------------------------------- */

const StepRail = ({ stepIdx }: { stepIdx: number }) => (
  <div className="steps">
    {STEPS.map((s, i) => (
      <div
        key={s.id}
        className={`step-row ${i === stepIdx ? "active" : i < stepIdx ? "done" : ""}`}
      >
        <span className="step-dot"></span>
        <span className="step-num">{s.num}</span>
        <span>{s.label}</span>
      </div>
    ))}
  </div>
);

const LeftPane = ({ stepIdx, accent }: { stepIdx: number; accent: string }) => (
  <div className="left-pane">
    <div className="brand-block">
      <ZeroLogo size={48} accent={accent} />
      <div className="tagline">
        The identity layer
        <br />
        for the agentic internet.
      </div>
      <div className="tagline-rule"></div>
      <StepRail stepIdx={stepIdx} />
    </div>
    <div className="foot">
      <span><span className="foot-dot"></span>SECURE SESSION · TLS 1.3</span>
      <span>v0.4.2-canary</span>
    </div>
  </div>
);

/* --------------------------------- screens -------------------------------- */

const WelcomeScreen = ({ onNext }: { onNext: () => void }) => {
  const [choice, setChoice] = useState("personal");
  const opts: { id: string; code: string; title: string }[] = [
    { id: "personal", code: "0x01", title: "personal" },
    { id: "team",     code: "0x02", title: "team" },
    { id: "machine",  code: "0x03", title: "machine" },
  ];
  return (
    <div className="card framed fade-enter">
      <span className="card-corner tl" />
      <span className="card-corner tr" />
      <span className="card-corner bl" />
      <span className="card-corner br" />
      <div className="card-stamp">REC · IDENT-CLASS</div>

      <h1 className="card-title">Create your zero identity</h1>

      <div className="welcome-options">
        {opts.map((o) => (
          <button
            key={o.id}
            className={`welcome-option ${choice === o.id ? "active" : ""}`}
            onClick={() => setChoice(o.id)}
          >
            <span className="welcome-option-code">{o.code}</span>
            <div className="welcome-option-body">
              <div className="welcome-option-title">{o.title}</div>
            </div>
            <div style={{ color: "var(--accent)", fontFamily: "var(--font-mono), monospace", fontSize: 11 }}>
              {choice === o.id ? "selected" : ""}
            </div>
          </button>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext}>
        Continue      </button>
    </div>
  );
};

type ScreenProps = {
  onNext: () => void;
  onBack: () => void;
  state: FormState;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
};

const EmailScreen = ({ onNext, onBack, state, setState }: ScreenProps) => {
  const valid = /\S+@\S+\.\S+/.test(state.email) && state.password.length >= 8;
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email, password: state.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error === "email_taken" ? "That email is already registered." : "Registration failed.");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("zero_token", data.token);
        localStorage.setItem("zero_user_id", data.userId);
      }
      onNext();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card fade-enter">
      <h1 className="card-title">Claim your handle</h1>

      <div className="field">
        <div className="field-label"><span>Email</span></div>
        <input
          type="email"
          value={state.email}
          onChange={(e) => setState({ ...state, email: e.target.value })}
          placeholder="you@domain.com"
        />
      </div>

      <div className="field">
        <div className="field-label"><span>Handle</span><span>{state.handle.length}/24</span></div>
        <input
          value={state.handle}
          onChange={(e) =>
            setState({ ...state, handle: e.target.value.replace(/[^a-z0-9_]/g, "").slice(0, 24) })
          }
          placeholder="ada.lovelace"
        />
        <div className="field-hint">→ {state.handle || "your-handle"}.zero</div>
      </div>

      <div className="field">
        <div className="field-label">Password</div>
        <input
          type="password"
          value={state.password}
          onChange={(e) => setState({ ...state, password: e.target.value })}
          placeholder="min 8 characters"
        />
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{err}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={!valid || submitting}>
        {submitting ? "Creating…" : "Continue"}
      </button>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
};

const PhoneScreen = ({ onNext, onBack, state, setState }: ScreenProps) => {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const filled = code.every((c) => c.length === 1);

  const setDigit = (i: number, v: string) => {
    v = v.replace(/[^0-9]/g, "").slice(-1);
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="card fade-enter">
      <h1 className="card-title">{sent ? "Enter your code" : "Verify your phone"}</h1>

      {!sent ? (
        <>
          <div className="field">
            <div className="field-label">Phone</div>
            <div className="row">
              <select
                value={state.country}
                onChange={(e) => setState({ ...state, country: e.target.value })}
                style={{ flex: "0 0 110px" }}
              >
                <option>+1 US</option>
                <option>+44 UK</option>
                <option>+33 FR</option>
                <option>+49 DE</option>
                <option>+81 JP</option>
              </select>
              <input
                value={state.phone}
                onChange={(e) => setState({ ...state, phone: e.target.value })}
                placeholder="(555) 010-0182"
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setSent(true)} disabled={!state.phone}>
            Send code          </button>
        </>
      ) : (
        <>
          <div className="otp">
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={c}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !c && i > 0) refs.current[i - 1]?.focus();
                }}
                maxLength={1}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={onNext} disabled={!filled} style={{ marginTop: 18 }}>
            Verify          </button>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
};

const DocumentScreen = ({ onNext, onBack, state, setState }: ScreenProps) => {
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const ready = front && back;

  return (
    <div className="card fade-enter">
      <h1 className="card-title">Upload your ID</h1>

      <div className="chip-row" style={{ marginTop: 18 }}>
        {["Passport", "Driver license", "National ID", "Residence permit"].map((d) => (
          <div
            key={d}
            className={`chip ${state.docType === d ? "active" : ""}`}
            onClick={() => setState({ ...state, docType: d })}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="upload-grid">
        <button className={`upload-tile ${front ? "uploaded" : ""}`} onClick={() => setFront(true)}>
          <div className="upload-label">{front ? "front_id.jpg" : "Front"}</div>
        </button>
        <button className={`upload-tile ${back ? "uploaded" : ""}`} onClick={() => setBack(true)}>
          <div className="upload-label">{back ? "back_id.jpg" : "Back"}</div>
        </button>
      </div>

      <button className="btn btn-primary" onClick={onNext} disabled={!ready}>
        Continue      </button>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
};

const FaceScreen = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => {
  const [phase, setPhase] = useState(0);
  const [step, setStep] = useState(-1);
  const checks = [
    "Center your face in the frame",
    "Turn slowly to your left",
    "Turn slowly to your right",
    "Smile to confirm liveness",
  ];

  useEffect(() => {
    if (phase !== 1) return;
    let i = 0;
    setStep(0);
    const t = setInterval(() => {
      i++;
      if (i >= checks.length) {
        clearInterval(t);
        setPhase(2);
        setStep(checks.length);
      } else {
        setStep(i);
      }
    }, 900);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div className="card fade-enter">
      <h1 className="card-title">Face verification</h1>

      <div className="liveness">
        <div className="liveness-frame">
          <div className="liveness-face">🧑‍🦱</div>
          {phase === 1 && <div className="liveness-scanline"></div>}
        </div>
        {phase >= 1 && <div className={`liveness-ring ${phase === 2 ? "complete" : ""}`}></div>}
      </div>

      <div className="liveness-status">
        {phase === 1 && (<span className="label">{checks[step] || "…"}</span>)}
        {phase === 2 && (<span className="label">✓ Liveness confirmed</span>)}
      </div>

      <ul className="checks">
        {checks.map((c, i) => (
          <li key={c} className={step > i || phase === 2 ? "done" : step === i ? "active" : ""}>
            <span className="check-icon">{step > i || phase === 2 ? "✓" : ""}</span>
            {c}
          </li>
        ))}
      </ul>

      {phase === 0 && (
        <button className="btn btn-primary" onClick={() => setPhase(1)}>
          Start scan
        </button>
      )}
      {phase === 1 && (
        <button className="btn btn-ghost" disabled>
          <span style={{ opacity: 0.6 }}>Scanning…</span>
        </button>
      )}
      {phase === 2 && (
        <button className="btn btn-primary" onClick={onNext}>
          Continue        </button>
      )}

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
};

const AGENT_SCOPES = [
  "send_message",
  "read_messages",
  "create_post",
  "delete_post",
  "read_profile",
  "update_profile",
];

const AgentScreen = ({ onNext, onBack, state, setState }: ScreenProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("zero_token") : null;
      if (!token) {
        setErr("Session expired. Please restart.");
        return;
      }
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: state.agentName, scope: state.scopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to create key.");
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("zero_api_key", data.plainKey);
        localStorage.setItem("zero_api_key_id", data.id);
        localStorage.setItem("zero_api_key_prefix", data.prefix);
      }
      onNext();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card fade-enter">
      <h1 className="card-title">Bind your first agent</h1>

      <div className="field">
        <div className="field-label">Agent name</div>
        <input
          value={state.agentName}
          onChange={(e) => setState({ ...state, agentName: e.target.value })}
          placeholder="research-runner-01"
        />
        <div className="field-hint">
          → {state.handle || "your-handle"}.{state.agentName || "agent-name"}.zero
        </div>
      </div>

      <div className="field">
        <div className="field-label">Capabilities</div>
        <div className="chip-row" style={{ marginBottom: 0 }}>
          {AGENT_SCOPES.map((s) => (
            <div
              key={s}
              className={`chip ${state.scopes.includes(s) ? "active" : ""}`}
              onClick={() =>
                setState({
                  ...state,
                  scopes: state.scopes.includes(s)
                    ? state.scopes.filter((x) => x !== s)
                    : [...state.scopes, s],
                })
              }
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{err}</div>}
      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={!state.agentName || state.scopes.length === 0 || submitting}
        style={{ marginTop: 18 }}
      >
        {submitting ? "Binding…" : "Bind"}
      </button>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
};

const VerifiedScreen = ({ state, onRestart }: { state: FormState; onRestart: () => void }) => {
  const displayName = state.handle
    ? state.handle.split(".").map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1)).join(" ")
    : "Verified Human";
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setApiKey(localStorage.getItem("zero_api_key"));
    setKeyPrefix(localStorage.getItem("zero_api_key_prefix"));
  }, []);
  return (
    <div className="card fade-enter">
      <h1 className="card-title">Welcome to zero.</h1>

      <div className="seal-wrap">
        <div className="seal">
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 28, color: "var(--accent)", letterSpacing: "0.04em" }}>00</span>
        </div>
      </div>

      <div className="id-card">
        <div className="id-card-top">
          <div>
            <div className="id-card-name">{displayName}</div>
            <div className="id-card-handle">@{state.handle || "your-handle"}.zero</div>
          </div>
          <div className="id-card-status">IAL2 · LIVE</div>
        </div>
        <div className="id-card-grid">
          <div className="id-card-row"><div className="k">API key</div><div className="v">{keyPrefix ? `${keyPrefix}…` : "—"}</div></div>
          <div className="id-card-row"><div className="k">Issued</div><div className="v">2026-05-09 07:14 UTC</div></div>
          <div className="id-card-row"><div className="k">Document</div><div className="v">{state.docType || "Passport"} · ✓</div></div>
          <div className="id-card-row"><div className="k">Liveness</div><div className="v">0.987 match</div></div>
          <div className="id-card-row"><div className="k">Bound agents</div><div className="v">1 active</div></div>
          <div className="id-card-row"><div className="k">Trust score</div><div className="v" style={{ color: "var(--accent)" }}>98 / 100</div></div>
        </div>
      </div>

      {apiKey && (
        <div style={{ marginTop: 18, padding: 12, background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.3)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>
            Save this key now — it won&apos;t be shown again
          </div>
          <code style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, wordBreak: "break-all", color: "var(--accent)" }}>
            {apiKey}
          </code>
        </div>
      )}
      <button className="btn btn-primary" style={{ marginTop: 18 }}>Open dashboard</button>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button className="btn-link" onClick={onRestart}>↺ Restart demo</button>
      </div>
    </div>
  );
};

/* --------------------------------- landing -------------------------------- */

const Landing = ({ onStart }: { onStart: () => void }) => (
  <div className="landing">
    <div className="landing-inner fade-enter">
      <ZeroLogo size={160} />
      <div className="landing-sub">the identity layer for the agentic internet</div>
      <button className="btn btn-primary landing-cta" onClick={onStart}>Get started</button>
    </div>
  </div>
);

/* ----------------------------------- app ---------------------------------- */

const ACCENT = "#c8f542";

export default function Onboarding() {
  const [started, setStarted] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<FormState>({
    email: "",
    handle: "",
    password: "",
    country: "+1 US",
    phone: "",
    docType: "Passport",
    agentName: "research-runner-01",
    scopes: ["read_messages"],
  });

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const restart = () => setStepIdx(0);

  const screen = STEPS[stepIdx].id;

  const [lines, setLines] = useState<TickerLine[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    if (!started) return;
    const msg = STEP_LOG[screen];
    if (!msg) return;
    setLines((prev) => [...prev, { id: idRef.current++, ts: stamp(), msg }]);
  }, [screen, started]);

  if (!started) return <Landing onStart={() => setStarted(true)} />;

  return (
    <div
      className="shell"
      data-screen-label={`step-${STEPS[stepIdx].num}-${STEPS[stepIdx].label}`}
    >
      <LeftPane stepIdx={stepIdx} accent={ACCENT} />
      <div className="right-pane">
        <div className="right-top">
          <span><span className="mono">zero://</span>onboard/{STEPS[stepIdx].id}</span>
          <span className="pill">step {stepIdx} / {STEPS.length - 1}</span>
        </div>
        <div className="card-wrap">
          {screen === "welcome" && <WelcomeScreen onNext={next} />}
          {screen === "email" && (
            <EmailScreen onNext={next} onBack={back} state={state} setState={setState} />
          )}
          {screen === "phone" && (
            <PhoneScreen onNext={next} onBack={back} state={state} setState={setState} />
          )}
          {screen === "document" && (
            <DocumentScreen onNext={next} onBack={back} state={state} setState={setState} />
          )}
          {screen === "face" && <FaceScreen onNext={next} onBack={back} />}
          {screen === "agent" && (
            <AgentScreen onNext={next} onBack={back} state={state} setState={setState} />
          )}
          {screen === "verified" && <VerifiedScreen state={state} onRestart={restart} />}
        </div>
        <Ticker lines={lines} />
      </div>
    </div>
  );
}
