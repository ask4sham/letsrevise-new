import React from "react";
import "./CausalMechanismBlock.css";

/**
 * One row in a causal chain. Store in CMS as JSON:
 * `{ "risk": string, "body": string, "effect": string }`
 * (`effect` = outcome column label in the UI.)
 */
export type CausalMechanismRow = {
  risk: string;
  body: string;
  effect: string;
};

export type CausalMechanismBlockProps = {
  /** Table rows as JSON array (see CausalMechanismRow). */
  rows: CausalMechanismRow[];
  /** Optional section heading above the grid. */
  title?: string;
  className?: string;
  /** Prefix for React keys (e.g. CMS block id). */
  idPrefix?: string;
};

const LABEL_RISK = "Risk factor";
const LABEL_BODY = "Body effect";
const LABEL_OUTCOME = "Outcome";

/**
 * Visualises cause–mechanism–outcome chains for GCSE-style content.
 * Three columns on wide screens; each step stacks vertically on mobile.
 */
export function CausalMechanismBlock({ rows, title, className, idPrefix }: CausalMechanismBlockProps) {
  const safe = (rows || []).filter(
    (r) => r && (String(r.risk).trim() || String(r.body).trim() || String(r.effect).trim())
  );
  if (safe.length === 0) return null;

  const rootClass = ["causal-mechanism-block", className].filter(Boolean).join(" ");

  return (
    <section className={rootClass} aria-label={title || "Causal mechanism"}>
      {title ? (
        <h3 className="causal-mechanism-block__title">{title}</h3>
      ) : null}
      {safe.map((row, i) => {
        const key = `${idPrefix || "cm"}-${i}`;
        return (
          <div key={key} className="causal-mechanism-block__row">
            <article className="causal-mechanism-block__card causal-mechanism-block__card--risk">
              <span className="causal-mechanism-block__label">{LABEL_RISK}</span>
              <p className="causal-mechanism-block__text">{row.risk}</p>
            </article>
            <article className="causal-mechanism-block__card causal-mechanism-block__card--body">
              <span className="causal-mechanism-block__label">{LABEL_BODY}</span>
              <p className="causal-mechanism-block__text">{row.body}</p>
            </article>
            <article className="causal-mechanism-block__card causal-mechanism-block__card--outcome">
              <span className="causal-mechanism-block__label">{LABEL_OUTCOME}</span>
              <p className="causal-mechanism-block__text">{row.effect}</p>
            </article>
          </div>
        );
      })}
    </section>
  );
}

export default CausalMechanismBlock;
