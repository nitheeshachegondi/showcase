"use client";

import { useState } from "react";

// A fictional example: a founder's document, and the features Showcase finds in it.
const SENTENCES = [
  "CareerLoop reads your resume and a pasted job description and builds a week-by-week preparation roadmap.",
  "A skill gap report lists every requirement in the job description that your resume does not yet prove.",
  "Mock interviews adapt their questions to the role, the company type and the seniority level you are targeting.",
  "CareerLoop is free for your first three mock interviews every month, and the Pro plan costs Rs 499 per month.",
];

const FEATURES = [
  { title: "Roadmap from resume and job description", desc: "A week-by-week preparation plan." },
  { title: "Skill gap report", desc: "Every requirement your resume doesn't prove yet." },
  { title: "Role-adaptive mock interviews", desc: "Questions follow the role, company type and seniority." },
  { title: "Free tier and Pro pricing", desc: "Three free mock interviews a month; Pro is Rs 499 a month." },
];

export default function SourceDemo() {
  const [sel, setSel] = useState(1);

  return (
    <div>
      <div className="sheet">
        <div className="doc-title">The founder&apos;s document (example)</div>
        <p className="doc-text" style={{ margin: 0 }}>
          {SENTENCES.map((s, i) => (
            <span key={i}>
              {i === sel ? <span className="hl sweep">{s}</span> : s}{" "}
            </span>
          ))}
        </p>
      </div>

      <div className="demo-feats">
        <div className="label">What Showcase found. Click one to see where it came from.</div>
        {FEATURES.map((f, i) => (
          <button key={f.title} type="button" className={`fl-item ${i === sel ? "on" : ""}`} onClick={() => setSel(i)} onFocus={() => setSel(i)} aria-pressed={i === sel}>
            <span className="tick" aria-hidden="true">
              ✓
            </span>
            <span>
              <b>{f.title}</b>
              <span className="d">{f.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
