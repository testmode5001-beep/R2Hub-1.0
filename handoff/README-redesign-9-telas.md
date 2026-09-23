# Handoff de design — 9 telas do R2 Hub

Para quem vai desenhar. Este documento descreve o **estado atual** de nove telas
já em produção, os dados reais que elas carregam e os problemas conhecidos de
cada uma. Não é um pedido de tela nova do zero: é um pedido de redesenho sobre
um sistema vivo, usado todo dia por 16 pessoas numa fábrica.

Telas no escopo: **Home, Central, Pedidos, Aprovação, Facas, Pantone,
Calculadoras, Arquivos, Clientes.**

Fora do escopo (existem, mas não entram agora): Fábrica, OP, Apontamentos,
Afiação, Estoque, Mural, Equipe, ANVISA.

---

## 1. O que é a R2 e o que é o hub

R2 Etiquetas é uma fábrica de etiquetas em bobina, impressão **flexográfica**.
O hub é o sistema interno: onde a vendedora abre um pedido de arte, o designer
faz, a vendedora aprova, o clichê é encomendado da clicheria e a produção roda.

O hub roda **on-premises**, num servidor da própria fábrica, servido por um
vigia (watchdog) na porta 8081. Sem nuvem, sem internet no caminho.

### Quem usa, de verdade

| Papel | Pessoas | O que faz nas telas |
| --- | --- | --- |
| **vendas** | **11** | abre pedidos, aprova arte, pede alteração, procura arquivo de cliente |
| designer | 2 | pega o pedido, faz a arte, devolve, pede clichê |
| gestor | 1 | acompanha, aprova, cobra |
| estoque | 1 | substrato, bobinas |
| admin | 1 | tudo |

**Onze dos dezesseis usuários são vendedoras.** Isso é o fato mais importante
deste documento e a tela deve ser desenhada para elas, não para o designer nem
para o gestor. Elas não são usuárias de software — são pessoas que precisam
saber se a etiqueta do cliente ficou pronta.

### O parque

Todas as telas são desenhadas para **desktop em monitor de fábrica**. Não há uso
em celular nestas nove telas (existe uma rota mobile separada, `m.leitura`, fora
do escopo).

---

## 2. O palco — a restrição que manda em tudo

Não são páginas roláveis. Cada tela é um **palco de tamanho fixo 1920×1290**,
centralizado e **escalado** para caber na viewport (componente `EstagioV1a`).

Consequências para o design:

- **Tudo tem que caber.** Não existe "rola mais para baixo" no nível da página.
  Blocos internos podem ter rolagem própria, a página não.
- Um bloco que cresce empurra outro para fora do palco. Já aconteceu: seis
  cartões somavam 1100px numa faixa de 896 e dois ficavam invisíveis fora da
  tela — a fila mostrava menos do que parecia.
- Em monitor pequeno a largura de projeto deixa de ser 1920 e o palco reflui.
  Desenhe pensando que a escala pode cair.
- O usuário controla o zoom do palco por um controle próprio (hoje muitos rodam
  a 80%).

### Cromo compartilhado

- **Rail preto** à esquerda: 76px, expande para 238px no hover (translúcido +
  blur). Botão amarelo `+` no topo, as 16 páginas na ordem do fluxo de trabalho,
  marca R2 embaixo com cross-fade de símbolo para wordmark.
- **Topbar branca** de uma linha: data · pesquisa · Chat · Anotações · bloco do
  usuário (notificações, preferências, sair).

O rail e a topbar **não estão no escopo** — mas todo desenho tem que conviver
com eles e respeitar o espaço que sobra.

---

## 3. Identidade

### Cores

| Token | Hex | Uso |
| --- | --- | --- |
| preto R2 | `#252425` | texto principal, rail, botão primário, chips ativos |
| amarelo R2 | `#FFE815` | **acento único** — etapa atual, alerta, texto sobre preto |
| fundo | `#F1F1F1` | fundo do palco |
| superfície | `#FFFFFF` | cards |
| superfície fraca | `#FAFAFA` | linha marcada, card resolvido |
| campo | `#F4F4F4` | inputs, chips inativos |
| campo (rail escuro) | `#302F30` | input e card dentro do rail preto |
| rail elevado | `#3A393A` | numeração inativa, chip "Finalizado" |
| creme | `#FFFBE0` | card de concluído (Aprovação), "clichê recebido" |
| borda | `#ECECEC` | divisores |
| borda forte | `#E0DFE0` | contorno de botão secundário |
| texto secundário | `#5C5A5C` | rótulos, apoio |
| texto terciário | `#6F6D6F` | metadados em fundo claro (mínimo AA) |
| texto fraco | `#7A787A` | placeholders, notas |
| texto desativado | `#8A888A` | valor ausente, item resolvido |
| texto sobre escuro | `#8D8B8D` | metadado dentro do rail preto |
| texto claro | `#C9C7C9` | aba inativa no rail |
| erro | `#C42B26` | validação, atraso, cancelado |
| erro (fundo) | `#FDF0EF` | campo inválido, chip cancelado |

**Regra de contraste, inegociável:** em fundo claro nunca usar cinza acima de
`#7A787A` para texto abaixo de 16px. `#8D8B8D` só sobre `#252425`/`#302F30`.

**O amarelo é acento único.** Se tudo é amarelo, nada é. Ver §5.

### Tipografia

- **Display: Fraunces** (variável), `font-variation-settings: 'SOFT' 100, 'opsz' <tamanho>`,
  weight 700–900, `letter-spacing -.02em a -.03em`. Títulos de página (56–82px),
  nome de cliente em card (36–38px), valores de especificação (18px, `opsz 48`).
- **Texto: Inter** 300–900.
- **Números, códigos, horas: mono** (`ui-monospace, Menlo, monospace`), 11–15px.

| Papel | Estilo |
| --- | --- |
| título de card | `800 17–19px/1.15`, `-.01em` |
| eyebrow / rótulo de seção | `700 11.5px/1`, `.14em`, uppercase |
| rótulo de campo | `700 10.5px/1`, `.14em`, uppercase |
| corpo | `500 13.5px/1.5` a `500 14.5px/1.6` |
| linha de tabela | `400–600 15–16px/1.2` |
| metadado | `500 12–12.5px/1.2` |
| pílula de status | `700 12.5px/1`, `.03em`, uppercase |

### Espaçamento, raio, sombra

- Escala: 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30.
- Padding de card `20–22px 22–26px`. Gap entre cards `12–14px`.
- Raios: `6` checkbox · `8` botão · `9` input · `10–12` item de lista ·
  `14` card · `16` modal · `999` pílula/chip.
- Sombra de card: `0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)`.

### Um padrão que já existe e vale reusar

**Nome de cliente em pé** (`nomeEmPe`): em card fechado estreito, o nome roda
90° e quebra em **duas** linhas, com o corpo caindo conforme o nome cresce
(25px até 16 caracteres, 14px acima de 34). Foi feito porque
"CASA DE CARNES ALEXANDRE ITAPIRA" era cortado no meio. Vale em Central,
Pedidos e Aprovação.

---

## 4. O fluxo de um pedido

Entender isto é pré-requisito para desenhar Home, Central, Pedidos e Aprovação.

```
nova → criacao → aguardando → aprovada → cliche → concluido
         ↑            ↓
         └─────── revisao
```

| Status no banco | Rótulo na tela | De quem é a vez |
| --- | --- | --- |
| `nova` | Aguardando Design | ninguém pegou ainda |
| `criacao` | Aguardando Design | designer, já assumiu |
| `aguardando` | **Aguardando aprovação** | **vendedora** |
| `revisao` | **Alteração pedida** | **designer** |
| `aprovada` | Design aprovado | quem pede clichê |
| `cliche` | Clichê solicitado | clicheria |
| `concluido` | Finalizado | — |
| `cancelado` | Cancelado | — |

> **Atenção, isto é recente.** Até 28/08/2026 `aguardando` e `revisao` eram
> **a mesma pílula "Revisão"** em nove arquivos. Eram lados opostos do fluxo
> mostrados igual: num a arte foi entregue e espera a vendedora, no outro a
> vendedora pediu alteração e a bola é do design. Ninguém sabia de quem era a
> vez olhando a tela — só clicando no sino de notificações. Acabou de ser
> separado. **Não volte a juntar.**

---

## 5. Regras que o desenho não pode quebrar

1. **O amarelo significa "é a sua vez agora".** Card branco = ninguém pegou.
   Card cinza = a bola é de outra pessoa. Card amarelo = alguém precisa agir.
   Quando o amarelo virou decoração, o card perdeu a função.

2. **Não repita a mesma informação em superfícies diferentes.** Duas tentativas
   já foram recusadas por isto: o texto da alteração no card da fila e uma tarja
   com o mesmo texto dentro do pedido. Se o dado já está a um palmo dali, uma
   marca basta — número, ponto, cor. Não texto.

3. **Marca só quando ela diz algo.** A marca de alteração na lista só aparece
   quando há mais de uma em aberto, ou quando a mais antiga espera há dois dias
   ou mais. Um "1 · 0d" em toda linha seria repetir a pílula e virar ruído.

4. **O hub NUNCA apaga arquivo em `\\server\Arte\Clientes`.** Regra inegociável
   da fábrica. "Excluir anexo" no hub significa desvincular do pedido, nunca
   apagar do share. Nenhum botão pode sugerir o contrário.

5. **Nada de dado inventado.** Sem cores, anexos ou briefing de exemplo na tela.
   Campo sem valor mostra o vazio explícito (`—`, "a assumir"), não um
   placeholder plausível.

6. **O sino não é a interface.** Se a única forma de descobrir algo é abrir as
   notificações, o desenho falhou.

---

## 6. As nove telas

Volumes abaixo são **contagens reais da base de produção em 28/08/2026**.

---

### 6.1 Home

**Quem usa:** todos, é a porta de entrada.

**Hoje:** saudação à esquerda, painel escuro à direita com seletor de papel
(Gestor / Vendas / Designer / Produção / Clicheria), três números
(em aberto, na clicheria, fechados no mês), tarefas do dia, recentes dos
pedidos. Rodapé com agenda da semana (grade de 5 × 280px) e atalhos.

**Dados reais:** 31 pedidos, 13 em aberto, 18 finalizados.

**Problemas conhecidos:**

- **Existem duas "anotações" no hub que não são a mesma coisa.** As da Home vêm
  do servidor (tabela `user_notas`) e viram tarefa do dia; as da Central vivem
  em `localStorage`. Mesmo nome, mesma cara, armazenamentos diferentes. O
  desenho deve deixar claro qual é qual — ou o produto deve unificá-las.
- O papel de parede central do protótipo nunca foi migrado; hoje é preto sólido.
- O seletor de papel é manual, mas o cargo do usuário já é conhecido. Ele abre
  no papel certo e mesmo assim oferece os outros cinco.
- As tarefas do dia são montadas a partir dos números reais ("5 em revisão",
  "3 esperando o design") mais as anotações em aberto. Há uma lista fixa no
  código, mas ela só aparece se não houver pedido nenhum — em produção nunca
  aparece.

---

### 6.2 Central

**Quem usa:** gestor e vendas, para ter a visão do mês.

**Hoje:** coluna esquerda de **624px** com título Fraunces 80, calendário do mês
(dia atual amarelo, entregas sublinhadas, anotação por dia), cards de contagem
(Clichês / Substrato / Medidas em barras), Anotações e Pódio. Coluna direita com
"Em aberto" (card grande de 612px + cards verticais de 98px que expandem no
clique), Resumo de artes (3 KPIs mensais + seletor de mês) e Finalizados
recentes em tabela ordenável.

**Dados reais:** 31 pedidos, 28 clientes, 4 anotações de usuário.

**Problemas conhecidos:**

- A coluna esquerda de 624px é quase um terço do palco para conteúdo de consulta,
  enquanto o trabalho de verdade acontece à direita.
- As anotações persistem em **localStorage**, não no banco — trocar de máquina
  perde tudo. Pior: as anotações da **Home** vão para o servidor. São duas
  features com o mesmo nome e destinos diferentes (ver Home).
- O calendário e o "Resumo de artes" competem pelo mesmo papel de "como está o
  mês", em dois lugares diferentes.

---

### 6.3 Pedidos

**Quem usa:** vendas e design, é a tela mais usada do hub.

**Hoje:** coluna esquerda de **400px** — título Fraunces 82, card Status (lista
com orelha de 4px + contagem), card Origem (chips + "Somente atrasados"), dois
KPIs-filtro (Clichês para aprovar / na clicheria) e card Medidas mais pedidas.
Coluna direita — "Fila de produção", faixa de 4 cards (o aberto com 600px, os
fechados com 88px e nome em pé) e a tabela completa com colunas **arrastáveis e
redimensionáveis**, orelha de status por linha e paginação.

**Dados reais:** 31 pedidos, 203 registros de histórico, 67 anexos,
18 comentários. Colunas: Nº, Cliente, Medida, Substrato, Origem, Status,
Solicitação, Prazo.

**Estado recente (agosto/2026):** a faixa passou a ordenar **por urgência**, não
por número — ordenando por nº, um pedido novo empurrava para fora da tela uma
alteração parada há dias. Alteração pedida e Aguardando design disputam as vagas
juntas (as duas são a vez do design); Aguardando aprovação só entra se sobrar.

**Problemas conhecidos:**

- **A faixa cabe 4 cards.** Era 6 e dois ficavam fora da tela. Quatro é pouco
  para uma fila que já teve nove pedidos em aberto. O formato "um card grande +
  três lombadas" pode não ser a resposta certa.
- O KPI **"Clichês para aprovar"** soma Alteração pedida + Aguardando aprovação
  + Design aprovado. O nome não descreve o conteúdo — sobrou da época em que os
  status eram um só.
- A coluna Status tem 152px e o rótulo "ALTERAÇÃO PEDIDA" ocupa quase tudo.
- A ordem das colunas é preferência por usuário, salva em `user_config`.
  Qualquer redesenho da tabela precisa manter isso funcionando.

---

### 6.4 Aprovação

**Quem usa:** vendas e gestor. É a ponte com a **clicheria**, um fornecedor
externo que recebe pedido por e-mail.

**Hoje:** cabeçalho com título 56px + "prazo médio de retorno" + filtros de
e-mail. Esquerda de **380px** (com rolagem própria): KPIs Aguardando clicheria /
E-mail não enviado, filtro por Motivo, Pódio de aprovações, Espessura do clichê
(1,14 / 1,70 com chips de mês) e Cores mais pedidas. Centro e direita: faixa
"Chegaram da aprovação de arte", colunas "Enviados à clicheria" (ações Clichê
chegou / Conferir / Reprovar) e "Concluídos" em cards creme `#FFFBE0` com total
e itens.

Tem um modal próprio: **"Solicitar clichê — E-mail à clicheria"** com tipo,
cores, motivo (permite motivo novo), observações, anexos e uma **calculadora de
distorção** (`R = dentes × passo`, `K = 2π(esp − 0,127)`).

**Dados reais:** 17 registros de chegada de clichê, 7 solicitações, 7 motivos
cadastrados, 9 substratos de faca.

**Problemas conhecidos:**

- É a tela **mais densa e maior do hub** (102 KB de componente, contra 54 KB de
  Pedidos) e a única cuja coluna lateral precisa rolar sozinha — sinal de que
  não cabe no palco.
- Ela mistura três trabalhos diferentes na mesma tela: pedir clichê, acompanhar
  o que está na clicheria e registrar o que chegou (com nota fiscal e valor).
- Valor de clichê é informação restrita por permissão (`cliche.valor_ver`) — o
  desenho precisa funcionar bonito **sem** os valores, para quem não pode vê-los.

---

### 6.5 Facas

**Quem usa:** design e produção. Faca é a matriz de corte da etiqueta.

**Hoje:** catálogo de **294 facas** com filtros por sistema / seção / cilindro,
vista ativas / mortas / todas, comparação de até 3, prévia do desenho e cadastro
de faca nova. Os desenhos são **PDFs vindos do share**; sem eles a tela cai num
desenho gerado a partir da medida.

**Dados reais:** 294 facas no catálogo, 9 substratos.

**Estado recente:** o visualizador de desenho foi corrigido em 28/08 — a imagem
media 1128px de altura numa área de 494 e vinha cortada. Agora cabe inteira
(`object-fit: contain`), com zoom a partir daí.

**Problemas conhecidos:**

- **O visualizador renderiza só a primeira página do PDF.** Se algum desenho
  tiver duas páginas, o resto some sem aviso. Não foi verificado se existem.
- A tela também é usada como **seletor** dentro de outras telas (modal de faca
  no pedido, no formulário de medidas). O catálogo precisa funcionar nos dois
  papéis: navegar e escolher.
- "Faca morta" é um estado importante (a faca existe mas não se usa mais) e hoje
  vive num filtro de vista, não no próprio item.

---

### 6.6 Pantone

**Quem usa:** design e vendas, para acertar a cor com o cliente.

**Hoje:** biblioteca Solid Coated 2024 com **3.219 cores** + escala de processo,
famílias calculadas por Lab (neutro, rosa, vermelho, laranja…), grade de 8
colunas, coluna lateral de 300px e um filtro **"Pantones usados"** que cruza a
biblioteca com as cores dos pedidos reais.

**Dados reais:** 3.219 cores; as cores usadas saem do campo `cores_desc` dos
31 pedidos.

**Problemas conhecidos:**

- A tabela vem do arquivo `.acb` do Illustrator e é regenerada por script
  (`scripts/gerar-pantone.mjs`) — **não é anual**, muda quando a Pantone muda.
  O desenho não deve sugerir "edição 2024" como se fosse fixo.
- 3.219 amostras num palco fixo é um problema de densidade de verdade: hoje a
  grade é de 8 colunas e rola.
- "Pantones usados" é o recorte mais valioso da tela e está como um filtro entre
  outros.

---

### 6.7 Calculadoras

**Quem usa:** design, produção e orçamento.

**Hoje:** **11 calculadoras em 4 grupos** (Clichê, Etiquetas, Facas, Produção),
com fórmulas portadas 1:1 do protótipo. Cada uma tem destaque escuro para o
resultado, resultado detalhado, barra de composição, tabela ordenável e um
histórico com Salvar / Restaurar / Remover.

**Dados reais:** nenhum — é tela de cálculo puro. Passos de faca fixos
(M1 π, 1/8", 1/4", 3/8", 1/2").

**Problemas conhecidos:**

- É o **maior componente do hub** (128 KB) para uma tela sem dado de banco.
  Onze calculadoras dividindo o mesmo palco fixo.
- **O histórico só existe na memória da página** (`useState`), nem em
  `localStorage` nem no banco. O botão chama "Salvar resultado" e um F5 apaga
  tudo. É a promessa mais quebrada das nove telas.
- As grades usam `auto-fit minmax(200–210px, 1fr)`, o que faz o número de
  colunas mudar sozinho conforme a escala do palco. Em zoom baixo o layout
  reflui de forma imprevisível.

---

### 6.8 Arquivos

**Quem usa:** vendas e produção. É o **arquivo físico** de clichês — gavetas de
verdade, no galpão.

**Hoje:** **1.915 pastas** migradas, busca por nome / código / etiqueta, gavetas
A–W (+ antigas), registro de consulta ao abrir, marcação de inativas (vagas ou
2+ anos sem consulta), cadastro e edição de cliente. Grade de `400px 1fr`.

**Dados reais:** 1.915 pastas em `arquivo_pastas`.

**Problemas conhecidos:**

- É a tela com **mais registros do hub** e a busca é a única forma prática de
  chegar em algo. As gavetas A–W são navegação de segunda ordem.
- "Inativa" é derivada de duas coisas diferentes — pasta vaga e pasta sem
  consulta há 2 anos — mostradas como um estado só.
- O registro de consulta acontece **ao abrir** a pasta na tela, o que mistura
  "consultei no sistema" com "fui na gaveta".

---

### 6.9 Clientes

**Quem usa:** vendas, o dia inteiro.

**Hoje:** as pastas da rede (`\\server\Arte\Clientes`) dentro do hub. Grade de
`340px 1fr`, cards em `auto-fill minmax(186px, 1fr)`. PDF, PNG e JPG abrem na
própria tela; `.ai` e `.cdr` o navegador não mostra — esses baixam ou abrem pelo
caminho de rede.

**O problema que ela resolve:** para achar a arte de um cliente a vendedora saía
do hub, abria o Explorador e procurava entre **cerca de 5 mil pastas** — pela
grafia exata, porque a busca do Windows não perdoa acento nem caixa.
"Sao Geraldo" não achava "São Geraldo". Aqui a busca é a do hub: sem acento, sem
caixa, por palavra.

**Dados reais:** 28 clientes cadastrados no banco; o share tem milhares de
pastas e é lido **ao vivo**, sem cópia e sem índice.

**Problemas conhecidos:**

- **SÓ LEITURA, e isso é lei.** Nada nesta tela grava, renomeia ou apaga no
  share. O desenho não pode ter afordância de escrita.
- Ler o share ao vivo significa **latência real** em pasta grande. Precisa de
  estado de carregando que não pareça travamento.
- Não há miniatura para `.ai` e `.cdr`, que é justamente o formato da arte
  final — o card mais importante é o que não tem prévia.

---

## 7. Como entregar

O formato que este projeto já usa e que funciona bem: protótipo em **HTML de alta
fidelidade**, um arquivo por tela, com os estilos inline e a lógica separada —
o mesmo padrão de `design_handoff_pedido_e_nova_arte/design/*.dc.html`.

O que ajuda muito na hora de implementar:

- **Estados, não só o estado feliz.** Lista vazia, um item, o máximo que cabe,
  nome comprido, valor ausente, sem permissão.
- **As medidas exatas** — a implementação é hifi e persegue o pixel.
- **O que acontece quando não cabe.** Esta é a pergunta que mais custou caro
  neste projeto: o palco é fixo, e todo bloco que cresce tira outro da tela.

---

## 8. Contexto técnico, para calibrar o que é barato e o que é caro

Não é para desenhar em cima disto — é para saber o que custa.

- **React 19 + TanStack Start + Vite 7 + TypeScript.** Estilos são **inline**,
  não há sistema de classes utilitário em uso nas telas v1a.
- **SQLite local** (`node:sqlite`), schema em `user_version 40`. Toda mudança de
  banco é migração versionada.
- Permissões por papel são levadas a sério: cada ação tem a sua, e a tela
  esconde o que a pessoa não pode fazer. **Todo desenho precisa de uma versão
  sem os botões.**
- Publicar = `npm run build`. O vigia serve `.output/`, então build **é**
  publicação.
