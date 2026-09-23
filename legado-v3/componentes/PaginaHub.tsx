// Casco reutilizável das páginas internas do Hub, no design de "capa" (mesma
// linguagem da Central e da Home): fundo em vídeo/imagem próprio da página +
// véu escuro + fade-in, título Fraunces amarelo à esquerda, toolbar à direita
// (Home + slot de ações + pill do usuário com engrenagem/sino/Sair) e o menu
// inferior compartilhado. O miolo (form, listas, etc.) entra pelo slot.
//
// Cada página tem fundo INDEPENDENTE (o usuário pediu): o `page` identifica a
// config no backend (getPageConfig/setPageVideo) e o arquivo publicado.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { hasPerm, type SessionUser } from "@/lib/session";
import { getHomeConfig, setHomeVideo, uploadVideo, listHomeVideos } from "@/lib/api/config.functions";
import { fileToBase64 } from "@/lib/files";
import { MenuCapa, type StatKey } from "@/components/MenuCapa";
import { NotificationBell } from "@/components/NotificationBell";

/* Constantes visuais compartilhadas do design de capa. */
export const CINZA = "#d8d0d1";
export const AMARELO = "#ffe91d";
export const PRETO = "#1d1d1b";
export const SOMBRA_CARD = "0 1px 0 rgba(0,0,0,0.04), 0 12px 26px -18px rgba(0,0,0,0.3)";
/** Fundo é imagem? (senão é vídeo) — decide entre <img> e <video>. */
export const ehImagemSrc = (s: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(s);

/** Páginas com fundo próprio — precisa casar com o enum do backend. */
export type PaginaFundo = "nova" | "cliches" | "solcliche" | "facas" | "calculadoras" | "apontamentos";

/** Contexto passado aos slots para colorirem seus textos conforme o fundo. */
export type UiCapa = {
  videoAtivo: boolean;
  /** Amarelo sobre vídeo (contraste), preto sobre o cinza padrão. */
  corApoio: string;
  AMARELO: string;
  PRETO: string;
  SOMBRA_CARD: string;
};

type Slot = ReactNode | ((ui: UiCapa) => ReactNode);
function renderSlot(s: Slot | undefined, ui: UiCapa): ReactNode {
  return typeof s === "function" ? (s as (ui: UiCapa) => ReactNode)(ui) : s;
}

export function PaginaHub({
  titulo,
  user,
  stats,
  aoAbrirMenu,
  onHome,
  onLogout,
  acoesTopo,
  rodapeDireita,
  larguraConteudo,
  arTopo,
  menuLateral = false,
  children,
}: {
  titulo: string;
  user: SessionUser;
  stats?: Partial<Record<StatKey, number>>;
  aoAbrirMenu: (to: string) => void;
  onHome: () => void;
  onLogout: () => void;
  /** Ações extras na toolbar (à esquerda da pill). Recebe o contexto de cor. */
  acoesTopo?: Slot;
  /** Bloco à direita do menu inferior (ex.: "Finalizados recentes"). */
  rodapeDireita?: Slot;
  /** Largura do miolo (ex.: form estreito). Padrão: 100%. */
  larguraConteudo?: string;
  /** Ar entre o título e o miolo. Padrão: clamp(28px, 4.5vh, 64px). */
  arTopo?: string;
  /** Menu vertical na lateral direita (ao lado do miolo) em vez do rodapé. */
  menuLateral?: boolean;
  children: Slot;
}) {
  const qc = useQueryClient();
  const podeEditar = hasPerm(user, "usuarios.gerenciar");
  const [editandoFundo, setEditandoFundo] = useState(false);

  // Papel de parede ÚNICO do app — o mesmo da capa (home) e de todas as páginas.
  // Query key compartilhada com a home → cache reaproveitado, navegação leve.
  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: () => getHomeConfig() });
  const video = cfg?.video ?? "";
  const videoAtivo = !!video;
  const corApoio = videoAtivo ? AMARELO : PRETO;
  const [videoPronto, setVideoPronto] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setVideoPronto(false);
    const v = videoRef.current;
    if (v && v.readyState >= 3) setVideoPronto(true);
  }, [video]);

  const ui: UiCapa = { videoAtivo, corApoio, AMARELO, PRETO, SOMBRA_CARD };

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
      {/* Véu escuro leve — faz o amarelo contrastar sobre qualquer vídeo. */}
      {videoAtivo && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, background: "rgba(0,0,0,0.22)", opacity: videoPronto ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      )}

      <div className="relative z-10 flex flex-col flex-1" style={{ padding: "1.6% 3.5% 2.2% 4.5%" }}>
        {/* Topo: título à esquerda; ações + pill à direita. */}
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
              {titulo}
            </h1>
          </div>

          <div className="flex items-center flex-wrap" style={{ paddingTop: "0.35em", gap: "clamp(16px, 1.6vw, 30px)" }}>
            {renderSlot(acoesTopo, ui)}
            <button
              onClick={onHome}
              className="uppercase tracking-wider hover:opacity-70"
              style={{ color: corApoio, fontWeight: 600, fontSize: "clamp(10px, 0.85vw, 13px)" }}
            >
              Home
            </button>
            {/* Pill do usuário — mesmo desenho da capa */}
            <div
              className="flex items-center"
              style={{ gap: "0.4em", background: videoAtivo ? "rgba(255,255,255,0.88)" : "rgba(29,29,27,0.06)", borderRadius: "9999px", padding: "0.25em 0.85em 0.25em 1.4em", boxShadow: videoAtivo ? "0 1px 4px rgba(0,0,0,0.12)" : "none" }}
            >
              <span className="font-bold uppercase tracking-wider" style={{ color: PRETO, opacity: 0.55, fontSize: "clamp(9px, 0.8vw, 12px)" }}>
                {user.nome.split(" ")[0]}
              </span>
              {podeEditar && (
                <button
                  onClick={() => setEditandoFundo(true)}
                  title="Papel de parede (todas as páginas)"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-card hover:opacity-80"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.09)" }}
                  aria-label="Editar fundo da página"
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

        {menuLateral ? (
          /* Miolo à esquerda + menu vertical na lateral direita (mesma tela). */
          <div className="flex flex-1 flex-wrap items-start" style={{ marginTop: arTopo ?? "clamp(28px, 4.5vh, 64px)", columnGap: "clamp(24px, 4vw, 72px)", rowGap: "clamp(24px, 4vh, 48px)" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: larguraConteudo }}>
              {renderSlot(children, ui)}
            </div>
            <div className="shrink-0" style={{ paddingTop: "0.15em" }}>
              <MenuCapa user={user} stats={stats} aoAbrir={aoAbrirMenu} peso={600} tracking="-0.01em" cor={videoAtivo ? "#ffffff" : PRETO} vertical />
            </div>
          </div>
        ) : (
          <>
            {/* Miolo */}
            <div style={{ marginTop: arTopo ?? "clamp(28px, 4.5vh, 64px)", width: larguraConteudo ?? "100%" }}>
              {renderSlot(children, ui)}
            </div>

            {/* Base: menu à esquerda, slot opcional à direita */}
            <div className="mt-auto flex items-end justify-between gap-6 flex-wrap pt-8">
              <MenuCapa user={user} stats={stats} aoAbrir={aoAbrirMenu} peso={600} tracking="-0.01em" cor={videoAtivo ? "#ffffff" : PRETO} />
              {renderSlot(rodapeDireita, ui)}
            </div>
          </>
        )}
      </div>

      {editandoFundo && (
        <ModalFundoPagina
          videoNome={cfg?.videoNome ?? ""}
          onClose={() => setEditandoFundo(false)}
          onMudou={() => { qc.invalidateQueries({ queryKey: ["home-config"] }); }}
        />
      )}
    </div>
  );
}

/** Modal do papel de parede — único para todas as páginas (mesmo da capa).
    Escolher vídeo/imagem do acervo ou enviar um novo. Só quem tem usuarios.gerenciar. */
function ModalFundoPagina({ videoNome, onClose, onMudou }: { videoNome: string; onClose: () => void; onMudou: () => void }) {
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
      await escolher(res.nome); // já aplica a mídia recém-enviada
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
