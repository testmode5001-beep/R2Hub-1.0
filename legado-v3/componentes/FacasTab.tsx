// Aba de Facas para Afiação: envio (medida + substrato), acompanhamento
// e registro do retorno com estado da faca (bom/regular/ruim) + solicitar nova.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { listSubstratos, addSubstrato, enviarFacaAfiacao, receberFaca, listFacas } from "@/lib/api/facas.functions";

const sombra = { boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" };
const inp = "w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground";

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Dias corridos desde a data (para sinalizar há quanto tempo a faca está fora). */
function diasDesde(s: string): string {
  const ms = Date.now() - new Date(s).getTime();
  const dias = Math.floor(ms / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

const ESTADO_INFO: Record<string, { label: string; cls: string }> = {
  bom: { label: "Bom", cls: "bg-[color:var(--success,#16a34a)]/15 text-[color:var(--success,#16a34a)]" },
  regular: { label: "Regular", cls: "bg-[color:var(--warning,#d97706)]/15 text-[color:var(--warning,#d97706)]" },
  ruim: { label: "Ruim", cls: "bg-destructive/10 text-destructive" },
};

const ESTADO_LABEL: Record<string, string> = { bom: "bom", regular: "regular", ruim: "ruim" };

export function FacasTab() {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [recebendo, setRecebendo] = useState<any | null>(null);
  const [busca, setBusca] = useState("");

  const { data: facas = [], isLoading } = useQuery({
    queryKey: ["facas"],
    queryFn: () => listFacas(),
    refetchInterval: 10000,
  });

  const q = busca.trim().toLowerCase();
  const filtradas = q
    ? facas.filter((f: any) =>
        String(f.numero).padStart(4, "0").includes(q) ||
        String(f.numero).includes(q) ||
        f.medida?.toLowerCase().includes(q) ||
        f.substrato?.toLowerCase().includes(q) ||
        f.user_nome?.toLowerCase().includes(q) ||
        f.recebida_por?.toLowerCase().includes(q) ||
        (f.estado && (ESTADO_LABEL[f.estado] ?? "").includes(q)) ||
        f.observacao?.toLowerCase().includes(q),
      )
    : facas;

  const emAfiacao = filtradas.filter((f: any) => f.status === "enviada");
  const recebidas = filtradas.filter((f: any) => f.status === "recebida");

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["facas"] });
  }

  return (
    <>
      {!enviando && (
        <button
          onClick={() => setEnviando(true)}
          className="w-full mb-3 bg-yellow text-foreground rounded-[10px] py-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] hover:opacity-85"
        >
          <i className="ti ti-cut"></i> Enviar faca para afiação
        </button>
      )}

      {enviando && (
        <FormEnvio onDone={() => { setEnviando(false); recarregar(); }} onCancel={() => setEnviando(false)} />
      )}

      {!enviando && facas.length > 0 && (
        <div className="relative mb-3">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]"></i>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por medida, substrato, estado, nº..."
            className="w-full bg-card rounded-[10px] pl-8 pr-3 py-[9px] text-[13px] border border-border focus:outline-none focus:border-foreground"
            style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <i className="ti ti-x text-[13px]"></i>
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : facas.length === 0 ? (
        !enviando && (
          <div className="text-center py-9 text-muted-foreground">
            <i className="ti ti-cut text-[34px] block mb-2"></i>
            Nenhuma faca enviada para afiação ainda.
          </div>
        )
      ) : filtradas.length === 0 ? (
        <div className="text-center py-9 text-muted-foreground">
          <i className="ti ti-search-off text-[34px] block mb-2"></i>
          Nenhuma faca encontrada para “{busca}”.
        </div>
      ) : (
        <>
          {emAfiacao.length > 0 && (
            <>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                Em afiação ({emAfiacao.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {emAfiacao.map((f: any) => (
                  <div key={f.id} className="bg-card rounded-[14px] p-3 border-l-[3px] border-l-[color:var(--warning,#d97706)] flex flex-col" style={sombra}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground">#{String(f.numero).padStart(4, "0")}</span>
                      <span className="text-[9px] font-extrabold px-[6px] py-[2px] rounded-[10px] bg-[color:var(--warning,#d97706)]/15 text-[color:var(--warning,#d97706)] whitespace-nowrap">
                        <i className="ti ti-clock mr-[2px]"></i>Em afiação
                      </span>
                    </div>
                    <div className="font-display text-[20px] font-extrabold leading-none">{f.medida}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 truncate">{f.substrato}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Enviada {new Date(f.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      <span className="font-bold text-foreground"> · {diasDesde(f.created_at)}</span>
                    </div>
                    <button
                      onClick={() => setRecebendo(f)}
                      className="mt-2 w-full rounded-[10px] py-[7px] px-2 text-[11px] font-bold bg-foreground text-yellow flex items-center justify-center gap-1"
                    >
                      <i className="ti ti-package-import"></i>Faca chegou
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {recebidas.length > 0 && (
            <>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                Recebidas
              </div>
              <div className="space-y-2">
                {recebidas.map((f: any) => (
                  <div key={f.id} className="bg-card rounded-[14px] py-[13px] px-[15px]" style={sombra}>
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div className="text-sm font-bold">#{String(f.numero).padStart(4, "0")} — {f.medida}</div>
                      <div className="flex gap-1 items-center">
                        {f.estado && (
                          <span className={`text-[10px] font-extrabold px-2 py-[3px] rounded-[12px] ${ESTADO_INFO[f.estado]?.cls ?? ""}`}>
                            {ESTADO_INFO[f.estado]?.label ?? f.estado}
                          </span>
                        )}
                        {!!f.nova_solicitada && (
                          <span className="text-[10px] font-extrabold px-2 py-[3px] rounded-[12px] bg-foreground text-yellow">
                            <i className="ti ti-plus mr-[2px]"></i>Nova solicitada
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-1">
                      <span>{f.substrato}</span>
                      {f.valor != null && <span className="font-bold text-foreground">R$ {Number(f.valor).toFixed(2).replace(".", ",")}</span>}
                      <span>Enviada {fmtDate(f.created_at)}</span>
                      {f.recebida_em && <span>Recebida {fmtDate(f.recebida_em)} · {f.recebida_por}</span>}
                    </div>
                    {f.observacao && <div className="text-[12px] mt-1">{f.observacao}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {recebendo && (
        <ModalReceber
          faca={recebendo}
          onClose={() => setRecebendo(null)}
          onDone={() => { setRecebendo(null); recarregar(); }}
        />
      )}
    </>
  );
}

function FormEnvio({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [medida, setMedida] = useState("");
  const [substrato, setSubstrato] = useState("");
  const [novoSubstrato, setNovoSubstrato] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: substratos = [] } = useQuery({
    queryKey: ["faca-substratos"],
    queryFn: () => listSubstratos(),
  });

  async function salvarNovoSubstrato() {
    if (!novoSubstrato || novoSubstrato.trim().length < 2) return;
    try {
      await addSubstrato({ data: { nome: novoSubstrato.trim() } });
      toast.success("Matéria-prima adicionada.");
      setSubstrato(novoSubstrato.trim());
      setNovoSubstrato(null);
      qc.invalidateQueries({ queryKey: ["faca-substratos"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
    }
  }

  async function enviar() {
    if (!medida.trim() || !substrato) { toast.error("Preencha a medida e o substrato."); return; }
    setSalvando(true);
    try {
      const res = await enviarFacaAfiacao({ data: { medida: medida.trim(), substrato } });
      toast.success(`Faca #${String(res.numero).padStart(4, "0")} registrada — aguardando retorno da afiação.`);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-card rounded-[14px] p-4 mb-3" style={sombra}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-[15px] font-extrabold flex items-center gap-[7px]">
          <i className="ti ti-cut"></i>Enviar faca para afiação
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
      </div>

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Medida da faca *</div>
      <input value={medida} onChange={(e) => setMedida(e.target.value)} placeholder="Ex.: 80 × 60" className={`${inp} mb-3`} />

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Substrato *</div>
      <div className="flex flex-wrap gap-[6px] mb-2">
        {substratos.map((s: any) => (
          <button key={s.id} type="button" onClick={() => setSubstrato(s.nome)}
            className={`py-[6px] px-[11px] rounded-[20px] border-[1.5px] text-xs font-medium whitespace-nowrap ${substrato === s.nome ? "bg-foreground text-yellow border-foreground" : "bg-background border-border"}`}>
            {s.nome}
          </button>
        ))}
        {novoSubstrato === null && (
          <button type="button" onClick={() => setNovoSubstrato("")} title="Adicionar matéria-prima"
            className="py-[6px] px-[11px] rounded-[20px] border-[1.5px] border-dashed border-border text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground">
            <i className="ti ti-plus mr-1"></i>Nova matéria-prima
          </button>
        )}
      </div>
      {novoSubstrato !== null && (
        <div className="flex gap-2 mb-3">
          <input value={novoSubstrato} onChange={(e) => setNovoSubstrato(e.target.value)} placeholder="Nome da matéria-prima..." autoFocus className={`flex-1 ${inp}`} />
          <button onClick={salvarNovoSubstrato} className="rounded-[10px] px-3 bg-foreground text-yellow text-[13px] font-bold">Salvar</button>
          <button onClick={() => setNovoSubstrato(null)} className="rounded-[10px] px-3 border-[1.5px] border-border bg-background text-[13px] font-bold">
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}

      <button onClick={enviar} disabled={!medida.trim() || !substrato || salvando}
        className="w-full mt-2 bg-yellow text-foreground rounded-[10px] py-3 font-bold text-sm flex items-center justify-center gap-[6px] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed">
        <i className="ti ti-send"></i> {salvando ? "Registrando..." : "Registrar envio"}
      </button>
    </div>
  );
}

/** Aceita "12,50", "1.250,00" ou "12.50" e devolve o número (ou NaN). */
function parseValor(v: string): number {
  const s = v.trim();
  if (!s) return NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s);
}

function ModalReceber({ faca, onClose, onDone }: { faca: any; onClose: () => void; onDone: () => void }) {
  const [estado, setEstado] = useState<"bom" | "regular" | "ruim" | "">("");
  const [solicitarNova, setSolicitarNova] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseValor(valor);
  const valorInvalido = valor.trim() !== "" && (!Number.isFinite(valorNum) || valorNum < 0);

  async function confirmar() {
    if (!estado) { toast.error("Informe o estado da faca."); return; }
    if (valorInvalido) { toast.error("Valor inválido."); return; }
    setSalvando(true);
    try {
      await receberFaca({
        data: {
          id: faca.id,
          estado,
          solicitarNova,
          observacao: observacao.trim() || null,
          valor: valor.trim() !== "" ? valorNum : null,
        },
      });
      toast.success(
        solicitarNova
          ? "Faca recebida — solicitação de faca nova registrada."
          : "Faca recebida e registrada.",
      );
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[360px]" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[16px] font-extrabold flex items-center gap-2">
            <i className="ti ti-package-import"></i>Faca chegou
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">
          #{String(faca.numero).padStart(4, "0")} — {faca.medida} · {faca.substrato}
        </p>

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Estado da faca *</div>
        <div className="grid grid-cols-3 gap-[6px] mb-4">
          {([["bom", "Bom", "ti-thumb-up"], ["regular", "Regular", "ti-adjustments"], ["ruim", "Ruim", "ti-thumb-down"]] as const).map(([k, l, ic]) => (
            <button key={k} type="button" onClick={() => setEstado(k)}
              className={`py-2 px-1 rounded-[10px] border-[1.5px] text-[13px] font-semibold flex flex-col items-center gap-[2px] ${estado === k ? "bg-foreground text-yellow border-foreground" : "bg-background border-border"}`}>
              <i className={`ti ${ic}`}></i>{l}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Valor da afiação (R$)</div>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">R$</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={`${inp} pl-8 ${valorInvalido ? "border-destructive" : ""}`}
          />
        </div>

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Observação</div>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: fio irregular no canto, afiação parcial..."
          className={`${inp} min-h-[60px] resize-y mb-3`}
        />

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={solicitarNova} onChange={(e) => setSolicitarNova(e.target.checked)} className="w-4 h-4 accent-[var(--foreground)]" />
          <span className="text-[13px] font-semibold">Solicitar faca nova</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-background border border-border">Cancelar</button>
          <button onClick={confirmar} disabled={!estado || salvando} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow disabled:opacity-40">
            {salvando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
