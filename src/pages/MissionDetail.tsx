import { useParams } from "react-router-dom";
import { dt, useApi, useGet } from "../lib/api";
import { useSession } from "../lib/session";
import { Form } from "../components/Form";
import { ActionButton, Badge, Q, Section, Table } from "../components/ui";

export function MissionDetail() {
  const { id } = useParams();
  const q = useGet<any>(`/missions/${id}`);
  const { can } = useSession();
  const api = useApi();
  const download = async (aid: string) => { const r = await api<any>(`/artifacts/${aid}/link`, { method: "POST", json: {} }); window.open(r.url, "_blank", "noopener"); };
  return <Q q={q}>{(d) => { const m = d.mission; return <div className="stack" style={{ gap: 4 }}>
    <div className="card row between"><div><div className="eyebrow">Misi</div><h2 style={{ fontSize: 20, marginTop: 4 }}>{m.title}</h2><div className="small dim">Tenggat {dt(m.due_at)}</div></div><Badge v={m.status} /></div>
    {d.delivery && <Section title="Delivery"><div className="card stack"><div className="row between"><span className="small dim">Dikirim {dt(d.delivery.delivered_at)}</span><Badge v={d.delivery.status} /></div><p className="pre" style={{ margin: 0 }}>{d.delivery.delivery_note}</p>
      {m.status === "AWAITING_ACCEPTANCE" && <div className="card" style={{ background: "#0b1120" }}><h3>Keputusan Anda</h3>
        <Form label="Kirim keputusan" fields={[{ name: "decision", label: "Keputusan", type: "select", options: [{ value: "accept", label: "Terima — sesuai kriteria penerimaan" }, { value: "dispute", label: "Sengketakan — tidak sesuai" }] }, { name: "note", label: "Catatan", type: "textarea", required: true }]}
          submit={(v) => api(`/missions/${id}/acceptance`, { method: "POST", json: v }).then((r) => { q.refetch(); return r; })} /></div>}
    </div></Section>}
    <Section title="Artefak" sub="Disimpan privat. Tautan unduhan berlaku 5 menit.">
      <Table rows={d.artifacts} empty="Belum ada artefak" cols={[{ h: "Berkas", r: (a: any) => a.filename }, { h: "Ukuran", r: (a: any) => `${Math.ceil(a.size_bytes / 1024)} KB` }, { h: "SHA-256", r: (a: any) => <span className="mono small dim">{a.sha256.slice(0, 12)}…</span> }, { h: "", r: (a: any) => <ActionButton run={() => download(a.id)}>Unduh</ActionButton> }]} />
      {can("delivery:write") && <ArtifactUpload missionId={id!} onDone={() => q.refetch()} />}
    </Section>
    {can("workspace:read") && <>
      <Section title="Tugas"><Table rows={d.tasks} empty="Belum ada tugas" cols={[{ h: "Tugas", r: (t: any) => t.title }, { h: "Pelaksana", r: (t: any) => t.executor_type === "agent" ? `Agen: ${t.agent_name ?? "—"}` : `Manusia: ${t.assignee_name ?? "belum ditugaskan"}` }, { h: "Kompensasi", r: (t: any) => t.compensation_minor ? `Rp ${t.compensation_minor.toLocaleString("id-ID")}` : "—" }, { h: "Status", r: (t: any) => <Badge v={t.status} /> }]} /></Section>
      <Section title="Riwayat transisi"><Table rows={d.transitions} cols={[{ h: "Dari", r: (t: any) => <Badge v={t.from_state} /> }, { h: "Ke", r: (t: any) => <Badge v={t.to_state} /> }, { h: "Alasan", r: (t: any) => t.reason }, { h: "Waktu", r: (t: any) => dt(t.created_at) }]} /></Section>
    </>}
  </div>; }}</Q>;
}

function ArtifactUpload({ missionId, onDone }: { missionId: string; onDone: () => void }) {
  const api = useApi();
  return <div className="row"><input type="file" id="art-up" style={{ maxWidth: 320 }} />
    <ActionButton done="Terunggah" run={async () => {
      const f = (document.getElementById("art-up") as HTMLInputElement).files?.[0];
      if (!f) throw new Error("Pilih berkas dahulu");
      await api(`/missions/${missionId}/artifacts?filename=${encodeURIComponent(f.name)}`, { method: "POST", body: f, headers: { "content-type": f.type || "application/octet-stream" } });
      onDone();
    }}>Unggah artefak</ActionButton></div>;
}
