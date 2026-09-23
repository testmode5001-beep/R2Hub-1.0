// Aba de Solicitações de Clichê (designer): formulário que envia e-mail direto
// à clicheria pelo R2 Hub + histórico das solicitações.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  listMotivosCliche, addMotivoCliche, criarSolicitacaoCliche, listSolicitacoesCliche,
} from "@/lib/api/cliches.functions";
import { fileToBase64 } from "@/lib/files";

const sombra = { boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" };
const inp = "w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground";

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ClichesTab() {
  const [criando, setCriando] = useState(false);
  const qc = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["cliche-solicitacoes"],
    queryFn: () => listSolicitacoesCliche(),
  });

  return (
    <>
      {!criando && (
        <button
          onClick={() => setCriando(true)}
          className="w-full mb-3 bg-yellow text-foreground rounded-[10px] py-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] hover:opacity-85"
        >
          <i className="ti ti-mail-forward"></i> Nova solicitação de clichê
        </button>
      )}

      {criando && (
        <FormSolicitacao
          onDone={() => {
            setCriando(false);
            qc.invalidateQueries({ queryKey: ["cliche-solicitacoes"] });
          }}
          onCancel={() => setCriando(false)}
        />
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : solicitacoes.length === 0 ? (
        !criando && (
          <div className="text-center py-9 text-muted-foreground">
            <i className="ti ti-mail text-[34px] block mb-2"></i>
            Nenhuma solicitação de clichê ainda.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {solicitacoes.map((s: any) => (
            <div key={s.id} className="bg-card rounded-[14px] py-[13px] px-[15px]" style={sombra}>
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div className="text-sm font-bold">
                  #{String(s.numero).padStart(4, "0")} — {s.motivo}
                </div>
                {s.email_enviado ? (
                  <span className="text-[10px] font-extrabold px-2 py-[3px] rounded-[12px] bg-[color:var(--success,#16a34a)]/15 text-[color:var(--success,#16a34a)]">
                    <i className="ti ti-mail-check mr-1"></i>E-mail enviado
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-[3px] rounded-[12px] bg-destructive/10 text-destructive" title={s.email_erro ?? ""}>
                    <i className="ti ti-mail-x mr-1"></i>E-mail não enviado
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-1">
                <span>Clichê {s.tipo}</span>
                {s.cliente && <span>{s.cliente}</span>}
                <span>{(s.cores as any[]).map((c) => (typeof c === "string" ? c : `${c.cor} ×${c.quantidade}`)).join(", ")}</span>
                <span>{fmtDate(s.created_at)} · {s.user_nome}</span>
              </div>
              {s.observacao && <div className="text-[12px] mt-1">{s.observacao}</div>}
              {!s.email_enviado && s.email_erro && (
                <div className="text-[11px] text-destructive mt-1">Motivo: {s.email_erro}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FormSolicitacao({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"1.70" | "1.14" | "">("");
  const [cliente, setCliente] = useState("");
  const [cores, setCores] = useState<string[]>([""]);
  const [motivo, setMotivo] = useState("");
  const [novoMotivo, setNovoMotivo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: motivos = [] } = useQuery({
    queryKey: ["cliche-motivos"],
    queryFn: () => listMotivosCliche(),
  });

  const valido = tipo && motivo && cores.length > 0 && cores.every((c) => c.trim());

  function setCor(i: number, v: string) {
    setCores((cs) => cs.map((c, idx) => (idx === i ? v : c)));
  }

  function addArquivos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setArquivos((prev) => [...prev, ...files]);
  }

  async function salvarNovoMotivo() {
    if (!novoMotivo || novoMotivo.trim().length < 2) return;
    try {
      await addMotivoCliche({ data: { nome: novoMotivo.trim() } });
      toast.success("Motivo adicionado.");
      setMotivo(novoMotivo.trim());
      setNovoMotivo(null);
      qc.invalidateQueries({ queryKey: ["cliche-motivos"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar motivo");
    }
  }

  async function enviar() {
    if (!valido) { toast.error("Preencha tipo, motivo e as cores."); return; }
    setEnviando(true);
    try {
      const anexos = [];
      for (const file of arquivos) {
        anexos.push({ nome: file.name, dataBase64: await fileToBase64(file) });
      }
      const res = await criarSolicitacaoCliche({
        data: {
          tipo: tipo as "1.70" | "1.14",
          cliente: cliente.trim() || null,
          cores: cores.map((c) => c.trim()),
          motivo,
          observacao: observacao.trim() || null,
          anexos,
        },
      });
      if (res.emailEnviado) {
        toast.success(`Solicitação #${String(res.numero).padStart(4, "0")} enviada por e-mail à clicheria!`);
      } else {
        toast.warning(
          `Solicitação #${String(res.numero).padStart(4, "0")} registrada, mas o e-mail NÃO foi enviado: ${res.emailErro}`,
          { duration: 9000 },
        );
      }
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar solicitação");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-card rounded-[14px] p-4 mb-3" style={sombra}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-[15px] font-extrabold flex items-center gap-[7px]">
          <i className="ti ti-mail-forward"></i>Nova solicitação de clichê
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
      </div>

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Tipo de clichê *</div>
      <div className="grid grid-cols-2 gap-[6px] mb-3">
        {(["1.70", "1.14"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`py-2 px-1 rounded-[10px] border-[1.5px] text-[13px] font-semibold ${tipo === t ? "bg-foreground text-yellow border-foreground" : "bg-background border-border"}`}>
            Clichê {t}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Cliente / referência (opcional)</div>
      <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: Padaria São João — rótulo bolo" className={`${inp} mb-3`} />

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Cores *</div>
      <div className="space-y-2 mb-1">
        {cores.map((c, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={c} onChange={(e) => setCor(i, e.target.value)} placeholder={`Cor ${i + 1} (ex.: Pantone 185 ou Ciano)`} className={`flex-1 ${inp}`} />
            {cores.length > 1 && (
              <button onClick={() => setCores((cs) => cs.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0" title="Remover">
                <i className="ti ti-x text-[14px]"></i>
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setCores((cs) => [...cs, ""])} className="text-[12px] font-bold text-muted-foreground hover:text-foreground mb-3">
        <i className="ti ti-plus mr-1"></i>Adicionar cor
      </button>

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Motivo da solicitação *</div>
      {novoMotivo === null ? (
        <div className="flex gap-2 mb-3">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`flex-1 ${inp}`}>
            <option value="">Selecione o motivo...</option>
            {motivos.map((m: any) => (
              <option key={m.id} value={m.nome}>{m.nome}</option>
            ))}
          </select>
          <button onClick={() => setNovoMotivo("")} title="Adicionar novo motivo" className="rounded-[10px] px-3 border-[1.5px] border-border bg-background text-[13px] font-bold hover:border-foreground">
            <i className="ti ti-plus"></i>
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Novo motivo..." autoFocus className={`flex-1 ${inp}`} />
          <button onClick={salvarNovoMotivo} className="rounded-[10px] px-3 bg-foreground text-yellow text-[13px] font-bold">Salvar</button>
          <button onClick={() => setNovoMotivo(null)} className="rounded-[10px] px-3 border-[1.5px] border-border bg-background text-[13px] font-bold">
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Observações</div>
      <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhes adicionais para a clicheria..." className={`${inp} min-h-[70px] resize-y mb-3`} />

      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Anexos</div>
      <label className="block border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-foreground relative">
        <input type="file" multiple onChange={(e) => { addArquivos(e.target.files); e.target.value = ""; }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <i className="ti ti-cloud-upload text-lg text-muted-foreground"></i>
        <p className="text-[11px] text-muted-foreground mt-[2px]">Anexar arte/arquivos para a clicheria (vão junto no e-mail)</p>
      </label>
      {arquivos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((file, i) => (
            <li key={i} className="flex items-center gap-2 bg-background border border-border rounded-[8px] px-2 py-1 text-[12px]">
              <i className="ti ti-file"></i>
              <span className="flex-1 truncate">{file.name}</span>
              <button type="button" onClick={() => setArquivos((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <i className="ti ti-x"></i>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={enviar} disabled={!valido || enviando}
        className="w-full mt-4 bg-yellow text-foreground rounded-[10px] py-3 font-bold text-sm flex items-center justify-center gap-[6px] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed">
        <i className="ti ti-send"></i> {enviando ? "Enviando..." : "Enviar solicitação por e-mail"}
      </button>
    </div>
  );
}
