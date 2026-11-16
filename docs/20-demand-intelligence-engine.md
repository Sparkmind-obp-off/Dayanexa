# DAYANEXA V3 — Demand Intelligence Engine

**Version:** 3.0 · **Layer:** 2 of 5 · **Authority:** `docs/18-demand-to-execution-architecture-v3.md`

## 1. Mission

Convert raw observations into explainable, evidence-backed demand hypotheses and validated opportunities. It must distinguish a single complaint, repeated discussion, explicit request, purchase intent and verified transaction.

## 2. Pipeline

1. Normalize language, timestamps, URLs, source identity and problem statements.
2. Remove exact duplicates and identify near-duplicates without deleting independent source records.
3. Classify signal type: explicit need, pain point, request for recommendation, purchase intent, procurement, competitor mention, general discussion, irrelevant or spam.
4. Extract structured attributes: problem, desired outcome, segment/niche, geography, urgency (explicit vs inferred), constraints, budget evidence (explicit vs unknown), current workaround and requested timeline.
5. Cluster signals by problem/outcome and segment; preserve cluster membership history and split/merge rationale.
6. Build a demand hypothesis with supporting and contradicting evidence.
7. Score independent dimensions and list missing evidence.
8. Route to human review, requester clarification or validation experiment.
9. Only after validation gate, create an opportunity.

## 3. Cluster model

A DemandCluster is not merely a keyword bucket. It must capture a common unmet outcome and distinguish:
- Niche and sub-niche.
- Problem pattern and requested outcome.
- Customer segment and geography.
- Source mix and time window.
- Number of unique signals, canonical sources and independent requesters where permitted.
- Explicit vs inferred urgency and budget.
- Existing alternatives/workarounds and unmet gap.
- Contradicting evidence, saturation and uncertainty.
- Cluster algorithm/rubric version and reviewer.

AI may suggest cluster membership. Merging, splitting or promoting clusters must preserve audit history and evidence references. Reposts, copied text and syndicated articles do not count as independent demand.

## 4. Evidence hierarchy

Stronger evidence: direct request from a decision-maker, explicit scope/budget/deadline, quote request, procurement brief, deposit/pre-order, paid pilot, verified purchase or repeat purchase. Medium evidence: multiple independent people describing the same specific pain, a detailed request for a solution, or a credible partner referral. Weak evidence: likes, views, vague complaints, generic trends, keyword volume, AI inference or a single anonymous post.

Record evidence stance: supports, contradicts, contextual or uncertain. Record who reviewed it and why. A demand record must be able to show the original source URL/ID and exact captured context within retention/privacy rules.

## 5. Independent assessment dimensions

Do not collapse the assessment into one opaque score. Store each score, rationale, evidence references, confidence and rubric version:
- **Evidence quality (0–100):** directness, source reliability, traceability and corroboration.
- **Frequency (0–100):** independent requesters and recurrence after deduplication.
- **Recency (0–100):** age of evidence and whether the need is still active.
- **Urgency (0–100):** explicit deadline, consequence or urgency statement; unknown when not expressed.
- **Intent (0–100):** specificity and action toward buying/commissioning; do not infer from engagement.
- **Budget evidence (0–100 or unknown):** explicit budget, procurement value or paid history; unknown is not zero.
- **Commercial potential (0–100):** plausible price, reachable segment, repeatability and gross-margin potential.
- **Risk (low/medium/high/critical):** source, privacy, legal, delivery, platform and financial risks.
- **Confidence:** confidence in the assessment itself, separate from commercial potential.

Any aggregate ranking must publish its formula and show the independent dimensions. It cannot override missing evidence or the validation gate.

## 6. Validation policy

A source count threshold is a guardrail, not proof of willingness to pay. The current V2 rule of at least two supporting evidence items from two distinct source URLs plus human rationale may remain a minimum technical gate, but V3 must strengthen it for commercial claims:
- Verify source independence and requester identity/authority where lawfully possible.
- Seek direct confirmation, interview, request-for-quote, landing/offer test, paid pilot or deposit where appropriate.
- Keep the validation method, sample, dates, outcome, consent and limitations.
- A public post can justify a hypothesis, not imply the author has consented to be contacted or buy.
- A validated pain point is not a validated offer; price and delivery willingness require separate evidence.
- Allow states: hypothesis, evidence pending, under review, validated, deferred, rejected, disputed/stale.

## 7. Opportunity creation

Opportunity creation requires:
- Validated demand or an explicitly approved exception with reason.
- Evidence bundle and contradiction summary.
- Segment/niche definition and problem statement.
- Expected outcome and acceptance hypothesis.
- Preliminary commercial assessment and risk.
- Named owner and next action.

Opportunity scores are assessments, not guarantees. Keep model/provider/trace, prompt/rubric version and human reviewer. AI can draft; authorized human review decides validation until automated authority is separately approved.

## 8. UI requirements

Provide a demand research workspace with:
- Search filters and source/time coverage.
- Niche and sub-niche cluster view.
- Signal list with clickable original sources.
- Supporting/contradicting evidence side-by-side.
- Duplicate and independence indicators.
- Score dimensions, rationales, confidence and missing evidence.
- Review/clarification queue and validation decision.
- Full history of cluster membership and assessment changes.

## 9. Acceptance tests

1. Exact duplicates do not inflate frequency or independent-source counts.
2. Contradicting evidence remains visible and affects review.
3. Cluster split/merge is versioned and reversible.
4. AI classifications/assessments retain model trace and are labeled inference.
5. A cluster with many likes but no specific need is not validated.
6. A single public complaint cannot become a paid opportunity automatically.
7. Validation records include method, reviewer, rationale and evidence.
8. An opportunity cannot be created from an unvalidated demand without a separately audited exception.
9. Scores are reproducible against a versioned rubric and show all dimensions.
10. Every displayed finding links to permitted original evidence.
