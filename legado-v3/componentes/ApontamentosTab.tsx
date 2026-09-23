// Aba de Apontamentos (gestão): clichês, matéria-prima, medidas, vendedoras
// e artes/aprovações por dia, filtrados por período.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApontamentos } from "@/lib/api/cliches.functions";

const sombra = { boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" };
const inp = "bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground";

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDia(iso: string): string {
  return iso.split("-").reverse().slice(0, 2).join("/");
}

function fmtBRL(v: number): string {
  return `R$ ${Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, ".")}`;
}

export function ApontamentosTab() {
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hojeLocal());

  const { data, isLoading } = useQuery({
    queryKey: ["apontamentos", de, ate],
    queryFn: () => getApontamentos({ data: { de, ate } }),
  });

  const presets = [
    { l: "Hoje", d: 0 },
    { l: "7 dias", d: 7 },
    { l: "30 dias", d: 30 },
    { l: "90 dias", d: 90 },
  ];

  return (
    <>
      {/* Período */}
      <div className="bg-card rounded-[14px] p-3 mb-3" style={sombra}>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inp} />
          <span className="text-[12px] text-muted-foreground">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inp} />
          <div className="flex gap-[6px] ml-auto">
            {presets.map((p) => (
              <button key={p.l} onClick={() => { setDe(diasAtras(p.d)); setAte(hojeLocal()); }}
                className="px-[10px] py-[5px] rounded-[20px] border-[1.5px] border-border bg-background text-[11px] font-bold hover:border-foreground">
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <CardNum n={data.pedidos.qtde} l="Pedidos" />
            <CardNum n={data.cliches.qtde} l="Clichês recebidos" />
            <CardNum n={fmtBRL(data.cliches.total)} l="Gasto com clichês" pequeno />
          </div>

          <Secao titulo="Clichês por dia" icone="ti-printer">
            {data.clichesPorDia.length === 0 ? <Vazio /> : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">
                    <th className="text-left py-1">Dia</th>
                    <th className="text-center py-1">Registros</th>
                    <th className="text-right py-1">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.clichesPorDia as any[]).map((c) => (
                    <tr key={c.dia} className="border-t border-border">
                      <td className="py-[6px] font-semibold">{fmtDia(c.dia)}</td>
                      <td className="py-[6px] text-center">{c.qtde}</td>
                      <td className="py-[6px] text-right font-bold">{fmtBRL(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>

          <Secao titulo="Solicitações de clichê por motivo" icone="ti-mail-forward">
            <Barras itens={(data.solicitacoesPorMotivo as any[]).map((m) => ({ label: m.motivo, valor: m.qtde }))} />
          </Secao>

          <Secao titulo="Matéria-prima dos pedidos" icone="ti-layers">
            <Barras itens={(data.materias as any[]).map((m) => ({ label: m.materia, valor: m.qtde }))} />
          </Secao>

          <Secao titulo="Medidas mais pedidas" icone="ti-ruler-measure">
            <Barras itens={(data.medidas as any[]).map((m) => ({ label: m.medida, valor: m.qtde }))} />
          </Secao>

          <Secao titulo="Pedidos por vendedora" icone="ti-user-star">
            <Barras itens={(data.vendedoras as any[]).map((v) => ({ label: v.nome, valor: v.qtde }))} />
          </Secao>

          <Secao titulo="Facas para afiação" icone="ti-cut">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <CardNum n={data.facas?.enviadas ?? 0} l="Enviadas" />
              <CardNum n={data.facas?.em_afiacao ?? 0} l="Em afiação" />
              <CardNum n={data.facas?.novas_solicitadas ?? 0} l="Novas solicitadas" />
              <CardNum n={fmtBRL(data.facasGasto ?? 0)} l="Gasto com afiação" pequeno />
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-1">Por substrato</div>
            <Barras itens={((data.facasPorSubstrato ?? []) as any[]).map((s) => ({ label: s.substrato, valor: s.qtde }))} />
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-1 mt-3">Estado das facas recebidas</div>
            <Barras itens={((data.facasPorEstado ?? []) as any[]).map((e) => ({ label: e.estado === "bom" ? "Bom" : e.estado === "regular" ? "Regular" : "Ruim", valor: e.qtde }))} />
          </Secao>

          <Secao titulo="Artes enviadas × aprovações por dia" icone="ti-brush">
            {data.artesAprovacoesPorDia.length === 0 ? <Vazio /> : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">
                    <th className="text-left py-1">Dia</th>
                    <th className="text-center py-1">Artes enviadas</th>
                    <th className="text-center py-1">Aprovações</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.artesAprovacoesPorDia as any[]).map((d) => (
                    <tr key={d.dia} className="border-t border-border">
                      <td className="py-[6px] font-semibold">{fmtDia(d.dia)}</td>
                      <td className="py-[6px] text-center">{d.artes}</td>
                      <td className="py-[6px] text-center">{d.aprovacoes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Secao>
        </>
      )}
    </>
  );
}

function CardNum({ n, l, pequeno }: { n: number | string; l: string; pequeno?: boolean }) {
  return (
    <div className="bg-card rounded-[10px] py-3 px-[10px] text-center" style={sombra}>
      <div className={`font-display font-extrabold leading-none ${pequeno ? "text-[15px] pt-[6px]" : "text-[24px]"}`}>{n}</div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em] mt-[4px]">{l}</div>
    </div>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-[14px] p-4 mb-3" style={sombra}>
      <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]">
        <i className={`ti ${icone}`}></i>{titulo}
      </div>
      {children}
    </div>
  );
}

function Vazio() {
  return <div className="text-[12px] text-muted-foreground">Sem dados no período.</div>;
}

function Barras({ itens }: { itens: { label: string; valor: number }[] }) {
  if (itens.length === 0) return <Vazio />;
  const max = Math.max(...itens.map((i) => i.valor));
  return (
    <div className="space-y-[6px]">
      {itens.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <div className="w-[140px] text-[12px] font-semibold truncate shrink-0" title={i.label}>{i.label}</div>
          <div className="flex-1 h-[16px] bg-background rounded-[8px] overflow-hidden">
            <div className="h-full bg-yellow rounded-[8px]" style={{ width: `${Math.max(6, (i.valor / max) * 100)}%` }} />
          </div>
          <div className="w-[30px] text-right text-[12px] font-extrabold shrink-0">{i.valor}</div>
        </div>
      ))}
    </div>
  );
}
