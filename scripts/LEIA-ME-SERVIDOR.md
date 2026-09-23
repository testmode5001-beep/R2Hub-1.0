# R2 Hub rodando sozinho nesta máquina

O hub é um site servido por esta máquina para a rede da empresa. Quem usa só
abre o endereço no navegador — não instala nada.

**Endereço:** `http://192.168.0.145:8081`
**Celular (leitura de OP):** `http://192.168.0.145:8081/op`

> Se o IP da máquina mudar, o endereço muda junto. Peça ao TI para fixar o IP
> (reserva no roteador) antes de espalhar o endereço para a equipe.

## Como está montado

- O que roda é o **build de produção** (pasta `.output`), não o servidor de
  desenvolvimento. É mais rápido e não depende de nenhum programa aberto.
- Quem sobe o servidor é o `scripts\servidor.ps1`, que roda **em laço**: se o
  node cair, ele volta em 5 segundos (testado derrubando o processo de
  propósito).
- A partida automática está na **pasta Inicializar do Windows** (`R2 Hub.vbs`,
  cópia do `scripts\iniciar-hub.vbs`) — o hub sobe sozinho quando alguém entra
  nesta conta do Windows. Foi o jeito possível: esta máquina **nega criação de
  tarefa agendada** para usuário comum ("Acesso negado").
- O banco continua sendo o arquivo `data\designhub.db` (o mesmo de sempre).
- Log em `logs\servidor.log`.

**Não mova nem renomeie a pasta do projeto** — o arquivo da pasta Inicializar
aponta para este caminho. Se precisar mover, rode o instalador de novo.

## O passo que falta (precisa de administrador)

Do jeito atual, se o computador reiniciar e ninguém entrar na conta, o hub
**não sobe**. Para virar servidor de verdade, abra o PowerShell com o botão
direito > "Executar como administrador" e rode uma vez:

```powershell
& "C:\Users\arte01.FILITEC\Desktop\R2 Hub\DesignHub-v2\scripts\instalar-servico-admin.ps1"
```

Isso troca a partida pela pasta Inicializar por uma tarefa que sobe no **boot**,
como SISTEMA (funciona com o computador na tela de login), e libera a porta 8081
no firewall.

## Comandos do dia a dia

Parar:

```powershell
& ".\scripts\parar-hub.ps1"
```

Subir:

```powershell
wscript.exe ".\scripts\iniciar-hub.vbs"
```

Ver se está no ar:

```powershell
(Invoke-WebRequest http://localhost:8081 -UseBasicParsing).StatusCode
```

Ver o fim do log:

```powershell
Get-Content .\logs\servidor.log -Tail 30
```

## Depois de mexer no código

O build de produção é uma foto do código. Mudou alguma coisa, precisa refazer:

```powershell
npm run build
```

E depois parar e subir de novo (os dois comandos acima).

## Backup

O banco inteiro é um arquivo. Backup = copiar `data\designhub.db` (com o
servidor parado, ou copiando também o `-wal`). Vale agendar uma cópia diária
para outra máquina ou para a nuvem da empresa.

## Desenvolvimento

O servidor de desenvolvimento (`npx vite dev`) agora usa a **porta 8082**, para
não brigar com o hub de produção na 8081.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `servidor.ps1` | o laço que mantém o node de pé (é o coração) |
| `iniciar-hub.vbs` | sobe o laço sem abrir janela; é a cópia dele que fica na pasta Inicializar |
| `parar-hub.ps1` | derruba laço + node |
| `instalar-servico.ps1` | instala a partida automática (tenta tarefa agendada, cai na pasta Inicializar) |
| `instalar-servico-admin.ps1` | o passo com administrador: boot + firewall |
