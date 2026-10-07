// As Preferências no molde das etapas da Solicitação v4 (Augusto, 02/10/2026:
// "em preferências tente manter tudo em uma tela só sem scroll, refaça tudo
// do zero se necessário, pq o rework ficou fora de alinhamento e do grid do
// hub atual").
//
// É uma camada da página, não uma caixa flutuante: o cinza da página cobre o
// palco (os balões da Home inclusive) e a barra do topo continua por cima,
// com a engrenagem acesa (o menu leva para outra página e fecha a camada).
// Tudo mora na grade, como nas etapas da Solicitação:
// - dois painéis brancos, da c1 à c16,5 e da c17 à c23, da linha 9 à 51, com
//   o raio e a sombra do rework;
// - no painel da esquerda, duas colunas (c2 e c10) separadas pelo traço cinza
//   da c9, o mesmo da etapa de medidas; no da direita, a tinta em 1409 (49 da
//   borda, a das etapas);
// - títulos em Fraunces 40 com a base na linha 14; as opções começam na linha
//   20 e andam de três em três; escolha única é lista com o escolhido em
//   negrito itálico (a "Matéria-prima"), e liga/desliga é a bolinha da "Faca
//   nova";
// - no pé, "Preferências" em Fraunces 104 com a tinta na c1 e a base na linha
//   63, e "Fechar" em pílula terminando na c23, como o "Sair" das etapas.
// Nada rola. Não há Salvar: cada escolha grava na hora e, se o servidor
// recusar, a marca volta e o aviso diz por quê.
//
// Ficaram de fora três itens da caixa antiga que não fazem nada no 1.0 (a
// caixa antiga continua nas telas antigas, com eles): o tamanho na tela (o
// palco do 1.0 sempre cabe na janela, ver PalcoFixo), o som de mensagem do
// Chat (o Chat só existe na barra antiga) e o modo compacto das listas (só a
// lista antiga de pedidos lê).
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { tituloDoPeV4 } from "./CapaV4Hub10";
import { useApresentacao } from "./ApresentacaoHub10";
import { AMARELO, FR, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, MENU, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { ACERTO_IN, baseFraunces, baseInter, folga, folgaFR, folgaIN } from "./grade-hub10";
import { AvisoV1a } from "../v1a/HubV1a";
import { ilustDaHome, useHubDados, type IlustHome, type PapelParede } from "../v1a/HubDadosV1a";
import { definirSom, notificacaoNativaDisponivel, pedirPermissaoNativa, somLigado, tocarBip } from "@/lib/aviso-novidade";
import { erroLegivel } from "@/lib/erro-legivel";
import { changeMyPassword } from "@/lib/api/auth.functions";
import { instalarFocoDosModais } from "@/lib/foco-modal";
import { PALETA } from "@/lib/paleta-hub";

const LG = LINHA_DA_GRADE_HUB;
/** os painéis das etapas: da linha 9 à 51 */
const TOPO = 9 * LG;
const PE_PAINEL = 51 * LG;
/** as colunas do texto: c2 e c5 (a 2ª da lista de telas), c10 e a tinta do painel da direita */
const COL_A = 160;
const COL_A2 = 400;
const COL_B = 800;
const DIR = 1409;
const LARG_DIR = 1840 - 49 - DIR;
/** o cinza das explicações: o que o guia propõe para tela nova (5,1:1 no branco; o #8f8f8f não passa) */
const CINZA = "#6f6d6f";
const CINZA_FORTE = "#5b595b";
/** o cinza do traço entre as colunas (o das dicas, nas etapas) */
const DICA = "#c7c7c7";
const VERMELHO = PALETA.perigo;
const MONO = "ui-monospace, Menlo, monospace";
const PILULA_ALT = 44.04;
const PILULA_BORDA = 2.21;

const PAINEL: CSSProperties = {
  position: "absolute", top: TOPO, height: PE_PAINEL - TOPO, background: "#fff", borderRadius: 20, boxShadow: "7px 7px 42px rgba(0,0,0,.2)", zIndex: 1,
};
const LIMPO: CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: PRETO, textAlign: "left" };
/** a pílula do pé das etapas: 44 de altura, 0,85 acima da linha 63 (sem fundo aqui, para o hover da classe valer) */
const PILULA: CSSProperties = {
  position: "absolute", top: 63 * LG - 0.85 - PILULA_ALT, height: PILULA_ALT, boxSizing: "border-box", border: `${PILULA_BORDA}px solid ${PRETO}`, borderRadius: 999,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "2px 30px 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 500,
  letterSpacing: "-.014em", color: PRETO, whiteSpace: "nowrap", cursor: "pointer", zIndex: 3,
};
/** os campos e rótulos da caixa de cadastro: os da caixa "Design criado" */
const CAMPO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#fff", border: "1.5px solid #d9d8d6", borderRadius: 11, padding: "12px 14px",
  fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: PRETO, outline: "none",
};
const ROTULO_CAMPO: CSSProperties = { display: "block", fontFamily: INTER, fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: CINZA_FORTE, marginBottom: 8 };

/** Fraunces com a tinta da 1ª letra em x e a base em `base`. */
function frEm(texto: string, corpo: number, x: number, base: number): CSSProperties {
  return {
    position: "absolute", left: x - folgaFR(corpo, texto.charAt(0)), top: base - baseFraunces(corpo, corpo),
    ...FR, fontSize: corpo, lineHeight: `${corpo}px`, letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO,
  };
}
/** Inter com a tinta da 1ª letra em x e a base da 1ª linha em `base` (o itálico é o de verdade, com a folga dele). */
function interEm(texto: string, corpo: number, x: number, base: number, lh: number, peso = 400, italico = false): CSSProperties {
  const c = texto.charAt(0);
  const f = italico ? folga(`italic ${peso} ${corpo}px Inter`, c, 1) + (ACERTO_IN[`${corpo}/${peso}i${c}`] ?? 0.8) : folgaIN(peso, corpo, c);
  return {
    position: "absolute", left: x - f, top: base - baseInter(corpo, lh),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, fontStyle: italico ? "italic" : "normal", lineHeight: `${lh}px`, color: PRETO,
  };
}

/** A bolinha da "Faca nova": aro fino; ligada, cheia. */
function Bolinha({ ligada }: { ligada: boolean }) {
  return <span aria-hidden style={{ display: "block", boxSizing: "border-box", width: 28, height: 28, borderRadius: 999, border: `1px solid ${PRETO}`, background: ligada ? PRETO : "transparent", flex: "none" }} />;
}
/** Liga/desliga com a bolinha encostada na coluna e o texto em Fraunces 32
    depois dela, nas medidas da "Faca nova" (a bolinha no meio do olho da letra). */
function LigaDesliga({ x, base, texto, ligada, aoClicar, desligada = false }: {
  x: number; base: number; texto: string; ligada: boolean; aoClicar: () => void; desligada?: boolean;
}) {
  const topo = Math.round(base - 9.16 - 14);
  return (
    <button type="button" role="switch" aria-checked={ligada} onClick={aoClicar} disabled={desligada} className="np4-opcao"
      style={{ ...LIMPO, position: "absolute", left: x, top: topo, height: 28, display: "flex", alignItems: "center", cursor: desligada ? "default" : "pointer", opacity: desligada ? 0.45 : 1, zIndex: 2 }}>
      <Bolinha ligada={ligada} />
      <span style={{ ...FR, position: "absolute", left: 34.57, top: base - topo - baseFraunces(32, 32), fontSize: 32, lineHeight: "32px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{texto}</span>
    </button>
  );
}
/** onde cai a tinta do texto de um LigaDesliga: a explicação de baixo começa junto (o recuo do texto ao lado da bolinha) */
const tintaDoLiga = (x: number, texto: string) => x + 34.57 + folgaFR(32, texto.charAt(0));
/** Item de lista de escolha única (a "Matéria-prima" das etapas): Inter 24, o escolhido em negrito itálico. */
function Escolha({ x, linha, texto, on, aoEscolher, desligada = false }: { x: number; linha: number; texto: string; on: boolean; aoEscolher: () => void; desligada?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={aoEscolher} disabled={desligada} className="np4-opcao"
      style={{ ...LIMPO, ...interEm(texto, 24, x, linha * LG, 30, on ? 800 : 400, on), letterSpacing: "-.02em", whiteSpace: "nowrap", cursor: desligada ? "default" : "pointer", opacity: desligada ? 0.45 : 1, zIndex: 2 }}>{texto}</button>
  );
}

/* A miniatura da Home: as ilustrações são pranchas de 1920 por 1080 com o
   desenho num canto (a caixa da tinta medida no navegador); a miniatura
   mostra só o desenho, centrado, com 16 de ar na caixa de 382 por 18 linhas. */
const DESENHO_DA_HOME: Record<IlustHome, { src: string; x: number; y: number; w: number; h: number }> = {
  /* a de vendas nova, do Augusto (06/10/2026): a cena larga */
  Vendas: { src: "/home10/home-vendas-estilo.svg", x: 112, y: 91, w: 1652, h: 891 },
  /* a de design no estilo da de vendas (07/10/2026) */
  Design: { src: "/home10/home-design-estilo.svg", x: 149, y: 171, w: 1602, h: 808 },
};
function recorteDoDesenho(qual: IlustHome): CSSProperties {
  const d = DESENHO_DA_HOME[qual];
  const caixaA = 18 * LG;
  const k = Math.min((LARG_DIR - 32) / d.w, (caixaA - 32) / d.h);
  return { position: "absolute", left: (LARG_DIR - d.w * k) / 2 - d.x * k, top: (caixaA - d.h * k) / 2 - d.y * k, width: 1920 * k, height: 1080 * k, maxWidth: "none" };
}

/** Explicação em Inter 18, a tinta em x e a base na linha `linha`. */
function Explica({ x, linha, largura, texto, cor = CINZA, peso = 400 }: { x: number; linha: number; largura: number; texto: string; cor?: string; peso?: number }) {
  return <div style={{ ...interEm(texto, 18, x, linha * LG, 24, peso), width: largura, letterSpacing: "-.02em", color: cor, zIndex: 2 }}>{texto}</div>;
}

const movimentoReduzido = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function PreferenciasHub10({ nome, fechar }: { nome: string; fechar: () => void }) {
  const dados = useHubDados();
  useEscDoTopo(true, NIVEL.preferencias, fechar);
  /* o Tab fica dentro da camada (e da caixa de cadastro, quando ela abre) */
  useEffect(() => instalarFocoDosModais(), []);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "ok" | "alerta" } | null>(null);

  /* As preferências da conta gravam na hora.
     `locais` guarda o que foi escolhido aqui; cada gravação manda o objeto
     inteiro (o gravado mais o daqui), uma de cada vez. Se o servidor recusar,
     a escolha volta ao que ele tem e o aviso diz. */
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const [locais, setLocais] = useState<Record<string, boolean | string>>({});
  const locaisRef = useRef(locais);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  /* antes de as preferências gravadas chegarem, gravar mandaria só as daqui e
     apagaria as das outras telas (a ordem das colunas de Pedidos, por exemplo) */
  const prefsProntas = !!dados.prefs || !dados.aoSalvarPrefs;
  const prefs: Record<string, boolean | string> = { ...(dados.prefs ?? {}), ...locais };
  const gravar = (mudanca: Record<string, boolean | string>) => {
    if (!prefsProntas) return;
    locaisRef.current = { ...locaisRef.current, ...mudanca };
    setLocais(locaisRef.current);
    const salvar = dadosRef.current.aoSalvarPrefs;
    if (!salvar) return;
    fila.current = fila.current
      .then(() => salvar({ ...(dadosRef.current.prefs ?? {}), ...locaisRef.current }))
      .catch((e: unknown) => {
        /* volta só o que ainda é desta escolha (um clique depois dela fica) */
        const resto = { ...locaisRef.current };
        for (const k of Object.keys(mudanca)) if (resto[k] === mudanca[k]) delete resto[k];
        locaisRef.current = resto;
        setLocais(resto);
        setAviso({ texto: erroLegivel(e, "Não deu para guardar a escolha."), tipo: "alerta" });
      });
  };

  /* a tela inicial: as páginas do menu do 1.0 que a pessoa abre (a Home sempre) */
  const telas = MENU
    .filter(([, p]) => p === "Home" || !dados.paginasDisponiveis || dados.paginasDisponiveis.includes(p))
    .map(([rotulo, p]) => ({ valor: p, nome: rotulo === "CALC'S" ? "Calculadoras" : rotulo.charAt(0) + rotulo.slice(1).toLowerCase() }));
  const telaInicial = String(prefs.telaInicial || "Home");
  const telaFora = !telas.some((t) => t.valor === telaInicial);
  /* o nome que o menu dá (Aprovações, Relatórios), e não o interno */
  const nomeDaTela = MENU.find(([, p]) => p === telaInicial)?.[0];
  const telaForaNome = nomeDaTela ? (nomeDaTela === "CALC'S" ? "Calculadoras" : nomeDaTela.charAt(0) + nomeDaTela.slice(1).toLowerCase()) : telaInicial;
  const metade = Math.ceil(telas.length / 2);
  const auto = prefs.auto === true;

  /* o bip e o aviso do Windows: preferências da máquina */
  const [som, setSom] = useState(true);
  useEffect(() => { setSom(somLigado()); }, []);
  const [permNativa, setPermNativa] = useState<NotificationPermission | "indisponivel">("indisponivel");
  useEffect(() => { if (notificacaoNativaDisponivel()) setPermNativa(Notification.permission); }, []);

  /* a Home: a ilustração ou o papel de parede (uma escolha só) */
  const podePapel = !!dados.podeTrocarPapel && !!dados.aoListarPapeis && !!dados.aoTrocarPapel;
  const [papeis, setPapeis] = useState<PapelParede[] | null>(null);
  const [papelAtual, setPapelAtual] = useState(dados.papelNome || "");
  useEffect(() => { setPapelAtual(dados.papelNome || ""); }, [dados.papelNome]);
  const [trocando, setTrocando] = useState("");
  const [enviandoPapel, setEnviandoPapel] = useState(false);
  const arquivoPapelRef = useRef<HTMLInputElement | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const fecharLista = useCallback(() => setListaAberta(false), []);
  useEscDoTopo(listaAberta, NIVEL.preferencias + 1, fecharLista);
  /* o foco entra no acervo quando ele abre (no escolhido, ou no primeiro) */
  const listaRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!listaAberta) return;
    const id = requestAnimationFrame(() => {
      const el = listaRef.current;
      (el?.querySelector<HTMLButtonElement>("button[aria-pressed=true]") ?? el?.querySelector<HTMLButtonElement>("button"))?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [listaAberta, papeis]);
  useEffect(() => {
    if (!podePapel) return;
    let vivo = true;
    dados.aoListarPapeis!()
      .then((l) => { if (vivo) setPapeis(l); })
      .catch((e: unknown) => { if (vivo) { setPapeis([]); setAviso({ texto: erroLegivel(e, "Não deu para ler o acervo de papéis de parede."), tipo: "alerta" }); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podePapel]);
  const trocarPapel = (nomeArquivo: string) => {
    if (!dados.aoTrocarPapel || trocando) return;
    setTrocando(nomeArquivo || "(nenhum)");
    Promise.resolve(dados.aoTrocarPapel(nomeArquivo))
      .then(() => { setPapelAtual(nomeArquivo); if (nomeArquivo) setListaAberta(false); })
      .catch((e: unknown) => setAviso({ texto: erroLegivel(e, "Não deu para aplicar o papel de parede."), tipo: "alerta" }))
      .finally(() => setTrocando(""));
  };
  /** lê o arquivo escolhido, sobe para o acervo e já aplica para quem enviou */
  async function enviarPapel(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo || !dados.aoEnviarPapel) return;
    setEnviandoPapel(true);
    try {
      const base64 = await new Promise<string>((ok, erro) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1] ?? "");
        r.onerror = () => erro(new Error("Não deu para ler o arquivo."));
        r.readAsDataURL(arquivo);
      });
      const novo = await dados.aoEnviarPapel(arquivo.name, base64);
      setPapeis((l) => [...(l ?? []).filter((p) => p.nome !== novo.nome), novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      trocarPapel(novo.nome);
    } catch (e: unknown) {
      setAviso({ texto: erroLegivel(e, "Não deu para enviar o arquivo."), tipo: "alerta" });
    } finally {
      setEnviandoPapel(false);
    }
  }
  const ilust = ilustDaHome(prefs, dados.meuPapel);
  const naHome: IlustHome | "papel" = papelAtual ? "papel" : ilust;
  /* escolher a ilustração tira o papel de parede: os dois ocupam o mesmo lugar na Home */
  const escolherIlust = (v: IlustHome) => {
    if (papelAtual) trocarPapel("");
    gravar({ homeIlustracao: v });
  };
  const [semMovimento] = useState(movimentoReduzido);

  /* cadastrar colega do próprio setor (usuarios.criar_departamento) */
  const cargo = dados.meuCargoLabel || "seu departamento";
  const [colegaAberto, setColegaAberto] = useState(false);
  const botaoColegaRef = useRef<HTMLButtonElement | null>(null);
  /* ao fechar, o foco volta para quem abriu */
  const fecharColega = useCallback(() => { setColegaAberto(false); requestAnimationFrame(() => botaoColegaRef.current?.focus()); }, []);
  useEscDoTopo(colegaAberto, NIVEL.preferencias + 3, fecharColega);
  const [colegaNome, setColegaNome] = useState("");
  const [colegaLogin, setColegaLogin] = useState("");
  const [colegaSenha, setColegaSenha] = useState("");
  const [colegaAviso, setColegaAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const [colegaOcupado, setColegaOcupado] = useState(false);
  const loginValido = /^[a-z0-9._-]{3,40}$/.test(colegaLogin.trim());
  const colegaValido = colegaNome.trim().length >= 2 && loginValido && colegaSenha.length >= 6;
  const faltaColega = colegaNome.trim().length < 2 ? "Falta o nome completo."
    : !loginValido ? "O login vai de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, sem espaço."
      : colegaSenha.length < 6 ? "A senha provisória precisa de 6 ou mais caracteres." : "";
  const criarColega = () => {
    if (!colegaValido || colegaOcupado || !dados.aoCriarColega) return;
    setColegaOcupado(true);
    setColegaAviso(null);
    const n = colegaNome.trim(), l = colegaLogin.trim(), s = colegaSenha;
    dados.aoCriarColega({ nome: n, username: l, senha: s })
      /* o aviso leva o login e a senha: os campos se limpam para o próximo cadastro */
      .then(() => { setColegaAviso({ texto: `Conta de ${n.split(" ")[0]} criada. Login ${l}, senha provisória ${s}: repasse para a pessoa.`, ok: true }); setColegaNome(""); setColegaLogin(""); setColegaSenha(""); })
      .catch((e: unknown) => setColegaAviso({ texto: erroLegivel(e, "Não deu para criar a conta."), ok: false }))
      .finally(() => setColegaOcupado(false));
  };
  const textoColega = `Cadastre alguém do seu setor: a conta nasce com o acesso de ${cargo}. Quem você cadastrar não vai poder cadastrar outras pessoas.`;

  /* trocar a própria senha (Augusto, 02/10/2026: "coloco Trocar senha"; o
     login já mandava trocar "em Preferências" e não havia onde) */
  const [senhaAberta, setSenhaAberta] = useState(false);
  const botaoSenhaRef = useRef<HTMLButtonElement | null>(null);
  const fecharSenha = useCallback(() => { setSenhaAberta(false); requestAnimationFrame(() => botaoSenhaRef.current?.focus()); }, []);
  useEscDoTopo(senhaAberta, NIVEL.preferencias + 3, fecharSenha);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaRepete, setSenhaRepete] = useState("");
  const [senhaAviso, setSenhaAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  const [senhaOcupada, setSenhaOcupada] = useState(false);
  const faltaSenha = !senhaAtual ? "Escreva a senha que você usa hoje."
    : senhaNova.length < 6 ? "A senha nova precisa de 6 ou mais caracteres."
      : senhaRepete !== senhaNova ? "A repetição não bate com a senha nova." : "";
  const trocarSenha = () => {
    if (faltaSenha || senhaOcupada) return;
    setSenhaOcupada(true);
    setSenhaAviso(null);
    changeMyPassword({ data: { senhaAtual, novaSenha: senhaNova } })
      .then(() => { setSenhaAviso({ texto: "Senha trocada. Use a nova no próximo acesso.", ok: true }); setSenhaAtual(""); setSenhaNova(""); setSenhaRepete(""); })
      .catch((e: unknown) => setSenhaAviso({ texto: erroLegivel(e, "Não deu para trocar a senha."), ok: false }))
      .finally(() => setSenhaOcupada(false));
  };
  /* o fim do título do pé: a pílula vem 44 depois dele, nunca antes da c6 */
  const tituloPeRef = useRef<HTMLDivElement | null>(null);
  const [fimTituloPe, setFimTituloPe] = useState(80 + 600);
  /* a largura do "Trocar senha": a pílula da apresentação vem 29 depois (o vão
     das pílulas do pé de Pedidos) */
  const [largSenha, setLargSenha] = useState(143.29);
  useEffect(() => {
    const el = tituloPeRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => {
      if (!vivo || !el.isConnected) return;
      setFimTituloPe(el.offsetLeft + el.offsetWidth);
      if (botaoSenhaRef.current) setLargSenha(botaoSenhaRef.current.offsetWidth);
    });
    return () => { vivo = false; };
  }, []);
  const xPilulaSenha = Math.max(480 - PILULA_BORDA / 2, Math.ceil(fimTituloPe + 44));
  /* rever a apresentação do hub (o tour interativo do primeiro acesso) */
  const apresentacao = useApresentacao();

  const textoBip = "Pedido novo ou que mudou de etapa dá um bip. A aba pisca mesmo sem som.";
  const linhaAuto = telaFora ? Math.max(38, 20 + 3 * metade + 3) : 38;

  return (
    <>
      <div role="dialog" aria-label="Preferências" data-modal-esc=""
        style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.preferencias, background: FUNDO_PAGINA, color: PRETO, fontFamily: INTER }}>
        <div aria-hidden style={{ ...PAINEL, left: 80, width: 1240 }} />
        <div aria-hidden style={{ ...PAINEL, left: 1360, width: 480 }} />
        {/* o traço entre as duas colunas, o da etapa de medidas (na c9) */}
        <div aria-hidden style={{ position: "absolute", left: 720 - PILULA_BORDA / 2, top: 184.75, width: PILULA_BORDA, height: 600, background: DICA, zIndex: 2 }} />

        {/* c2: a tela inicial e o último pedido (valem para a conta) */}
        <div style={{ ...frEm("Tela inicial", 40, COL_A, 14 * LG), zIndex: 2 }}>Tela inicial</div>
        <Explica x={COL_A} linha={16} largura={480} texto="A página que abre quando você entra no hub." />
        {telas.map((t, i) => (
          <Escolha key={t.valor} x={i < metade ? COL_A : COL_A2} linha={20 + 3 * (i % metade)} texto={t.nome} on={telaInicial === t.valor}
            aoEscolher={() => gravar({ telaInicial: t.valor })} desligada={!prefsProntas} />
        ))}
        {telaFora && <Explica x={COL_A} linha={20 + 3 * metade} largura={480} cor={CINZA_FORTE} texto={`Hoje abre em ${telaForaNome}, que não está mais no seu menu.`} />}

        <LigaDesliga x={COL_A} base={linhaAuto * LG} texto="Abrir o último pedido" ligada={auto} aoClicar={() => gravar({ auto: !auto })} desligada={!prefsProntas} />
        <Explica x={tintaDoLiga(COL_A, "Abrir o último pedido")} linha={linhaAuto + 2} largura={440} texto="Ao entrar, reabre em Pedidos o último pedido que você abriu neste computador." />

        {/* c10: os avisos (valem para este computador) e o cadastro de colega */}
        <div style={{ ...frEm("Avisos", 40, COL_B, 14 * LG), zIndex: 2 }}>Avisos</div>
        <Explica x={COL_B} linha={16} largura={480} texto="Valem para este computador." />
        <LigaDesliga x={COL_B} base={20 * LG} texto="Bip de aviso" ligada={som}
          aoClicar={() => { const novo = !som; setSom(novo); definirSom(novo); if (novo) tocarBip(); }} />
        <Explica x={tintaDoLiga(COL_B, "Bip de aviso")} linha={22} largura={440} texto={textoBip} />
        {permNativa === "indisponivel" ? (
          <div style={{ ...interEm("A", 18, COL_B, 27 * LG, 24), width: 480, letterSpacing: "-.02em", color: CINZA, zIndex: 2 }}>
            Aviso na bandeja do Windows: abra o hub por <b style={{ fontWeight: 600, color: CINZA_FORTE }}>https://192.168.0.145</b>, com o certificado instalado, para ativar.
          </div>
        ) : permNativa === "granted" ? (
          <Explica x={COL_B} linha={27} largura={480} peso={600} cor={CINZA_FORTE} texto="Avisos na bandeja do Windows ativados neste navegador." />
        ) : permNativa === "denied" ? (
          /* bloqueado, o navegador não pergunta de novo: só a explicação, sem botão que não faz nada */
          <Explica x={COL_B} linha={27} largura={480} texto="Aviso na bandeja do Windows: o navegador bloqueou. Libere as notificações deste site no cadeado da barra de endereço." />
        ) : (
          <>
            <button type="button" onClick={() => { void pedirPermissaoNativa().then(setPermNativa); }} className="np4-opcao"
              style={{ ...LIMPO, ...frEm("Ativar avisos do Windows", 32, COL_B, 27 * LG), zIndex: 2 }}>Ativar avisos do Windows</button>
            <Explica x={COL_B} linha={29} largura={480} texto="Mostra o aviso na bandeja do Windows mesmo com o navegador minimizado." />
          </>
        )}

        {!!dados.aoCriarColega && (
          <>
            <div style={{ ...frEm("Equipe", 40, COL_B, 37 * LG), zIndex: 2 }}>Equipe</div>
            <Explica x={COL_B} linha={39} largura={480} texto={textoColega} />
            <button ref={botaoColegaRef} type="button" onClick={() => { setColegaAviso(null); setColegaAberto(true); }} aria-haspopup="dialog" className="np4-opcao"
              style={{ ...LIMPO, ...frEm("Cadastrar colega", 32, COL_B, 44 * LG), zIndex: 2 }}>Cadastrar colega</button>
          </>
        )}

        {/* painel da direita: a sua Home */}
        <div style={{ ...frEm("Sua Home", 40, DIR, 14 * LG), zIndex: 2 }}>Sua Home</div>
        <Explica x={DIR} linha={16} largura={LARG_DIR} texto="O que aparece em destaque na Home. Vale só para você." />
        <Escolha x={DIR} linha={20} texto="Ilustração de vendas" on={naHome === "Vendas"} aoEscolher={() => escolherIlust("Vendas")} desligada={!!trocando || !prefsProntas} />
        <Escolha x={DIR} linha={23} texto="Ilustração de design" on={naHome === "Design"} aoEscolher={() => escolherIlust("Design")} desligada={!!trocando || !prefsProntas} />
        {podePapel && (
          <>
            <Escolha x={DIR} linha={26} texto="Papel de parede" on={naHome === "papel"} aoEscolher={() => setListaAberta(true)} desligada={!!trocando} />
            <button type="button" onClick={() => setListaAberta(true)} aria-haspopup="dialog" aria-expanded={listaAberta} title="Escolher o papel de parede no acervo" className="np4-opcao"
              style={{ ...LIMPO, ...interEm(papelAtual || "E", 18, DIR, 28 * LG, 24), maxWidth: LARG_DIR, letterSpacing: "-.02em",
                color: CINZA_FORTE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textUnderlineOffset: 4, paddingBottom: 3, zIndex: 2 }}>
              {papelAtual || (papeis === null ? "Lendo o acervo…" : "Escolher no acervo")}
            </button>
          </>
        )}
        {/* o que a Home mostra, em miniatura */}
        <div aria-hidden style={{ position: "absolute", left: DIR, top: 30 * LG, width: LARG_DIR, height: 18 * LG, boxSizing: "border-box", borderRadius: 12, background: FUNDO_PAGINA,
          overflow: "hidden", display: "grid", placeItems: "center", zIndex: 2 }}>
          {naHome === "papel" ? (
            dados.papelParede ? (
              dados.papelTipo === "video"
                /* com o movimento reduzido ligado, o vídeo fica parado no 1º quadro */
                ? <video key={dados.papelParede} src={dados.papelParede} muted loop autoPlay={!semMovimento} playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <img src={dados.papelParede} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : <span style={{ fontSize: 16, color: CINZA_FORTE }}>{papelAtual}</span>
          ) : (
            <img src={DESENHO_DA_HOME[naHome].src} alt="" style={recorteDoDesenho(naHome)} />
          )}
        </div>

        {/* o pé */}
        <div ref={tituloPeRef} style={tituloDoPeV4("Preferências")}>Preferências</div>
        <button ref={botaoSenhaRef} type="button" onClick={() => { setSenhaAviso(null); setSenhaAberta(true); }} aria-haspopup="dialog" className="np4-pilula"
          style={{ ...PILULA, left: xPilulaSenha, minWidth: 143.29 }}>Trocar senha</button>
        {apresentacao && (
          <button type="button" onClick={() => { fechar(); apresentacao.verDeNovo(); }} className="np4-pilula"
            style={{ ...PILULA, left: xPilulaSenha + largSenha + 29, minWidth: 143.29 }}>Ver a apresentação</button>
        )}
        <button type="button" onClick={fechar} className="np4-pilula"
          style={{ ...PILULA, right: 1920 - (1840 + PILULA_BORDA / 2), minWidth: 143.29 }}>Fechar</button>

        {/* o acervo de papéis de parede: um menu por cima do painel da esquerda, da c5 à c16 */}
        {listaAberta && (
          <>
            <div aria-hidden onClick={fecharLista} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 8 }} />
            <div ref={listaRef} role="dialog" aria-label="Escolher papel de parede"
              style={{ position: "absolute", left: 400, top: TOPO, width: 880, maxHeight: PE_PAINEL - TOPO, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18,
                padding: "26px 30px 24px", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 20, boxShadow: "0 18px 44px rgba(0,0,0,.22)", zIndex: 9 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <span style={{ ...FR, fontSize: 32, lineHeight: "32px", letterSpacing: "-.02em" }}>Papel de parede</span>
                <span style={{ flex: 1, fontSize: 14, color: CINZA, textAlign: "right" }}>
                  <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: PRETO, marginRight: 6, verticalAlign: 1 }} />vídeo
                  <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, border: `1.5px solid ${CINZA_FORTE}`, boxSizing: "border-box", margin: "0 6px 0 16px", verticalAlign: 1 }} />imagem
                </span>
                <button type="button" onClick={fecharLista} aria-label="Fechar a lista" className="p10-flat"
                  style={{ flex: "none", width: 33, height: 33, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, overflowY: "auto" }}>
                {(papeis ?? []).map((p) => {
                  const on = papelAtual === p.nome;
                  const mb = p.tamanhoMB.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                  return (
                    <button key={p.nome} type="button" onClick={() => trocarPapel(p.nome)} disabled={!!trocando} aria-pressed={on} title={`${p.nome} (${p.tipo === "video" ? "vídeo" : "imagem"}, ${mb} MB)`}
                      className={on ? undefined : "p10-flat"}
                      style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, height: 42, padding: "0 14px", border: "none", borderRadius: 10, background: on ? AMARELO : FUNDO_PAGINA,
                        cursor: trocando ? "wait" : "pointer", fontFamily: INTER, fontSize: 16, fontWeight: on ? 700 : 500, color: PRETO, textAlign: "left" }}>
                      <span aria-hidden style={{ flex: "none", width: 8, height: 8, boxSizing: "border-box", borderRadius: 999, background: p.tipo === "video" ? PRETO : "transparent", border: p.tipo === "video" ? "none" : `1.5px solid ${CINZA_FORTE}` }} />
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trocando === p.nome ? "Aplicando…" : p.nome}</span>
                    </button>
                  );
                })}
                {papeis === null && <span style={{ gridColumn: "1 / -1", fontSize: 16, color: CINZA, padding: "10px 4px" }}>Lendo o acervo…</span>}
                {papeis?.length === 0 && <span style={{ gridColumn: "1 / -1", fontSize: 16, color: CINZA, padding: "10px 4px" }}>Nenhuma mídia no acervo ainda. Use “Adicionar papel de parede” aqui embaixo.</span>}
              </div>
              {!!dados.aoEnviarPapel && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,.12)" }}>
                  <input ref={arquivoPapelRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" style={{ display: "none" }}
                    onChange={(e) => { void enviarPapel(e.target.files); e.target.value = ""; }} />
                  <button type="button" onClick={() => arquivoPapelRef.current?.click()} disabled={enviandoPapel} className="np4-pilula"
                    style={{ flex: "none", height: 40, boxSizing: "border-box", padding: "0 18px", border: `1.5px dashed ${PRETO}`, borderRadius: 999, display: "flex", alignItems: "center", gap: 8,
                      fontFamily: INTER, fontSize: 16, fontWeight: 500, color: PRETO, cursor: enviandoPapel ? "wait" : "pointer" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" aria-hidden><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                    {enviandoPapel ? "Enviando…" : "Adicionar papel de parede"}
                  </button>
                  <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4, color: CINZA }}>Imagem (JPG, PNG, WebP ou GIF, até 25 MB) ou vídeo (MP4, WebM ou MOV, até 150 MB). Vai para o acervo e todos podem usar.</span>
                </div>
              )}
            </div>
          </>
        )}

        {aviso && <AvisoV1a texto={aviso.texto} tipo={aviso.tipo} onFechar={() => setAviso(null)} />}
      </div>

      {/* cadastrar colega: caixa por cima de tudo, a barra inclusive */}
      {colegaAberto && (
        <div onClick={fecharColega} data-modal-esc=""
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.preferencias + 3, background: "rgba(37,36,37,.78)" }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); criarColega(); }} role="dialog" aria-modal="true" aria-label="Cadastrar colega"
            style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 720, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20, margin: 0,
              background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", padding: "28px 42px 34px", fontFamily: INTER, color: PRETO }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: 1.2, letterSpacing: ".16em", textTransform: "uppercase", color: CINZA_FORTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {nome ? `${nome} · ${cargo}` : cargo}
                </div>
                <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10 }}>Cadastrar colega</div>
              </div>
              <button type="button" onClick={fecharColega} aria-label="Fechar" className="p10-flat"
                style={{ flex: "none", width: 46, height: 46, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "transparent", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: CINZA_FORTE }}>
              A conta nasce com o acesso de {cargo}, e a senha é provisória: a pessoa cria a dela no primeiro acesso. Quem você cadastrar <b style={{ color: PRETO }}>não vai poder cadastrar outras pessoas</b>. Isso só o gestor faz.
            </p>
            <label>
              <span style={ROTULO_CAMPO}>Nome completo</span>
              <input autoFocus value={colegaNome} onChange={(e) => setColegaNome(e.target.value)} placeholder="Ex.: Ana Paula Souza" style={CAMPO} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                <span style={ROTULO_CAMPO}>Login</span>
                <input value={colegaLogin} onChange={(e) => setColegaLogin(e.target.value.toLowerCase())} placeholder="ana.paula" autoCapitalize="none" autoCorrect="off" style={CAMPO} />
              </label>
              <label>
                <span style={ROTULO_CAMPO}>Senha provisória</span>
                <input value={colegaSenha} onChange={(e) => setColegaSenha(e.target.value)} placeholder="6 ou mais caracteres" autoComplete="off" style={CAMPO} />
              </label>
            </div>
            <p role="status" style={{ margin: 0, minHeight: 24, fontSize: 16, lineHeight: 1.4, fontWeight: colegaAviso ? 600 : 400, color: colegaAviso ? (colegaAviso.ok ? PRETO : VERMELHO) : CINZA }}>
              {colegaAviso ? `${colegaAviso.ok ? "✓ " : ""}${colegaAviso.texto}` : faltaColega}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" onClick={fecharColega} className="p10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <button type="submit" disabled={!colegaValido || colegaOcupado} className="p10-flat"
                style={{ height: 50, padding: "0 28px", border: "none", borderRadius: 999, background: colegaValido ? PRETO : "#cfcccd", color: "#fff", fontFamily: INTER, fontSize: 18, fontWeight: 600,
                  cursor: colegaValido && !colegaOcupado ? "pointer" : "not-allowed" }}>{colegaOcupado ? "Criando…" : "Criar conta"}</button>
            </div>
          </form>
        </div>
      )}

      {/* trocar a própria senha: caixa por cima de tudo, a barra inclusive */}
      {senhaAberta && (
        <div onClick={fecharSenha} data-modal-esc=""
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.preferencias + 3, background: "rgba(37,36,37,.78)" }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); trocarSenha(); }} role="dialog" aria-modal="true" aria-label="Trocar senha"
            style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 720, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20, margin: 0,
              background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", padding: "28px 42px 34px", fontFamily: INTER, color: PRETO }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: 1.2, letterSpacing: ".16em", textTransform: "uppercase", color: CINZA_FORTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {nome || "Sua conta"}
                </div>
                <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10 }}>Trocar senha</div>
              </div>
              <button type="button" onClick={fecharSenha} aria-label="Fechar" className="p10-flat"
                style={{ flex: "none", width: 46, height: 46, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "transparent", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: CINZA_FORTE }}>
              A senha de entrar no hub. A nova vale a partir do próximo acesso; ninguém consegue vê-la depois, nem o gestor.
            </p>
            <label>
              <span style={ROTULO_CAMPO}>Senha atual</span>
              <input autoFocus type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} autoComplete="current-password" style={CAMPO} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                <span style={ROTULO_CAMPO}>Senha nova</span>
                <input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} placeholder="6 ou mais caracteres" autoComplete="new-password" style={CAMPO} />
              </label>
              <label>
                <span style={ROTULO_CAMPO}>Repita a nova</span>
                <input type="password" value={senhaRepete} onChange={(e) => setSenhaRepete(e.target.value)} autoComplete="new-password" style={CAMPO} />
              </label>
            </div>
            <p role="status" style={{ margin: 0, minHeight: 24, fontSize: 16, lineHeight: 1.4, fontWeight: senhaAviso ? 600 : 400, color: senhaAviso ? (senhaAviso.ok ? PRETO : VERMELHO) : CINZA }}>
              {senhaAviso ? `${senhaAviso.ok ? "✓ " : ""}${senhaAviso.texto}` : faltaSenha}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" onClick={fecharSenha} className="p10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>
                {senhaAviso?.ok ? "Fechar" : "Voltar"}
              </button>
              <button type="submit" disabled={!!faltaSenha || senhaOcupada} className="p10-flat"
                style={{ height: 50, padding: "0 28px", border: "none", borderRadius: 999, background: !faltaSenha ? PRETO : "#cfcccd", color: "#fff", fontFamily: INTER, fontSize: 18, fontWeight: 600,
                  cursor: !faltaSenha && !senhaOcupada ? "pointer" : "not-allowed" }}>{senhaOcupada ? "Trocando…" : "Trocar senha"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
