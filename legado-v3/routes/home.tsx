// Home V3 do Hub — mockup home_v3_3 (grid 1920×1080, GRID.md/DESIGN.md):
//   · data/hora no topo-esquerdo; rail preto fechado com "V. 0.01" no pé
//   · saudação "Olá, {nome}" em Fraunces gigante (ink) + frase em text-muted
//   · "Em aberto" à direita: cards de pedido/faca com orelha, em 2 colunas
//   · bloco sino + engrenagem (config) no topo-direito
// Funcionalidades preservadas: pendências por permissão/escopo, atalhos 1–N,
// modal de configuração (versão + acervo de mídia) e logout.
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  BlocoSinoConfig, CardFacaV3, CardPedidoV3, HubShell, TAM_TITULO, TINTA_FRAUNCES,
  TRANS_GRID, TituloSecao, Y_CARDS, Y_SECAO, linhas,
} from "@/components/v3/HubV3";
import { itensDoUsuario } from "@/components/MenuCapa";
import { getHomeConfig, getHomeStats, listHomeVideos, setHomeConfig, setHomeVideo } from "@/lib/api/config.functions";
import { listPedidos } from "@/lib/api/pedidos.functions";
import { listFacas } from "@/lib/api/facas.functions";
import { logout } from "@/lib/api/auth.functions";
import {
  clearStoredSession, getStoredSession, hasPerm, type SessionUser,
} from "@/lib/session";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "R2 Hub" }] }),
  component: HomePage,
});

const LAST_MENU_KEY = "r2hub.ultimoMenu";

/* Uma pendência do quadro da direita: pedido em andamento ou faca fora. */
type Pendencia =
  | { kind: "pedido"; id: string; created_at: string; p: any }
  | { kind: "faca"; id: string; created_at: string; f: any };

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profile] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);
  const [editando, setEditando] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["home-config"],
    queryFn: () => getHomeConfig(),
  });

  // Contadores dos badges — atualizam sozinhos a cada 30s.
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => getHomeStats(),
    refetchInterval: 30_000,
    enabled: !!profile,
  });

  // Pendências pertinentes ao usuário: pedidos (o servidor já limita ao escopo
  // de cada um) e, para quem tem a aba, facas em afiação.
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => listPedidos(),
    refetchInterval: 30_000,
    enabled: !!profile,
  });
  const podeAfiacao = !!profile && hasPerm(profile, "tab.afiacao");
  const { data: facas = [] } = useQuery({
    queryKey: ["facas"],
    queryFn: () => listFacas(),
    refetchInterval: 30_000,
    enabled: podeAfiacao,
  });

  const itensAtalho = profile ? itensDoUsuario(profile) : [];

  function abrir(to: string) {
    try { localStorage.setItem(LAST_MENU_KEY, to); } catch { /* storage pode estar bloqueado */ }
    navigate({ to });
  }

  // Atalhos de teclado 1–N abrem os itens do menu direto da capa.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editando) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= itensAtalho.length) {
        e.preventDefault();
        abrir(itensAtalho[n - 1].to);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, itensAtalho.length]);

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const podeEditar = hasPerm(profile, "usuarios.gerenciar");
  const primeiroNome = profile.nome.split(" ")[0];
  const versao = cfg?.versao ?? "V. 0.01";
  const frase = cfg?.frase?.trim() || "Tenha um ótimo dia, contamos com você, sempre : ]";

  // Pendências mescladas (mais recentes primeiro), limitadas a 8 = grade 2×4.
  const pendencias: Pendencia[] = [
    ...pedidos
      .filter((p: any) => !["concluido", "cancelado"].includes(p.status))
      .map((p: any) => ({ kind: "pedido" as const, id: p.id, created_at: p.created_at, p })),
    ...(podeAfiacao
      ? facas
          .filter((f: any) => f.status === "enviada")
          .map((f: any) => ({ kind: "faca" as const, id: `faca-${f.id}`, created_at: f.created_at, f }))
      : []),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const cards = pendencias.slice(0, 8);
  const excedente = pendencias.length - cards.length;

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    try { await logout(); } catch { /* sessão pode já ter expirado */ }
    clearStoredSession();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <HubShell
        user={profile}
        stats={stats}
        ativo="/home"
        aoNavegar={abrir}
        onLogout={sair}
        versao={versao}
      >
        {(g) => {
          /* Direita ANCORADA nas colunas físicas 11–16 (não mexe com o rail);
             a saudação vive na área esquerda flexível. */
          const xCards = g.col(11);
          const wCards = g.cw(6);
          return (
            <>
              <BlocoSinoConfig user={profile} onLogout={sair} onConfig={podeEditar ? () => setEditando(true) : undefined} />

              {/* Saudação — corpo de título do mockup (95,8876) em caixas de
                  7 linhas do ritmo; a frase entra 1 linha abaixo, em 2 linhas */}
              <div className="absolute" style={{ left: g.x0, top: linhas(19), width: g.wEsq(9), transition: TRANS_GRID }}>
                <h1 className="fd select-none" style={{ fontSize: TAM_TITULO, lineHeight: `${linhas(7)}px`, letterSpacing: "-2px", color: "var(--text)", marginLeft: TINTA_FRAUNCES }}>
                  Olá,<br />{primeiroNome}
                </h1>
                <p style={{ marginTop: linhas(1), fontSize: 16, lineHeight: `${linhas(2)}px`, fontWeight: 500, color: "var(--text-muted)" }}>
                  {frase}
                </p>
              </div>

              {/* Em aberto — 2 colunas de cards, no máximo 8 (posição fixa) */}
              <div className="absolute" style={{ left: xCards, top: Y_SECAO, width: wCards }}>
                <TituloSecao acao="Ver todos" onAcao={() => abrir("/app?todos=1")}>Em aberto</TituloSecao>
              </div>
              <div className="absolute" style={{ left: xCards, top: Y_CARDS, width: wCards }}>
                {cards.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", padding: "6px 0" }}>
                    Nenhuma pendência agora. Bom trabalho! : ]
                  </div>
                ) : (
                  <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "18px 12px" }}>
                    {cards.map((c) =>
                      c.kind === "pedido" ? (
                        <CardPedidoV3 key={c.id} p={c.p} onOpen={() => navigate({ to: "/pedido/$id", params: { id: c.p.id } })} />
                      ) : (
                        <CardFacaV3 key={c.id} f={c.f} onOpen={() => abrir("/app?tab=facas")} />
                      ),
                    )}
                  </div>
                )}
                {excedente > 0 && (
                  <button
                    onClick={() => abrir("/app")}
                    className="hover:opacity-70"
                    style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}
                  >
                    +{excedente} em andamento na Central →
                  </button>
                )}
              </div>
            </>
          );
        }}
      </HubShell>

      {editando && (
        <ModalEditarCapa
          inicial={{ titulo: cfg?.titulo ?? "", frase: cfg?.frase ?? "", versao, videoNome: cfg?.videoNome ?? "" }}
          onVideoMudou={() => qc.invalidateQueries({ queryKey: ["home-config"] })}
          onClose={() => setEditando(false)}
          onDone={() => { setEditando(false); qc.invalidateQueries({ queryKey: ["home-config"] }); }}
        />
      )}
    </>
  );
}

/** Configuração do Hub (engrenagem): versão exibida no rail, frase da saudação
    e acervo de mídia (o papel de parede não aparece no design V3, mas o acervo
    continua gerenciável para não perder a funcionalidade). */
function ModalEditarCapa({ inicial, onVideoMudou, onClose, onDone }: {
  inicial: { titulo: string; frase: string; versao: string; videoNome: string };
  onVideoMudou: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [versao, setVersao] = useState(inicial.versao);
  const [frase, setFrase] = useState(inicial.frase);
  const [saving, setSaving] = useState(false);

  const [videoSel, setVideoSel] = useState(inicial.videoNome);
  const [aplicando, setAplicando] = useState<string | null>(null);

  const { data: videosData, isLoading: carregandoVideos } = useQuery({
    queryKey: ["home-videos"],
    queryFn: () => listHomeVideos(),
  });
  const videos = videosData?.videos ?? [];

  const inp = "w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground";

  async function escolherVideo(nome: string) {
    if (aplicando) return;
    setAplicando(nome || "__cinza__");
    try {
      await setHomeVideo({ data: { nome } });
      setVideoSel(nome);
      onVideoMudou();
      toast.success(nome ? "Mídia selecionada no acervo." : "Seleção de mídia limpa.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar o vídeo");
    } finally {
      setAplicando(null);
    }
  }

  async function salvar() {
    setSaving(true);
    try {
      await setHomeConfig({ data: { titulo: inicial.titulo, frase, versao } });
      toast.success("Configuração salva.");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[400px] my-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[16px] font-extrabold">Configuração do Hub</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Versão do Hub (pé do menu)</div>
        <input value={versao} onChange={(e) => setVersao(e.target.value)} className={`${inp} mb-3`} />

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Frase da saudação</div>
        <input value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Tenha um ótimo dia, contamos com você, sempre : ]" className={`${inp} mb-4`} />

        {/* Acervo de mídia — mantido do design anterior (não aparece no V3) */}
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Acervo de mídia (legado)</div>
        <div className="rounded-[12px] border border-border overflow-hidden mb-1 max-h-[150px] overflow-y-auto">
          <VideoOpcao
            rotulo="Nenhuma mídia selecionada"
            detalhe="Padrão"
            icone="ti-photo"
            ativo={!videoSel}
            aplicando={aplicando === "__cinza__"}
            desabilitado={!!aplicando}
            onClick={() => escolherVideo("")}
          />
          {carregandoVideos && (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">Procurando vídeos na rede...</div>
          )}
          {!carregandoVideos && videos.length === 0 && (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">Nenhum vídeo encontrado na pasta da rede.</div>
          )}
          {videos.map((v) => (
            <VideoOpcao
              key={v.nome}
              rotulo={v.nome}
              detalhe={`${v.tamanhoMB} MB`}
              icone={v.tipo === "imagem" ? "ti-photo" : "ti-movie"}
              ativo={videoSel === v.nome}
              aplicando={aplicando === v.nome}
              desabilitado={!!aplicando}
              onClick={() => escolherVideo(v.nome)}
            />
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mb-4">
          O design V3 usa fundo sólido — o acervo fica guardado caso o papel de parede volte.
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-background border border-border">Fechar</button>
          <button onClick={salvar} disabled={saving} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow disabled:opacity-40">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoOpcao({ rotulo, detalhe, icone, ativo, aplicando, desabilitado, onClick }: {
  rotulo: string; detalhe: string; icone: string;
  ativo: boolean; aplicando: boolean; desabilitado: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border last:border-b-0 transition-colors ${ativo ? "bg-yellow/25" : "hover:bg-background"} disabled:cursor-not-allowed`}
    >
      <i className={`ti ${icone} text-[15px] text-muted-foreground shrink-0`}></i>
      <span className="flex-1 text-[12px] font-bold truncate">{rotulo}</span>
      <span className="text-[10px] text-muted-foreground shrink-0">{detalhe}</span>
      {aplicando
        ? <i className="ti ti-loader-2 animate-spin text-[15px] shrink-0"></i>
        : ativo && <i className="ti ti-check text-[15px] shrink-0" style={{ color: "#1d1d1b" }}></i>}
    </button>
  );
}
