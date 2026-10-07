// "Pasta do cliente" — a caixa que o designer vê ao clicar em "Iniciar criação".
//
// A pasta do cliente deixou de nascer com o pedido (Augusto, 25/09/2026): a
// vendedora digitava o nome, ignorava o aviso de "já existe" e o share ganhava
// "Toninho Sorvetes - Renata" ao lado de "Toninho Sorvetes", ou "Bronzemax
// Retangular" e "Bronzemax Redonda" para um Bronzemax só. Quem conhece o share
// é o designer, então é ele quem escolhe: uma pasta que já existe, marcada de
// saída a mais parecida com o que a vendedora escreveu, ou uma nova.
//
// Confirmar liga o pedido à pasta e leva para Referências os anexos que
// esperavam no hub. Não há handoff desta caixa; ela segue o desenho das
// caixas 1.0 (Design criado, Clichê chegou) e a regra 60/30/10: cabeçalho na
// cor do status do pedido, corpo branco, preto só no botão que confirma.
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";

import { FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { listPastasClientes } from "@/lib/api/clientes.functions";
import { nomeDaPastaNova } from "@/lib/caixa-da-pasta";
import { PALETA } from "@/lib/paleta-hub";

const CINZA = "#8a8a8a";
const MAX_SUGESTOES = 8;

/* ————— parecença entre o que foi digitado e o nome da pasta —————
   Sem acento, sem caixa, sem pontuação, e sem os conectivos ("de", "da"…),
   que casam com tudo. A nota pesa mais o quanto da PASTA o texto cobre: para
   "Bronzemax Redonda", a pasta "Bronzemax" é coberta inteira e vem primeiro —
   o "Redonda" é o tipo da faca, não parte do nome do cliente. */
const PARADAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);
const normal = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const palavras = (s: string) => normal(s).split(" ").filter((t) => t.length > 1 && !PARADAS.has(t));
const casa = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

function parecenca(pasta: string, texto: string): number {
  const a = normal(pasta), b = normal(texto);
  if (!b) return 0;
  if (a === b) return 1;
  const pp = palavras(pasta), pt = palavras(texto);
  if (!pp.length || !pt.length) return 0;
  const cobrePasta = pp.filter((x) => pt.some((t) => casa(x, t))).length / pp.length;
  const cobreTexto = pt.filter((t) => pp.some((x) => casa(x, t))).length / pt.length;
  return 0.6 * cobrePasta + 0.4 * cobreTexto;
}
/* abaixo disto a pasta não é marcada de saída — melhor sugerir "nova" que
   empurrar o arquivo para o cliente errado */
const MARCA_SE_ACIMA = 0.5;
/* ...e só se o texto cobre a pasta INTEIRA. "Laticínios Serra Azul" dava
   0,67 com a pasta "Laticínio Serra Verde" e ela vinha marcada: o pedido ia
   para o cliente errado e mudava de nome (simulação de 28/09/2026). Pasta
   parecida sem cobrir continua na lista, para o designer escolher.
   Para marcar, cada palavra da pasta tem de estar no texto como a MESMA
   palavra, ou no plural ("café" e "cafés"): o começo de palavra serve para
   a lista, não para marcar. "Serra" casava com "Serrano", e "Sim5 Café Serra
   da Mantiqueira" vinha com a pasta "Cafés Serrano" marcada (simulação 5,
   05/10/2026). */
const mesmaPalavra = (a: string, b: string) => a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;
const cobreInteira = (pasta: string, texto: string) => {
  const pp = palavras(pasta), pt = palavras(texto);
  return pp.length > 0 && pp.every((x) => pt.some((t) => mesmaPalavra(x, t)));
};

export function PastaClienteHub10({ pedido, anexos, corStatus, acao = "Iniciar criação", fechar, onConfirmar }: {
  pedido: { num: string; cliente: string };
  /** quantos anexos esperam no hub — vão para Referências ao confirmar */
  anexos: number;
  /** cor do status do pedido: é a cor do cabeçalho (os 30% da regra) */
  corStatus: string;
  /** o que o botão faz depois de confirmar — "Iniciar criação", ou
      "Continuar" quando a caixa abre antes de entregar a arte */
  acao?: string;
  fechar: () => void;
  onConfirmar: (d: { pasta?: string; novaPasta?: string }) => Promise<unknown>;
}) {
  useEscDoTopo(true, NIVEL.caixa, fechar);
  const { data } = useQuery<{ pastas: string[]; deTeste?: boolean }>({
    queryKey: ["pastas-clientes"],
    queryFn: () => listPastasClientes() as Promise<{ pastas: string[]; deTeste?: boolean }>,
    staleTime: 60_000,
  });
  const pastas = data?.pastas ?? [];
  const onde = data?.deTeste ? "nas pastas do hub de teste" : "no servidor";

  const [busca, setBusca] = useState(pedido.cliente);
  const [nova, setNova] = useState(pedido.cliente.trim());
  /* null = ainda não escolheu nada: vale a sugestão automática */
  const [escolha, setEscolha] = useState<null | { tipo: "pasta"; nome: string } | { tipo: "nova" }>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const parecidas = useMemo(() => pastas
    .map((nome) => ({ nome, nota: parecenca(nome, busca) }))
    .filter((x) => x.nota > 0.2)
    .sort((x, y) => y.nota - x.nota || x.nome.localeCompare(y.nome, "pt-BR")), [pastas, busca]);
  const sugestoes = parecidas.slice(0, MAX_SUGESTOES);

  /* a escolhida: a da pessoa, ou a mais parecida (se for parecida o bastante) */
  const marcada = sugestoes.find((s) => s.nota >= MARCA_SE_ACIMA && cobreInteira(s.nome, busca));
  const automatica = marcada ? { tipo: "pasta" as const, nome: marcada.nome } : { tipo: "nova" as const };
  const atual = escolha ?? automatica;

  /* nome novo que já é uma pasta (mesmo nome, outra caixa): o servidor usa a
     existente — e a caixa avisa, para ninguém achar que criou outra */
  /* A mesma conta do servidor (acharPastaExata): o nome idêntico, depois sem
     diferença de caixa, e sem acento ("Lupulo" é a pasta "Lúpulo") só quando
     uma pasta só bate. */
  const chave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const novaJaExiste = (() => {
    const b = nova.trim();
    if (!b) return null;
    const exata = pastas.find((p) => p === b);
    if (exata) return exata;
    const semCaixa = pastas.filter((p) => p.toLowerCase() === b.toLowerCase());
    if (semCaixa.length === 1) return semCaixa[0];
    const iguais = pastas.filter((p) => chave(p) === chave(b));
    return iguais.length === 1 ? iguais[0] : null;
  })();

  /* o nome que o pedido vai ganhar: o servidor troca o nome do cliente pelo
     da pasta e avisa a vendedora; a caixa avisa antes (Augusto, 02/10/2026,
     depois que o #232 "Filial Centro" virou o nome da pasta sem ninguém ver) */
  /* pasta nova ganha a caixa padrão do servidor ("Arco-Íris" vira
     "Arco-íris"); a caixa mostra o nome final antes de confirmar, e o aviso
     amarelo aparece quando ele muda (simulação 5, 05/10/2026) */
  const nomeFinal = atual.tipo === "pasta" ? atual.nome : (novaJaExiste ?? (nomeDaPastaNova(nova) || nova.trim()));
  const nomeMuda = nomeFinal.length > 1 && nomeFinal !== pedido.cliente;
  const pronto = !enviando && (atual.tipo === "pasta" || nova.trim().length > 1) && pastas.length > 0;
  const confirmar = async () => {
    if (!pronto) return;
    setEnviando(true);
    setErro("");
    try {
      await onConfirmar(atual.tipo === "pasta" ? { pasta: atual.nome } : { novaPasta: nova.trim() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para confirmar a pasta.");
      setEnviando(false);
    }
  };

  const LINHA: CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", border: "none", borderRadius: 12,
    background: "none", cursor: "pointer", textAlign: "left", fontFamily: INTER, color: PRETO };
  const Bolinha = ({ on }: { on: boolean }) => (
    <span aria-hidden style={{ flex: "none", width: 20, height: 20, boxSizing: "border-box", borderRadius: 999, border: `1.5px solid ${PRETO}`,
      display: "grid", placeItems: "center", background: "#fff" }}>
      {on && <span style={{ width: 10, height: 10, borderRadius: 999, background: PRETO }} />}
    </span>
  );

  return (
    <div onClick={fechar}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, background: "rgba(37,36,37,.78)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pasta do cliente"
        style={{ boxSizing: "border-box", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 760, maxHeight: 820,
          display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22,
          boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "24px 36px 20px",
          background: corStatus, borderBottom: `1.5px solid ${PRETO}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 14px/1.25 ${INTER}`, letterSpacing: ".04em", textTransform: "uppercase", color: "#4a4a4a" }}>
              {pedido.num} · {acao}
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10 }}>Pasta do cliente</div>
          </div>
          <button onClick={fechar} className="p10-flat" aria-label="Fechar"
            style={{ flex: "none", width: 40, height: 40, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "#fff",
              border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        {/* ————— o que a vendedora escreveu, e a busca ————— */}
        <div style={{ flex: "none", padding: "20px 36px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, color: CINZA }}>A vendedora escreveu</span>
            <span style={{ ...FR, fontSize: 24, letterSpacing: "-.02em" }}>{pedido.cliente}</span>
          </div>
          <label style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, height: 48, boxSizing: "border-box", padding: "0 18px",
            border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "text" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            {/* procurar não desfaz "Criar pasta nova": só a pasta escolhida,
                que pode sumir da lista, volta para a sugestão */}
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setEscolha((x) => (x?.tipo === "nova" ? x : null)); }} autoFocus
              placeholder="Procurar pasta no servidor" aria-label="Procurar pasta de cliente no servidor"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: `600 17px/1 ${INTER}`, color: PRETO }} />
          </label>
          {data?.deTeste && (
            <div style={{ marginTop: 8, paddingLeft: 18, fontSize: 14, color: CINZA }}>
              Hub de teste: a busca é nas pastas de teste, não no servidor.
            </div>
          )}
        </div>

        {/* ————— as pastas parecidas ————— */}
        {/* Mesma coluna da busca (36 de cada lado): o fundo da linha marcada
            bate nas bordas do campo de busca, em vez de passar delas. */}
        <div className="p10-trilha" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 36px 8px" }}>
          {/* Lugar para umas quatro pastas mesmo quando ainda não há nenhuma:
              encolhida, a lista parecia caber uma pasta só (Augusto,
              30/09/2026). A contagem diz quantas bateram. */}
          <div style={{ minHeight: 4 * 58 + 31 }}>
            {!data && <div style={{ padding: "14px 14px", fontSize: 16, color: CINZA }}>Lendo as pastas do servidor…</div>}
            {data && sugestoes.length === 0 && (
              <div style={{ padding: "14px 14px", fontSize: 16, color: CINZA }}>
                {busca.trim() ? `Nenhuma pasta parecida com “${busca.trim()}” ${onde}.` : "Escreva o nome do cliente para procurar a pasta."}
              </div>
            )}
            {sugestoes.length > 0 && (
              <div style={{ padding: "6px 14px 4px", fontSize: 14, color: CINZA }}>
                {parecidas.length === 1 ? `1 pasta parecida ${onde}` : `${parecidas.length} pastas parecidas ${onde}`}
                {parecidas.length > MAX_SUGESTOES && `; aqui as ${MAX_SUGESTOES} mais parecidas. Escreva mais do nome para achar outra.`}
              </div>
            )}
            {sugestoes.map((s) => {
              const on = atual.tipo === "pasta" && atual.nome === s.nome;
              return (
                <button key={s.nome} onClick={() => setEscolha({ tipo: "pasta", nome: s.nome })} className="p10-linha" aria-pressed={on}
                  style={{ ...LINHA, background: on ? "#f1f1f1" : "none" }}>
                  <Bolinha on={on} />
                  <span style={{ flex: 1, minWidth: 0, ...FR, fontSize: 24, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ————— ou uma pasta nova —————
            Fora da rolagem da lista: com 7 ou mais pastas parecidas ela ficava
            embaixo, fora da vista, mesmo quando era a opção marcada (simulação
            5, 05/10/2026). */}
        <div style={{ flex: "none", padding: "0 36px" }}>
          <div style={{ margin: "8px 0 0", paddingTop: 10, borderTop: "1px solid rgba(0,0,0,.12)" }}>
            <button onClick={() => setEscolha({ tipo: "nova" })} className="p10-linha" aria-pressed={atual.tipo === "nova"}
              style={{ ...LINHA, background: atual.tipo === "nova" ? "#f1f1f1" : "none" }}>
              <Bolinha on={atual.tipo === "nova"} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>Criar pasta nova</span>
            </button>
            {atual.tipo === "nova" && (
              /* a mesma coluna da busca de cima: começa e termina nas bordas
                 dela (Augusto, 29/09/2026). Recuado até o texto "Criar pasta
                 nova", ficava menor que a busca. */
              <div style={{ padding: "4px 0 10px" }}>
                <input value={nova} onChange={(e) => setNova(e.target.value)} aria-label="Nome da pasta nova" placeholder="Nome da pasta nova"
                  style={{ width: "100%", height: 48, boxSizing: "border-box", padding: "0 18px", border: `1.5px solid ${PRETO}`, borderRadius: 999,
                    outline: "none", ...FR, fontSize: 22, letterSpacing: "-.02em", color: PRETO, background: "#fff" }} />
                {novaJaExiste && (
                  <div style={{ marginTop: 8, fontSize: 15, color: "#5b595b" }}>
                    Já existe a pasta “{novaJaExiste}”. Ela será usada, sem criar outra.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {nomeMuda && (
          <div role="status" style={{ flex: "none", margin: "0 36px 12px", padding: "10px 14px", borderRadius: 12, background: "rgba(255,240,121,.55)", fontSize: 15, lineHeight: 1.4, color: PRETO }}>
            O nome do cliente neste pedido passa a ser <b>“{nomeFinal}”</b>, o da pasta. A vendedora é avisada.
          </div>
        )}

        {/* ————— pé ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 16, padding: "16px 36px 20px", borderTop: "1px solid rgba(0,0,0,.12)" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: erro ? PALETA.perigo : "#5b595b" }}>
            {erro || (anexos > 0
              ? `${anexos} ${anexos === 1 ? "anexo vai" : "anexos vão"} para Referências desta pasta.`
              : "A pasta ganha a subpasta Referências.")}
          </span>
          <button onClick={fechar} className="p10-flat"
            style={{ flex: "none", height: 50, padding: "0 22px", border: `1.5px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO,
              fontFamily: INTER, fontSize: 17, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
          <button onClick={() => void confirmar()} className="p10-flat" disabled={!pronto}
            style={{ flex: "none", height: 50, padding: "0 26px", border: "none", borderRadius: 999, background: pronto ? PRETO : "#bdbdbd", color: "#fff",
              fontFamily: INTER, fontSize: 17, fontWeight: 700, cursor: pronto ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            {enviando ? "Um momento…" : acao}
          </button>
        </div>
      </div>
    </div>
  );
}
