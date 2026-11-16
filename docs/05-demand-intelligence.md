# Market Perception & Demand Intelligence

## 1. Source classes
Customer briefs and support channels; partner/referral feeds; public marketplace listings; public social posts and comments; public procurement/tender notices; community discussions; business system integrations explicitly authorized by account owners; first-party analytics and search data.

## 2. Source registry
Each connector must declare data owner, authorization basis, permitted purpose, access method, terms/robots/API rules, rate limits, fields collected, personal-data handling, retention/deletion, geography, and operational owner. No credential sharing, bypassing access controls, or scraping private/restricted content.

## 3. Discovery pipeline
Discover → capture minimum necessary fields → normalize → deduplicate → classify → extract problem → identify segment → gather corroborating evidence → test requester credibility and intent → cluster → human review where needed.

## 4. Evidence hierarchy
Stronger evidence includes direct customer request with authority, paid order/deposit, repeated verified purchases, procurement brief, or explicit budget and deadline. Weaker evidence includes likes, generic complaints, isolated comments, trend estimates, and model inference. Signals must never be represented as confirmed demand without corroboration.

## 5. Independent assessment dimensions
- Demand confidence: evidence quality, recency, consistency, corroboration.
- Problem severity: consequence and urgency.
- Frequency: recurring/one-off.
- Requester credibility and decision authority.
- Commercial intent and willingness to pay.
- Reach and segment size.
- Competitive alternatives and unmet gap.
- Solvability and capability formation cost.
- Delivery cost, time, and operational risk.
- Legal, privacy, platform, safety, and reputational risk.

Store separate dimension scores and human-readable rationale; retain contradictory evidence.

## 6. Validation methods
Customer interview or clarification; landing-page/offer test; paid pilot; deposit/pre-order where lawful; quote request; repeat purchase evidence; partner confirmation. Do not claim validation from views or engagement alone.

## 7. Anti-patterns
Keyword volume treated as demand; fake requester accounts; fabricated budgets; scraping beyond permitted access; deduplicated posts counted as separate customers; inferred urgency presented as fact; demand score with no evidence trail.
