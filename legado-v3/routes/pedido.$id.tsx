import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getPedido, changeStatus, registrarCliche } from "@/lib/api/pedidos.functions";
import { uploadAnexo, downloadAnexo, deleteAnexo, listPastaCliente } from "@/lib/api/anexos.functions";
import { getHomeStats } from "@/lib/api/config.functions";
import { logout } from "@/lib/api/auth.functions";
import { clearStoredSession, getStoredSession, hasPerm, type SessionUser } from "@/lib/session";
import { abrirBlob, base64ToBlob, copiarTexto, fileToBase64, fmtTamanho, salvarBlob, toFileUrl } from "@/lib/files";
import { PaginaHub } from "@/components/PaginaHub";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  head: () => ({ meta: [{ title: "Pedido — R2 Hub" }] }),
  component: PedidoDetail,
});

type Status = "nova" | "criacao" | "aguardando" | "revisao" | "aprovada" | "cliche" | "concluido" | "cancelado";

const STATUS_LIST: { key: Status; label: string; cls: string }[] = [
  { key: "nova", label: "Nova", cls: "s-nova" },
  { key: "criacao", label: "Em criação", cls: "s-criacao" },
  { key: "aguardando", label: "Aguardando aprovação", cls: "s-aguardando" },
  { key: "revisao", label: "Revisão solicitada", cls: "s-revisao" },
  { key: "aprovada", label: "Arte aprovada", cls: "s-aprovada" },
  { key: "cliche", label: "Clichê solicitado", cls: "s-cliche" },
  { key: "concluido", label: "Concluído", cls: "s-concluido" },
  { key: "cancelado", label: "Cancelado", cls: "s-cancelado" },
];
const sInfo = (k: Status) => STATUS_LIST.find((s) => s.key === k) ?? STATUS_LIST[0];

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function PedidoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profile] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);

  const { data } = useQuery({
    queryKey: ["pedido", id],
    queryFn: () => getPedido({ data: { id } }),
    refetchInterval: 8000,
    enabled: !!profile,
  });

  // Contadores das bolhas do menu (mesma fonte da capa/Central).
  const { data: stats } = useQuery({ queryKey: ["home-stats"], queryFn: () => getHomeStats(), refetchInterval: 30_000, enabled: !!profile });

  // Menu de capa: navega para as abas do /app (ou rota própria, ex.: /usuarios).
  function irPara(to: string) {
    if (to.startsWith("/app")) {
      const tab = new URL(to, window.location.origin).searchParams.get("tab");
      navigate({ to: "/app", search: (tab ? { tab } : {}) as any });
    } else {
      navigate({ to: to as any });
    }
  }

  async function doLogout() {
    await qc.cancelQueries();
    qc.clear();
    try { await logout(); } catch { /* sessão pode já ter expirado */ }
    clearStoredSession();
    navigate({ to: "/auth", replace: true });
  }

  const pedido = data?.pedido as any;
  const historico = (data?.historico ?? []) as any[];
  const anexos = (data?.anexos ?? []) as any[];
  const cliches = (data?.cliches ?? []) as any[];
  const pasta = data?.pasta as { nome: string; caminho: string } | null;
  const [apagandoAnexo, setApagandoAnexo] = useState<any | null>(null);
  const [modalCliche, setModalCliche] = useState(false);

  async function doChangeStatus(newStatus: Status, observacao: string) {
    try {
      await changeStatus({ data: { id, status: newStatus, observacao: observacao || null } });
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["pedido", id] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function uploadArquivo(file: File, tipo: "arte" | "anexo") {
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await uploadAnexo({ data: { pedidoId: id, tipo, nome: file.name, dataBase64 } });
      toast.success(
        tipo === "arte"
          ? `Arte enviada (v${res.versao}) — salva na pasta do cliente`
          : "Arquivo enviado — salvo na pasta do cliente",
      );
      qc.invalidateQueries({ queryKey: ["pedido", id] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    }
  }

  async function doDeleteAnexo(anexoId: string) {
    try {
      await deleteAnexo({ data: { anexoId } });
      setApagandoAnexo(null);
      toast.success("Anexo apagado (arquivo removido da pasta do cliente).");
      qc.invalidateQueries({ queryKey: ["pedido", id] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar anexo");
    }
  }

  async function openAnexo(anexoId: string) {
    try {
      const { dataBase64, mime } = await downloadAnexo({ data: { anexoId } });
      abrirBlob(base64ToBlob(dataBase64, mime));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
    }
  }

  async function baixarAnexo(anexoId: string) {
    try {
      const { dataBase64, mime, nome } = await downloadAnexo({ data: { anexoId } });
      salvarBlob(base64ToBlob(dataBase64, mime), nome);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar arquivo.");
    }
  }

  if (!profile || !pedido) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const isDesigner = hasPerm(profile, "pedidos.status_design");
  const isVendedor = hasPerm(profile, "pedidos.aprovar");
  const isDono = pedido.vendedor_id === profile.id;
  const podeAnexar = isDesigner || isDono;
  const podeApagarAnexo = (a: any) =>
    a.user_id === profile.id || isDesigner || hasPerm(profile, "pedidos.editar_todos");
  const status = pedido.status as Status;
  const isCliche = pedido.tipo === "cliche";

  return (
    <>
      <PaginaHub
        titulo={pedido.cliente}
        user={profile}
        stats={stats}
        aoAbrirMenu={irPara}
        onHome={() => navigate({ to: "/home" })}
        onLogout={doLogout}
        larguraConteudo="clamp(320px, 92vw, 1100px)"
        arTopo="clamp(10px, 1.6vh, 22px)"
        acoesTopo={({ corApoio }: any) => (
          <button
            onClick={() => navigate({ to: "/app" })}
            className="uppercase tracking-wider hover:opacity-70"
            style={{ color: corApoio, fontWeight: 600, fontSize: "clamp(10px, 0.85vw, 13px)" }}
          >
            <i className="ti ti-arrow-left mr-1"></i>Voltar
          </button>
        )}
      >
        {({ corApoio, videoAtivo }: any) => (
          <>
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className={`inline-block px-2 py-[3px] rounded-[12px] text-[10px] font-extrabold tracking-[0.03em] ${sInfo(status).cls}`}>{sInfo(status).label}</span>
              <span className="text-[12px] uppercase tracking-[0.06em]" style={{ color: corApoio, fontWeight: 500, opacity: videoAtivo ? 0.95 : 0.65 }}>
                Pedido #{pedido.numero} · Criado em {fmtDate(pedido.created_at)}
              </span>
            </div>

            {isCliche && (
          <div className="bg-yellow rounded-[14px] p-4 mb-[10px] flex items-center gap-3" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
            <i className="ti ti-stamp text-[22px]"></i>
            <div>
              <div className="font-display text-[15px] font-extrabold leading-tight">Reposição de clichê</div>
              <div className="text-[12px] font-semibold">Código do produto: <strong>{pedido.codigo_produto}</strong></div>
            </div>
          </div>
        )}

            {/* 2 colunas ALINHADAS (base da Nova): items-stretch + o último card
                de cada coluna cresce → os rodapés das colunas casam na base. */}
            <div className="flex flex-wrap items-stretch" style={{ gap: "14px" }}>
            <div className="pcol flex flex-col">

        {/* Pasta do Cliente (Etapa 1) */}
        {pasta && (
          <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
            <div className="font-display text-[15px] font-extrabold mb-2 flex items-center gap-[7px]"><i className="ti ti-folder"></i>Pasta do Cliente</div>
            <div className="text-[11px] text-muted-foreground break-all bg-background border border-border rounded-[8px] px-2 py-[6px] font-mono mb-2">
              {pasta.caminho}
            </div>
            <div className="flex gap-2">
              <a
                href={toFileUrl(pasta.caminho)}
                onClick={async () => {
                  try { await navigator.clipboard.writeText(pasta.caminho); } catch { /* sem clipboard */ }
                  toast.info("Caminho copiado! Se a pasta não abrir sozinha, aperte Win+E e cole (Ctrl+V) na barra de endereço.", { duration: 8000 });
                }}
                className="flex-1 rounded-[10px] py-2 px-3 text-[12px] font-bold bg-yellow text-foreground text-center"
              >
                <i className="ti ti-folder-open mr-1"></i>Abrir Pasta do Cliente
              </a>
              <button
                onClick={() => copiarTexto(pasta.caminho)}
                className="rounded-[10px] py-2 px-3 text-[12px] font-bold bg-background border-[1.5px] border-border"
              >
                <i className="ti ti-copy mr-1"></i>Copiar caminho
              </button>
            </div>
            <PastaArquivos pedidoId={id} />
          </div>
        )}

        {/* Specs */}
        <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
          <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className="ti ti-clipboard-list"></i>{isCliche ? "Solicitação" : "Especificações"}</div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[13px]">
            {isCliche ? (
              <>
                <Info l="Código do produto" v={pedido.codigo_produto} />
                {pedido.motivo && <Info l="Motivo" v={pedido.motivo} />}
                {pedido.vendedor_nome && <Info l="Solicitante" v={pedido.vendedor_nome} />}
                {pedido.designer_nome && <Info l="Designer" v={pedido.designer_nome} />}
              </>
            ) : (
              <>
                <Info l="Matéria-prima" v={pedido.materia} />
                <Info l="Largura MP" v={`${pedido.larg_materia} mm`} />
                <Info l="Medidas" v={`${pedido.largura} × ${pedido.altura} mm`} />
                <Info l="Formato" v={pedido.forma} />
                <Info l="Cores" v={pedido.cores} />
                {pedido.carreiras && <Info l="Carreiras" v={pedido.carreiras} />}
                {pedido.cores_desc && <Info l="Especificação" v={pedido.cores_desc} />}
                {pedido.vendedor_nome && <Info l="Vendedor(a)" v={pedido.vendedor_nome} />}
                {pedido.designer_nome && <Info l="Designer" v={pedido.designer_nome} />}
              </>
            )}
          </div>
          {!isCliche && (
            <div className="mt-3">
              <Label>Briefing</Label>
              <div className="text-[13px] whitespace-pre-wrap">{pedido.descricao}</div>
            </div>
          )}
          {pedido.link_ref && (
            <div className="mt-2">
              <Label>Referência</Label>
              <a href={pedido.link_ref} target="_blank" rel="noreferrer" className="text-[13px] underline break-all">{pedido.link_ref}</a>
            </div>
          )}
        </div>

        {/* Anexos */}
        <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
          <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className="ti ti-paperclip"></i>Anexos</div>

          {anexos.length === 0 && (
            <div className="text-[12px] text-muted-foreground mb-2">Nenhum anexo registrado.</div>
          )}

          {anexos.map((a: any) => (
            <div key={a.id} className="w-full flex items-center gap-2 bg-background border border-border rounded-[10px] px-3 py-2 mb-2">
              <i className={`ti ${a.tipo === "arte" ? "ti-brush" : "ti-file"} text-lg`}></i>
              <button onClick={() => openAnexo(a.id)} className="flex-1 min-w-0 text-left hover:opacity-75">
                <div className="text-[12px] font-bold truncate">
                  {a.tipo === "arte" ? `Arte (v${a.versao})` : a.tipo === "faca" ? "Faca" : "Anexo"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{a.nome} · {fmtDate(a.created_at)}</div>
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => baixarAnexo(a.id)} title="Baixar" className="p-1 text-muted-foreground hover:text-foreground"><i className="ti ti-download text-base"></i></button>
                <button onClick={() => copiarTexto(a.path)} title="Copiar caminho na rede" className="p-1 text-muted-foreground hover:text-foreground"><i className="ti ti-copy text-base"></i></button>
                {podeApagarAnexo(a) && (
                  <button onClick={() => setApagandoAnexo(a)} title="Apagar anexo" className="p-1 text-muted-foreground hover:text-destructive"><i className="ti ti-trash text-base"></i></button>
                )}
              </div>
            </div>
          ))}

          {podeAnexar && (
            <label className="block border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-foreground relative mt-2">
              <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArquivo(f, isDesigner ? "arte" : "anexo"); e.currentTarget.value = ""; }} className="absolute inset-0 opacity-0 cursor-pointer" />
              <i className="ti ti-upload text-lg text-muted-foreground"></i>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isDesigner ? "Enviar arte / arquivo (vai para a pasta do cliente)" : "Anexar arquivo (referência, faca, foto — vai para a pasta do cliente)"}
              </p>
            </label>
          )}
        </div>
            </div>{/* fim coluna esquerda */}
            <div className="pcol flex flex-col">

        {/* Clichês registrados */}
        {cliches.length > 0 && (
          <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
            <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className="ti ti-printer"></i>Clichês recebidos</div>
            {cliches.map((c: any) => (
              <div key={c.id} className="bg-background border border-border rounded-[10px] px-3 py-2 mb-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[12px] font-bold">
                    <i className="ti ti-calendar-check mr-1"></i>
                    {c.data_chegada.split("-").reverse().join("/")} às {c.hora_chegada}
                  </span>
                  <span className="text-[11px] text-muted-foreground">por {c.user_nome}</span>
                </div>
                <div className="mt-1 space-y-[2px]">
                  {c.itens.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">{it.descricao}</span>
                      <span className="font-semibold">R$ {Number(it.valor).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[12px] border-t border-border pt-[3px] mt-[3px]">
                    <span className="font-bold">Total</span>
                    <span className="font-extrabold">R$ {Number(c.total).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ações */}
        <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
          <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className="ti ti-bolt"></i>Ações</div>
          {isDesigner && status === "cliche" && (
            <button
              onClick={() => setModalCliche(true)}
              className="w-full mb-2 rounded-[10px] py-2 px-3 text-[12px] font-bold bg-foreground text-yellow flex items-center justify-center gap-2"
            >
              <i className="ti ti-truck-delivery"></i>Clichê chegou
            </button>
          )}
          <ActionPanel
            status={status}
            isDesigner={isDesigner}
            isVendedor={isVendedor}
            onChange={doChangeStatus}
          />
        </div>

        {/* Timeline */}
        <div className="bg-card rounded-[14px] p-4 mb-[10px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
          <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className="ti ti-history"></i>Histórico</div>
          {historico.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">Sem eventos.</div>
          ) : (
            <ol className="relative border-l-2 border-border pl-4 space-y-3">
              {historico.map((h: any) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-yellow border-2 border-foreground"></span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-[2px] rounded-[10px] text-[10px] font-extrabold ${sInfo(h.status).cls}`}>{sInfo(h.status).label}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(h.created_at)}{h.user_nome ? ` · ${h.user_nome}` : ""}</span>
                  </div>
                  {h.observacao && <div className="text-[12px] mt-1">{h.observacao}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
            </div>{/* fim coluna direita */}
            </div>{/* fim das colunas */}
            {/* último card de cada coluna cresce → rodapés alinhados na base */}
            <style>{`.pcol{flex:1 1 320px;min-width:0}.pcol>*{margin-bottom:14px}.pcol>*:last-child{margin-bottom:0;flex:1 1 auto}`}</style>
          </>
        )}
      </PaginaHub>

      {/* Modal confirmar apagar anexo */}
      {apagandoAnexo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-[18px] p-6 w-full max-w-[320px]" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3 mx-auto">
              <i className="ti ti-trash text-destructive text-xl"></i>
            </div>
            <h2 className="font-display text-[17px] font-extrabold text-center mb-1">Apagar anexo?</h2>
            <p className="text-[12px] text-muted-foreground text-center mb-5 break-all">
              <strong>{apagandoAnexo.nome}</strong> será removido do pedido e da pasta do cliente na rede.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setApagandoAnexo(null)} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-background border-[1.5px] border-border">
                Cancelar
              </button>
              <button onClick={() => doDeleteAnexo(apagandoAnexo.id)} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-destructive text-white">
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clichê chegou */}
      {modalCliche && (
        <ClicheModal
          cores={pedido.cores as string}
          onClose={() => setModalCliche(false)}
          onSave={async (dados) => {
            try {
              const res = await registrarCliche({ data: { pedidoId: id, ...dados } });
              toast.success(`Clichê registrado — total R$ ${res.total.toFixed(2).replace(".", ",")}`);
              setModalCliche(false);
              qc.invalidateQueries({ queryKey: ["pedido", id] });
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Erro ao registrar clichê");
            }
          }}
        />
      )}
    </>
  );
}

/** Linhas iniciais do pop-up conforme as cores do pedido. */
function linhasIniciais(cores: string): string[] {
  if (cores === "CMYK") return ["Ciano", "Magenta", "Amarelo", "Preto"];
  if (cores === "4+PANTONE") return ["Ciano", "Magenta", "Amarelo", "Preto", "Pantone"];
  const n = parseInt(cores, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 8) {
    return Array.from({ length: n }, (_, i) => `Cor ${i + 1}`);
  }
  return ["Cor 1"];
}

/** Aceita "12,50", "1.250,00" ou "12.50" e devolve o número. */
function parseValor(v: string): number {
  const s = v.trim();
  if (!s) return NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s);
}

function ClicheModal({ cores, onClose, onSave }: {
  cores: string;
  onClose: () => void;
  onSave: (d: { dataChegada: string; horaChegada: string; itens: { descricao: string; valor: number }[] }) => Promise<void>;
}) {
  const agora = new Date();
  const [dataChegada, setDataChegada] = useState(agora.toISOString().slice(0, 10));
  const [horaChegada, setHoraChegada] = useState(
    `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`,
  );
  const [linhas, setLinhas] = useState<{ descricao: string; valor: string }[]>(
    () => linhasIniciais(cores).map((d) => ({ descricao: d, valor: "" })),
  );
  const [saving, setSaving] = useState(false);

  const total = linhas.reduce((s, l) => {
    const v = parseValor(l.valor);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const valido =
    dataChegada && horaChegada &&
    linhas.length > 0 &&
    linhas.every((l) => l.descricao.trim() && Number.isFinite(parseValor(l.valor)) && parseValor(l.valor) >= 0);

  function setLinha(i: number, campo: "descricao" | "valor", v: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: v } : l)));
  }

  async function salvar() {
    if (!valido) return;
    setSaving(true);
    try {
      await onSave({
        dataChegada,
        horaChegada,
        itens: linhas.map((l) => ({ descricao: l.descricao.trim(), valor: parseValor(l.valor) })),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-card w-full sm:max-w-[420px] rounded-t-[24px] sm:rounded-[18px] p-5 max-h-[90vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[17px] font-extrabold flex items-center gap-2">
            <i className="ti ti-truck-delivery"></i>Clichê chegou
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>

        <div className="grid grid-cols-2 gap-[10px] mb-3">
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Dia</div>
            <input type="date" value={dataChegada} onChange={(e) => setDataChegada(e.target.value)} className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Horário</div>
            <input type="time" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground" />
          </div>
        </div>

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
          Valor de cada clichê ({cores} {cores === "1" ? "cor" : "cores"})
        </div>
        <div className="space-y-2 mb-2">
          {linhas.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={l.descricao}
                onChange={(e) => setLinha(i, "descricao", e.target.value)}
                placeholder={`Cor ${i + 1}`}
                className="flex-1 bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground"
              />
              <div className="relative w-[110px]">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">R$</span>
                <input
                  value={l.valor}
                  onChange={(e) => setLinha(i, "valor", e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="w-full bg-background border border-border rounded-[10px] pl-7 pr-2 py-2 text-[13px] text-right focus:outline-none focus:border-foreground"
                />
              </div>
              {linhas.length > 1 && (
                <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0" title="Remover campo">
                  <i className="ti ti-x text-[14px]"></i>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setLinhas((ls) => [...ls, { descricao: "", valor: "" }])}
          className="text-[12px] font-bold text-muted-foreground hover:text-foreground mb-3"
        >
          <i className="ti ti-plus mr-1"></i>Adicionar campo
        </button>

        <div className="flex justify-between items-center border-t border-border pt-3 mb-4">
          <span className="text-[13px] font-bold">Total</span>
          <span className="font-display text-[17px] font-extrabold">R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-background border border-border">Cancelar</button>
          <button onClick={salvar} disabled={!valido || saving} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow disabled:opacity-40">
            {saving ? "Salvando..." : "Registrar clichê"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PastaArquivos({ pedidoId }: { pedidoId: string }) {
  const [aberto, setAberto] = useState(false);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["pasta-cliente", pedidoId],
    queryFn: () => listPastaCliente({ data: { pedidoId } }),
    enabled: aberto,
    staleTime: 30_000,
  });
  const arquivos = (data?.arquivos ?? []) as { nome: string; subpasta: string; tamanho: number; modificado: string }[];

  return (
    <div className="mt-2">
      <button
        onClick={() => { setAberto((v) => !v); if (!aberto) refetch(); }}
        className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
      >
        <i className={`ti ${aberto ? "ti-chevron-down" : "ti-chevron-right"} mr-1`}></i>
        {aberto ? "Ocultar arquivos da pasta" : "Ver arquivos da pasta"}
        {isFetching && aberto ? " (atualizando...)" : ""}
      </button>
      {aberto && (
        <div className="mt-2 space-y-1">
          {arquivos.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">Pasta vazia.</div>
          ) : (
            arquivos.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] bg-background border border-border rounded-[8px] px-2 py-1">
                <i className="ti ti-file text-[12px]"></i>
                <span className="flex-1 truncate">{a.subpasta ? `${a.subpasta}\\` : ""}{a.nome}</span>
                <span className="text-muted-foreground shrink-0">{fmtTamanho(a.tamanho)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ActionPanel({ status, isDesigner, isVendedor, onChange }: {
  status: Status; isDesigner: boolean; isVendedor: boolean;
  onChange: (s: Status, obs: string) => void;
}) {
  const [obs, setObs] = useState("");
  const [confirm, setConfirm] = useState<{ s: Status; label: string } | null>(null);

  function act(s: Status, label: string) {
    setConfirm({ s, label });
  }

  function confirmAct() {
    if (!confirm) return;
    onChange(confirm.s, obs);
    setObs("");
    setConfirm(null);
  }

  const designerActions: { s: Status; label: string; icon: string; show: boolean }[] = [
    { s: "criacao", label: "Iniciar criação", icon: "ti-player-play", show: status === "nova" },
    { s: "aguardando", label: "Enviar para aprovação", icon: "ti-send", show: status === "criacao" || status === "revisao" },
    { s: "cliche", label: "Solicitar clichê", icon: "ti-printer", show: status === "aprovada" },
    { s: "concluido", label: "Concluir pedido", icon: "ti-check", show: status === "cliche" || status === "aprovada" },
  ];
  const vendedorActions: { s: Status; label: string; icon: string; show: boolean }[] = [
    { s: "aprovada", label: "Aprovar arte", icon: "ti-thumb-up", show: status === "aguardando" },
    { s: "revisao", label: "Solicitar revisão", icon: "ti-refresh", show: status === "aguardando" },
    { s: "cancelado", label: "Cancelar pedido", icon: "ti-x", show: !["concluido", "cancelado"].includes(status) },
  ];

  const actions = [
    ...(isDesigner ? designerActions : []),
    ...(isVendedor ? vendedorActions : []),
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return <div className="text-[12px] text-muted-foreground">Sem ações disponíveis neste momento.</div>;
  }

  return (
    <>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observação (opcional)"
        className="w-full bg-background border-[1.5px] border-border rounded-[10px] px-3 py-2 text-[13px] mb-2 min-h-[60px] resize-y outline-none focus:border-foreground"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map((a) => (
          <button
            key={a.s}
            onClick={() => act(a.s, a.label)}
            className={`rounded-[10px] py-2 px-3 text-[12px] font-bold flex items-center justify-center gap-2 ${
              a.s === "cancelado" ? "bg-destructive text-white" :
              a.s === "revisao" ? "bg-background border-[1.5px] border-destructive text-destructive" :
              "bg-yellow text-foreground"
            }`}
          >
            <i className={`ti ${a.icon}`}></i>{a.label}
          </button>
        ))}
      </div>

      {/* Modal de confirmação universal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-[18px] p-6 w-full max-w-[320px]" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 mx-auto ${confirm.s === "cancelado" ? "bg-destructive/10" : "bg-foreground/10"}`}>
              <i className={`ti text-xl ${
                confirm.s === "cancelado" ? "ti-alert-triangle text-destructive" :
                confirm.s === "aprovada" ? "ti-thumb-up text-foreground" :
                confirm.s === "concluido" ? "ti-check text-foreground" :
                confirm.s === "revisao" ? "ti-refresh text-destructive" :
                "ti-help text-foreground"
              }`}></i>
            </div>
            <h2 className="font-display text-[17px] font-extrabold text-center mb-1">{confirm.label}?</h2>
            <p className="text-[12px] text-muted-foreground text-center mb-5">
              Tem certeza que deseja executar esta ação?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-background border-[1.5px] border-border"
              >
                Não, voltar
              </button>
              <button
                onClick={confirmAct}
                className={`flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold ${confirm.s === "cancelado" || confirm.s === "revisao" ? "bg-destructive text-white" : "bg-foreground text-yellow"}`}
              >
                Sim, confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em]">{l}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}
function Label({ children }: any) {
  return <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-1">{children}</div>;
}
