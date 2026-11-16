/**
 * Evidence normalization: canonical URL, exact fingerprint, near-duplicate (syndication) fingerprint,
 * independent-source key and heuristic demand cues. Observed facts and inferences are kept separate.
 */
import { digestHex } from "../lib/crypto";
import { DEMAND_CATEGORIES } from "./taxonomy";

const TRACKING = /^(utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref|ref_src|si|spm|_ga)$/i;

/** Lowercased host without www/m/old, https scheme, no hash, no tracking params, sorted query, no trailing slash. */
export function canonicalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^(www\d?|m|mobile|old|amp)\./, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const q = u.searchParams.toString();
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `https://${host}${path}${q ? `?${q}` : ""}`;
  } catch { return null; }
}

const TWO_LEVEL = new Set(["co.id", "ac.id", "go.id", "or.id", "web.id", "my.id", "sch.id", "biz.id", "co.uk", "org.uk", "com.au", "com.sg", "com.my", "co.jp", "com.br", "co.in"]);
export function registrableDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join(".");
  return TWO_LEVEL.has(last2) ? parts.slice(-3).join(".") : last2;
}

/**
 * Key used to count INDEPENDENT sources. Same community/publisher → same key, so many posts from one
 * subreddit or one site are not counted as many independent sources.
 */
export function independentSourceKey(canonical: string): { key: string; community: string | null } {
  const u = new URL(canonical);
  const host = u.hostname;
  const seg = u.pathname.split("/").filter(Boolean);
  if (host.endsWith("reddit.com") && seg[0] === "r" && seg[1]) return { key: `reddit.com/r/${seg[1].toLowerCase()}`, community: `r/${seg[1]}` };
  if ((host.endsWith("youtube.com")) && seg[0]?.startsWith("@")) return { key: `youtube.com/${seg[0].toLowerCase()}`, community: seg[0] };
  if (host.endsWith("youtube.com") && (seg[0] === "channel" || seg[0] === "c") && seg[1]) return { key: `youtube.com/${seg[0]}/${seg[1]}`, community: seg[1] };
  if (host.endsWith("threads.net") && seg[0]?.startsWith("@")) return { key: `threads.net/${seg[0].toLowerCase()}`, community: seg[0] };
  if (host.endsWith("facebook.com") && seg[0] && !["groups", "watch", "events", "share", "story.php", "permalink.php"].includes(seg[0])) return { key: `facebook.com/${seg[0].toLowerCase()}`, community: seg[0] };
  if (host.endsWith("stackexchange.com")) return { key: host, community: host.split(".")[0] };
  if (host.endsWith("kaskus.co.id") && seg[0] === "forum" && seg[1]) return { key: `kaskus.co.id/forum/${seg[1]}`, community: seg[1] };
  // Blog platforms: a subdomain is an independent publisher.
  if (/\.(medium\.com|substack\.com|blogspot\.com|wordpress\.com|tumblr\.com)$/.test(host)) return { key: host, community: null };
  return { key: registrableDomain(host), community: null };
}

export function platformOf(canonical: string): string {
  const host = new URL(canonical).hostname;
  const map: [RegExp, string][] = [[/reddit\.com$/, "reddit"], [/youtube\.com$|youtu\.be$/, "youtube"], [/threads\.net$/, "threads"], [/facebook\.com$/, "facebook"], [/quora\.com$/, "quora"],
    [/stackoverflow\.com$|stackexchange\.com$/, "stackexchange"], [/kaskus\.co\.id$/, "kaskus"], [/x\.com$|twitter\.com$/, "x"], [/instagram\.com$/, "instagram"], [/linkedin\.com$/, "linkedin"], [/tiktok\.com$/, "tiktok"]];
  return map.find(([re]) => re.test(host))?.[1] ?? "web";
}

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2);

/** Near-duplicate fingerprint over the first 40 meaningful words (catches syndicated copies/reposts). */
export async function textFingerprint(title: string, content: string): Promise<string | null> {
  const w = words(`${content}`).slice(0, 40);
  if (w.length < 12) return title && words(title).length >= 6 ? digestHex("SHA-256", `t|${words(title).join(" ")}`) : null;
  return digestHex("SHA-256", `c|${w.join(" ")}`);
}

const CUES: { id: string; re: RegExp }[] = [
  { id: "seeking", re: /\b(butuh|membutuhkan|cari|mencari|nyari|looking for|need(s|ed)?|searching for|any recommendations?|rekomendasi|recommend)\b/i },
  { id: "pain", re: /\b(masalah|kendala|keluhan|susah|sulit|ribet|frustrat\w*|annoy\w*|problem|issue|pain|struggl\w*|kecewa|mahal|expensive)\b/i },
  { id: "workaround", re: /\b(workaround|manual|spreadsheet|excel|terpaksa|akhirnya pakai|hack)\b/i },
  { id: "willingness", re: /\b(mau bayar|bersedia bayar|willing to pay|budget|anggaran|harga berapa|how much|pricing)\b/i },
  { id: "alternative", re: /\b(alternatif|alternative to|pengganti|replacement for|vs\.?|better than)\b/i },
  { id: "question", re: /(\?|\b(bagaimana|gimana|how (do|can|to)|apa ada|is there)\b)/i },
];

/** Heuristic (NOT AI, NOT validation): which demand cues and categories the text appears to contain. */
export function heuristics(title: string, content: string) {
  const text = `${title} ${content}`.slice(0, 4000);
  const cues = CUES.filter((c) => c.re.test(text)).map((c) => c.id);
  const lower = text.toLowerCase();
  const categories = DEMAND_CATEGORIES.filter((c) => c.terms.some((t) => lower.includes(t))).map((c) => c.code).slice(0, 4);
  const strong = cues.includes("seeking") || (cues.includes("pain") && (cues.includes("question") || cues.includes("workaround")));
  return { cues, categories, signalKind: strong ? "possible_demand_signal" : cues.length ? "weak_signal" : "context", method: "keyword_heuristic@1", label: "inferred" as const };
}

const STOP = new Set(("yang dan di ke dari untuk dengan ini itu ada tidak atau juga akan pada sebagai dalam bisa saya kami kita mereka anda apa cara the and for with this that are was were you your have has how what why when who from into about can will not but all any our out more most best top new get use using vs dan/atau www com https http reddit youtube quora kaskus facebook threads").split(" "));
/** Term-frequency themes across UNIQUE evidence (inference; counted per independent source to avoid repost bias). */
export function themes(rows: { title: string | null; content_excerpt: string | null; independent_source_key: string }[], queryTerms: string[]) {
  const skip = new Set([...STOP, ...queryTerms.flatMap((q) => words(q))]);
  const byTerm = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const seen = new Set(words(`${r.title ?? ""} ${(r.content_excerpt ?? "").slice(0, 600)}`).filter((w) => !skip.has(w) && w.length > 3 && !/^\d+$/.test(w)));
    for (const w of seen) { counts.set(w, (counts.get(w) ?? 0) + 1); if (!byTerm.has(w)) byTerm.set(w, new Set()); byTerm.get(w)!.add(r.independent_source_key); }
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => (byTerm.get(b[0])!.size - byTerm.get(a[0])!.size) || b[1] - a[1]).slice(0, 10)
    .map(([term, n]) => ({ term, records: n, independentSources: byTerm.get(term)!.size, label: "inferred_term_frequency" }));
}
