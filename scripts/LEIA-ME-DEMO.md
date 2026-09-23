# Demonstração — um mês de operação fictícia

Para apresentar o Hub com o sistema "vivo": 57 pedidos espalhados pelos últimos
30 dias, clichês, afiação, leituras, produção e avisos. Nenhum dado real foi
alterado — tudo é inserção, e há desfazer.

## Carregar

```bash
node scripts/seed-demo.mjs
```

Popula o banco (`data/designhub.db`): clientes, pedidos em todos os estágios do
fluxo, histórico e comentários coerentes com as datas, clichês registrados com
valores, solicitações à clicheria, facas na afiação, fila de leituras de OP,
notificações e anotações do dia, cadastros da equipe.

Depois, **no navegador em que a apresentação vai rodar**, abra:

```
http://localhost:8081/demo-local.html
```

e clique em *Carregar demonstração*. Isso preenche o que o Hub guarda no próprio
navegador (não no servidor): máquinas rodando na Fábrica, 90 apontamentos de
produção do mês e as faltas de matéria-prima do Estoque.

## Desfazer

```bash
node scripts/limpar-demo.mjs
```

Remove exatamente o que o seed inseriu (rastro na tabela `demo_seed`). O estado
do navegador sai pelo botão *limpar* da mesma página `demo-local.html`.

Se algo sair do lugar, o banco anterior está inteiro em
`data/designhub.db.backup-antes-demo` — basta parar o servidor e copiar por cima
de `data/designhub.db`.

## Roteiro sugerido de apresentação

1. **Home** — saudação, tarefas do dia, atalhos personalizáveis, papel de parede.
2. **Central** — calendário com entregas, clichês por estágio, finalizados.
3. **Pedidos** — fila de produção, filtros por status/origem, medidas mais pedidas.
4. **Aprovação** — chegadas da arte, responder cliente, prova enviada, clichê chegou.
5. **Fábrica** — duas máquinas rodando com cronômetro e custo por hora.
6. **Leitura no celular** — `/m/leitura`: foto da OP → OCR → cai na fila da Fábrica.
7. **Apontamentos** — o mês inteiro em números: pedidos, R$ de clichê, ferramental,
   metros produzidos.
8. **Facas / Afiação** — catálogo com os desenhos reais em PDF e o ciclo de afiação.
9. **Equipe** — as 69 permissões por pessoa.

## Observações

- Os números foram sorteados com semente fixa: rodar o seed de novo em um banco
  limpo produz o mesmo mês.
- Os pedidos de teste antigos (`Teste 01`, `teste 04`, `TESTE MIGRACAO`) foram
  removidos para não aparecerem na apresentação.
