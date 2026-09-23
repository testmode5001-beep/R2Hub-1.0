// Menu "de capa" — as abas do Hub num grid de 4 colunas que preenche a partir
// da ÚLTIMA linha (a base): quem tem só 2 acessos vê os dois na linha de baixo.
// Compartilhado entre a Home e a Central (novo design da interface).
import { CALC_TAB_MAP, hasPerm, type SessionUser } from "@/lib/session";

const AMARELO = "#ffe91d";
const PRETO = "#1d1d1b";

/** Corpo de texto do menu — o mesmo clamp aprovado na capa. */
export const TAM_MENU = "clamp(10px, min(1.35vw, 2.5vh), 26px)";

export type StatKey = "pedidosNovos" | "clichesAbertos" | "facasAbertas";
export type MenuItem = { label: string; to: string; mostrar: boolean; badge?: StatKey };

/** Itens do menu — exatamente as abas do Hub, na ordem da barra de abas;
    cada um só aparece se o usuário tiver a permissão. */
export function itensDoUsuario(user: SessionUser): MenuItem[] {
  const temCalc = Object.keys(CALC_TAB_MAP).some((p) => hasPerm(user, p));
  return [
    { label: "CENTRAL", to: "/app", mostrar: true, badge: "pedidosNovos" },
    { label: "+ NOVA", to: "/app?tab=novo", mostrar: hasPerm(user, "pedidos.criar") },
    { label: "APROVAÇÃO", to: "/app?tab=cliches", mostrar: hasPerm(user, "tab.cliches"), badge: "clichesAbertos" },
    { label: "SOLICITAR CLICHÊ", to: "/app?tab=solcliche", mostrar: hasPerm(user, "tab.solicitar_cliche") },
    { label: "AFIAÇÃO", to: "/app?tab=facas", mostrar: hasPerm(user, "tab.afiacao"), badge: "facasAbertas" },
    { label: "CALCULADORAS", to: "/app?tab=calculadoras", mostrar: temCalc },
    { label: "APONTAMENTOS", to: "/app?tab=apontamentos", mostrar: hasPerm(user, "apontamentos.ver") },
    { label: "USUÁRIOS", to: "/usuarios", mostrar: hasPerm(user, "usuarios.gerenciar") },
  ].filter((i) => i.mostrar);
}

const MENU_COLUNAS = 4;

/* Preenche o grid a partir da ÚLTIMA linha: os 4 primeiros itens formam a
   linha de baixo, os próximos entram na de cima, e assim por diante. */
function linhasDoMenu(itens: MenuItem[]): MenuItem[][] {
  const linhas: MenuItem[][] = [];
  for (let i = 0; i < itens.length; i += MENU_COLUNAS) linhas.push(itens.slice(i, i + MENU_COLUNAS));
  return linhas.reverse(); // primeira linha renderizada = a de cima
}

/** Contador em bolha amarela (Fraunces super soft black), no canto superior
    direito da palavra — só aparece quando > 0. */
function Bolha({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute inline-flex items-center justify-center rounded-full"
      style={{
        left: "100%",
        top: 0,
        transform: "translate(-34%, -42%)",
        width: "1.62em",
        height: "1.62em",
        background: AMARELO,
        color: PRETO,
        fontFamily: "'Fraunces', Georgia, serif",
        fontWeight: 900,
        fontVariationSettings: "'SOFT' 100, 'opsz' 144, 'wght' 900",
        fontSize: "0.62em",
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {/* dígito em algarismos lining+tabular (senão a Fraunces usa oldstyle e
          cada número senta numa altura) e com nudge para o centro óptico */}
      <span
        style={{
          display: "block",
          transform: "translateY(-0.0125em)",
          fontVariantNumeric: "lining-nums tabular-nums",
          fontFeatureSettings: '"lnum" 1, "tnum" 1',
        }}
      >
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}

/** Classe do link do menu — hover amarelo + negrito + slide + brilho. */
const ANCHOR_CLS = "relative cursor-pointer transition-[color,transform] duration-150 hover:text-[#ffe91d] hover:font-black hover:translate-x-[6px] hover:[text-shadow:0_1px_9px_rgba(0,0,0,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe91d]";

/** Palavra do menu com "fantasma" peso 900 (reserva a largura do hover, para o
    negrito não desalinhar) + a bolha de contador. */
function ItemMenu({ item, stats }: { item: MenuItem; stats?: Partial<Record<StatKey, number>> }) {
  return (
    <span className="relative inline-grid">
      <span aria-hidden className="invisible" style={{ gridArea: "1 / 1", fontWeight: 900 }}>{item.label}</span>
      <span style={{ gridArea: "1 / 1" }}>{item.label}</span>
      <Bolha count={item.badge ? (stats?.[item.badge] ?? 0) : 0} />
    </span>
  );
}

export function MenuCapa({ user, stats, aoAbrir, peso = 800, tracking = "0.01em", cor = PRETO, vertical = false }: {
  user: SessionUser;
  stats?: Partial<Record<StatKey, number>>;
  aoAbrir: (to: string) => void;
  peso?: number;
  tracking?: string;
  cor?: string;
  /** Lista vertical (lateral) em vez da grade de 4 colunas na base. */
  vertical?: boolean;
}) {
  const itens = itensDoUsuario(user);

  // Modo vertical (lateral direita) — itens na ordem natural, um por linha.
  if (vertical) {
    return (
      <nav
        className="flex flex-col"
        style={{
          rowGap: "0.72em",
          fontFamily: "'Inter', sans-serif",
          fontWeight: peso,
          fontSize: TAM_MENU,
          letterSpacing: tracking,
          color: cor,
        }}
      >
        {itens.map((item) => (
          <a
            key={item.label}
            href={item.to}
            onClick={(e) => { e.preventDefault(); aoAbrir(item.to); }}
            className={ANCHOR_CLS}
            style={{ lineHeight: 1, width: "max-content" }}
          >
            <ItemMenu item={item} stats={stats} />
          </a>
        ))}
      </nav>
    );
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${MENU_COLUNAS}, max-content)`,
        columnGap: "3.2vw",
        rowGap: "0.95em",
        alignItems: "end",
        fontFamily: "'Inter', sans-serif",
        fontWeight: peso,
        fontSize: TAM_MENU,
        letterSpacing: tracking,
        color: cor,
      }}
    >
      {linhasDoMenu(itens).flatMap((linha, li) =>
        linha.map((item, ci) => (
          <a
            key={item.label}
            href={item.to}
            onClick={(e) => { e.preventDefault(); aoAbrir(item.to); }}
            className={ANCHOR_CLS}
            /* posição explícita: linha de cima pode ser incompleta e o
               auto-flow a completaria com itens da linha de baixo */
            style={{ lineHeight: 1, gridColumn: ci + 1, gridRow: li + 1 }}
          >
            <ItemMenu item={item} stats={stats} />
          </a>
        )),
      )}
    </div>
  );
}
