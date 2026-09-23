# Rotas antigas (interface V3) — fora do ar, guardadas aqui

Estas telas foram substituídas pela interface v1a em `/hub` (04/08/2026).
Nada foi apagado: os arquivos só saíram de `src/routes/`, então o TanStack
deixa de gerar as rotas e o TypeScript deixa de compilá-los.

| Arquivo          | URL que ele servia | Substituto no /hub                    |
|------------------|--------------------|---------------------------------------|
| `app.tsx`        | `/app`             | `/hub?tela=central` (e as demais abas) |
| `home.tsx`       | `/home`            | `/hub?tela=home`                       |
| `usuarios.tsx`   | `/usuarios`        | `/hub?tela=equipe`                     |
| `pedido.$id.tsx` | `/pedido/<id>`     | `/hub?tela=pedidos&pedido=<id>` (a modal do pedido) |

`/pedido/<id>` continua funcionando: no lugar do arquivo antigo ficou um
redirecionamento (`src/routes/_authenticated/pedido.$id.tsx`), para os links
guardados nas notificações antigas não quebrarem.

## Para voltar atrás

Mova o arquivo de volta para `src/routes/_authenticated/` e reinicie o servidor
de desenvolvimento — a árvore de rotas é gerada de novo sozinha. Se voltar o
`pedido.$id.tsx`, apague antes o redirecionamento que está no lugar dele.

A rota `preview-v3.tsx` (preview sem login, usada para validar o desenho das
telas) também está aqui. Com ela fora, **todas** as páginas exigem login.

Os componentes que só estas telas usavam estão em `componentes/`: `PaginaHub`,
`MenuCapa`, `NotificationBell`, `Logo`, `ClichesTab`, `FacasTab`,
`ApontamentosTab` e a pasta `v3/` (HubV3 e CentralV3). Para reativar uma tela
antiga, devolva também os componentes que ela importa.

`componentes/ui/` são os 45 componentes do shadcn. Nenhuma tela v1a usa (elas
são escritas com estilo inline), e o `components.json` na raiz continua
configurado — `npx shadcn add <nome>` regera qualquer um deles em
`src/components/ui/` quando precisar.
