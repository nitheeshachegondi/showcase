import type { Feature, Showcase } from "./types";

export interface CheckItem {
  id: string;
  label: string;
  hint: string;
  required: boolean;
  ok: boolean;
}

/**
 * The details people need before they can judge a product. "Required" items block publishing
 * (enforced on the server too); "recommended" items are flagged but never block.
 */
export function buildChecklist(input: {
  showcase: Showcase;
  features: Feature[];
  uncoveredCount?: number;
}): CheckItem[] {
  const s = input.showcase;
  const included = input.features.filter((f) => f.status === "included");
  const thin = included.filter((f) => f.description.trim().length < 25).length;
  const unsure = input.features.filter((f) => f.status === "clarify").length;
  const uncovered = input.uncoveredCount ?? 0;

  return [
    { id: "tagline", required: true, label: "One-line tagline", hint: "A clear sentence on what it is and who it's for.", ok: s.tagline.trim().length >= 10 },
    { id: "what", required: true, label: "What it is", hint: "Explain the product in a few sentences.", ok: s.what.trim().length >= 40 },
    { id: "problem", required: true, label: "The problem it solves", hint: "What goes wrong for people without it?", ok: s.problem.trim().length >= 20 },
    { id: "features", required: true, label: "At least one included feature", hint: "Include a feature from your documents or add one yourself.", ok: included.length >= 1 },
    { id: "whoFor", required: true, label: "Who should use it", hint: "Name the people this is built for.", ok: s.whoFor.length >= 1 },
    { id: "pricing", required: true, label: "Pricing", hint: 'Even "Free" or "Contact us for pricing" helps. Visitors always ask.', ok: s.pricing.trim().length >= 2 },

    { id: "notFor", required: false, label: "Who it is NOT suitable for", hint: "Saying this builds trust and avoids wrong matches.", ok: s.notFor.length >= 1 },
    { id: "limitations", required: false, label: "Limitations", hint: "Languages, platforms, limits, what is not available yet.", ok: s.limitations.length >= 1 },
    { id: "diff", required: false, label: "What makes it different", hint: "Why choose this over the alternatives?", ok: s.differentiators.length >= 1 },
    { id: "depth", required: false, label: "At least 5 features documented", hint: "More documented detail means more people can find you.", ok: included.length >= 5 },
    { id: "thin", required: false, label: "Every feature has a full description", hint: `${thin} included feature${thin === 1 ? " has" : "s have"} a very short description. Use “Improve wording”.`, ok: thin === 0 },
    { id: "unsure", required: false, label: "No features left as “unsure”", hint: `${unsure} feature${unsure === 1 ? " needs" : "s need"} a decision: include or leave out.`, ok: unsure === 0 },
    { id: "uncovered", required: false, label: "Every document passage reviewed", hint: `${uncovered} passage${uncovered === 1 ? "" : "s"} in your documents ${uncovered === 1 ? "isn't" : "aren't"} covered by a feature yet.`, ok: uncovered === 0 },
    { id: "demo", required: false, label: "A demo link or screenshots", hint: "Show it, don't just describe it.", ok: !!s.demoUrl || s.screenshots.length > 0 },
    { id: "note", required: false, label: "A note from you, the founder", hint: "Your own words on why you built it.", ok: s.founderNote.trim().length >= 20 },
  ];
}

export const missingRequired = (items: CheckItem[]) => items.filter((i) => i.required && !i.ok);
