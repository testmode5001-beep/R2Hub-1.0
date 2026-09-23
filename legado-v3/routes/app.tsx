import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { listPedidos, createPedido, solicitarCliche, updatePedido, deletePedido, getPedido } from "@/lib/api/pedidos.functions";
import { listMotivosCliche, addMotivoCliche } from "@/lib/api/cliches.functions";
import { getHomeStats, getHomeConfig, setHomeVideo, uploadVideo, listHomeVideos } from "@/lib/api/config.functions";
import { MenuCapa } from "@/components/MenuCapa";
import { PaginaHub } from "@/components/PaginaHub";
import { CentralV3 } from "@/components/v3/CentralV3";
import { BlocoSinoConfig, HubShell, TRANS_GRID, TituloPagina, linhas } from "@/components/v3/HubV3";
import { uploadAnexo, deleteAnexo } from "@/lib/api/anexos.functions";
import { ClichesTab } from "@/components/ClichesTab";
import { FacasTab } from "@/components/FacasTab";
import { ApontamentosTab } from "@/components/ApontamentosTab";
import { logout } from "@/lib/api/auth.functions";
import { CALC_TAB_MAP, clearStoredSession, getStoredSession, hasPerm, type SessionUser } from "@/lib/session";
import { copiarTexto, fileToBase64 } from "@/lib/files";
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Pedidos — R2 Hub" }] }),
  component: AppPage,
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

/** Pedido "em andamento" = ainda em fluxo (não concluído nem cancelado). */
const EM_ANDAMENTO = (s: string) => !["concluido", "cancelado"].includes(s);

/** Cor da barra lateral por status (usada no chip e na lista). */
function borderStatus(status: string): string {
  return status === "revisao" ? "border-l-destructive"
    : status === "aprovada" ? "border-l-[color:var(--success)]"
    : status === "cliche" ? "border-l-[color:var(--warning)]"
    : status === "cancelado" ? "border-l-[#999] opacity-70"
    : "border-l-transparent";
}

/** Dias corridos desde a data — para sinalizar há quanto tempo o pedido está aberto. */
function diasDesde(s: string): string {
  const dias = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

const MATERIAS = ["Papel couché", "Polietileno", "Cartão couché", "Térmico", "BOPP térmico", "BOPP metalizado", "BOPP Matte", "BOPP brilho", "BOPP removível", "Nylon resinado"];
const FORMAS = ["Retangular", "Quadrada", "Oval/Elipse", "Recorte especial", "Redonda", "GAP"];
const CORES_OPTS = ["1", "2", "3", "4", "4+PANTONE", "CMYK"];

function AppPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  type TabId = "pedidos" | "novo" | "cliches" | "solcliche" | "facas" | "calculadoras" | "apontamentos";
  // Permite entrar direto numa aba pela capa: /app?tab=cliches
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "pedidos";
    const t = new URLSearchParams(window.location.search).get("tab");
    const validas: TabId[] = ["pedidos", "novo", "cliches", "solcliche", "facas", "calculadoras", "apontamentos"];
    return validas.includes(t as TabId) ? (t as TabId) : "pedidos";
  });
  const [profile] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);
  // Filtro e busca sobrevivem à navegação (abrir um pedido e voltar não reseta).
  const [filtro, setFiltro] = useState<Status | "todos">(() => {
    if (typeof window === "undefined") return "todos";
    const s = sessionStorage.getItem("r2hub.central.filtro");
    return s === "todos" || STATUS_LIST.some((x) => x.key === s) ? (s as Status | "todos") : "todos";
  });
  const [editando, setEditando] = useState<any | null>(null);
  const [deletando, setDeletando] = useState<any | null>(null);
  const [busca, setBusca] = useState(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem("r2hub.central.busca") ?? ""),
  );
  useEffect(() => {
    try {
      sessionStorage.setItem("r2hub.central.filtro", filtro);
      sessionStorage.setItem("r2hub.central.busca", busca);
    } catch { /* storage pode estar bloqueado */ }
  }, [filtro, busca]);
  // Central é a entrada; "Ver todos" abre a grade completa (aceita ?todos=1).
  const [verTodos, setVerTodos] = useState<boolean>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("todos") === "1",
  );

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => listPedidos(),
    refetchInterval: 5000,
    enabled: !!profile,
  });

  async function doLogout() {
    await qc.cancelQueries();
    qc.clear();
    try { await logout(); } catch { /* sessão pode já ter expirado */ }
    clearStoredSession();
    navigate({ to: "/auth", replace: true });
  }

  const stats = useMemo(() => {
    const total = pedidos.length;
    const ativos = pedidos.filter((p: any) => !["concluido", "cancelado"].includes(p.status)).length;
    const concl = pedidos.filter((p: any) => p.status === "concluido").length;
    return { total, ativos, concl };
  }, [pedidos]);

  const filtered = useMemo(() => {
    let list = filtro === "todos" ? pedidos : pedidos.filter((p: any) => p.status === filtro);
    if (busca?.trim()) {
      const q = busca.toLowerCase();
      // Medida composta: "100x50", "100 x 50" ou "100×50" casam com largura×altura.
      const qMedida = q.replace(/×/g, "x").replace(/\s+/g, "");
      list = list.filter((p: any) =>
        p.cliente?.toLowerCase().includes(q) ||
        p.materia?.toLowerCase().includes(q) ||
        p.largura?.toString().includes(q) ||
        p.altura?.toString().includes(q) ||
        `${p.largura}x${p.altura}`.toLowerCase().includes(qMedida) ||
        p.cores?.toString().includes(q) ||
        p.numero?.toString().includes(q) ||
        // Pesquisa por palavras-chave: status, código do produto e motivo
        sInfo(p.status).label.toLowerCase().includes(q) ||
        p.codigo_produto?.toLowerCase().includes(q) ||
        p.motivo?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pedidos, filtro, busca]);

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const canCreate = hasPerm(profile, "pedidos.criar");
  const canManageUsers = hasPerm(profile, "usuarios.gerenciar");
  const canDelete = hasPerm(profile, "pedidos.excluir");
  const canEditAll = hasPerm(profile, "pedidos.editar_todos");
  const canCliches = hasPerm(profile, "tab.cliches");
  const canSolCliche = hasPerm(profile, "tab.solicitar_cliche");
  const canAfiacao = hasPerm(profile, "tab.afiacao");
  const canApontamentos = hasPerm(profile, "apontamentos.ver");
  // Calculadoras liberadas para este usuário → abas do FlexoFaca.
  const calcTabs = Object.entries(CALC_TAB_MAP)
    .filter(([perm]) => hasPerm(profile, perm))
    .map(([, tabId]) => tabId);
  const canCalc = calcTabs.length > 0;
  const flexoUrl = `/flexofaca.html?tabs=${calcTabs.join(",")}`;

  async function doDelete(id: string) {
    try {
      await deletePedido({ data: { id } });
      setDeletando(null);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Pedido apagado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar");
    }
  }

  // Menu de capa (Central nova): navega entre as abas sem recarregar a rota.
  function abrirDoMenu(to: string) {
    if (to.startsWith("/app")) {
      const t = new URL(to, window.location.origin).searchParams.get("tab") ?? "pedidos";
      setVerTodos(false);
      setTab(t as TabId);
    } else {
      navigate({ to });
    }
  }

  // + Nova no novo design (casco de capa PaginaHub).
  if (tab === "novo" && canCreate) {
    return (
      <NovaPage
        profile={profile}
        aoAbrirMenu={abrirDoMenu}
        onHome={() => navigate({ to: "/home" })}
        onLogout={doLogout}
        onDone={() => { setTab("pedidos"); qc.invalidateQueries({ queryKey: ["pedidos"] }); }}
      />
    );
  }

  // Central no design V3 (dashboard 1920×1080) — "Ver todos" é a mesma base
  // com a grade completa, filtros, ordem e kanban (modoTodos).
  if (tab === "pedidos") {
    return (
      <CentralV3
        key={verTodos ? "todos" : "central"}
        profile={profile}
        isLoading={isLoading}
        pedidos={pedidos}
        filtered={filtered}
        filtro={filtro}
        setFiltro={setFiltro}
        busca={busca}
        setBusca={setBusca}
        onOpen={(id: string) => navigate({ to: "/pedido/$id", params: { id } })}
        onVerTodos={() => setVerTodos(true)}
        aoAbrirMenu={abrirDoMenu}
        onHome={() => navigate({ to: "/home" })}
        canCreate={canCreate}
        onNova={() => { setVerTodos(false); setTab("novo"); }}
        onLogout={doLogout}
        modoTodos={verTodos}
        onVoltar={() => setVerTodos(false)}
        modalFundo={(videoNome: string, fechar: () => void) => (
          <ModalFundoCentral
            videoNome={videoNome}
            onClose={fechar}
            onMudou={() => qc.invalidateQueries({ queryKey: ["home-config"] })}
          />
        )}
      />
    );
  }

  return (
    /* key = aba atual → o fade re-dispara a cada troca de página interna */
    <div key={`${tab}-${verTodos}`} className="fade-page min-h-screen flex flex-col">
      {/* Header */}
      <div className="max-w-[680px] w-full mx-auto flex items-center justify-between px-[18px] pt-[18px]">
        <div className="min-w-0">
          <button
            onClick={() => navigate({ to: "/home" })}
            title="Voltar para a capa"
            className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground hover:text-foreground"
          >
            <i className="ti ti-home mr-1"></i>R2 Hub
          </button>
          <div className="font-display text-[18px] font-extrabold tracking-[-0.4px] leading-[1.1] truncate">
            {tab === "pedidos" ? "Central" : tab === "novo" ? "Nova solicitação" : tab === "cliches" ? "Aprovação" : tab === "solcliche" ? "Solicitar Clichê" : tab === "facas" ? "Facas para Afiação" : tab === "calculadoras" ? "Calculadoras" : "Apontamentos"}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <div className="flex items-center gap-[6px] bg-card rounded-[20px] py-1 pl-[6px] pr-[10px]" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.09)" }}>
            <div className="w-[22px] h-[22px] rounded-full bg-foreground text-yellow flex items-center justify-center text-[10px] font-extrabold">
              {profile.nome[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-semibold hidden sm:inline">{profile.nome.split(" ")[0]}</span>
            <button onClick={doLogout} className="text-xs font-semibold text-muted-foreground hover:text-foreground pl-2 border-l border-border">Sair</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[680px] w-full mx-auto flex px-[18px] pt-[10px] gap-[2px] overflow-x-auto">
        <button onClick={() => { setTab("pedidos"); setVerTodos(false); }} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "pedidos" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Central</button>
        {canCreate && (
          <button onClick={() => setTab("novo")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "novo" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>+ Nova</button>
        )}
        {canCliches && (
          <button onClick={() => setTab("cliches")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "cliches" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Aprovação</button>
        )}
        {canSolCliche && (
          <button onClick={() => setTab("solcliche")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "solcliche" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Solicitar Clichê</button>
        )}
        {canAfiacao && (
          <button onClick={() => setTab("facas")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "facas" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Afiação</button>
        )}
        {canCalc && (
          <button onClick={() => setTab("calculadoras")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "calculadoras" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Calculadoras</button>
        )}
        {canApontamentos && (
          <button onClick={() => setTab("apontamentos")} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${tab === "apontamentos" ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>Apontamentos</button>
        )}
        {canManageUsers && (
          <button onClick={() => navigate({ to: "/usuarios" })} className="px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] border-transparent text-muted-foreground hover:text-foreground transition">Usuários</button>
        )}
      </div>

      {/* Content */}
      <div className={`px-[18px] py-[14px] flex-1 w-full mx-auto pb-8 ${tab === "calculadoras" ? "max-w-[1140px]" : "max-w-[680px]"}`}>
        {tab === "pedidos" && (
          <button
            onClick={() => setVerTodos(false)}
            className="mb-3 text-[12px] font-bold text-muted-foreground hover:text-foreground"
          >
            <i className="ti ti-arrow-left mr-1"></i>Voltar à Central
          </button>
        )}
        {tab === "pedidos" && (
          <PedidosList
            isLoading={isLoading}
            pedidos={filtered}
            stats={stats}
            filtro={filtro}
            setFiltro={setFiltro}
            busca={busca}
            setBusca={setBusca}
            isGestor={canDelete}
            canEdit={(p: any) => canEditAll || p.vendedor_id === profile.id}
            onEdit={(p: any) => setEditando(p)}
            onDelete={(p: any) => setDeletando(p)}
            onOpen={(id: string) => navigate({ to: "/pedido/$id", params: { id } })}
          />
        )}
        {tab === "novo" && canCreate && (
          <NovoForm
            onDone={() => { setTab("pedidos"); qc.invalidateQueries({ queryKey: ["pedidos"] }); }}
          />
        )}
        {tab === "cliches" && canCliches && <ClichesTab />}
        {tab === "solcliche" && canSolCliche && (
          <SolicitarClicheForm
            onDone={() => { setTab("pedidos"); qc.invalidateQueries({ queryKey: ["pedidos"] }); }}
          />
        )}
        {tab === "facas" && canAfiacao && <FacasTab />}
        {tab === "calculadoras" && canCalc && (
          <div>
            <div className="flex justify-end mb-2">
              <a
                href={flexoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-external-link mr-1"></i>Abrir em tela cheia
              </a>
            </div>
            <iframe
              src={flexoUrl}
              title="R2 Hub — Calculadoras"
              className="w-full rounded-[14px] bg-card"
              style={{ height: "calc(100vh - 200px)", minHeight: 560, border: "none", boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}
            />
          </div>
        )}
        {tab === "apontamentos" && canApontamentos && <ApontamentosTab />}
      </div>

      {/* Modal confirmar apagar */}
      {deletando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-[18px] p-6 w-full max-w-[320px]" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-3 mx-auto">
              <i className="ti ti-trash text-destructive text-xl"></i>
            </div>
            <h2 className="font-display text-[17px] font-extrabold text-center mb-1">Apagar pedido?</h2>
            <p className="text-[12px] text-muted-foreground text-center mb-5">
              Pedido <strong>#{deletando.numero} — {deletando.cliente}</strong> será removido permanentemente.
              Os arquivos na pasta do cliente serão preservados.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeletando(null)} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-background border-[1.5px] border-border">
                Cancelar
              </button>
              <button onClick={() => doDelete(deletando.id)} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-destructive text-white">
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar pedido */}
      {editando && (
        <EditModal pedido={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); qc.invalidateQueries({ queryKey: ["pedidos"] }); }} />
      )}

    </div>
  );
}

/* ————— Central nova (interface de capa, handoff "Central") ————— */
const CINZA = "#d8d0d1";
const AMARELO = "#ffe91d";
const PRETO = "#1d1d1b";
const SOMBRA_CARD = "0 1px 0 rgba(0,0,0,0.04), 0 12px 26px -18px rgba(0,0,0,0.3)";

function diasDesdeCurto(s: string): string {
  const dias = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** Urgência: a partir de 3 dias parado o "há X dias" fica âmbar; 5+, vermelho. */
function corUrgencia(created: string): string | undefined {
  const dias = Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
  if (dias >= 5) return "var(--destructive, #dc2626)";
  if (dias >= 3) return "var(--warning, #d97706)";
  return undefined;
}

/** Borda lateral do chip pela cor do status (mesma linguagem da lista clássica). */
function corBordaChip(p: any): string {
  if (p.tipo === "cliche") return PRETO;
  if (p.status === "revisao") return "var(--destructive, #dc2626)";
  if (p.status === "aprovada") return "var(--success, #16a34a)";
  if (p.status === "cliche") return "var(--warning, #d97706)";
  return "transparent";
}

const VISTOS_KEY = "r2hub.central.vistos";
const LIMITE_GRADE = 18; // 3 linhas × 6 colunas — o resto vai para "Ver todos"
/** Fundo é imagem? (senão é vídeo) — decide entre <img> e <video>. */
const ehImagemSrc = (s: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(s);
// Colunas do kanban = status "em andamento", na ordem do fluxo.
const COLUNAS_STATUS = STATUS_LIST.filter((s) => EM_ANDAMENTO(s.key)).map((s) => s.key);

/** Chip de pedido — reutilizado na grade e nas colunas (kanban). */
function ChipCentral({ p, naoVisto, onAbrir }: { p: any; naoVisto: boolean; onAbrir: () => void }) {
  const isCliche = p.tipo === "cliche";
  const corDias = corUrgencia(p.created_at);
  return (
    <div
      onClick={onAbrir}
      className="group relative rounded-[14px] cursor-pointer hover:opacity-90 transition flex flex-col"
      style={{
        // cards sólidos (sem translúcido): branco, ou amarelo para clichê
        background: isCliche ? AMARELO : "#ffffff",
        boxShadow: SOMBRA_CARD,
        color: PRETO,
        padding: "clamp(12px, 0.95vw, 18px)",
        borderLeft: `3px solid ${corBordaChip(p)}`,
      }}
    >
      {/* Ações rápidas — aparecem no hover, sem abrir o pedido */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition flex gap-1"
        style={{ top: 8, right: 8, zIndex: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          title="Copiar nº do pedido"
          onClick={() => { copiarTexto(`#${p.numero}`); toast.success(`Nº #${p.numero} copiado.`); }}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", color: PRETO }}
        >
          <i className="ti ti-hash text-[12px]"></i>
        </button>
        <button
          title="Copiar resumo do pedido"
          onClick={() => {
            const resumo = isCliche
              ? `#${p.numero} ${p.cliente} — reposição de clichê, cód. ${p.codigo_produto} (${sInfo(p.status).label})`
              : `#${p.numero} ${p.cliente} — ${p.materia} ${p.largura}×${p.altura}mm (${sInfo(p.status).label})`;
            copiarTexto(resumo);
            toast.success("Resumo copiado.");
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", color: PRETO }}
        >
          <i className="ti ti-copy text-[12px]"></i>
        </button>
      </div>

      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] font-bold flex items-center gap-[5px]" style={{ opacity: 0.55 }}>
          {naoVisto && (
            <span
              title="Atualizado desde sua última visita"
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: isCliche ? PRETO : AMARELO, boxShadow: isCliche ? "none" : "0 0 0 1.5px rgba(29,29,27,0.25)" }}
            />
          )}
          #{p.numero}
        </span>
        <StatusBadge s={p.status} />
      </div>
      {/* nome em Fraunces recuado -0.03em: alinha OPTICAMENTE a tinta do nome
          com as linhas em Inter (side-bearing difere) */}
      <div className="font-display font-extrabold leading-tight truncate" style={{ fontSize: "clamp(15px, 1.25vw, 21px)", marginLeft: "-0.03em" }}>{p.cliente}</div>
      <div className="text-[11px] truncate mt-1" style={{ opacity: 0.65 }}>
        {isCliche ? <>Reposição · Cód. {p.codigo_produto}</> : <>{p.materia} · {p.largura}×{p.altura}mm</>}
      </div>
      <div className="text-[11px]" style={{ opacity: 0.65 }}>
        Aberto {new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        {" · "}
        <span className="font-bold" style={{ opacity: 1, color: corDias ?? PRETO }}>
          {corDias && <i className="ti ti-alert-triangle mr-[2px] text-[10px]"></i>}
          {diasDesdeCurto(p.created_at)}
        </span>
      </div>
    </div>
  );
}

/** + Nova solicitação no design V3 (casco HubShell, mesmo grid da Central). */
function NovaPage({ profile, aoAbrirMenu, onHome: _onHome, onLogout, onDone }: any) {
  const { data: stats } = useQuery({ queryKey: ["home-stats"], queryFn: () => getHomeStats(), refetchInterval: 30_000 });
  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: () => getHomeConfig() });
  const BASE_NOVA = 1080 - 20;
  return (
    <HubShell
      user={profile}
      stats={stats}
      ativo="/app?tab=novo"
      aoNavegar={aoAbrirMenu}
      onLogout={onLogout}
      versao={cfg?.versao ?? "V. 0.01"}
    >
      {(g) => (
        <>
          <BlocoSinoConfig user={profile} onLogout={onLogout} />
          <TituloPagina x={g.x0}>Nova solicitação</TituloPagina>
          <p
            className="absolute uppercase"
            style={{ left: g.x0, top: linhas(19), fontSize: 12, lineHeight: `${linhas(1)}px`, letterSpacing: "0.06em", fontWeight: 500, color: "var(--text-muted)", transition: TRANS_GRID }}
          >
            Preencha os dados da etiqueta — a pasta do cliente é criada sozinha na rede.
          </p>
          {/* Formulário em 3 colunas — rola por dentro se precisar */}
          <div
            className="absolute overflow-y-auto"
            style={{ left: g.x0, top: linhas(23), width: 1900 - g.x0, height: BASE_NOVA - linhas(23), scrollbarWidth: "thin", transition: TRANS_GRID }}
          >
            <NovoForm onDone={onDone} />
          </div>
        </>
      )}
    </HubShell>
  );
}

function CentralNova({ profile, isLoading, pedidos, filtered, filtro, setFiltro, busca, setBusca, onOpen, onVerTodos, aoAbrirMenu, onHome, canCreate, onNova, onLogout, modoTodos = false, onVoltar }: any) {
  const qc = useQueryClient();
  const podeEditar = hasPerm(profile, "usuarios.gerenciar");
  const [editandoFundo, setEditandoFundo] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Fundo próprio da Central (independente da capa) — vídeo com fade-in branco.
  const { data: centralCfg } = useQuery({ queryKey: ["home-config"], queryFn: () => getHomeConfig() });
  const video = centralCfg?.video ?? "";
  const videoAtivo = !!video;
  // Textos de apoio menores: amarelo sobre vídeo (contraste), preto sobre cinza.
  const corApoio = videoAtivo ? AMARELO : PRETO;
  const [videoPronto, setVideoPronto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setVideoPronto(false);
    const v = videoRef.current;
    if (v && v.readyState >= 3) setVideoPronto(true);
  }, [video]);
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");
  const [vista, setVista] = useState<"grade" | "colunas">(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("r2hub.central.vista") === "colunas") ? "colunas" : "grade",
  );
  function trocarVista(v: "grade" | "colunas") {
    setVista(v);
    try { sessionStorage.setItem("r2hub.central.vista", v); } catch { /* storage bloqueado */ }
    // No kanban os status viram colunas — o filtro de status atrapalharia.
    if (v === "colunas") setFiltro("todos");
  }
  const buscaRef = useRef<HTMLInputElement>(null);

  // "Não visto": guarda o status de cada pedido na última vez que foi ABERTO;
  // se mudou desde então (ou nunca foi aberto), o chip ganha um pontinho.
  const [vistos, setVistos] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(VISTOS_KEY) ?? "{}"); } catch { return {}; }
  });
  function abrirPedido(p: any) {
    const prox = { ...vistos, [p.id]: p.status };
    setVistos(prox);
    try { localStorage.setItem(VISTOS_KEY, JSON.stringify(prox)); } catch { /* storage bloqueado */ }
    onOpen(p.id);
  }

  // Atalhos: "/" foca a pesquisa; Esc limpa e sai dela.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === buscaRef.current) {
        setBusca("");
        buscaRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contadores das bolhas do menu (mesma fonte da capa; cache compartilhado).
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => getHomeStats(),
    refetchInterval: 30_000,
  });

  // Contagem por status para os pills de filtro (sobre todos os pedidos).
  const porStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pedidos) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [pedidos]);

  // Grade principal. Central: só "em andamento" (quando filtro=todos), limitada.
  // Ver todos (modoTodos): TODOS os pedidos (inclui finalizados), sem limite.
  const grade = (filtro === "todos" ? (modoTodos ? filtered : filtered.filter((p: any) => EM_ANDAMENTO(p.status))) : filtered)
    .slice()
    .sort((a: any, b: any) =>
      ordem === "antigos"
        ? String(a.created_at).localeCompare(String(b.created_at))
        : String(b.created_at).localeCompare(String(a.created_at)),
    );
  const gradeVisivel = modoTodos ? grade : grade.slice(0, LIMITE_GRADE);
  const gradeExcedente = modoTodos ? 0 : grade.length - gradeVisivel.length;
  const tituloGrade = modoTodos ? "Todos os pedidos" : (filtro === "todos" ? "Em andamento" : sInfo(filtro).label);

  // Kanban: agrupa os "em andamento" (respeitando a busca) por status.
  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const st of COLUNAS_STATUS) g[st] = [];
    for (const p of filtered) if (EM_ANDAMENTO(p.status) && g[p.status]) g[p.status].push(p);
    for (const st of COLUNAS_STATUS) {
      g[st].sort((a, b) =>
        ordem === "antigos"
          ? String(a.created_at).localeCompare(String(b.created_at))
          : String(b.created_at).localeCompare(String(a.created_at)),
      );
    }
    return g;
  }, [filtered, ordem]);

  // A pesquisa vale também para os finalizados recentes.
  const buscando = !!busca.trim();
  const finalizadosRecentes = (buscando ? filtered : pedidos)
    .filter((p: any) => !EM_ANDAMENTO(p.status))
    .slice(0, 4);

  return (
    <div className="fade-page min-h-screen flex flex-col relative overflow-hidden" style={{ background: videoAtivo ? "#ffffff" : CINZA }}>
      {/* Fundo em vídeo OU imagem (quando escolhido) — independente da capa */}
      {videoAtivo && (ehImagemSrc(video) ? (
        <img
          key={video}
          src={video}
          alt=""
          onLoad={() => setVideoPronto(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ zIndex: 0, opacity: videoPronto ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      ) : (
        <video
          ref={videoRef}
          key={video}
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setVideoPronto(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ zIndex: 0, opacity: videoPronto ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      ))}
      {/* Scrim geral (véu) escuro e leve — faz o amarelo (título + textos de
          apoio) contrastar sobre qualquer vídeo, sem escurecer demais. */}
      {videoAtivo && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, background: "rgba(0,0,0,0.22)", opacity: videoPronto ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      )}

      <div className="relative z-10 flex flex-col flex-1" style={{ padding: "1.6% 3.5% 2.2% 4.5%" }}>
      {/* Topo: título à esquerda; filtros, pesquisa e pill à direita.
          rowGap só aparece quando a barra quebra para baixo do título. */}
      <div className="flex items-start justify-between flex-wrap" style={{ columnGap: "16px", rowGap: "clamp(14px, 3vh, 34px)" }}>
        <div className="min-w-0">
          <h1
            className="select-none"
            style={{
              color: AMARELO,
              fontFamily: "'Fraunces', Georgia, serif",
              fontVariationSettings: "'SOFT' 100, 'opsz' 144, 'wght' 900",
              fontWeight: 900,
              fontSize: "clamp(38px, 5.6vw, 110px)",
              lineHeight: 0.95,
              letterSpacing: "-0.008em",
              marginTop: "-0.06em",
            }}
          >
            {modoTodos ? "Todos" : "Central"}
          </h1>
          <p
            className="mt-1 text-[12px] uppercase tracking-[0.06em]"
            style={{ color: corApoio, fontWeight: 500, opacity: videoAtivo ? 0.95 : 0.65 }}
          >
            {modoTodos
              ? "Todos os pedidos — em andamento e finalizados."
              : "Pedidos em andamento — do design à aprovação do clichê."}
          </p>
        </div>

        <div className="flex items-center flex-wrap" style={{ paddingTop: "0.35em", gap: "clamp(16px, 1.6vw, 30px)" }}>
          {canCreate && (
            <button
              onClick={onNova}
              className="rounded-full uppercase tracking-wider hover:opacity-85"
              style={{ background: AMARELO, color: PRETO, fontWeight: 700, fontSize: "clamp(10px, 0.85vw, 13px)", padding: "0.5em 1.1em", boxShadow: SOMBRA_CARD }}
            >
              + Nova
            </button>
          )}
          {modoTodos && (
            <button
              onClick={onVoltar}
              className="uppercase tracking-wider hover:opacity-70"
              style={{ color: corApoio, fontWeight: 600, fontSize: "clamp(10px, 0.85vw, 13px)" }}
            >
              <i className="ti ti-arrow-left mr-1"></i>Central
            </button>
          )}
          <button
            onClick={onHome}
            className="uppercase tracking-wider hover:opacity-70"
            style={{ color: corApoio, fontWeight: 600, fontSize: "clamp(10px, 0.85vw, 13px)" }}
          >
            Home
          </button>
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className="uppercase tracking-wider hover:opacity-70"
            style={{ color: corApoio, fontWeight: 600, fontSize: "clamp(10px, 0.85vw, 13px)" }}
          >
            Filtros
            <i className={`ti ${filtrosAbertos ? "ti-chevron-up" : "ti-chevron-down"} ml-1 text-[11px]`}></i>
          </button>
          {/* Filtro ativo como chip removível — um clique no ✕ limpa */}
          {filtro !== "todos" && (
            <button
              onClick={() => setFiltro("todos")}
              title="Remover filtro"
              className="flex items-center gap-[6px] rounded-full uppercase tracking-wider hover:opacity-80"
              style={{ background: PRETO, color: AMARELO, fontWeight: 700, fontSize: "clamp(10px, 0.8vw, 12px)", padding: "0.4em 0.9em" }}
            >
              {sInfo(filtro).label}
              <i className="ti ti-x text-[12px]"></i>
            </button>
          )}
          <div className="relative">
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisa"
              title="Atalho: / foca a pesquisa · Esc limpa"
              className="rounded-full outline-none font-bold placeholder:font-bold"
              style={{
                background: "#ffffff",
                color: PRETO,
                width: "clamp(170px, 21vw, 380px)",
                padding: "0.55em 1.1em",
                fontSize: "clamp(12px, 0.95vw, 15px)",
                boxShadow: SOMBRA_CARD,
                fontFamily: "'Fraunces', Georgia, serif",
              }}
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: PRETO }}>
                <i className="ti ti-x text-[13px]"></i>
              </button>
            )}
          </div>
          {/* Pill do usuário — mesmo desenho da capa */}
          <div
            className="flex items-center"
            style={{ gap: "0.4em", background: videoAtivo ? "rgba(255,255,255,0.88)" : "rgba(29,29,27,0.06)", borderRadius: "9999px", padding: "0.25em 0.85em 0.25em 1.4em", boxShadow: videoAtivo ? "0 1px 4px rgba(0,0,0,0.12)" : "none" }}
          >
            <span className="font-bold uppercase tracking-wider" style={{ color: PRETO, opacity: 0.55, fontSize: "clamp(9px, 0.8vw, 12px)" }}>
              {profile.nome.split(" ")[0]}
            </span>
            {/* Engrenagem (só quem gerencia) — fundo próprio da Central */}
            {podeEditar && (
              <button
                onClick={() => setEditandoFundo(true)}
                title="Papel de parede (todas as páginas)"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-card hover:opacity-80"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.09)" }}
                aria-label="Editar fundo da Central"
              >
                <i className="ti ti-settings text-[16px]" style={{ color: PRETO }}></i>
              </button>
            )}
            <NotificationBell />
            <button
              onClick={onLogout}
              className="font-bold uppercase tracking-wider hover:brightness-75"
              style={{ color: PRETO, opacity: 0.75, fontSize: "clamp(9px, 0.8vw, 12px)", padding: "0 0.6em" }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Filtros — a mesma lista de status, com CONTADORES; status zerados
          ficam apagados para o gargalo saltar aos olhos. */}
      {filtrosAbertos && (
        <div className="flex gap-[6px] overflow-x-auto pb-1 mt-2">
          {["todos", ...STATUS_LIST.map((s) => s.key)].map((k) => {
            const n = k === "todos" ? pedidos.length : (porStatus[k] ?? 0);
            const ativo = filtro === k;
            return (
              <button
                key={k}
                /* clicar no pill já ativo desmarca (volta para Todos) */
                onClick={() => setFiltro(ativo && k !== "todos" ? "todos" : k)}
                title={ativo && k !== "todos" ? "Clique para remover o filtro" : undefined}
                className={`px-[11px] py-[5px] rounded-[20px] border-[1.5px] text-[11px] font-bold whitespace-nowrap shrink-0 ${ativo ? "bg-foreground text-yellow border-foreground" : "bg-white border-transparent"}`}
                style={ativo ? undefined : { color: PRETO, opacity: n === 0 ? 0.4 : 1 }}
              >
                {k === "todos" ? "Todos" : sInfo(k as Status).label} ({n})
                {ativo && k !== "todos" && <i className="ti ti-x ml-1 text-[10px]"></i>}
              </button>
            );
          })}
        </div>
      )}

      {/* Grade de chips — no máximo 6 por linha (min 15% de largura cada);
          os cards crescem proporcionalmente para preencher o grid. */}
      <div style={{ marginTop: "clamp(32px, 5.5vh, 76px)" }}>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: corApoio, opacity: videoAtivo ? 0.95 : 0.65, fontWeight: 500 }}>
            {tituloGrade} {grade.length > 0 && `(${grade.length})`}
          </span>
          {buscando && (
            <span className="text-[11px]" style={{ color: corApoio, opacity: videoAtivo ? 0.9 : 0.55 }}>
              — {filtered.length} resultado{filtered.length === 1 ? "" : "s"} para “{busca.trim()}”
            </span>
          )}
          <button
            onClick={() => setOrdem((o) => (o === "recentes" ? "antigos" : "recentes"))}
            title="Inverter a ordem"
            className="ml-auto text-[11px] uppercase tracking-[0.06em] hover:opacity-70"
            style={{ color: corApoio, fontWeight: 500, opacity: videoAtivo ? 0.95 : 0.65 }}
          >
            <i className={`ti ${ordem === "recentes" ? "ti-sort-descending" : "ti-sort-ascending"} mr-1`}></i>
            {ordem === "recentes" ? "Mais recentes primeiro" : "Mais antigos primeiro"}
          </button>
          {/* Alternar Grade ⇄ Colunas por status (kanban) */}
          <div className="flex items-center rounded-full" style={{ background: "rgba(29,29,27,0.06)", padding: 2 }}>
            {([["grade", "ti-layout-grid", "Grade"], ["colunas", "ti-layout-columns", "Colunas por status"]] as const).map(([v, ic, t]) => (
              <button
                key={v}
                onClick={() => trocarVista(v)}
                title={t}
                className="w-7 h-7 rounded-full flex items-center justify-center transition"
                style={vista === v ? { background: PRETO, color: AMARELO } : { color: PRETO, opacity: 0.55 }}
              >
                <i className={`ti ${ic} text-[14px]`}></i>
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="py-10 text-center" style={{ color: PRETO, opacity: 0.5 }}>Carregando...</div>
        ) : grade.length === 0 ? (
          <div className="py-8 flex flex-col items-start gap-3">
            <span style={{ color: PRETO, opacity: 0.5 }}>
              {buscando ? `Nada encontrado para “${busca.trim()}”.` : "Nenhum pedido por aqui."}
            </span>
            {canCreate && !buscando && (
              <button
                onClick={onNova}
                className="rounded-full uppercase tracking-wider hover:opacity-85"
                style={{ background: AMARELO, color: PRETO, fontWeight: 700, fontSize: "12px", padding: "0.6em 1.2em", boxShadow: SOMBRA_CARD }}
              >
                + Criar solicitação
              </button>
            )}
          </div>
        ) : vista === "colunas" ? (
          /* Kanban — uma coluna por status COM solicitação (status vazios somem) */
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {COLUNAS_STATUS.filter((st) => (grupos[st] ?? []).length > 0).map((st) => {
              const itens = grupos[st] ?? [];
              return (
                <div key={st} className="shrink-0 flex flex-col" style={{ width: "clamp(210px, 21vw, 290px)" }}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <StatusBadge s={st as Status} />
                    <span className="text-[11px] font-bold" style={{ color: corApoio, opacity: videoAtivo ? 0.9 : 0.45 }}>{itens.length}</span>
                  </div>
                  <div
                    className="flex flex-col gap-3"
                    style={{ maxHeight: "62vh", overflowY: "auto", paddingRight: 2 }}
                  >
                    {itens.map((p: any) => (
                      <ChipCentral key={p.id} p={p} naoVisto={vistos[p.id] !== p.status} onAbrir={() => abrirPedido(p)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(max(15%, 180px), 1fr))", gap: "clamp(12px, 0.9vw, 18px)" }}>
              {gradeVisivel.map((p: any) => (
                <ChipCentral key={p.id} p={p} naoVisto={vistos[p.id] !== p.status} onAbrir={() => abrirPedido(p)} />
              ))}
            </div>
            {gradeExcedente > 0 && (
              <button
                onClick={onVerTodos}
                className="mt-3 text-[12px] uppercase tracking-[0.06em] hover:opacity-70"
                style={{ color: corApoio, fontWeight: 600 }}
              >
                Ver todos (+{gradeExcedente})
              </button>
            )}
          </>
        )}
      </div>

      {/* Base: menu à esquerda, finalizados recentes à direita.
          No "Ver todos" os finalizados já estão na grade → esconde o card. */}
      <div className="mt-auto flex items-end justify-between gap-6 flex-wrap pt-8">
        <MenuCapa user={profile} stats={stats} aoAbrir={aoAbrirMenu} peso={600} tracking="-0.01em" cor={videoAtivo ? "#ffffff" : PRETO} />

        {!modoTodos && (
        <div style={{ width: "clamp(280px, 26vw, 460px)" }}>
          {/* Rótulos alinhados ao início da curva do card (raio 18px) */}
          <div className="flex items-center justify-between mb-2" style={{ padding: "0 18px" }}>
            <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: corApoio, opacity: videoAtivo ? 0.95 : 0.65, fontWeight: 500 }}>
              Finalizados recentes
            </span>
            <button
              onClick={onVerTodos}
              className="text-[11px] uppercase tracking-[0.06em] hover:opacity-70"
              style={{ color: corApoio, fontWeight: 500 }}
            >
              Ver todos
            </button>
          </div>
          {finalizadosRecentes.length > 0 && (
            <div className="rounded-[18px] px-5 py-4" style={{ background: "#ffffff", boxShadow: SOMBRA_CARD }}>
              {finalizadosRecentes.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => abrirPedido(p)}
                  className="cursor-pointer hover:opacity-70 truncate"
                  style={{
                    color: PRETO,
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontVariationSettings: "'SOFT' 100, 'opsz' 144, 'wght' 900",
                    fontWeight: 900,
                    fontSize: "clamp(13px, 1.05vw, 17px)",
                    lineHeight: 1.5,
                  }}
                >
                  {p.tipo === "cliche"
                    ? `${p.cliente} - reposição clichê`
                    : `${p.cliente} - ${p.largura}x${p.altura} / ${String(p.materia).toLowerCase()}`}
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
      </div>{/* fim do wrapper de conteúdo (acima do vídeo) */}

      {editandoFundo && (
        <ModalFundoCentral
          videoNome={centralCfg?.videoNome ?? ""}
          onClose={() => setEditandoFundo(false)}
          onMudou={() => qc.invalidateQueries({ queryKey: ["home-config"] })}
        />
      )}
    </div>
  );
}

/** Modal do fundo da Central — escolher vídeo (independente da capa) ou enviar
    um novo para o acervo. Só é aberto por quem tem usuarios.gerenciar. */
function ModalFundoCentral({ videoNome, onClose, onMudou }: { videoNome: string; onClose: () => void; onMudou: () => void }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState(videoNome);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["home-videos"], queryFn: () => listHomeVideos() });
  const videos = data?.videos ?? [];

  async function escolher(nome: string) {
    if (aplicando) return;
    setAplicando(nome || "__cinza__");
    try {
      await setHomeVideo({ data: { nome } });
      setSel(nome);
      onMudou();
      toast.success(nome ? "Papel de parede aplicado em todas as páginas." : "Fundo cinza restaurado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar o vídeo");
    } finally {
      setAplicando(null);
    }
  }

  async function enviarNovo(file: File | null | undefined) {
    if (!file) return;
    const ehImg = file.type.startsWith("image/");
    const tetoMB = ehImg ? 25 : 150;
    if (file.size > tetoMB * 1024 * 1024) { toast.error(`${ehImg ? "Imagem" : "Vídeo"} acima de ${tetoMB} MB.`); return; }
    setEnviando(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await uploadVideo({ data: { nome: file.name, dataBase64 } });
      toast.success(`“${res.nome}” adicionado ao acervo.`);
      await qc.invalidateQueries({ queryKey: ["home-videos"] });
      await escolher(res.nome); // já aplica o vídeo recém-enviado
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar vídeo");
    } finally {
      setEnviando(false);
    }
  }

  const Row = ({ rotulo, detalhe, icone, ativo, carregando }: { rotulo: string; detalhe: string; icone: string; ativo: boolean; carregando: boolean }) => (
    <div className={`w-full flex items-center gap-2 px-3 py-2 border-b border-border last:border-b-0 ${ativo ? "bg-yellow/25" : ""}`}>
      <i className={`ti ${icone} text-[15px] text-muted-foreground shrink-0`}></i>
      <span className="flex-1 text-[12px] font-bold truncate">{rotulo}</span>
      <span className="text-[10px] text-muted-foreground shrink-0">{detalhe}</span>
      {carregando ? <i className="ti ti-loader-2 animate-spin text-[15px] shrink-0"></i> : ativo && <i className="ti ti-check text-[15px] shrink-0" style={{ color: "#1d1d1b" }}></i>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[400px] my-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[16px] font-extrabold">Papel de parede</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">Vale para todas as páginas do Hub (inclusive a capa).</p>

        <div className="rounded-[12px] border border-border overflow-hidden mb-3 max-h-[210px] overflow-y-auto">
          <button onClick={() => escolher("")} disabled={!!aplicando} className="w-full text-left disabled:cursor-not-allowed">
            <Row rotulo="Sem vídeo (fundo cinza)" detalhe="Padrão" icone="ti-photo" ativo={!sel} carregando={aplicando === "__cinza__"} />
          </button>
          {isLoading && <div className="px-3 py-3 text-[12px] text-muted-foreground">Procurando vídeos...</div>}
          {!isLoading && videos.length === 0 && <div className="px-3 py-3 text-[12px] text-muted-foreground">Nenhum vídeo no acervo ainda.</div>}
          {videos.map((v) => (
            <button key={v.nome} onClick={() => escolher(v.nome)} disabled={!!aplicando} className="w-full text-left hover:bg-background disabled:cursor-not-allowed">
              <Row rotulo={v.nome} detalhe={`${v.tamanhoMB} MB`} icone={v.tipo === "imagem" ? "ti-photo" : "ti-movie"} ativo={sel === v.nome} carregando={aplicando === v.nome} />
            </button>
          ))}
        </div>

        {/* Enviar novo vídeo (quem abre o modal já tem acesso) */}
        <label className="block border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-foreground relative">
          <input
            type="file"
            accept="video/*,image/*"
            disabled={enviando}
            onChange={(e) => { enviarNovo(e.target.files?.[0]); e.target.value = ""; }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <i className={`ti ${enviando ? "ti-loader-2 animate-spin" : "ti-cloud-upload"} text-lg text-muted-foreground`}></i>
          <p className="text-[11px] text-muted-foreground mt-[2px]">
            {enviando ? "Enviando..." : "Enviar vídeo ou imagem (vídeo até 150 MB · imagem até 25 MB)"}
          </p>
        </label>
        <p className="text-[10px] text-muted-foreground mt-2">A mídia enviada entra no acervo e fica disponível também para a capa.</p>

        <button onClick={onClose} className="w-full mt-4 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow">Fechar</button>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const info = sInfo(s);
  return <span className={`inline-block px-2 py-[3px] rounded-[12px] text-[10px] font-extrabold tracking-[0.03em] ${info.cls}`}>{info.label}</span>;
}

function PedidosList({ isLoading, pedidos, stats, filtro, setFiltro, busca, setBusca, isGestor, canEdit, onEdit, onDelete, onOpen }: any) {
  const emAndamento = pedidos.filter((p: any) => EM_ANDAMENTO(p.status));
  const finalizados = pedidos.filter((p: any) => !EM_ANDAMENTO(p.status));
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-[14px]">
        {[
          { n: stats.total, l: "Total" },
          { n: stats.ativos, l: "Ativos" },
          { n: stats.concl, l: "Concluídos" },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-[10px] py-3 px-[10px] text-center" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
            <div className="font-display text-[24px] font-extrabold leading-none">{s.n}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.06em] mt-[2px]">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-[6px] overflow-x-auto pb-1 mb-3">
        {["todos", ...STATUS_LIST.map((s) => s.key)].map((k) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`px-[11px] py-[5px] rounded-[20px] border-[1.5px] text-[11px] font-bold whitespace-nowrap shrink-0 ${filtro === k ? "bg-foreground text-yellow border-foreground" : "bg-card border-border text-foreground"}`}
          >
            {k === "todos" ? "Todos" : sInfo(k as Status).label}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]"></i>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, material, medidas..."
          className="w-full bg-card rounded-[10px] pl-8 pr-3 py-[9px] text-[13px] border border-border focus:outline-none focus:border-foreground"
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
        />
        {busca && (
          <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <i className="ti ti-x text-[13px]"></i>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-9 text-muted-foreground">
          <i className="ti ti-inbox text-[34px] block mb-2"></i>
          Nenhum pedido por aqui ainda.
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                Em andamento ({emAndamento.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {emAndamento.map((p: any) => {
                  const isCliche = p.tipo === "cliche";
                  return (
                    <div
                      key={p.id}
                      onClick={() => onOpen(p.id)}
                      className={`rounded-[14px] p-3 border-l-[3px] cursor-pointer hover:opacity-80 flex flex-col ${isCliche ? "bg-yellow border-l-[#1d1d1b]" : `bg-card ${borderStatus(p.status)}`}`}
                      style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-bold ${isCliche ? "text-foreground/70" : "text-muted-foreground"}`}>#{p.numero}</span>
                        <StatusBadge s={p.status} />
                      </div>
                      <div className="font-display text-[15px] font-extrabold leading-tight truncate">{p.cliente}</div>
                      {isCliche ? (
                        <>
                          <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] mt-1 flex items-center gap-1 truncate"><i className="ti ti-stamp shrink-0"></i><span className="truncate">{p.motivo || "Reposição de clichê"}</span></div>
                          <div className="text-[10px] text-foreground/70 truncate">Cód. {p.codigo_produto}</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate">{p.materia} · {p.largura}×{p.altura}mm</div>
                      )}
                      <div className={`text-[10px] ${isCliche ? "text-foreground/70" : "text-muted-foreground"}`}>
                        Aberto {new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        <span className="font-bold text-foreground"> · {diasDesde(p.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {finalizados.length > 0 && (
            <>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-2">
                Finalizados
              </div>
              <div className="space-y-2">
                {finalizados.map((p: any) => (
                  <div key={p.id} onClick={() => onOpen(p.id)} className={`bg-card rounded-[14px] py-[13px] px-[15px] cursor-pointer hover:opacity-80 border-l-[3px] ${borderStatus(p.status)}`} style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm font-bold">{p.cliente}</div>
                      <div className="flex items-center gap-1">
                        <StatusBadge s={p.status} />
                        {(canEdit(p) || isGestor) && (
                          <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                            {canEdit(p) && (
                              <button onClick={() => onEdit(p)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                                <i className="ti ti-pencil text-[12px]"></i>
                              </button>
                            )}
                            {isGestor && (
                              <button onClick={() => onDelete(p)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                <i className="ti ti-trash text-[12px]"></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-1">
                      <span>#{p.numero}</span>
                      {p.tipo === "cliche" ? (
                        <>
                          <span><i className="ti ti-stamp mr-[2px]"></i>{p.motivo || "Reposição de clichê"}</span>
                          <span>Cód. {p.codigo_produto}</span>
                        </>
                      ) : (
                        <>
                          <span>{p.materia}</span>
                          <span>{p.largura}×{p.altura}mm</span>
                          <span>{p.cores} cor(es)</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function EditModal({ pedido, onClose, onSaved }: { pedido: any; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  // Busca o pedido COMPLETO — a listagem traz só um resumo, e editar em cima
  // do resumo apagava briefing, largura da MP e outros campos não carregados.
  const { data: full } = useQuery({
    queryKey: ["pedido-edit", pedido.id],
    queryFn: () => getPedido({ data: { id: pedido.id } }),
  });

  const [f, setF] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);

  useEffect(() => {
    if (full?.pedido && !f) {
      const p = full.pedido as any;
      setF({
        cliente: p.cliente ?? "",
        materia: p.materia ?? "",
        larg_materia: p.larg_materia ?? "",
        largura: p.largura ?? "",
        altura: p.altura ?? "",
        forma: p.forma ?? "GAP",
        cores: p.cores ?? "",
        cores_desc: p.cores_desc ?? "",
        carreiras: p.carreiras ?? "",
        descricao: p.descricao ?? "",
        link_ref: p.link_ref ?? "",
      });
    }
  }, [full, f]);

  const anexos = (full?.anexos ?? []) as any[];

  function recarregarAnexos() {
    qc.invalidateQueries({ queryKey: ["pedido-edit", pedido.id] });
    qc.invalidateQueries({ queryKey: ["pedido", pedido.id] });
  }

  async function addAnexos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setEnviandoAnexo(true);
    try {
      for (const file of files) {
        const dataBase64 = await fileToBase64(file);
        await uploadAnexo({ data: { pedidoId: pedido.id, tipo: "anexo", nome: file.name, dataBase64 } });
      }
      toast.success(files.length > 1 ? `${files.length} arquivos anexados.` : "Arquivo anexado.");
      recarregarAnexos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar");
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function removerAnexo(a: any) {
    try {
      await deleteAnexo({ data: { anexoId: a.id } });
      toast.success("Anexo apagado (removido da pasta do cliente).");
      recarregarAnexos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar anexo");
    }
  }

  async function save() {
    if (!f) return;
    setSaving(true);
    try {
      await updatePedido({ data: { id: pedido.id, ...f } });
      toast.success("Pedido atualizado.");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-card w-full sm:max-w-[500px] rounded-t-[24px] sm:rounded-[18px] p-5 max-h-[90vh] overflow-y-auto" style={{ boxShadow: "0 -4px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[17px] font-extrabold">Editar #{pedido.numero}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>
        {!f ? (
          <div className="text-center text-muted-foreground py-10">Carregando pedido...</div>
        ) : (
        <>
        <div className="space-y-3">
          {[
            { k: "cliente", label: "Cliente" },
            { k: "larg_materia", label: "Largura MP (mm)" },
            { k: "largura", label: "Largura etiqueta (mm)" },
            { k: "altura", label: "Altura etiqueta (mm)" },
            { k: "carreiras", label: "Quantidade de carreiras" },
            { k: "cores_desc", label: "Descrição das cores" },
            { k: "descricao", label: "Briefing" },
            { k: "link_ref", label: "Link referência" },
          ].map(({ k, label }) => (
            <div key={k}>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
              <input value={(f as any)[k]} onChange={(e) => setF((s: any) => ({ ...s, [k]: e.target.value }))} className="w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground" />
            </div>
          ))}
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Material</div>
            <Chips options={MATERIAS} value={f.materia} onChange={(v) => setF((s: any) => ({ ...s, materia: v }))} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Formato</div>
            <Chips options={FORMAS} value={f.forma} onChange={(v) => setF((s: any) => ({ ...s, forma: v }))} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Cores</div>
            <Chips options={CORES_OPTS} value={f.cores} onChange={(v) => setF((s: any) => ({ ...s, cores: v }))} />
          </div>

          {/* Anexos */}
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Anexos</div>
            {anexos.length === 0 && (
              <div className="text-[12px] text-muted-foreground mb-1">Nenhum anexo neste pedido.</div>
            )}
            {anexos.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 bg-background border border-border rounded-[8px] px-2 py-1.5 text-[12px] mb-1">
                <i className={`ti ${a.tipo === "arte" ? "ti-brush" : "ti-file"}`}></i>
                <span className="flex-1 truncate">{a.nome}</span>
                <button onClick={() => removerAnexo(a)} title="Apagar anexo" className="text-muted-foreground hover:text-destructive">
                  <i className="ti ti-trash text-[13px]"></i>
                </button>
              </div>
            ))}
            <label className="block border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-foreground relative mt-1">
              <input
                type="file"
                multiple
                onChange={(e) => { addAnexos(e.target.files); e.target.value = ""; }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <i className="ti ti-cloud-upload text-lg text-muted-foreground"></i>
              <p className="text-[11px] text-muted-foreground mt-[2px]">
                {enviandoAnexo ? "Enviando..." : "Anexar mais arquivos (vão para a pasta do cliente)"}
              </p>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-background border border-border">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow">
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

/** Quando true, o Card cresce (flex) para as colunas alinharem o rodapé. */
const CardColunaCtx = createContext(false);

function NovoForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    cliente: "", materia: "", larg_materia: "", largura: "", altura: "",
    forma: "GAP", cores: "", cores_desc: "", descricao: "", link_ref: "", carreiras: ""
  });
  const [anexos, setAnexos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const fields = [
    ["cliente", f.cliente], ["materia", f.materia], ["larg_materia", f.larg_materia],
    ["largura", f.largura], ["altura", f.altura], ["forma", f.forma],
    ["cores", f.cores], ["descricao", f.descricao], ["carreiras", f.carreiras],
  ];
  const completed = fields.filter(([_, v]) => v).length;
  const progress = Math.round((completed / fields.length) * 100);
  const valid = fields.every(([_, v]) => v);

  function setF1<K extends keyof typeof f>(k: K, v: string) { setF((s) => ({ ...s, [k]: v })); }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Cópia síncrona: o FileList é "vivo" e é esvaziado quando o input é limpo logo em seguida.
    const files = Array.from(list);
    setAnexos((prev) => [...prev, ...files]);
  }

  function removeFile(i: number) { setAnexos((p) => p.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!valid) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setSending(true);
    try {
      const { id } = await createPedido({
        data: {
          cliente: f.cliente,
          materia: f.materia,
          larg_materia: f.larg_materia,
          largura: f.largura,
          altura: f.altura,
          forma: f.forma,
          cores: f.cores,
          cores_desc: f.cores_desc || null,
          carreiras: f.carreiras || null,
          descricao: f.descricao,
          link_ref: f.link_ref || null,
        },
      });

      for (const file of anexos) {
        const dataBase64 = await fileToBase64(file);
        await uploadAnexo({ data: { pedidoId: id, tipo: "anexo", nome: file.name, dataBase64 } });
      }

      toast.success("Solicitação enviada! Arquivos salvos na pasta do cliente.");
      setF({ cliente: "", materia: "", larg_materia: "", largura: "", altura: "", forma: "GAP", cores: "", cores_desc: "", descricao: "", link_ref: "", carreiras: "" });
      setAnexos([]);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally { setSending(false); }
  }

  return (
    <>
      {/* Três colunas explícitas (colapsam quando estreito). items-stretch +
          cards flex-grow → todas as colunas terminam na mesma base. */}
      <CardColunaCtx.Provider value={true}>
      <div className="flex flex-wrap items-stretch" style={{ gap: "14px" }}>
      {/* Coluna 1 */}
      <div className="flex flex-col" style={{ flex: "1 1 280px", minWidth: 0 }}>
      <Card title="Dados do cliente" icon="ti-building-store">
        <Field label="Nome do cliente" required>
          <input value={f.cliente} onChange={(e) => setF1("cliente", e.target.value)} placeholder="Ex.: Biscoitos Vitória" className="inp" />
        </Field>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Se for cliente novo, a pasta dele será criada automaticamente na rede.
        </p>
      </Card>

      <Card title="Matéria-prima" icon="ti-layers">
        <Label>Material *</Label>
        <Chips options={MATERIAS} value={f.materia} onChange={(v) => setF1("materia", v)} />
        <div className="mt-3">
          <Field label="Largura da matéria-prima (mm)" required>
            <input value={f.larg_materia} onChange={(e) => setF1("larg_materia", e.target.value)} placeholder="Ex.: 620" className="inp" />
          </Field>
        </div>
      </Card>
      </div>{/* fim coluna 1 */}

      {/* Coluna 2 */}
      <div className="flex flex-col" style={{ flex: "1 1 280px", minWidth: 0 }}>
      <Card title="Medidas da etiqueta" icon="ti-ruler-measure">
        <div className="grid grid-cols-2 gap-[10px]">
          <Field label="Largura (mm)" required>
            <input value={f.largura} onChange={(e) => setF1("largura", e.target.value)} placeholder="80" className="inp" />
          </Field>
          <Field label="Altura (mm)" required>
            <input value={f.altura} onChange={(e) => setF1("altura", e.target.value)} placeholder="60" className="inp" />
          </Field>
        </div>
        <Label>Formato *</Label>
        <Chips options={FORMAS} value={f.forma} onChange={(v) => setF1("forma", v)} />
        <div className="mt-3">
          <Field label="Quantidade de carreiras" required>
            <input value={f.carreiras} onChange={(e) => setF1("carreiras", e.target.value)} placeholder="Ex.: 2" className="inp" />
          </Field>
        </div>
      </Card>

      <Card title="Cores de impressão" icon="ti-droplet">
        <Label>Número de cores *</Label>
        <div className="grid grid-cols-3 gap-[6px] mb-2">
          {CORES_OPTS.map((c) => (
            <button key={c} type="button" onClick={() => setF1("cores", c)}
              className={`py-2 px-1 rounded-[10px] border-[1.5px] text-[13px] font-semibold ${f.cores === c ? "bg-foreground text-yellow border-foreground" : "bg-background border-border"}`}>
              {c}
            </button>
          ))}
        </div>
        <Field label="Especificação (opcional)">
          <input value={f.cores_desc} onChange={(e) => setF1("cores_desc", e.target.value)} placeholder="Ex.: Pantone 185 C, preto" className="inp" />
        </Field>
      </Card>
      </div>{/* fim coluna 2 */}

      {/* Coluna 3 */}
      <div className="flex flex-col" style={{ flex: "1 1 280px", minWidth: 0 }}>
      <Card title="Briefing da arte" icon="ti-message">
        <Field label="Descrição / instruções" required>
          <textarea value={f.descricao} onChange={(e) => setF1("descricao", e.target.value)} placeholder="Descreva a arte: logo, textos, referências..." className="inp min-h-[80px] resize-y" />
        </Field>
        <Field label="Link de referência (opcional)">
          <input value={f.link_ref} onChange={(e) => setF1("link_ref", e.target.value)} placeholder="https://..." className="inp" />
        </Field>
      </Card>

      <Card title="Anexos" icon="ti-paperclip">
        <Label>Arquivos (qualquer formato)</Label>
        <label className="w-full block border-2 border-dashed border-border rounded-[10px] p-4 text-center cursor-pointer hover:border-foreground bg-transparent relative">
          <input
            type="file"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <i className="ti ti-cloud-upload text-2xl text-muted-foreground block mb-1"></i>
          <p className="text-xs text-muted-foreground">Clique para anexar arquivos (faca, referências, fotos, PDF, AI, CDR...)</p>
        </label>
        {anexos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {anexos.map((file, i) => (
              <li key={i} className="flex items-center gap-2 bg-background border border-border rounded-[8px] px-2 py-1 text-[12px]">
                <i className="ti ti-file"></i>
                <span className="flex-1 truncate">{file.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <i className="ti ti-x"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Enviar ao pé da coluna 3 — mb-[10px] casa a base do botão com o rodapé
          dos cards das outras colunas (que também têm mb-[10px]). */}
      <div className="mt-1 mb-[10px]">
        <div className="h-[3px] bg-border rounded-sm mb-3 overflow-hidden">
          <div className="h-full bg-yellow rounded-sm transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button onClick={submit} disabled={!valid || sending}
          className="w-full bg-yellow text-foreground rounded-[10px] py-3 font-bold text-sm flex items-center justify-center gap-[6px] hover:opacity-85 disabled:cursor-not-allowed">
          <i className="ti ti-send"></i> {sending ? "Enviando..." : "Enviar solicitação"}
        </button>
      </div>
      </div>{/* fim coluna 3 */}
      </div>{/* fim das colunas */}
      </CardColunaCtx.Provider>

      <style>{`.inp{width:100%;background:var(--background);border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-family:'Inter',sans-serif;font-size:14px;color:var(--foreground);outline:none}.inp:focus{border-color:var(--foreground)}`}</style>
    </>
  );
}

function SolicitarClicheForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [cliente, setCliente] = useState("");
  const [codigo, setCodigo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novoMotivo, setNovoMotivo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inpCls = "w-full bg-background border-[1.5px] border-border rounded-[10px] px-3 py-[10px] text-sm outline-none focus:border-foreground";

  const { data: motivos = [] } = useQuery({
    queryKey: ["cliche-motivos"],
    queryFn: () => listMotivosCliche(),
  });

  const valid = cliente.trim().length > 0 && codigo.trim().length > 0 && motivo.trim().length > 0;

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

  async function submit() {
    if (!valid) { toast.error("Preencha o cliente/arte, o código e o motivo."); return; }
    setSending(true);
    try {
      const { numero } = await solicitarCliche({ data: { cliente: cliente.trim(), codigo: codigo.trim(), motivo: motivo.trim() } });
      toast.success(`Solicitação de clichê #${numero} enviada ao design.`);
      setCliente(""); setCodigo(""); setMotivo("");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally { setSending(false); }
  }

  return (
    <>
      <div className="bg-card rounded-[12px] p-3 mb-[10px] flex items-start gap-2 text-[12px] border-l-[3px] border-l-yellow" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
        <i className="ti ti-stamp text-[16px] mt-[1px]"></i>
        <span>Clichê danificado em produção? Solicite a reposição aqui. O design recebe como uma arte nova — o chip fica <strong>amarelo</strong> na Central para diferenciar.</span>
      </div>

      <Card title="Reposição de clichê" icon="ti-stamp">
        <Field label="Cliente / Arte" required>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: Biscoitos Vitória — rótulo 500g" className={inpCls} autoFocus />
        </Field>
        <Field label="Código do produto" required>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: PRD-01234" className={inpCls} />
        </Field>
        <Field label="Motivo da solicitação" required>
          {novoMotivo === null ? (
            <div className="flex gap-2">
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`flex-1 ${inpCls}`}>
                <option value="">Selecione o motivo...</option>
                {motivos.map((m: any) => (
                  <option key={m.id} value={m.nome}>{m.nome}</option>
                ))}
              </select>
              <button type="button" onClick={() => setNovoMotivo("")} title="Adicionar novo motivo" className="rounded-[10px] px-3 border-[1.5px] border-border bg-background text-[13px] font-bold hover:border-foreground">
                <i className="ti ti-plus"></i>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Novo motivo..." autoFocus className={`flex-1 ${inpCls}`} />
              <button type="button" onClick={salvarNovoMotivo} className="rounded-[10px] px-3 bg-foreground text-yellow text-[13px] font-bold">Salvar</button>
              <button type="button" onClick={() => setNovoMotivo(null)} className="rounded-[10px] px-3 border-[1.5px] border-border bg-background text-[13px] font-bold">
                <i className="ti ti-x"></i>
              </button>
            </div>
          )}
        </Field>
      </Card>

      <button onClick={submit} disabled={!valid || sending}
        className="w-full mt-1 bg-yellow text-foreground rounded-[10px] py-3 font-bold text-sm flex items-center justify-center gap-[6px] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed">
        <i className="ti ti-send"></i> {sending ? "Enviando..." : "Enviar solicitação de clichê"}
      </button>
    </>
  );
}

function Card({ title, icon, children }: any) {
  const emColuna = useContext(CardColunaCtx);
  return (
    <div
      className="p-4 mb-[10px] bg-card"
      style={{
        borderRadius: "var(--radius-card, 14px)",
        boxShadow: "var(--sh, 0 1px 0 rgba(0,0,0,0.04))",
        // cresce para preencher a coluna → rodapés das colunas alinhados
        // (basis auto = mantém a altura natural como mínimo; grow ocupa o excedente)
        ...(emColuna ? { flex: "1 1 auto" } : {}),
      }}
    >
      <div className="font-display text-[15px] font-extrabold mb-3 flex items-center gap-[7px]"><i className={`ti ${icon}`}></i>{title}</div>
      {children}
    </div>
  );
}
function Label({ children }: any) {
  return <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-[5px] block">{children}</label>;
}
function Field({ label, required, children }: any) {
  return (
    <div className="mb-3">
      <Label>{label}{required && <span className="text-destructive ml-[2px]">*</span>}</Label>
      {children}
    </div>
  );
}
function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[6px] mt-[3px]">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`py-[6px] px-[11px] rounded-[20px] border-[1.5px] text-xs font-medium whitespace-nowrap ${value === o ? "bg-foreground text-yellow border-foreground" : "bg-background border-border"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
