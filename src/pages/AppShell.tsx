import { useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { Bell, Compass, Bot, Boxes, BriefcaseBusiness, ChartNoAxesCombined, CreditCard, FileCheck2, Gauge, GitBranch, HandHelping, Home, Layers3, Lightbulb, Menu, PlusCircle, Radar, Search, ShieldCheck, Store, Wallet, Inbox, LifeBuoy, Lock, ListChecks, SlidersHorizontal } from "lucide-react";
import { Brand } from "./Public";
import { useSession } from "../lib/session";
import { useGet } from "../lib/api";
import { ErrorBox, Loading } from "../components/ui";
import { Billing, ContributorPage, CustomerHome, MyRequests, NewRequest, Notifications } from "./Customer";
import { MissionDetail } from "./MissionDetail";
import { Onboarding, OpsQueues, PrivacyPage, RequestDetail, SupportPage } from "./Journey";
import * as W from "../workspaces";
import { CampaignDetail, DiscoveryCatalogPage, DiscoveryHome, NewCampaign } from "./Discovery";

export const WORKSPACES = [
  { path: "executive", name: "Executive Command", icon: Gauge, el: W.Executive, perm: "workspace:read" },
  { path: "market-radar", name: "Market Radar", icon: Radar, el: W.MarketRadar, perm: "workspace:read" },
  { path: "demand", name: "Demand Intelligence", icon: Search, el: W.DemandIntel, perm: "workspace:read" },
  { path: "opportunities", name: "Opportunity Universe", icon: Layers3, el: W.Opportunities, perm: "workspace:read" },
  { path: "solutions", name: "Solution Studio", icon: Lightbulb, el: W.Solutions, perm: "workspace:read" },
  { path: "capabilities", name: "Capability Foundry", icon: Boxes, el: W.Capabilities, perm: "workspace:read" },
  { path: "catalog", name: "Product & Service Catalog", icon: Store, el: W.CatalogWs, perm: "workspace:read" },
  { path: "agents", name: "Agent Workforce", icon: Bot, el: W.Agents, perm: "workspace:read" },
  { path: "execution", name: "Execution Control", icon: GitBranch, el: W.Execution, perm: "workspace:read" },
  { path: "commercial", name: "Commercial Control", icon: BriefcaseBusiness, el: W.Commercial, perm: "workspace:read" },
  { path: "delivery", name: "Quality & Delivery", icon: FileCheck2, el: W.Delivery, perm: "workspace:read" },
  { path: "ledger", name: "Economic Ledger", icon: Wallet, el: W.Ledger, perm: "ledger:read" },
  { path: "learning", name: "Intelligence & Learning", icon: ChartNoAxesCombined, el: W.Learning, perm: "workspace:read" },
  { path: "governance", name: "Governance & Audit", icon: ShieldCheck, el: W.Governance, perm: "governance:read" },
  { path: "admin-control", name: "Admin & Resource Control", icon: SlidersHorizontal, el: W.AdminControl, perm: "provider:admin" },
];

export default function AppShell() {
  const { me, can, isStaff, loading, error } = useSession();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const notes = useGet<{ unread: number }>(me ? "/notifications?limit=1" : null, { refetchInterval: 60_000 });
  if (loading) return <Loading label="Memverifikasi sesi…" />;
  if (me?.needsOnboarding) return <Onboarding />;
  if (error) return <div className="fatal stack"><Brand /><h2>Tidak dapat memuat akun</h2><ErrorBox error={error} /><p className="muted small">Jika ini terjadi setelah login, server mungkin belum selesai dikonfigurasi (database / kunci verifikasi Clerk). Tidak ada login alternatif atau mock.</p><UserButton /></div>;
  const title = WORKSPACES.find((w) => loc.pathname.includes(`/w/${w.path}`))?.name ?? CUSTOMER_TITLES.find(([p]) => loc.pathname === `/app${p}`)?.[1] ?? (loc.pathname.startsWith("/app/discovery/") ? "Kampanye discovery" : "DAYANEXA");
  const nav = (to: string, label: string, Icon: typeof Home, idx?: string) => <NavLink key={to} to={to} end={to === "/app"} className={({ isActive }) => `nav ${isActive ? "on" : ""}`} onClick={() => setOpen(false)}><Icon size={16} /><span>{label}</span>{idx && <span className="idx">{idx}</span>}</NavLink>;
  return <div className="shell">
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <aside className={`side ${open ? "open" : ""}`} aria-label="Navigasi aplikasi">
      <div style={{ padding: "4px 8px 14px" }}><Brand /></div>
      <div className="label">Akun saya</div>
      {nav("/app", "Beranda", Home)}{can("v3:use") && nav("/app/discovery", "Discovery (V3)", Compass)}{nav("/app/requests/new", "Ajukan kebutuhan", PlusCircle)}{nav("/app/requests", "Request & penawaran", Inbox)}
      {nav("/app/billing", "Paket & tagihan", CreditCard)}{nav("/app/contributor", "Kontributor", HandHelping)}{nav("/app/notifications", `Notifikasi${notes.data?.unread ? ` (${notes.data.unread})` : ""}`, Bell)}{nav("/app/support", "Dukungan", LifeBuoy)}{nav("/app/privacy", "Privasi & data", Lock)}
      {isStaff && <><div className="label">Operasional</div>{nav("/app/queues", "Antrean operator", ListChecks)}<div className="label">Command center · 15</div>{WORKSPACES.filter((w) => can(w.perm)).map((w, i) => nav(`/app/w/${w.path}`, w.name, w.icon, String(i + 1).padStart(2, "0")))}</>}
      <div className="grow" />
      <div className="card small" style={{ padding: 12, marginTop: 14 }}><div className="row between"><span className="dim">Paket</span><span className="planpill">{me?.plan.name}</span></div>
        <div className="dim" style={{ marginTop: 6 }}>Request periode ini: {me?.usage.requests}/{me?.plan.limits.requestsPerMonth}</div><div className="dim">Reset {me?.window ? new Date(me.window.resetsAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }) : "—"}</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="btn sm menu-btn" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={16} /></button>
        <div className="grow"><div className="eyebrow">{isStaff ? "Command center" : "Portal pelanggan"}</div><h1>{title}</h1></div>
        <span className="planpill">{me?.roles.filter((r) => r !== "member").join(" · ") || "member"}</span><UserButton />
      </header>
      <Routes>
        <Route index element={<CustomerHome />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="discovery" element={can("v3:use") ? <DiscoveryHome /> : <Navigate to="/app" replace />} />
        <Route path="discovery/new" element={can("v3:use") ? <NewCampaign /> : <Navigate to="/app" replace />} />
        <Route path="discovery/catalog" element={can("v3:use") ? <DiscoveryCatalogPage /> : <Navigate to="/app" replace />} />
        <Route path="discovery/:id" element={can("v3:use") ? <CampaignDetail /> : <Navigate to="/app" replace />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="billing" element={<Billing />} />
        <Route path="contributor" element={<ContributorPage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="queues" element={isStaff ? <OpsQueues /> : <Navigate to="/app" replace />} />
        <Route path="missions/:id" element={<MissionDetail />} />
        {WORKSPACES.map((w) => <Route key={w.path} path={`w/${w.path}`} element={can(w.perm) ? <w.el /> : <div className="alert bad">Anda tidak memiliki izin untuk workspace ini.</div>} />)}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </main>
  </div>;
}
const CUSTOMER_TITLES: [string, string][] = [["", "Beranda"], ["/discovery", "Demand Discovery"], ["/discovery/new", "Kampanye discovery baru"], ["/discovery/catalog", "Katalog sumber"], ["/requests/new", "Ajukan kebutuhan"], ["/support", "Dukungan"], ["/privacy", "Privasi & data"], ["/queues", "Antrean operator"], ["/requests", "Request & penawaran"], ["/billing", "Paket & tagihan"], ["/contributor", "Kontributor"], ["/notifications", "Notifikasi"]];
