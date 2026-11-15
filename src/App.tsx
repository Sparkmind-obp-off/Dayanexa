import { useState } from "react";
import {
  Activity, ArrowUpRight, Bot, Boxes, BriefcaseBusiness, ChartNoAxesCombined,
  CheckCircle2, CircleDollarSign, Compass, CreditCard, FileCheck2, Gauge,
  GitBranch, Layers3, Lightbulb, Radar, Search, ShieldCheck, Sparkles,
  Store, Wallet, Workflow
} from "lucide-react";

const workspaces = [
  { icon: Gauge, name: "Executive Command", detail: "System-wide priorities, performance, and decisions", domain: "Central Orchestrator" },
  { icon: Radar, name: "Market Radar", detail: "Signals, source health, and market patterns", domain: "Market Perception" },
  { icon: Search, name: "Demand Intelligence", detail: "Evidence, validation, and demand clusters", domain: "Demand Intelligence" },
  { icon: Layers3, name: "Opportunity Universe", detail: "Prioritized opportunities and assessments", domain: "Opportunity Intelligence" },
  { icon: Lightbulb, name: "Solution Studio", detail: "Product, service, and solution design", domain: "Solution Intelligence" },
  { icon: Boxes, name: "Capability Foundry", detail: "Build, integrate, acquire, or partner", domain: "Capability Foundry" },
  { icon: Store, name: "Product & Service Catalog", detail: "Offers, pricing, packaging, and catalog", domain: "Product & Commercial Engine" },
  { icon: Bot, name: "Agent Workforce", detail: "Agents, tools, permissions, and evaluations", domain: "Agentic Execution Network" },
  { icon: GitBranch, name: "Execution Control", detail: "Missions, task graphs, and run states", domain: "Agentic Execution Network" },
  { icon: BriefcaseBusiness, name: "Commercial Control", detail: "Customer validation, contracts, and revenue", domain: "Product & Commercial Engine" },
  { icon: FileCheck2, name: "Quality & Delivery", detail: "Quality gates, delivery, and acceptance", domain: "Quality, Delivery & Outcome" },
  { icon: Wallet, name: "Economic Ledger", detail: "Revenue, costs, payment, and settlement", domain: "Economic & Settlement Engine" },
  { icon: ChartNoAxesCombined, name: "Intelligence & Learning", detail: "Performance, feedback, and system evolution", domain: "Learning & Evolution Engine" },
  { icon: ShieldCheck, name: "Governance & Audit", detail: "Policies, approvals, risk, and traceability", domain: "Governance & Security" },
];

const gateways = [
  { id: "duitku", name: "Duitku", role: "Payment collection + disbursement", note: "Inquiry API and callback signature adapter" },
  { id: "xendit", name: "Xendit", role: "Invoices + future platform routing", note: "Invoice API; xenPlatform eligibility remains pending" },
  { id: "midtrans", name: "Midtrans", role: "Payment collection", note: "Snap API and notification signature adapter" },
  { id: "faspay", name: "Faspay", role: "Debit payment + merchant-specific channels", note: "Debit API; production endpoint is merchant-specific" },
];

function Metric({label,value,note}:{label:string;value:string;note:string}) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function PaymentPanel() {
  return <section className="payment-panel">
    <div className="payment-heading"><div><span className="eyebrow">PAYMENT PROVIDER REGISTRY</span><h3>Four gateways. One financial core.</h3><p>Each gateway is replaceable through a normalized adapter. DAYANEXA retains payment intents, event history, ledger and reconciliation as its source of truth.</p></div><span className="mode-pill"><span className="status-dot"/> MOCK MODE · LIVE LOCKED</span></div>
    <div className="gateway-grid">{gateways.map((gateway,i)=><article className="gateway-card" key={gateway.id}>
      <div className="gateway-top"><span className="gateway-icon"><CreditCard size={18}/></span><span className="gateway-index">0{i+1}</span></div>
      <h4>{gateway.name}</h4><strong>{gateway.role}</strong><p>{gateway.note}</p>
      <div className="gateway-status"><span className="pending-dot"/> Adapter scaffolded <small>Credentials not configured</small></div>
    </article>)}</div>
    <div className="payment-flow"><span>PAYMENT INTENT</span><ArrowUpRight size={14}/><span>GATEWAY ADAPTER</span><ArrowUpRight size={14}/><span>WEBHOOK VERIFY</span><ArrowUpRight size={14}/><span>RECONCILIATION</span><ArrowUpRight size={14}/><span>LEDGER</span></div>
    <p className="safety-note"><ShieldCheck size={15}/> No live checkout, automatic split, refund, or payout is enabled. Sandbox credentials and provider approval are required before activation.</p>
  </section>;
}

export default function App() {
  const [active, setActive] = useState("Executive Command");
  const selected = workspaces.find((workspace)=>workspace.name===active) ?? workspaces[0];
  const isPayments = active==="Economic Ledger" || active==="Commercial Control";
  return <main className="shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={()=>setActive("Executive Command")}><span className="brand-mark">D</span><span>DAYANEXA<small>OPPORTUNITY OS</small></span></a>
      <div className="nav-label">COMMAND</div>
      <button className={active==="Executive Command"?"nav active":"nav"} onClick={()=>setActive("Executive Command")}><Gauge size={17}/> Executive Command</button>
      <div className="nav-label">WORKSPACES · 14</div>
      {workspaces.slice(1).map(({icon:Icon,name},i)=><button className={active===name?"nav active":"nav"} onClick={()=>setActive(name)} key={name}><Icon size={16}/><span>{name}</span><small>{String(i+1).padStart(2,"0")}</small></button>)}
      <div className="sidebar-foot"><span className="status-dot"/> Foundation workspace <small>API foundation committed · live providers off</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><div><span className="eyebrow">CENTRAL COMMAND / {active.toUpperCase()}</span><h1>{active}</h1></div><div className="top-actions"><span className="env"><span className="status-dot"/> FOUNDATION</span><button className="avatar" title="DAYANEXA">DX</button></div></header>
      {active==="Executive Command" ? <>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> AGENTIC OPPORTUNITY & EXECUTION OS</div><h2>Discover demand.<br/><em>Build the capability.</em><br/>Deliver the outcome.</h2><p>One operating system to perceive real market needs, form the capabilities to solve them, and turn accepted outcomes into measurable economic value.</p><div className="hero-note"><ShieldCheck size={16}/> Demand-first · Capability-expanding · Outcome-verified</div></div><div className="orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core"><span>D</span><small>ORCHESTRATOR</small></div><i className="orb orb-a"/><i className="orb orb-b"/><i className="orb orb-c"/></div></section>
        <section className="metrics"><Metric label="Verified outcomes" value="—" note="No live data connected"/><Metric label="Validated demand" value="—" note="Evidence pipeline not enabled"/><Metric label="Active missions" value="0" note="No execution launched"/><Metric label="Verified margin" value="—" note="Awaiting economic ledger"/></section>
        <section className="section-head"><div><span className="eyebrow">OPERATING DOMAINS</span><h3>One system. Fourteen connected workspaces.</h3></div><span className="muted">Architecture foundation</span></section>
        <section className="workspace-grid">{workspaces.map(({icon:Icon,name,detail},i)=><button className="workspace" key={name} onClick={()=>setActive(name)}><div className="workspace-top"><span className="workspace-icon"><Icon size={19}/></span><span className="index">{String(i+1).padStart(2,"0")}</span></div><h4>{name}</h4><p>{detail}</p><span className="workspace-link">Open workspace <ArrowUpRight size={14}/></span></button>)}</section>
      </> : <>
        <section className="module-banner"><div className="module-icon"><selected.icon size={22}/></div><div><span className="eyebrow">CONNECTED DOMAIN</span><h2>{selected.domain}</h2><p>{selected.detail}. This workspace is part of the shared DAYANEXA lifecycle, policy model, event history and economic ledger.</p></div><span className="module-state"><CheckCircle2 size={14}/> BLUEPRINT DEFINED</span></section>
        {isPayments ? <PaymentPanel/> : <section className="module-placeholder"><span className="eyebrow">WORKSPACE FOUNDATION</span><h3>{active}</h3><p>The domain boundary and operating responsibilities are defined. Runtime workflows, live data sources, and operational controls will be activated in staged builds—not represented as live before they exist.</p><div className="module-checks"><span><CheckCircle2 size={15}/> Domain mapped</span><span><CheckCircle2 size={15}/> Lifecycle ownership defined</span><span><Activity size={15}/> Runtime integration pending</span></div></section>}
      </>}
      <footer><span>DAYANEXA © 2026</span><span>DEMAND DEFINES THE OPPORTUNITY</span><span>FOUNDATION BUILD · V0.2</span></footer>
    </section>
  </main>;
}
