# Design do Hub 1.0: guia de páginas

> Este arquivo fica em `docs/DESIGN-HUB-1.0.md`. Consulte-o antes de montar qualquer página nova do hub 1.0.
> Base: sete leituras do código feitas em 25/09/2026, sem editar nada, e as pranchas do designer (pasta `hubv3`). Alguns pontos foram conferidos de novo na fonte para fechar este guia: `styles.css:250-352`, `CalculadorasHub10.tsx:48-202`, `PedidoHub10.tsx:120-158 e 578-633`, `FerramentaisHub10.tsx:1268-1727`, `PedidoDetalheHub10.tsx:78-107`, `PantonesHub10.tsx:1-60 e 160-244`, `pantone-busca.ts`, a busca por `writingMode` no `src` e a busca por `CINZA =` e `FUNDO_PAINEL` no `hub10`.
> Caminhos: quando não houver outra indicação, são relativos a `DesignHub-v2/src/components/hub10/`. O formato é `arquivo:linha`. Todas as medidas estão em px do palco de 1920×1080.

**Marcadores usados no texto**
- **[Regra]**: o que se faz em página nova.
- **[Divergência]**: leituras do código, código ou prancha discordam. O guia registra o conflito e não escolhe calado. A lista completa está na seção 9.
- **[Suspeita]**: algo que não foi confirmado. Não trate como fato.
- **[Proposta]**: ainda não existe no código e depende de decisão do Augusto.

---

## 1. Conceito

1. **Palco fixo.** Toda página é desenhada num palco lógico de 1920×1080 (`PalcoFixo`, `ChromeHub10.tsx:115-137`).
   - A escala é `min(w/1920, h/1080)`, com o palco centralizado. A tarja em volta dele é `#e4e4e4`.
   - Dentro do palco tudo é `position: absolute`, em px do palco.
   - O comentário em `ChromeHub10.tsx:112-114` diz: "Toda tela cabe sem scroll, que é a regra estrutural do handoff". O palco nunca rola. Só rolam regiões internas: a trilha, na horizontal, e as listas, na vertical.
2. **Três faixas horizontais.**
   - Barra do topo, branca: 0..112.
   - Área de módulo: 112..728. São campos de cor chapados que vão de borda a borda do palco.
   - Faixa preta: 726..1080. Ela leva o nome da página em Fraunces 112 embaixo à esquerda, um resumo de duas linhas no meio (x 960) e uma linha de rodapé com filtros em texto.
3. **O título mora embaixo.** O nome da página fica na faixa preta. Nenhuma página tem tarja no topo com título. Tarja colorida com título em cima é coisa de modal.
4. **Campos de cor full-bleed.**
   - Os cards são retângulos de 480 (6 colunas) que se encostam, sem vão, sem raio e sem sombra em repouso.
   - Um card se separa do vizinho pelo degrau de tom (`clarear`, 12%), não por traço.
   - Traço preto de 1px só aparece como divisa estrutural: base do card, divisa de colunas, base da barra do topo.
5. **Do landing para o dentro.** O landing é a trilha de cards sobre a faixa preta. Clicar num card monta um painel no mesmo palco, sem véu e sem animação, feito de colunas quadradas. A barra do topo continua viva por cima (z 40 contra 38).
6. **Controles de página são texto.**
   - Filtros de rodapé no formato "Rótulo: valor ▾".
   - Recortes sublinhados quando ligados.
   - "Filtros" em negrito quando há filtro ativo.
   - Busca como retângulo plano com "PESQUISA".
   - Pílula só em comando isolado ("Comparar", pílula de status) e no botão redondo de fechar.
7. **A cor é do conteúdo.** Status do pedido, família da faca e tipo de calculadora pintam o módulo inteiro. Em telas novas vale a regra 60/30/10 (seção 4.5), com entorno neutro.
8. **Modal é exceção.** Véu, caixa arredondada, sombra pesada, sobrancelha mono e busca em pílula ficam só nas caixas. A seção 7 lista o que nunca pode aparecer numa página.

---

## 2. Grade

### 2.1 Colunas e linhas

- **Colunas.** São 24 colunas de 80 px, sem gutter. Neste guia, a coluna **cN começa em x = 80·N** (de c0 a c23).
  - A margem da página é uma coluna nos dois lados, então a área útil vai de 80 a 1840.
  - A prancha `GRID_home vendas.svg` desenha só os 24 retângulos de coluna.
- **Linhas.** São 67 linhas de 1080/67 = **16,119 px**.
  - A prancha `inside facas.svg` desenha as duas grades: 24 retângulos azuis de 80×1080 (as colunas) e 67 faixas cinza de 16,1 de altura (as linhas), de y 0,5 a 1063,4.
  - **[Divergência]** Não existe constante de linha no código. O único registro é o comentário "base de 16px" em `FerramentaisHub10.tsx:463`.
  - Os valores em uso não caem em múltiplos exatos: 813 = 50,4 linhas, 849 = 52,7 e 998 = 61,9.
  - **[Regra]** Use os números absolutos da tabela 2.3. Não recalcule posições por linha.

### 2.2 Linhas de coluna em uso

| x | Coluna | O que se alinha ali |
|---|---|---|
| 80 | c1 | wordmark; cabeçalho de painel (`left: 80, top: 58`) |
| 400 | c5 | botão "+" da barra |
| 480 | c6 | início da navegação; 2º card; fim do card fixo do PedidoDetalhe |
| 720 | c9 | divisa do painel "dentro" (`COL_ESQ = 720`, "9 colunas do grid", `FerramentaisHub10.tsx:471`) |
| 800 | c10 | comando "Comparar" (`COL_ESQ + 80`) |
| 960 | c12 | resumo da faixa preta, que é o meio exato do palco |
| 1440 | c18 | busca da barra (240 de largura, termina em 1680 = c21) |
| 1776 | — | dica de rolagem (64 de largura, termina em 1840) |
| 1840 | c23 | margem direita: ícones da barra e fechar (`right: 80`) |

### 2.3 Regiões padrão (coordenadas do código)

| Região | Caixa | Fundo | z | Referência |
|---|---|---|---|---|
| Barra do topo | 0, 0, 1920×112 (≈7 linhas) | `#fff`, `borderBottom 1px PRETO` | 40 | `ChromeHub10.tsx:202` |
| Trilha (módulo) | 0, 112, 1920×616, vai até 728 | cards | 2 | `CalculadorasHub10.tsx:150`, `PedidoHub10.tsx:534-535` |
| Card | `flex: 0 0 25%` = 480 (6 col) × 616 | tom do card | 2 (5 no hover) | `CalculadorasHub10.tsx:154` |
| Faixa preta | 0, 726, 1920×354 | `PRETO` | 1 | `CalculadorasHub10.tsx:143` |
| Título da página | left 72, top 813 | — | 3 | `CalculadorasHub10.tsx:188` |
| Resumo | left 960, top 849, width 888 (termina em 1848) | — | 3 | `CalculadorasHub10.tsx:190` |
| Rodapé da faixa | left 72, top 998, right 72 | — | 30 | `CalculadorasHub10.tsx:195`, `PedidoHub10.tsx:581` |
| Dica de rolagem | left 1776, top 392, 64×64 | — | 30 | `CalculadorasHub10.tsx:183` |
| Estado vazio | 0, 112, 1920×616, centralizado | — | 2 | `CalculadorasHub10.tsx:175` |

A trilha vai até 728 e a faixa começa em 726, de propósito. A trilha (z 2) cobre 2 px da faixa (z 1), e é por isso que os cards terminam em 728 por cima do preto (`PedidoDetalheHub10.tsx:420-424`).

**Âncoras dentro do card** (em relação ao card; some 112 para ter a coordenada do palco):

| Elemento | left / top | Referência |
|---|---|---|
| Marca (rótulo cinza) | 76 / 58 | `CalculadorasHub10.tsx:69`, `FerramentaisHub10.tsx:119`, `PedidoDetalheHub10.tsx:107` |
| Pessoa (Pedidos) | 80 / 58 | `PedidoHub10.tsx:455` |
| Título | 76 / 111 (Pedidos: 113; Novo pedido: 80 / 126) | `FerramentaisHub10.tsx:120`, `PedidoHub10.tsx:511`, `NovoPedidoHub10.tsx:417` |
| Ilustração | caixa absoluta na faixa ≈ 202..476 | `CalculadorasHub10.tsx:28-39`, `FerramentaisHub10.tsx:340` |
| Pílula de status | 76 / 351, altura 50 | `PedidoHub10.tsx:513` |
| Grade de campos | 82 / 413, colunas `206px minmax(0,1fr)` | `PedidoHub10.tsx:519` |
| Linha de baixo / contagem | 76–80 / 502 | `CalculadorasHub10.tsx:166`, `FerramentaisHub10.tsx:346` |
| Controle no canto direito | right 70–80 / top 57–58 | `PedidoHub10.tsx:467`, `NovoPedidoHub10.tsx:416` |

### 2.4 Painel "dentro": três modelos no código

**[Divergência]** Três modelos convivem no código. Para a página de Pantones, o modelo tem de ser escolhido explicitamente.

| Modelo | Caixa | Faixa preta | z | Colunas | Referência |
|---|---|---|---|---|---|
| **A. Ferramentais** (`PainelFamilia`) | 0, 112, 1920×968 (`ALTURA`) | fica coberta | 38 (`NIVEL.painel`) | 0..720 em `FUNDO`; 720..1920 em `#fff` com `borderLeft 1px`, `top: 1`, altura 967 | `FerramentaisHub10.tsx:471-472, 1272, 1584-1587` |
| **B. Pedidos** (`PedidoDetalheHub10`) | 0, 112, 1920×616 | continua visível e com filtros ativos | 38 | card fixo 0..480 na cor do status; depois colunas de 480 na rampa cinza | `PedidoDetalheHub10.tsx:427-437, 81-104` |
| **C. Novo pedido** | 0, 112, 1920×614 | continua visível | 6 | card aberto 0..480; conteúdo 480..1920 (18 col) em sub-painéis de 480 ou 960 | `NovoPedidoHub10.tsx:444-445, 102, 735` |

Coordenadas do modelo A (em relação ao painel; some 112 para o palco):

| Elemento | Posição |
|---|---|
| Seletor de família | 76 / 63 |
| Recortes | 380 / 63, largura 340 |
| Selo de referência | 76 / 150, altura 40 |
| Lista | 70 / 219, 640×582 = 6 linhas de 97 |
| Busca | 76 / 873, 320×37 |
| "Filtros" | 578 / 873, altura 37 |
| Comando | 800 / 58, altura 46 |
| Fechar | right 80 / top 58, 46×46 |

O 380 e o 578 vêm do handoff ("3 Cores" em 379,5) e não da grade de 80 (`FerramentaisHub10.tsx:1325-1328`).

**Linha de cabeçalho do painel.** Em qualquer modelo fica em `top: 58` do painel, com `left: 80` e `right: 80`. Um controle de 46 px nessa linha tem o centro em 81, no eixo de um texto de 24 px posto em `top: 63` (`FerramentaisHub10.tsx:1713-1719`).

**Ver todos** é uma camada que cobre o palco inteiro: 0, 0, 1920×1080, fundo `FUNDO`, z 50, por cima da barra, com `padding: "56px 72px 0"` (`PedidoHub10.tsx:636-637`).

### 2.5 Margens ópticas por papel

**[Regra]** Use a margem do papel. Não invente outra.

| Margem | Papel | Motivo / referência |
|---|---|---|
| 72 (e `right: 72`, que termina em 1848) | título, resumo e rodapé da faixa preta | Fraunces 112 tem folga lateral. Não há comentário que justifique; `PedidoHub10.tsx:574, 581` |
| 76 | texto de card e de painel, busca do painel | alinha com a borda da busca (`FerramentaisHub10.tsx:1275-1279`) |
| 80 | controles e estrutura: wordmark, ícones, fechar, "Comparar", cabeçalho de coluna | é a coluna exata (`FerramentaisHub10.tsx:1714`) |
| 70 | lista em Fraunces 96 | folga lateral do tipo em 96 (`FerramentaisHub10.tsx:1278-1279`) |

**[Divergência]** O rodapé da Home usa `left: 84` e `right: 80`, e o topo em 995 (`HomeHub10.tsx:618-625`). As demais páginas usam 72 e 998.

### 2.6 Ordem de camadas (z-index do palco)

`NIVEL = { painel: 38, verTodos: 50, caixa: 68, pantone: 76 }` (`ChromeHub10.tsx:54`). Esses números são ao mesmo tempo o z-index e a prioridade do ESC.

| z | Camada |
|---|---|
| 1 | faixa preta (Home: 2) |
| 2 | trilha e estado vazio |
| 3 | título e resumo da faixa |
| 5 | card em hover |
| 20 / 21 | faixas lilás e amarela da Agenda (Home) |
| 30 | rodapé da faixa e dica de rolagem |
| 38 | painel "dentro" (`NIVEL.painel`) |
| 40 | barra do topo, sempre renderizada **por último** dentro do `PalcoFixo` |
| 49 / 50 | apanhador transparente dos menus / menus e Ver todos (`NIVEL.verTodos`) |
| 60 | notificações (dentro da barra); véu das caixas do PedidoDetalhe |
| 68 | modais e seletores (`NIVEL.caixa`) |
| 70 | aviso `AvisoV1a` (`HubV1a.tsx:521`); confirmação "Limpar fila" |
| 76 | tabela Pantone por cima de outra caixa (`NIVEL.pantone`) |
| 80 / 90 / 95 | caixas da Home / sugestões / sair |

---

## 3. Tipografia

### 3.1 Famílias

- `INTER = "Inter, system-ui, sans-serif"` (`ChromeHub10.tsx:26`) é a fonte padrão do palco, com antialiasing (`:132`).
- `FR = { fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: 600 }` (`ChromeHub10.tsx:27`). O `opsz` é trocado por uso:
  - **144** no título da faixa e no título do Ver todos;
  - **96** na lista grande e nos títulos de modal;
  - **40** nas barras de acordeão dos modais e nos nomes de acabamento do Novo pedido.
- `styles.css:35-36` também define `--font-sans` e `--font-display`.
- **Mono** (`ui-monospace, Menlo, monospace`) é exclusiva de modal. Nenhum arquivo de página usa mono.

### 3.2 Papéis de página

| Papel | Família | Tamanho / entrelinha | Peso | Tracking | Cor | Referência |
|---|---|---|---|---|---|---|
| **Título da página** (faixa) | FR, opsz 144 | 112 / 1 | 600 | -.01em | `FUNDO` | `CalculadorasHub10.tsx:188` |
| Resumo, linha 1 | Inter | 24 / 1.5, gap 6 | 400 | — | `FUNDO` | `:190-191` |
| Resumo, linha 2 | Inter | 24 / 1.5 | 400 | — | `#bdbdbd` | `:192` |
| Rodapé: rótulo ("Período:") | Inter | 19 | 400, opacidade .62 | — | `FUNDO` | `PedidoHub10.tsx:584` |
| Rodapé: valor | Inter | 19 | 500 | — | `FUNDO` | `:584` |
| Rodapé: chevron | svg 14, traço 2.4 | — | opacidade .7 | — | `FUNDO` | `:585` |
| "Ver todos" | Inter | 19 | 500 | — | `FUNDO` | `:631` |
| "R2hub 1.0" | FR | 24 | 600 | — | `FUNDO` | `CalculadorasHub10.tsx:196` |
| Data no rodapé (Home, Novo pedido) | Inter | 24 | 400, hora em 600 | — | `#fff` | `HomeHub10.tsx:618`, `NovoPedidoHub10.tsx:435` |
| Navegação da barra | Inter | 16 | 500 | .01em | `PRETO` | `ChromeHub10.tsx:208` |
| Busca da barra ("PESQUISA") | Inter | 13 | — | .18em vazia, 0 digitando | — | `ChromeHub10.tsx:221` |
| **Marca do card** | Inter | 18 | 600 | — | `#8f8f8f` | `CalculadorasHub10.tsx:69` |
| Pessoa (card de pedido) | Inter | 24 | 500 | -.02em | tinta | `PedidoHub10.tsx:455` |
| **Título do card** (padrão) | FR | 56 / 56 | 600 | -.04em | tinta | `FerramentaisHub10.tsx:120`, `PedidoDetalheHub10.tsx:106` |
| Linha de baixo do card | Inter | 22 / 1.3 | 500 | -.01em | `PRETO` | `CalculadorasHub10.tsx:166` |
| Contagem do card | FR 46 / 1 (-.03em) + Inter 22 / 500 (-.01em), gap 10, alinhados na base | — | — | — | `PRETO` | `FerramentaisHub10.tsx:347-351` |
| `CampoHub10`: rótulo | Inter | 24 | 400 | — | tinta | `ChromeHub10.tsx:89-101` |
| `CampoHub10`: valor | Fraunces | 24 / 30, 2 linhas | 800 | -1px | tinta | `ChromeHub10.tsx:97-98` |
| Pílula de status | Inter | 24 | 600 | — | tinta | `PedidoHub10.tsx:513` |
| Estado vazio | FR 44 (-.02em) + Inter 20 | — | — | — | `PRETO` / `#8f8f8f` | `CalculadorasHub10.tsx:176-177` |
| Seletor de família (painel) | Inter | 24 | 600 | -.01em | `PRETO`; chevron 15, traço 2.6, opacidade .65 | `FerramentaisHub10.tsx:1284-1287` |
| Recorte desligado | Inter | 24 | 400 | — | `#6f6d6f` | `:1333-1335` |
| Recorte ligado | Inter | 24 | 700, sublinhado, offset 6 | — | `PRETO` | `:1333-1335` |
| **Lista grande** | FR, opsz 96 | 96 / 97px | 600 | -.03em | ligado `PRETO`, desligado `#9a989a` | `:1386-1388` |
| Busca do painel ("PESQUISA") | Inter | 14 / 1 | 600 | .08em, centrada | `PRETO` | `:1447-1449` |
| "Filtros" | Inter | 24 | 400; 700 com filtro | — | `PRETO` | `:1456` |
| Comando em pílula ("Comparar") | Inter | 18 | 600 | — | `PRETO` / `#fff` ligado | `:1705` |
| Selo: rótulo / valor | Inter 16 / 500 · FR 22 / 1 (-.02em) | — | — | — | `#5b595b` / `PRETO` | `:1361-1362` |
| Delta / eixo / "deitada" | Inter 700 18/1.1 · 13/600 · 13/600 | — | — | — | tinta / `CINZA` / `#5b595b` | `:1413-1429` |
| Nota | Inter | 15 | 400 | — | `#5b595b` | `:1354` |
| Legenda | Inter | 14 / 1.3 | 400; valor 600 | — | `#3c3a3c`; rótulo `CINZA`; valor `PRETO` | `:1803-1819` |
| Título de coluna (PedidoDetalhe) | FR | 56 / 56 | 600 | -.04em | `PRETO` | `PedidoDetalheHub10.tsx:106` |
| Ação em texto | Inter 18 / 500 (PedidoDetalhe `ACAO`) · Inter 22 / 500 (Novo pedido `PLANO`) | — | — | — | `PRETO` | `PedidoDetalheHub10.tsx:108`, `NovoPedidoHub10.tsx:98` |
| Corpo em painel | Inter | 17 / 1.5 | 400 | — | `PRETO` | `PedidoDetalheHub10.tsx:572` |
| Ver todos: título | FR, opsz 144 | 72 / 1 | 600 | -.02em | `PRETO` | `PedidoHub10.tsx:639` |
| Ver todos: contagem / cabeçalho / linha | 20 `CINZA` · 13/700 .08em maiúsculas `CINZA` · 18, cliente FR 22 -.02em | — | — | — | — | `:640, 707, 714-716` |

**Exceções de tamanho do título do card**, que seguem pedido ou prancha:
- Calculadoras: FR 70/70 com tracking 0. O Augusto pediu o tamanho do desenho (`CalculadorasHub10.tsx:65-70`).
- Pedidos: 56/58 (`PedidoHub10.tsx:511`).
- Novo pedido: 64/60 com -.03em, e 70 aberto (`NovoPedidoHub10.tsx:417, 745`).

**[Regra]** Página nova usa 56/56 com -.04em, a menos que a prancha diga outro valor.

**[Divergência]** A segunda linha do resumo é `#bdbdbd` em Calculadoras, Ferramentais e Novo pedido. Em Pedidos as duas linhas são `FUNDO` (`PedidoHub10.tsx:576-578`). **[Regra]** Página nova usa `#bdbdbd`, que é a maioria.

**[Divergência]** A ação em texto tem 18 no PedidoDetalhe e 22 no Novo pedido. Nada no código escolhe entre os dois.

### 3.3 Caixa (maiúsculas e minúsculas)

- **[Regra]** Tudo que aparece na página vai em minúsculas com inicial maiúscula (sentence case): título, card, filtro, lista. É a regra da memória "Card é sempre minúscula": tirar o `text-transform: uppercase` que o handoff põe em rótulo de card.
- Maiúsculas que existem hoje em página:
  - os rótulos do `MENU`, escritos em maiúsculas como string (`ChromeHub10.tsx:105-110`);
  - o placeholder "PESQUISA";
  - o selo "DA FILA" do card de pedido, uma exceção explícita (`PedidoHub10.tsx:476-479`);
  - o cabeçalho da tabela do Ver todos (`:707`);
  - o `ROTULO` do Novo pedido (13/600, .16em, `#b3b1b3`, escrito em maiúsculas como string, `NovoPedidoHub10.tsx:95`).
- **[Divergência]** Um leitor tratou rótulo em maiúsculas espaçadas como sinal de modal. O `ROTULO` do Novo pedido e o cabeçalho do Ver todos mostram que isso também já existe em página.
- **[Regra]** Página nova não cria maiúsculas além de `MENU` e "PESQUISA". Se o handoff tiver outra, copie o texto do `<script>` do `.dc.html` e confirme com o Augusto.

---

## 4. Cor

### 4.1 Constantes exportadas (`ChromeHub10.tsx:19-39`)

| Nome | Valor | Papel |
|---|---|---|
| `PRETO` | `#000000` | texto, traço estrutural, faixa preta, estado ligado |
| `AMARELO` | `#fff079` | amarelo do hub: tom de card (Ferramentais), aba Agenda, status Revisão |
| `AMARELO_MAIS` | `#FFE815` | criar e adicionar: o "+" da barra, "Cadastrar nova", a vaga "+ Adicionar faca" (ver 4.7) |
| `FUNDO` | `#f1f1f1` | fundo do palco e cor do texto sobre a faixa preta |
| `FUNDO_PAINEL` | `#f5f5f5` | "Fundo dos painéis das telas 1.0". Menus e caixas que abrem por cima continuam brancos |

### 4.2 Cores locais (não exportadas)

| Valor | Papel | Onde |
|---|---|---|
| `#fff` | barra do topo; coluna direita do painel A; corpo de popover | `ChromeHub10.tsx:202`, `FerramentaisHub10.tsx:1586` |
| `#e4e4e4` | tarja em volta do palco | `ChromeHub10.tsx:131` |
| `#8f8f8f` (`CINZA`) | rótulos, contagens, metadados, estado vazio | `PedidoHub10.tsx:56`, `FerramentaisHub10.tsx:36`, marca literal em `CalculadorasHub10.tsx:69` e `PedidoDetalheHub10.tsx:107` |
| `#8a8a8a` (`CINZA`) | o mesmo papel, com outro valor | `PedidoDetalheHub10.tsx:19`, `NovoPedidoHub10.tsx:40`, `PantonesHub10.tsx:34`, `PantoneHub10.tsx:22`, `DesignCriadoHub10.tsx:27`, `ClicheChegouHub10.tsx:26`, `PastaClienteHub10.tsx:21` |
| `#5b595b` | tinta 2 | `FerramentaisHub10.tsx:1354, 1407` |
| `#6f6d6f` | recorte desligado | `:1334` |
| `#9a989a` | item de lista desligado | `:1388` |
| `#3c3a3c` | corpo de legenda | `:1803` |
| `#bdbdbd` | 2ª linha do resumo na faixa preta | `CalculadorasHub10.tsx:192` |
| `#b3b1b3` (`CLARO`) | aba inativa, `ROTULO` do Novo pedido | `PedidoDetalheHub10.tsx:20`, `NovoPedidoHub10.tsx:41` |
| `#252425` | tinta dos cards de status | `PedidoHub10.tsx:34-44` |
| `#aba9fc` (`LILAS`) | Calculadoras; status Criação | `CalculadorasHub10.tsx:49` |
| `#b3352f` | erro e ação destrutiva | `PedidoDetalheHub10.tsx:21`, `FerramentaisHub10.tsx:418` |
| `#f96767` | selo de notificação, status Cancelado, contorno de "Limpar fila" | `ChromeHub10.tsx:233`, `PedidoHub10.tsx:505` |

**[Divergência]** Há dois valores de `CINZA`:
- `#8f8f8f` aparece em 2 arquivos, e é o valor literal da marca do card em todas as páginas;
- `#8a8a8a` aparece em 7 arquivos, entre eles as **páginas** Novo pedido e PedidoDetalhe.

Um leitor chamou `#8a8a8a` de "cinza do modal". A busca mostrou que ele não é só de modal.
- **[Regra]** Página nova usa `#8f8f8f`.
- **[Proposta]** Exportar `CINZA` de `ChromeHub10`.

### 4.3 Paleta de status (`PedidoHub10.tsx:34-44`)

| Status | Fundo | Tinta |
|---|---|---|
| Aguardando design (`nova`) | `#c2ffff` | `#252425` |
| Criação | `#aba9fc` | `#252425` |
| Design criado (`aguardando`) | `#79cdf4` | `#252425` |
| Revisão | `#fff079` | `#252425` |
| Aprovado | `#6ede8a` | `#252425` |
| Clicheria | `#ffbcf2` | `#252425` |
| Refazer clichê | `#f9caaa` | `#252425` |
| Finalizado | `#315bf4` | `#6ede8a` |
| Cancelado | `#f96767` | `#252425` |

Quando o status não é reconhecido, a cor é `#fff079` (`:45`).

### 4.4 Tons de família e rampas

- `clarear(hex, t)` mistura a cor em direção ao branco: `t = 0` não muda a cor e `t = 1` vira branco.
  - A função está copiada em três arquivos: `PedidoHub10.tsx:59-66`, `CalculadorasHub10.tsx:52-57` e `FerramentaisHub10.tsx:81-86`. Não é exportada.
  - **[Proposta]** Exportá-la de `ChromeHub10`.
- **Ferramentais:** `TOM = FAMILIAS.map((_, i) => clarear(AMARELO, i * 0.12))` dá `#fff079 #fff289 #fff499 #fff5a9 #fff7b9 #fff9c9 #fffbd9 #fffdea`. O 8º tom chega a 84%, o teto (`FerramentaisHub10.tsx:88-94`).
- **Calculadoras:** `clarear(LILAS, i * 0.12)` dá `#aba9fc #b5b3fc #bfbefd #c9c8fd #d3d2fd`.
  - **[Divergência]** A prancha `calculadoras.svg` usa `opacity` 1/.9/.8/.7/.6 sobre `#aba9fc`. Sobre branco isso dá `#aba9fc #b3b2fc #bcbafd #c4c3fd #cdcbfd`.
  - O comentário `CalculadorasHub10.tsx:58-61` diz que o handoff é "lilás chapado", e a prancha o contradiz.
- **Pedidos:** a função `corSequencia` usa `PASSO_EM_FORTE .12`, `PASSO_EM_CLARA .2`, `LIMIAR_CLARA .8` e `TETO .84` (`PedidoHub10.tsx:74-97`).
  - A contagem recomeça quando a cor muda.
  - Cores claras (luz ≥ .8) sobem 20% por passo.
  - Chegando na última cor que cabe no teto, a sequência volta para a primeira e recomeça o ciclo (Augusto, 29/09/2026): 8 degraus nas cores fortes (0 a 84%), 5 nas claras (0 a 80%).
- **Colunas do PedidoDetalhe:** rampa linear de `#e6e6e6` a `#fdfdfd` em 6 degraus, `fundoPainel(i)` (`PedidoDetalheHub10.tsx:96-104`). A base `PAINEL` é `FUNDO_PAINEL`, que a rampa sobrescreve (`:84`, `:546…817`).
- **Novo pedido:** lista fixa `TOM_ETAPA = ["#fff079", "#fff5a8", "#fff9cc", "#fffce7"]` (`NovoPedidoHub10.tsx:39`).

### 4.5 Regra 60/30/10 (telas NOVAS)

Regra do Augusto de 25/09/2026, citada em `PantonesHub10.tsx:9-14`. Vale para telas **novas**. Não se reforma as telas existentes por causa dela.

- **60% neutro:** fundo, grades e áreas de trabalho, ou seja, `FUNDO`, `#fff` e o preto da faixa.
- **30% secundário:** cards, painéis laterais, blocos de informação e cabeçalhos de popover, no tom da família.
- **10% destaque:** botão ou comando principal, item ativo, selo, ícone de ação, hover e foco.

Como a regra já aparece aplicada no código:
- **Visor de desenho** (`FerramentaisHub10.tsx:869-873`): o branco do desenho é o 60, o cabeçalho no tom da família é o 30, e o preto fica só em "Baixar PDF" ou "Sair da comparação".
- **Selo de referência** no tom da família, "é bloco de informação — os 30%" (`:1350-1351`).
- **Cabeçalho do popover "Filtros"** no tom da família, com corpo branco e preto só no que está ligado (`:1484-1486`).
- **Pasta do cliente:** cabeçalho na cor do status, corpo branco e preto só no botão que confirma (`PastaClienteHub10.tsx:11-13`).

**[Divergência]** Pedidos e Calculadoras são anteriores à regra. Neles o módulo colorido ocupa 616/1080 = **57%** do palco, e em Calculadoras esse módulo é 100% lilás. Nenhum dos dois é modelo de proporção para tela nova.

**[Regra]** Confira a regra por área, com a conta escrita no PR. Área do palco = 2.073.600 px²:

| Região | Área | Participação |
|---|---|---|
| Barra | 1920×112 | 10,4% |
| Faixa preta | 1920×354 | 32,8% |
| Módulo | 1920×616 | 57,0% |

### 4.6 Hierarquia de tinta (estado sem matiz nova)

- **[Regra]** Estado se codifica com tinta, e nunca com verde ou âmbar: `PRETO` → `#5b595b` → `CINZA #8f8f8f`.
- O exemplo canônico é a diferença de medida (`FerramentaisHub10.tsx:1396-1407`):

```ts
const cor = Math.abs(v) <= 2 ? PRETO : Math.abs(v) <= 5 ? "#5b595b" : CINZA;
// "Tinta, e não cor: verde e âmbar seriam duas cores fora da paleta"
```

- Os cinzas extras têm papel fixo. Não os use para outra coisa:
  - `#6f6d6f`: recorte desligado;
  - `#9a989a`: lista desligada;
  - `#3c3a3c`: corpo de legenda;
  - `#bdbdbd`: 2ª linha sobre o preto;
  - `#8f8d8f`, `#555355` e `#4a484a`: cinzas sobre fundo preto (rodapé de modal, contorno, botão desativado).

### 4.7 Os dois amarelos

- `AMARELO #fff079` é superfície: card, aba, status.
- `AMARELO_MAIS #FFE815` é o gesto de criar ou adicionar. O comentário em `ChromeHub10.tsx:19-24` diz "só no +".
- **[Divergência]** Usos reais de `#FFE815` além do "+" da barra:
  - "Cadastrar nova" e a vaga "Adicionar faca", coerentes com criar (`FerramentaisHub10.tsx:320-327, 1615`);
  - fundo de coluna em modo de edição no PedidoDetalhe, escrito como literal (`PedidoDetalheHub10.tsx:546, 631`);
  - a contagem de cores escolhidas no Novo pedido (`NovoPedidoHub10.tsx:613`);
  - botões principais de modal.
- Além disso, os modais redefinem `const AMARELO = "#FFE815"` localmente (`DesignCriadoHub10.tsx:25`, `ClicheChegouHub10.tsx:24`, `PantoneHub10.tsx:21`).
- **[Regra]** Na página, `#FFE815` só aparece em criar ou adicionar.

### 4.8 Roxo com moderação

- O lilás do hub é `#aba9fc`: status Criação, Calculadoras e a faixa de notas da Home.
- **[Divergência]** Os modais usam `ROXO = "#a4a2f0"` (`DesignCriadoHub10.tsx:26`), que não é o lilás da prancha.
- **[Regra]** Tela nova usa no máximo um elemento lilás e nunca um módulo inteiro.

### 4.9 Vermelho

- `#b3352f` é para erro e ação destrutiva.
- **[Divergência]** O Ferramentais também o usa como estado: "Cilindro estimado" (`FerramentaisHub10.tsx:1828`) e a contagem zero do popover "Filtros" (`:1553`). Isso contraria a regra de não criar matiz nova para estado.
- **[Regra]** Página nova não usa vermelho para estado. Para isso existe `#5b595b`.

### 4.10 Cores de domínio (não são interface)

Estas cores são conteúdo e não entram na conta 60/30/10 como interface:
- a cota azul `#00a0e4` e a magenta `#e32681` do desenho técnico (`FerramentaisHub10.tsx:1068, 1919-1924`);
- o CMYK da saudação da Home (`HomeHub10.tsx:73-74`);
- as amostras Pantone.

Vale o comentário de `PantonesHub10.tsx:10-12`: "Num catálogo de cor o entorno TEM de ser neutro: fundo colorido engana o olho sobre a amostra".

---

## 5. Componentes de página

Hoje não existe componente compartilhado para faixa, card ou painel. Cada página copia as linhas. **[Regra]** Copie das fontes citadas, sem reinventar.

### 5.1 Moldura

```tsx
<PalcoFixo>
  {/* faixa preta, trilha, título, resumo, rodapé, painéis… */}
  <BarraTopoHub10 profile={profile} paginaAtiva="Pantone" aoNavegar={aoNavegar}
    onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} />  {/* SEMPRE por último */}
  <AvisoV1a … />
</PalcoFixo>
```

- `paginaAtiva` é o segundo valor do par em `MENU` (`ChromeHub10.tsx:105-110`). Por exemplo, `["PANTONES", "Pantone"]` dá `"Pantone"`.
- O item ativo recebe `h10-navi on` e não navega.
- Importe de `./ChromeHub10`: `PRETO`, `AMARELO`, `AMARELO_MAIS`, `FUNDO`, `FUNDO_PAINEL`, `INTER`, `FR`, `NIVEL` e `useEscDoTopo`.
- **Não use** em região de página `CAIXA`, `CABECA`, `FECHAR_X` nem `AREA_TEXTO`. São peças de modal (`ChromeHub10.tsx:29-34`).

### 5.2 Trilha de cards

```tsx
<div ref={trilha} className="p10-trilha" onPointerDown={aoApontar} onScroll={() => setRolou(true)}
  style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 616, display: "flex", alignItems: "stretch",
    overflowX: itens.length > 4 ? "auto" : "hidden", overflowY: "hidden", zIndex: 2 }}>
  {itens.map((c, i) => (
    <div key={c.id} className="p10-card" onClick={() => { if (!arrasto.current.andou) abrir(c.id); }}
      style={{ position: "relative", flex: "0 0 25%", height: 616, background: TOM[i], borderBottom: `1px solid ${PRETO}`, color: PRETO, cursor: "pointer" }}>
      …
    </div>
  ))}
  {itens.length > 4 && <div aria-hidden style={{ flex: "0 0 24px", height: 616 }} />}
</div>
```
Fonte: `CalculadorasHub10.tsx:149-172`.

- **Roda do mouse:** a roda vertical vira rolagem horizontal de um card por giro, com trava de 220 ms e `passive: false` (`CalculadorasHub10.tsx:93-110`).
- **Arrasto:** mais de 4 px liga `andou`, que impede o clique de abrir o card.
  - O arrasto termina com `buttons === 0`, `pointerup`, `pointercancel` ou `blur` da janela (`:113-139`).
- **Snap:** `.p10-trilha` tem `scroll-snap-type: x mandatory` e o card tem `scroll-snap-align: start` (`styles.css:274-276`).
- **Espaçador:** 24 px no fim, só quando há mais de 4 cards. Sem ele, o hover do último card faz a trilha pular.
- **[Divergência]** Pedidos e Calculadoras têm o espaçador. O Ferramentais tem 8 famílias e não tem.
- **Contorno:** só `borderBottom 1px`, sem traço lateral. Os vizinhos se separam pelo tom (`styles.css:277-279`, `PedidoHub10.tsx:432-436`).
  - **[Divergência]** O Novo pedido usa `border: 1px solid #000; borderLeft: none; borderTop: none`, com traço à direita (`NovoPedidoHub10.tsx:413`).
  - As pranchas desenham contorno em todos os lados.

### 5.3 Anatomia do card

```tsx
const MARCA: CSSProperties = { position: "absolute", left: 76, top: 58, fontSize: 18, fontWeight: 600, color: "#8f8f8f", whiteSpace: "nowrap" };
const TITULO_CARTAO: CSSProperties = { position: "absolute", left: 76, top: 111, width: 348, ...FR, fontSize: 56, lineHeight: "56px", letterSpacing: "-.04em" };
```
Fonte: `FerramentaisHub10.tsx:119-120`. Em Calculadoras o título é 70/70 (`:70`).

- **Ilustração:** `<img>` com posição absoluta, na caixa em que foi desenhada, com `pointerEvents: "none"` e `draggable={false}` (`CalculadorasHub10.tsx:161-162`).
  - **[Suspeita]** No Ferramentais o `<img>` tem 240 px dentro de uma caixa de 190 que começa em 286 do card, então vai até 526 e pode cobrir uns 24 px da contagem em 502 (`FerramentaisHub10.tsx:128, 340, 346`).
- **Linha de baixo em 502:** uma frase em Inter 22/1.3/500 (Calculadoras) ou a contagem em FR 46 + Inter 22 (Ferramentais). "É o mesmo lugar", diz `CalculadorasHub10.tsx:164-165`.
- **"+" no card:** svg de 28 com a classe `p10-plus`, que gira 90° no hover do card, e `stopPropagation` (`PedidoHub10.tsx:464-470`). A versão "Cadastrar nova" usa um círculo `AMARELO_MAIS` de 22 px no lugar da marca (`FerramentaisHub10.tsx:324-331`).
- **Seta de ação:** svg de 30 com traço 2.2, classe `np10-seta`, em right 70 / top 58. Anda 6 px no hover (`NovoPedidoHub10.tsx:416`, `styles.css:295-296`).

### 5.4 Faixa preta

```tsx
<div style={{ position: "absolute", left: 0, top: 726, width: 1920, height: 354, background: PRETO, zIndex: 1 }} />
<div style={{ position: "absolute", left: 72, top: 813, ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontSize: 112, lineHeight: 1, letterSpacing: "-.01em", color: FUNDO, zIndex: 3 }}>Nome da página</div>
<div style={{ position: "absolute", left: 960, top: 849, width: 888, color: FUNDO, fontSize: 24, lineHeight: 1.5, zIndex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
  <div>{String(n).padStart(2, "0")} coisas</div>
  <div style={{ color: "#bdbdbd" }}>detalhe · detalhe</div>
</div>
<div style={{ position: "absolute", left: 72, top: 998, right: 72, display: "flex", alignItems: "center", fontSize: 19, color: FUNDO, zIndex: 30 }}>
  {/* filtros e, no fim, marginLeft: "auto" */}
  <div style={{ marginLeft: "auto", ...FR, fontSize: 24, whiteSpace: "nowrap" }}>R2hub 1.0</div>
</div>
```
Fonte: `CalculadorasHub10.tsx:143, 188-197`. As mesmas quatro linhas estão em `PedidoHub10.tsx:531/574/576/581`, `FerramentaisHub10.tsx:308/367/369/379` e `NovoPedidoHub10.tsx:407/423/427/434`.

- **Resumo:** duas linhas. Os números vão com dois dígitos (`padStart(2, "0")`, `PedidoHub10.tsx:386`). O resumo conta **tudo**, não a lista filtrada (`:385-400`).
  - **[Divergência]** A largura é 888 na maioria e 850 no Novo pedido.
- **Rodapé, duas formas:**
  - Com filtros "Rótulo: valor ▾": espaçados por `marginLeft: 150`, e "Ver todos" em `marginLeft: "auto"` com peso 500 (`PedidoHub10.tsx:581-632`). Um filtro só aparece quando tem **mais de uma** opção (`:603, 617`).
  - Com fonte: `<span style={{opacity:.62}}>Fonte:</span><span style={{marginLeft:8, fontWeight:500}}>…</span>` e "R2hub 1.0" à direita (`FerramentaisHub10.tsx:379-383`).
- **[Divergência]** O título é `FUNDO #f1f1f1`, não branco puro como diz a leitura da prancha.

### 5.5 Filtro de rodapé e o menu que abre para cima

```tsx
<div data-pop style={{ position: "relative", display: "flex", alignItems: "center", marginLeft: 150 }}>
  <div className="p10-flat" onClick={() => setMenu(menu === "x" ? null : "x")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
    <span style={{ opacity: .62 }}>Rótulo:</span><span style={{ fontWeight: 500 }}>{valor}</span>
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FUNDO} strokeWidth={2.4} strokeLinecap="round" style={{ opacity: .7 }}><polyline points="6 9 12 15 18 9" /></svg>
  </div>
  {menu === "x" && <OpcoesPop lista={…} atual={valor} aoEscolher={…} style={{ left: 0, bottom: "calc(100% + 16px)", minWidth: 230 }} />}
</div>
```

- `CAIXA_POP`: `#fff`, `1px PRETO`, raio 12, padding 8, z 40, sombra **para cima** `0 -14px 40px -16px rgba(0,0,0,.6)`, coluna com gap 3 (`PedidoHub10.tsx:123-127`).
- `OpcoesPop`: opção com altura 38, padding `0 14px`, raio 8 e Inter 16/500. A opção escolhida fica com fundo `PRETO` e texto `#fff` (`:147-158`).
- Divisória dentro do menu: `height: 1`, `rgba(37,36,37,.12)`, margem `5px 6px` (`:593`).
- Um estado só guarda o menu aberto (`menu: null | "periodo" | …`, `:208`).
- O clique fora é um `mousedown` no documento que ignora `[data-pop]` (`:243-251`).
- **Não confunda com `FiltroPilula`.** Ela é a pílula branca de 52 px que abre **para baixo** e só existe no Ver todos. O próprio código avisa que é diferente (`:129-131`).

### 5.6 Painel "dentro": convenções de cabeçalho

- A caixa segue a tabela 2.4. O fundo é `FUNDO`, com `overflow: hidden` e z `NIVEL.painel`. Ele não tem raio, sombra nem véu.
- A linha de cabeçalho fica em `top: 58`:
  - fechar em `right: 80`;
  - comando principal a 80 da divisa (`left: COL_ESQ + 80`);
  - texto de 24 px em `top: 63`, na mesma linha óptica.
  - O fechar e o comando ficam em pontas **opostas** e têm formas diferentes, para o "×" não ser lido como o fechar de um chip. Foi pedido do Augusto (`FerramentaisHub10.tsx:1692-1697`).
- **Seletor de família:** texto + chevron em 76/63. O chevron gira 180° quando o menu está aberto (`:1280-1288`).
  - O popover fica em 76/104 e tem largura 340: branco, `1.5px`, raio 18, sombra `0 22px 54px rgba(0,0,0,.22)`, padding `8px 0` (`:1290-1313`).
  - A linha ativa usa `rgba(0,0,0,.06)` e peso 700.
  - Trocar de família zera o recorte (`:1299-1302`).
- **Colunas do modelo B:** `PAINEL` é `flex: 0 0 480px`, altura 616, borda 1px à direita e embaixo. O título fica em 76/111 e o conteúdo começa em 212 (`PedidoDetalheHub10.tsx:81-107`).
- **Primeiro item pré-selecionado:** `atual = achadas.find(escolhida) ?? achadas[0]`. Um lado direito vazio "não diz para que ele serve" (`FerramentaisHub10.tsx:1206-1208`).

### 5.7 Listas

- **Lista grande** (`FerramentaisHub10.tsx:1373-1389`):
  - contêiner em 70/219, 640×582, `overflowY: auto`;
  - linha em FR opsz 96, 96/97px, -.03em;
  - item ligado `PRETO`, demais `#9a989a`;
  - clique com hover `p10-flat`.
- A rolagem volta ao topo quando mudam família, recorte ou busca (`:1269`).
- **[Divergência]** A lista vertical usa a classe `.p10-trilha`, que tem snap em x. Não faz mal na vertical, mas é a classe errada. Para esconder a barra sem snap existe `.h10-rolo-x`.
- **Linhas de menu ou seletor:** classe `.p10-linha`, com hover `rgba(37,36,37,.05)`.
- **Tabela do Ver todos:** grid `120px 1fr 220px 260px 130px 80px 200px 140px` com gap `0 20px`. O cabeçalho é fixo, com filete preto de 1.5px. As linhas têm padding `20px 24px` e filete `rgba(37,36,37,.12)` (`PedidoHub10.tsx:705-723`).

### 5.8 Pílulas: quando podem existir numa página

| Pílula | Especificação | Onde |
|---|---|---|
| Status do pedido | altura 50, borda 2px na tinta, raio 999, padding `0 24px`, 24/600 | `PedidoHub10.tsx:513` |
| Urgência | círculo preto de 50 com "!" branco 26/900, colado à pílula de status (gap 12), pulso contínuo `.p10-urgente` (parado com menos movimento). Na lista do Ver todos, 32; no painel do pedido, 44 na fileira de ícones | `PedidoHub10.tsx`, `styles.css` |
| Comando de modo ("Comparar") | altura 46, `1.5px PRETO`, raio 999, padding `0 22px 0 18px`, gap 10, ícone 18, 18/600. Ligada: fundo `PRETO`, texto `#fff`, `aria-pressed` | `FerramentaisHub10.tsx:1699-1711` |
| Selo de referência | altura 40, `1px PRETO`, fundo no tom da família, padding `0 6px 0 18px`, com "×" de 28 sem borda | `:1358-1371` |

**[Regra]** Fileira de pílulas para filtrar (`PILULA`) e chips de 34 px ficam só dentro de popover ou modal. Na página, filtro é texto (5.5, 5.10).

### 5.9 Campo de busca

```tsx
<label style={{ position: "absolute", left: 76, top: 873, width: 320, height: 37, boxSizing: "border-box",
  display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", cursor: "text" }}>
  <input value={busca} onChange={…} autoFocus placeholder="PESQUISA" aria-label="…"
    style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: "center",
      font: `600 14px/1 ${INTER}`, letterSpacing: ".08em", color: PRETO }} />
</label>
```
Fonte: `FerramentaisHub10.tsx:1444-1450`.

- O campo não tem borda, raio nem ícone. Fica no **pé** da coluna, com `autoFocus`.
- A busca da barra do topo é da mesma família: `#f1f1f1`, raio 4, 13px com .18em (`ChromeHub10.tsx:218-221`).
- O filtro de texto é `criarBusca` (`@/lib/busca`), que:
  - tira acento e põe em minúsculas;
  - troca `×`, `✕`, `✖` e `*` por `x`, e vírgula por ponto;
  - casa com ou sem espaço.
- **[Divergência]** O Novo pedido usa um campo tracejado, `1.5px dashed #000` com raio 14 (`CAMPO`, `NovoPedidoHub10.tsx:96, 510`), dentro da etapa. É campo de formulário.
- **[Regra]** Página nova usa a busca plana "PESQUISA". O campo tracejado fica para entrada de dado em formulário.

### 5.10 Recortes e "Filtros" (alternância em texto)

```tsx
<button onClick={() => setSecao(secao === s ? null : s)} className="p10-flat"
  style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 24,
    fontWeight: secao === s ? 700 : 400, color: secao === s ? PRETO : "#6f6d6f",
    textDecoration: secao === s ? "underline" : "none", textUnderlineOffset: 6, whiteSpace: "nowrap" }}>{s}</button>
```
Fonte: `FerramentaisHub10.tsx:1331-1335`.

- Recorte não tem "×". Clicar de novo desliga (`:1315-1320`).
- "Filtros" é texto de 24 px, **negrito** quando há filtro e nada mais. Número ("Filtros · 1") e bolinha foram testados e rejeitados (`:1458-1460`).
- O popover do "Filtros" abre **acima** da busca: left 76, `bottom: ALTURA - 873 + 20`, largura 560,5, com cabeçalho no tom da família e "×" de 33 (`:1464-1569`).

### 5.11 Botão de fechar

| Onde | Especificação | Referência |
|---|---|---|
| Painel "dentro" (padrão) | 46×46, `1.5px PRETO`, raio 999, fundo transparente, svg 18 com traço 2.4 (`M6 6l12 12` / `M18 6L6 18`), em `right: 80, top: 58` | `FerramentaisHub10.tsx:1720-1724` |
| Card fixo do PedidoDetalhe | 44×44, borda 2px na tinta, fundo `#FFFFFFEB`, em 400/50 | `PedidoDetalheHub10.tsx:441-444` |
| Ver todos | 56, preto cheio com "×" branco, `p10-dot` | `PedidoHub10.tsx:642-645` |
| Popover | 33, branco, `1.5px` | `FerramentaisHub10.tsx:1493, 1643` |

**[Divergência]** Um leitor escreveu que "páginas não têm botão de fechar". Vale para o **landing**, que se deixa pela barra ou por ação em texto como "Sair sem enviar" (`NovoPedidoHub10.tsx:438`). O painel "dentro" tem fechar e ESC.

### 5.12 Setas e rolagem

- **Dica de rolagem:** Lottie `LOTTIE.seta` de 64×64 com `rotate(-90deg)`, em 1776/392, com a classe `p10-dica` (fade de .4s). Só aparece quando há mais de 4 cards e o usuário ainda não rolou (`CalculadorasHub10.tsx:181-186`).
- **`.h10-rolo-x`:** esconde a barra, sem snap, com `overscroll-behavior-x: contain`. É para fileiras que rolam de lado sem puxar de volta (`styles.css:268-272`).
- **`.p10-trilha`:** esconde a barra e tem snap em x. É só para a trilha de cards.
- **Roda em fileira:** o `deltaY` vira `scrollBy` horizontal (`FerramentaisHub10.tsx:1257-1262`, `PantonesHub10.tsx:255-266`).

### 5.13 Divisórias

| Traço | Uso | Referência |
|---|---|---|
| `1px solid PRETO` | estrutura: base da barra, base do card, divisa de colunas, base de cabeçalho | `ChromeHub10.tsx:202`, `FerramentaisHub10.tsx:318, 1586` |
| `1.5px solid PRETO` | só controle isolado (fechar, "Comparar") e contorno de popover | `:1703, 1722` |
| `rgba(0,0,0,.12)` | divisória interna sobre branco (módulos, legenda, rodapé de popover) | `:960, 966, 1552, 1859` |
| `rgba(0,0,0,.14)` | filete da legenda no módulo | `:1884` (**[Divergência]** .12 nos outros lugares) |
| `rgba(37,36,37,.12)` | divisória em menu e linha de tabela | `PedidoHub10.tsx:593, 714` |

### 5.14 Esmaecimentos de borda

- Faixa de 44 px com `linear-gradient(to right|left, #fff, rgba(255,255,255,0))`, `pointerEvents: none`, `top: 1` e `bottom: 1`.
- Só aparece quando há sobra de rolagem: `medirPontas` testa `scrollLeft > 2` e `scrollLeft < sobra - 2` (`FerramentaisHub10.tsx:1244-1250, 1678-1679`).
- A tabela Pantone modal usa 34 px (`PantoneHub10.tsx:199-200`).

### 5.15 Linhas de contagem

- **Na faixa preta:** o resumo (5.4). É ali que a página diz quantas coisas tem.
- **No card:** contagem em FR 46 + unidade em Inter 22 (`FerramentaisHub10.tsx:346-353`).
- **Acima da lista que ela conta:** `"{n} de {total} facas do acervo"`, 400 14/1.4 `CINZA`, padding `0 22px 12px` (`:1036-1038`, dentro do seletor).
- **Rodapé do popover "Filtros":** filete `.12`, `marginTop: 22`, `paddingTop: 15`, contagem em 15 `CINZA` e "Limpar" sublinhado, que só aparece com filtro (`:1552-1566`).
- **Carregando:** "—" no lugar do número (`:348`) e frase em `CINZA` com "…" (`:370, 558`).

### 5.16 Chips (só em popover)

- Altura 34, padding `0 14px`, `1.5px PRETO`, raio 999, 700 13.
- Ligado: `PRETO` com texto `#fff`. Desligado: `#fff` com texto `PRETO`. Usa `aria-pressed`.
- Clicar num chip ligado desliga (`FerramentaisHub10.tsx:1525-1529, 1545-1547`).
- Muitos chips vão em `grid repeat(n, 1fr)` com gap 7, e não em `flex-wrap`, para as linhas alinharem (`:1541-1543`).

### 5.17 Legenda "Rótulo: valor"

```tsx
<span style={{ whiteSpace: "nowrap" }}><span style={{ color: CINZA }}>Seção: </span><b style={{ fontWeight: 600, color: PRETO }}>{valor}</b></span>
```
- O contêiner é `flex-wrap` com gap `6px 26px`, fonte 400 14/1.3 e cor `#3c3a3c` (`FerramentaisHub10.tsx:1800-1831`).
- Campo opcional só entra quando existe.
- Uma única marca de estado no fim substitui til e nota de rodapé.
- Os dados vêm de um hook compartilhado (`useFichaDaFaca`), para as duas vistas não divergirem (`:1758-1763`).

### 5.18 `CampoHub10`

É o par rótulo e valor do card (`ChromeHub10.tsx:89-101`): rótulo em Inter 24/400 e valor em Fraunces 800 24/30 com -1px, cortado em 2 linhas. Use-o para dado de ficha dentro de card ou painel, no lugar de rótulo em maiúsculas.

### 5.19 Estado vazio

- **No módulo:** coluna centralizada em 0,112,1920×616, com FR 44 (-.02em) e uma frase de 20 px em `#8f8f8f` (`CalculadorasHub10.tsx:174-179`, `PedidoHub10.tsx:558-563`).
- **Em lista interna:** texto de 20 px em `CINZA` com `paddingTop: 20`, em duas variantes, conforme haja busca ativa ou não (`FerramentaisHub10.tsx:1375-1378`).
- Estado vazio não leva ilustração.

### 5.20 Popover (o meio-termo)

- Caixa branca com borda de 1 a 1.5px, raio 12 a 20 e sombra, aberta **ao lado do gatilho**.
- Fica sobre um apanhador **transparente** em `NIVEL.x - 1`: "é um menu, não uma caixa modal" (`FerramentaisHub10.tsx:1466-1468`). Não há véu escuro.
- O cabeçalho no tom da família é o 30%.
- Pode ter chips, campo em pílula e rótulo em maiúsculas pequenas, porque é camada por cima da página e não a página.

### 5.21 Aviso

`AvisoV1a` (`../v1a/HubV1a`, z 70), com fundo `#252425`, check `#ffe815` e texto `#f1f1f1`. Todas as páginas 1.0 o usam para erro e para recado.

---

## 6. Interação

- **Navegação.** A rota é `/_authenticated/hub?tela=` (`hub.tsx:80-94`).
  - A barra chama `aoNavegar(label)`, que vira `LABEL_PARA_TELA[label]` (`hub.tsx:123-134`, com `"Pantone": "pantone10"`).
  - Uma tela bloqueada cai na Home com "Seu acesso não inclui essa página." (`:1172-1178`).
  - Um card sem permissão some. Se não sobra nenhum, aparece o estado vazio (`CalculadorasHub10.tsx:88-89`).
- **Do landing para o dentro.** O clique no card, desde que o arrasto não tenha passado de 4 px, monta o painel **na hora**, sem animação e sem véu.
  - A barra continua acessível (z 40 sobre 38).
  - Trocar de família no seletor não fecha o painel (`FerramentaisHub10.tsx:1081-1082`).
- **ESC.** Use `useEscDoTopo(ativo, nivel, fechar)` (`ChromeHub10.tsx:58-78`).
  - A pilha é global e só reage o nível mais alto. No empate, reage o último aberto.
  - O hook chama `preventDefault` e ignora evento já tratado.
  - `fechar` tem de ser um `useCallback` estável.
  - Níveis: painel 38, menus 50, caixas e seletores 68, tabela sobre caixa 76.
  - Uma página parada registra nível 1 para fechar os próprios menus (`PedidoHub10.tsx:235-240`).
  - O ESC tira uma camada por vez (`PedidoDetalheHub10.tsx:392-397`, `NovoPedidoHub10.tsx:186-195`).
  - Fechar o painel também limpa o estado que só existe dentro dele (`FerramentaisHub10.tsx:271`: busca e fixadas).
- **Clique fora.** Menus fecham com `[data-pop]` ou com um apanhador transparente. Na página nunca há clique em véu, porque não há véu.
- **Hover** (`styles.css:254-298`):

| Classe | Efeito | Uso |
|---|---|---|
| `.p10-card` | `scale(1.015)` a partir de `bottom center`, sombra `0 22px 40px -20px rgba(0,0,0,.42)`, z 5, `.32s cubic-bezier(.22,.61,.36,1)` | card da trilha |
| `.np10-card` | o mesmo, mais o contorno `inset 0 0 0 1px rgba(0,0,0,.85)`; `.np10-seta` anda 6 px | card com traço lateral (Novo pedido) |
| `.p10-plus` | gira 90° em .2s | "+" do card |
| `.p10-flat` / `.np10-flat` | opacidade .6 em .15s | texto e ícone clicáveis |
| `.p10-dot` / `.h10-dot` | escala 1.14 / 1.12 | botão redondo, ícone da barra |
| `.p10-linha` | fundo `rgba(37,36,37,.05)` em .12s | linha de lista ou menu |
| `.h10-navi` | opacidade .55; ativo com barra preta de 3px em `bottom: -8px` | navegação |
| `.fer10-modulo` / `.fer10-tirar` | o "×" só aparece no hover ou no `:focus-visible` | remover módulo |

  O comentário em `styles.css:277-279` explica por que `.p10-card` **não** tem o contorno inset: com cards sem traço lateral, o hover desenharia um traço que não existe em repouso.
- **Seleção:**
  - item de lista: tinta `PRETO` contra `#9a989a`;
  - recorte: 700 + sublinhado contra 400 `#6f6d6f`;
  - opção de menu e chip: fundo `PRETO` com texto `#fff`;
  - linha de menu ativa: `rgba(0,0,0,.06)` + 700;
  - modo ligado: pílula preta.
  - **[Divergência]** O Novo pedido marca o item escolhido com fundo `AMARELO`, borda 1px e raio 10 (`NovoPedidoHub10.tsx:517-521`).
  - **[Regra]** Página nova marca seleção com tinta. Fundo preto fica para opção de menu e modo ligado.
- **Transições.** São só as da tabela, mais o chevron que gira 180°. Painel não desliza.
- **Movimento reduzido** (`styles.css:342-352`). O bloco desliga `.h10-spark`, `.h10-badge`, `.np10-card`/`.np10-seta` e a saudação.
  - **[Divergência]** `.p10-card`, `.p10-plus`, `.p10-dica`, a Lottie e o `scrollBy` suave **não** entram no bloco.
  - **[Regra]** Toda classe nova com `transform` ou animação entra no bloco `@media (prefers-reduced-motion: reduce)`.
- **Teclado.**
  - Hoje só o ESC é tratado. Campos de busca de painel têm `autoFocus`.
  - A faixa de notas da Home é `role="button"` com `tabIndex={0}` e responde a Enter e Espaço (`HomeHub10.tsx:500-501`).
  - **[Divergência]** Os cards são `div` com `onClick`, sem `tabIndex` e sem `role` (`PedidoHub10.tsx:431`).
  - **[Regra]** Card novo segue o modelo da Home (`role="button"`, `tabIndex={0}`, Enter e Espaço) ou é um `<button>`, como no Novo pedido (`NovoPedidoHub10.tsx:412`).

---

## 7. Página × Modal

| Aspecto | Página | Só de modal (nunca na página) | Referência do modal |
|---|---|---|---|
| Camada | no palco, sem véu | véu `rgba(37,36,37,.78)` sobre 1920×1080, z 68 ou 76 | `DesignCriadoHub10.tsx:126-131`, `PantoneHub10.tsx:147-148` |
| Posição | presa a coordenadas da grade, de borda a borda | caixa centralizada com `translate(-50%,-50%)` e largura 720, 760 ou 1060, fora da grade | `DesignCriadoHub10.tsx:141`, `PantoneHub10.tsx:150` |
| Cantos | raio 0 em todo bloco estrutural | raio 20 a 24 na caixa | `PantoneHub10.tsx:150`, `ChromeHub10.tsx:32` |
| Traço | 1px `PRETO` estrutural | caixa com `1.5px solid #000` | idem |
| Sombra | nenhuma em repouso (só o hover do card) | `0 50px 110px -28px rgba(0,0,0,.62)` ou `0 18px 44px rgba(0,0,0,.22)` | idem |
| Fundo | `FUNDO #f1f1f1`; `#fff` só na coluna direita do painel A; `#f5f5f5` em coluna quadrada de altura cheia | caixa `#fff` | — |
| Título | **embaixo**, na faixa preta: Fraunces 112 em `FUNDO` a 72/813 | no topo da caixa: Fraunces 44 opsz 96 (-.035em) | `DesignCriadoHub10.tsx:149` |
| Sobrancelha | não existe (a marca é Inter 18/600 `#8f8f8f` em sentence case) | mono 700 13–14px, .16em, maiúsculas, `#8a8a8a` | `PantoneHub10.tsx:155` |
| Tarja colorida com título | nunca | `CABECA(cor)` ou cabeçalho na cor do status | `ChromeHub10.tsx:33`, `PastaClienteHub10.tsx:122-123` |
| Fechar | landing não tem; painel "dentro" tem 46 px em right 80/58 | círculo de 30 a 46 no canto do cabeçalho | `FECHAR_X`, `DesignCriadoHub10.tsx:157-160` |
| Busca | retângulo plano "PESQUISA", sem borda, raio ou ícone | pílula de 44 a 68 com `1.5px`, raio 999 e lupa | `PantoneHub10.tsx:164-168` |
| Filtros | texto: "Rótulo: valor ▾", recorte sublinhado, "Filtros" em negrito | fileira de `PILULA` (38 a 40, preta quando ligada) com esmaecimento | `PantoneHub10.tsx:69-75` |
| Rótulo de dado | `CampoHub10` (Inter 24 "Rótulo:" + Fraunces 800) | 800 11,5–12,5px, .12–.14em, maiúsculas | `FerramentaisHub10.tsx:1509` |
| Ação principal | ação em texto (`PLANO`, `ACAO`) ou modo em pílula | pílula `#FFE815` numa **tarja preta de rodapé** dentro da caixa ("Usar esta cor", "Cadastrar faca") | `PantoneHub10.tsx:227-242` |
| Acordeão | não existe | barras `#FFE815` e `#a4a2f0` com chevron | `DesignCriadoHub10.tsx:37-54` |
| Campo | busca plana; campo tracejado de formulário (Novo pedido) | campo `#fff` com `1.5px #d9d8d6` e raio 11; área tracejada com raio 14 | `DesignCriadoHub10.tsx:32-36` |
| Grade de amostras | quadrados encostados, sem raio **[Proposta]** | célula com raio 12 e bloco com raio 9 | `PantoneHub10.tsx:214-219` |
| Fonte mono | nunca | sobrancelha, chip do nº do pedido | `PedidoHub10.tsx` (modal de sucesso) |
| Cinza | `#8f8f8f` | `#8a8a8a` (mas ver a divergência em 4.2) | — |

**Híbridos conhecidos.** Não são página nem modal. Não copie como se fossem página.
- **Ver todos:** a estrutura é de página (palco inteiro, Fraunces 72, cards quadrados), mas os controles são de modal (segmentado, busca tracejada em pílula, `FiltroPilula`).
- **Visor de desenho:** geometria de página, com cabeçalho de 112 no tom da família e controles em pílula. Cobre a barra, em z 68.
- **Calendário da Home:** widget de página com raio 20 e sem sombra.

**[Divergência] `#f5f5f5`.** Três leitores chamaram `#f5f5f5` de "cinza de modal", e o próprio usuário lembrou de "campos `#f5f5f5`" nos modais. O código diz outra coisa:
- nos modais os campos são `#fff` com borda `#d9d8d6`;
- `FUNDO_PAINEL #f5f5f5` é cor **de página** (`NovoPedidoHub10.tsx:102`, base de `PedidoDetalheHub10.tsx:84`).

O que torna o painel da página de Pantones "de modal" é o **raio 22** com o recuo flutuante, e não a cor. O painel "dentro" do Ferramentais usa `FUNDO`, e não `#f5f5f5`.

---

## 8. Checklist para uma página nova

1. [ ] Está envolvida em `<PalcoFixo>`. `<BarraTopoHub10 paginaAtiva="…">` é o **último** filho, seguido de `AvisoV1a`. `paginaAtiva` confere com `MENU`.
2. [ ] O palco não rola. Só rolam a trilha (`.p10-trilha`, horizontal), listas internas (vertical, altura fixa) e fileiras (`.h10-rolo-x`).
3. [ ] O fundo é `FUNDO`. Não existe camada `#fff` de 1920×1080.
4. [ ] A faixa preta está em `0/726 1920×354 z1`. O título fica em 72/813 (FR opsz 144, 112/1, -.01em, `FUNDO`), o resumo em 960/849 com largura 888 (2ª linha `#bdbdbd`), e o rodapé em 72/998 com `right: 72`, 19px. Tudo copiado de `CalculadorasHub10.tsx:143-197`.
5. [ ] Não há título, tarja colorida nem sobrancelha no topo da página.
6. [ ] Nenhum bloco estrutural tem `borderRadius` ou `boxShadow` em repouso. Raio só aparece em pílula de controle, botão redondo e popover.
7. [ ] O traço estrutural é 1px `PRETO`. Os cards têm só `borderBottom`, e os vizinhos se separam por `clarear(base, i*0.12)` ou por matiz diferente. `1.5px` só em controle isolado.
8. [ ] As larguras de região são múltiplos de 80: 480, 720 e 1200. As âncoras seguem os papéis: 72 na faixa, 76 no texto de card e painel, 80 em controle, cabeçalho de painel em `top: 58`.
9. [ ] A tipografia usa só os papéis da seção 3. Não há mono nem `text-transform: uppercase` em card, e os rótulos estão em sentence case.
10. [ ] As cores saem de `ChromeHub10` e das tabelas da seção 4. `CINZA` é `#8f8f8f`. Estado é marcado com `PRETO`/`#5b595b`/`CINZA`. `#FFE815` só aparece em criar ou adicionar. Há no máximo um elemento lilás e nenhum vermelho de estado.
11. [ ] A conta do 60/30/10 por área está escrita no PR, com a tabela de 4.5.
12. [ ] Os controles são texto: filtros "Rótulo: valor ▾" com menu abrindo para cima, recortes sublinhados, "Filtros" em negrito. A busca é plana, "PESQUISA", sem borda, raio ou ícone.
13. [ ] Cada camada que abre registra `useEscDoTopo` com o `NIVEL` certo e um `fechar` estável. Menus fecham com clique fora (`data-pop` ou apanhador transparente em `NIVEL - 1`). Fechar o painel limpa o estado dele.
14. [ ] O hover usa as classes existentes. Arrastar não abre o card (`andou` > 4px). Classes novas com movimento entram no bloco de movimento reduzido. Os cards são alcançáveis pelo teclado.
15. [ ] O estado vazio é FR 44 + 20px `#8f8f8f`, centralizado. O carregando mostra "—" e uma frase com "…". Os rótulos de UI saem do handoff (`<script>` do `.dc.html`) quando ele existe, e não são inventados.

---

## 9. Divergências registradas

| # | Tema | Versões | Evidência | O que este guia faz |
|---|---|---|---|---|
| 1 | Topo da faixa preta | prancha 725 (725,5 na Home) · código 726 · Home 728 | `CalculadorasHub10.tsx:143`, `HomeHub10.tsx:453` | 726 (maioria), com a trilha indo até 728 |
| 2 | Contorno do card | prancha: 1px em volta · código: só `borderBottom` · Novo pedido: direita + base | `styles.css:277-279`, `NovoPedidoHub10.tsx:413` | padrão só base |
| 3 | Cor do título | prancha "branco" · código `FUNDO` | `PedidoHub10.tsx:574` | `FUNDO` |
| 4 | Margem | grade 80 · código 72/76/70/80 · Home 84 | 2.5 | papéis de 2.5 |
| 5 | Papel do `#f5f5f5` | "cinza de modal" (3 leitores) · `FUNDO_PAINEL` de página (1 leitor, conferido) | `NovoPedidoHub10.tsx:102`, `PedidoDetalheHub10.tsx:84` | é cor de página, desde que quadrada |
| 6 | `CINZA` | `#8f8f8f` (2 arquivos + marcas) · `#8a8a8a` (7 arquivos, com páginas) | busca por `CINZA =` | `#8f8f8f`; exportar (proposta) |
| 7 | 2ª linha do resumo | Pedidos `FUNDO` · demais `#bdbdbd` | `PedidoHub10.tsx:576-578` | `#bdbdbd` |
| 8 | Tons de Calculadoras | código `clarear` 12% · prancha `opacity` .9–.6 · comentário "chapado" | `CalculadorasHub10.tsx:58-62`, `calculadoras.svg` | registrado; a regra do hub é `clarear` |
| 9 | Prancha de Calculadoras | esperado: "mesma faixa preta" · o arquivo só tem a fileira de cards (viewBox 2475,8×1080, cards de 611,7) | `calculadoras.svg` | a faixa das Calculadoras foi copiada de Pedidos |
| 10 | Posição do "Comparar" | prancha: embaixo à direita · código: 800/58, de propósito | `FerramentaisHub10.tsx:1681-1698` | vale o código |
| 11 | Busca de página | plana (Ferramentais, barra) · tracejada com raio 14 (Novo pedido) | `NovoPedidoHub10.tsx:96, 510` | plana para "PESQUISA" |
| 12 | Fechar em página | "página não tem" · painel "dentro" tem | `FerramentaisHub10.tsx:1720` | landing sem, painel com |
| 13 | Marca de seleção | tinta · fundo amarelo com raio 10 · preto cheio | `NovoPedidoHub10.tsx:518` | tinta (menu e modo: preto) |
| 14 | Maiúsculas | "sinal de modal" · `ROTULO` do Novo pedido e cabeçalho do Ver todos na página | `NovoPedidoHub10.tsx:95`, `PedidoHub10.tsx:707` | nenhuma nova além de `MENU` e "PESQUISA" |
| 15 | `#FFE815` | "só no +" · criar, modo edição, contagem, CTAs de modal; modais redefinem `AMARELO` | 4.7 | na página, só criar ou adicionar |
| 16 | Vermelho de estado | regra sem matiz nova · "Cilindro estimado" e contagem zero em `#b3352f` | `FerramentaisHub10.tsx:1553, 1828` | página nova usa `#5b595b` |
| 17 | Modelo do painel "dentro" | A (cobre a faixa) · B (mantém a faixa) · C | 2.4 | escolher por página |
| 19 | Texto girado | "sem precedente" · precedente no V1a | busca: nenhum no hub10; `PedidosV1a.tsx:647`, `AprovacaoV1a.tsx:616`, `CentralV1a.tsx:548`, `AfiacaoV1a.tsx:921` usam `writingMode: "vertical-rl"` + `rotate(180deg)` | idioma novo para o hub10; a receita existe no V1a |
| 20 | Marca das Calculadoras | código 18 · prancha ≈24 (estimado pelo desenho da letra) | `calculadoras.svg` | **[Suspeita]**, não medido na tela |
| 21 | Saudação da Home | código 92 px com -.055em · prancha 112 px com tracking 0 · faixa lilás por cima ou por baixo da aba amarela | `Home design_Prancheta 1.svg` | registrado |
| 22 | Linhas da grade | `inside facas.svg`: 67 linhas de 16,1 · o código usa números absolutos que não caem nelas | `inside facas.svg` | números absolutos |
| 23 | Busca da barra | prancha 320×37,4 `#e6e6e6` em y 46 · código 240×38 `FUNDO` em y 37 | `Pedidos 1.0_Prancheta 1.svg` | vale o código |
| 24 | Ilustração × contagem no Ferramentais | possível sobreposição de ~24 px | `FerramentaisHub10.tsx:128, 340, 346` | **[Suspeita]** |
| 25 | Cinza do texto de estado vazio | guia `#8f8f8f` (3,2:1 sobre branco, abaixo do mínimo de leitura) · Pantones usa `#6f6d6f` (passa 4,5:1) | `PantonesHub10.tsx` (vazios da grade, "Ainda não aprovada", coluna direita vazia) | desvio declarado na Pantones; **[Proposta]** adotar `#6f6d6f` nos vazios das telas novas |
| 26 | Travessão em texto de tela | "—" e "–" como pontuação em avisos, rótulos e balões | pedido do Augusto, 25/09/2026 | **[Regra]** texto de tela não usa travessão: ponto, dois-pontos, vírgula ou parênteses; em título de balão, nome numa linha e explicação na de baixo. O "—" sozinho como valor vazio continua |

