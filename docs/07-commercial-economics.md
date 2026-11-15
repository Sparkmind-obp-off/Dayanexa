# Product, Commercial & Economic Engine

## 1. Business modes
Product; software subscription; usage-based service; professional service; implementation; managed operations; complete solution; recurring service; licensing; partner-enabled offer; outcome-based fee. Multiple models may coexist.

## 2. Commercial lifecycle
Solution hypothesis → customer discovery → value proposition → offer and scope → pricing/cost model → willingness-to-pay validation → quote/proposal → approval → contract/order → execution → acceptance → invoice/payment → settlement → repeat/renewal.

## 3. Offer contract
Customer segment, problem, outcome, scope, exclusions, deliverables, acceptance criteria, schedule, price/currency, tax treatment, payment terms, revision policy, cancellation/refund, data handling, support, dependencies, and legal terms.

## 4. Pricing
Price should reflect customer value, alternatives, risk, delivery cost, support, and willingness to pay. Record pricing assumptions and test results. Do not present model-generated willingness-to-pay estimates as customer-confirmed budgets.

## 5. Economic ledger
Use integer minor units and explicit ISO currency. Keep quote, invoice, payment, refund, chargeback, payout, and settlement distinct. Each entry has source reference, status, timestamp, actor, and reconciliation evidence.

## 6. Core calculations
- Gross Mission Margin = Verified Revenue − Direct Execution Costs.
- Gross Mission Margin % = Gross Mission Margin / Verified Revenue (only when verified revenue > 0).
- Contribution after variable costs = Verified Revenue − direct costs − variable payment/provider fees − refunds/chargebacks attributable to mission.
- Net operating result additionally accounts for overhead, taxes, financing, and other operating costs; do not call gross margin net profit.

## 7. Contributor fairness
Before assignment, disclose task, deliverable, rate/fee, currency, deadline, acceptance criteria, revision count, expenses, and payment timing. Track earned, approved, payable, paid, and disputed amounts separately. No unpaid speculative work.

## 8. Financial controls
No agent may authorize its own spending or verify its own payout. Require approval thresholds, budget reservation, idempotent payment requests, reconciliation, immutable ledger events, refund/chargeback handling, and separation of duties.
