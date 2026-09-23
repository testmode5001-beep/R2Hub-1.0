# Design Hub V3 — Instalação e Operação

A V3 roda **100% na infraestrutura da empresa**: sem Supabase, sem Vercel.

| Componente | V2 (antes) | V3 (agora) |
|---|---|---|
| Hospedagem | Vercel | Servidor Windows da empresa (Node.js) |
| Banco de dados | Supabase Postgres | SQLite embutido (arquivo local, `node:sqlite`) |
| Login | Supabase Auth (e-mail) | Usuário/senha criados pelo gestor (scrypt + sessões) |
| Arquivos | Bucket Supabase Storage | `\\server\Arte\Clientes` (pasta única por cliente) |
| Notificações | Web Push via Vercel | Sino + toasts internos (polling no servidor local) |
| Permissões | RLS no Postgres | Permissões por cargo, editáveis no painel |

## Requisitos

- **Node.js 22 LTS ou superior** (única dependência de máquina — o banco usa o
  `node:sqlite` embutido; não é preciso instalar PostgreSQL nem Docker).
- Acesso de leitura/escrita ao compartilhamento `\\server\Arte\Clientes`
  pela conta que executa o serviço.

## Desenvolvimento (estação de trabalho)

```powershell
npm install
npm run dev
```

- Login inicial: **admin / r2hub2026** → troque a senha no painel imediatamente.
- Sem `CLIENTES_DIR` definido, os arquivos vão para `./dev-data/Clientes`
  (pasta local de teste — não mexe na rede real).
- O banco fica em `./data/designhub.db`.

## Produção (servidor Windows)

1. Instalar Node.js LTS no servidor.
2. Clonar o repositório e rodar:

```powershell
npm install
npm run build
```

   O build usa `NITRO_PRESET=node-server` e gera a aplicação em
   `.output/`. Para iniciar: `node .output\server\index.mjs`.

3. Definir variáveis de ambiente do serviço:

```
NODE_ENV=production
CLIENTES_DIR=\\server\Arte\Clientes
DESIGNHUB_DB=C:\DesignHub\data\designhub.db
PORT=3000

# Vídeos de fundo da capa (opcional — este é o padrão embutido)
HOME_VIDEOS_DIR=\\server\Arte\Clientes\Modelos\Design\R2 Hub\Videos
# Pasta pública onde o vídeo escolhido é copiado. Padrão: <app>\.output\public.
# Aponte para uma pasta FORA do .output se quiser que o fundo sobreviva a um novo
# build (o build recria o .output e apagaria o home-bg.mp4).
# HOME_BG_DIR=C:\DesignHub\public-runtime

# E-mail das solicitações de clichê (SMTP da empresa)
SMTP_HOST=smtp.r2etiquetas.com.br
SMTP_PORT=587
SMTP_USER=hub@r2etiquetas.com.br
SMTP_PASS=senha-do-email
SMTP_FROM=R2 Hub <hub@r2etiquetas.com.br>
CLICHE_EMAIL_TO=contato@clicheria.com.br
```

> Sem as variáveis SMTP, a solicitação de clichê é registrada e os anexos são
> salvos em `\\server\Arte\Clientes\_Solicitações de Clichê\`, mas o e-mail não
> sai — o sistema avisa na tela.

4. Registrar como serviço do Windows (recomendado: [NSSM](https://nssm.cc)):

```powershell
nssm install DesignHub "C:\Program Files\nodejs\node.exe" "C:\DesignHub\app\.output\server\index.mjs"
nssm set DesignHub AppDirectory C:\DesignHub\app
nssm set DesignHub AppEnvironmentExtra NODE_ENV=production CLIENTES_DIR=\\server\Arte\Clientes DESIGNHUB_DB=C:\DesignHub\data\designhub.db PORT=3000
nssm set DesignHub ObjectName ".\ContaDeServico" "senha"   # conta com acesso ao share
nssm start DesignHub
```

5. Acesso das estações: `http://NOME-DO-SERVIDOR:3000`.

> **Importante:** a conta que roda o serviço precisa de permissão NTFS/share em
> `\\server\Arte\Clientes`. Conta LocalSystem normalmente NÃO tem acesso a rede —
> use uma conta de domínio dedicada.

## Notificações na área de trabalho (aba em segundo plano)

O sino avisa por toast na tela, contador no título da aba, bip sonoro e
**notificação do Windows** quando a aba do Hub não está em foco. O usuário ativa
no próprio sino ("Ativar avisos na área de trabalho").

Atenção: navegadores só liberam a API de notificação em origens seguras
(HTTPS ou localhost). Como o Hub roda em `http://servidor:3000` na rede interna,
habilite via GPO a política do Edge/Chrome:

- **OverrideSecurityRestrictionsOnInsecureOrigin** → adicionar `http://NOME-DO-SERVIDOR:3000`

(Modelos Administrativos → Microsoft Edge → "Substituir restrições de segurança
na origem insegura".) Alternativa: publicar o Hub com certificado HTTPS interno.

Obs.: em abas em segundo plano há um atraso de até ~1 minuto (limitação de
temporizadores dos navegadores); o aviso do Windows chega mesmo assim.

## Botão "Abrir Pasta do Cliente"

Navegadores bloqueiam links `file://` por padrão. Duas opções (o sistema já
oferece o botão **Copiar caminho** como alternativa universal):

- **Edge (recomendado em rede corporativa):** habilitar a política de grupo
  `IntranetFileLinksEnabled` (GPO: Modelos Administrativos → Microsoft Edge →
  "Permitir que links de URL de arquivo de sites da intranet sejam abertos").
  Com ela, o clique abre o Explorer direto na pasta do cliente.
- **Sem GPO:** o usuário clica em "Copiar caminho" e cola no Explorer (Win+E → colar).

## Backup

O banco é um único arquivo (`designhub.db` + auxiliares `-wal`/`-shm`).
Backup = parar o serviço (ou usar cópia noturna) e copiar a pasta `data\` —
pode entrar na rotina de backup que já cobre o servidor de arquivos.

## Cargos e permissões

- **Administrador** — acesso total (fixo).
- **Gestor / Designer / Comercial** — permissões editáveis na aba
  *Usuários → Permissões*. Auditoria completa na aba *Auditoria*
  (login, criação/edição de usuários, pastas criadas, uploads, mudanças de status).

## Pendências conhecidas

1. **Migração dos dados da V2 (Supabase):** os pedidos/anexos do projeto
   `qnxctwrxpimklbdldhoy` ainda não foram importados. É preciso a service role key
   do Supabase para exportar; como o sistema está em fase de testes, avaliar se
   vale importar ou começar do zero.
2. **Fontes e ícones via CDN:** o app ainda carrega Google Fonts e Tabler Icons
   da internet. Funciona se as estações tiverem acesso à web; para operação
   100% offline, baixar os arquivos e servir localmente (tarefa simples, ~30 min).
3. **`node:sqlite` emite aviso "experimental"** no Node 22 — inofensivo; no
   Node 24 LTS o módulo é estável. A camada de banco está isolada em
   `src/server/db.server.ts` caso se deseje trocar para PostgreSQL no futuro.
4. **Abrir a pasta no Explorador com um clique (protocolo `r2hub://`):** a tela
   *Clientes* mostra a pasta da rede e copia o caminho, mas não consegue ABRIR o
   Explorador — o navegador bloqueia `file://` vindo de página web
   (`Not allowed to load local resource`), e isso não é configurável: é trava do
   Chromium, não política do Edge. O único caminho é registrar um protocolo
   próprio em cada máquina da equipe:

   - uma chave em `HKEY_CLASSES_ROOT\r2hub` apontando para um `.cmd`/`.exe` que
     recebe o caminho e chama `explorer.exe`;
   - distribuir isso nas estações (script de logon, GPO ou instalação manual),
     junto com o instalador do certificado que já existe em `scripts/`;
   - a tela então troca o "Copiar caminho" por um link `r2hub://<caminho>`,
     mantendo a cópia como alternativa para quem não tiver o protocolo.

   **Decisão pendente do Augusto** (mexe no registro de cada computador). Sem
   isso, o fluxo atual funciona: copiar o caminho e colar no Explorador
   (Ctrl+L, Ctrl+V, Enter).
