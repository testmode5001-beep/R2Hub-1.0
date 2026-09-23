# Servidor do R2 Hub — build de produção rodando em laço: se o node cair,
# sobe de novo em 5 segundos. É este arquivo que a tarefa agendada chama.
# Log em logs\servidor.log (o arquivo é reaproveitado; corte quando crescer).
$ErrorActionPreference = "Continue"

$raiz = Split-Path -Parent $PSScriptRoot   # ...\DesignHub-v2
Set-Location $raiz
# Set-Location muda só a "pasta atual" do PowerShell; os processos filhos
# herdam a do PROCESSO, que vem do logon e pode nem existir (unidade de rede
# que ainda não montou) — o cmd então morre com "não pode encontrar o caminho
# especificado" ANTES de chamar o node, e o hub amanhece fora do ar (10/08).
[Environment]::CurrentDirectory = $raiz

$env:NODE_ENV = "production"
# Caminho ABSOLUTO do banco: sem isso o servidor usa ./data/designhub.db a
# partir da pasta em que foi aberto e, se essa pasta estiver errada, ele cria
# um banco NOVO e vazio sem reclamar — o pior erro possível aqui.
$env:DESIGNHUB_DB = Join-Path $raiz "data\designhub.db"
$env:PORT = "8081"
$env:HOST = "0.0.0.0"          # escuta na rede toda, não só em localhost
$env:NITRO_PORT = "8081"
$env:NITRO_HOST = "0.0.0.0"

# O .env é lido pelo vite em desenvolvimento, mas o servidor de produção não
# sabe dele — quem carrega é este laço. Vale para SMTP, CLIENTES_DIR, etc.
$env_arquivo = Join-Path $raiz ".env"
function CarregarEnv {
  if (-not (Test-Path $env_arquivo)) { return }
  foreach ($linha in Get-Content $env_arquivo) {
    if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $chave = $Matches[1]
      $valor = $Matches[2].Trim().Trim('"').Trim("'")
      if ($valor -ne "") { Set-Item -Path "Env:$chave" -Value $valor }
    }
  }
}
CarregarEnv

$pastaLog = Join-Path $raiz "logs"
if (-not (Test-Path $pastaLog)) { New-Item -ItemType Directory $pastaLog | Out-Null }
$log = Join-Path $pastaLog "servidor.log"

# Caminho COMPLETO do node: na partida junto com o Windows o PATH do usuario
# ainda nao esta montado e "node" solto nao existe — foi assim que o hub
# amanheceu fora do ar em 07/08. Em 12/08 foi pior: a propria pasta
# AppData\Local\nodejs-portable estava inacessivel no logon (perfil de dominio
# ainda carregando), o caminho era resolvido UMA vez antes do laco e o vigia
# martelou um caminho morto por horas mesmo com o node de volta. Por isso:
# 1) o node agora mora DENTRO do projeto (runtime\node.exe), na mesma pasta
#    que ja provou estar acessivel quando o AppData nao estava; e
# 2) a resolucao roda a CADA volta do laco — se sumir, espera e acha de novo.
function AcharNode {
  foreach ($c in @(
    (Join-Path $raiz "runtime\node.exe"),
    "C:\Users\arte01.FILITEC\AppData\Local\nodejs-portable\node-v24.18.0-win-x64\node.exe"
  )) { if (Test-Path $c) { return $c } }
  $cand = Get-ChildItem "$env:LOCALAPPDATA\nodejs-portable" -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cand) { return $cand.FullName }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$entrada = Join-Path $raiz ".output\server\index.mjs"
if (-not (Test-Path $entrada)) {
  "[$(Get-Date -Format s)] .output nao existe — rode 'npm run build' antes." | Add-Content $log
  exit 1
}

# Grava no log sem NUNCA derrubar o laço: se a escrita falhar (arquivo em uso,
# pasta fora do ar), engole o erro. Um log que não escreve é um aborrecimento;
# um log que mata o servidor é um desastre — foi o que aconteceu em 11/08.
function Anotar([string]$texto) {
  try { "[$(Get-Date -Format s)] $texto" | Add-Content -Path $log -ErrorAction Stop } catch { }
}

# Saída do node vai para arquivos próprios e é anexada ao log quando ele para.
# Nada de pipeline no meio: era o `| ForEach-Object { Add-Content }` que, ao
# falhar na PRIMEIRA linha impressa pelo node, derrubava o pipeline inteiro e
# matava o servidor junto — 1 segundo de vida, sem mensagem e sem código de
# saída, que foi exatamente o sintoma de 11/08 de manhã.
$saidaOut = Join-Path $pastaLog "node-out.log"
$saidaErr = Join-Path $pastaLog "node-err.log"

# Sinal de "publiquei, reinicie": ver o laço mais abaixo.
$sinalReiniciar = Join-Path $raiz "reiniciar.txt"
Remove-Item $sinalReiniciar -Force -ErrorAction SilentlyContinue   # sobra de execução anterior

Anotar "ambiente: cwd=[$([Environment]::CurrentDirectory)] temp=[$env:TEMP] node=[$(AcharNode)] entrada=[$(Test-Path $entrada)]"

# Duas manhãs seguidas o hub passou horas fora do ar e ninguém soube até tentar
# usar. Se ele não conseguir subir 3 vezes seguidas, um arquivo aparece na Área
# de Trabalho dizendo o que fazer — é feio de propósito, para ser visto.
# A Área de Trabalho de QUEM USA a máquina, não a do processo: rodando como
# SISTEMA (tarefa de boot) o GetFolderPath devolveria a mesa do perfil de
# serviço, em C:\Windows\System32\..., que ninguém abre nunca — o aviso
# existiria e seria invisível, que é pior do que não ter aviso.
$mesaUsuario = "C:\Users\arte01.FILITEC\Desktop"
$mesa = if (Test-Path $mesaUsuario) { $mesaUsuario } else { [Environment]::GetFolderPath("Desktop") }
$avisoArq = Join-Path $mesa "HUB FORA DO AR - LEIA.txt"
$seguidas = 0

function AvisarNaMesa {
  try {
    @(
      "O R2 HUB NAO ESTA CONSEGUINDO SUBIR.",
      "",
      "Tentou $script:seguidas vezes seguidas e nao ficou de pe.",
      "Ultima falha: $(Get-Date -Format 'dd/MM/yyyy HH:mm')",
      "",
      "O QUE FAZER:",
      "1) Abra a pasta do projeto e rode scripts\iniciar-hub.vbs (dois cliques).",
      "2) Se nao resolver, o motivo esta em logs\servidor.log - as linhas",
      "   'FALHA AO INICIAR O NODE' e 'ambiente:' dizem o que faltou.",
      "",
      "Este arquivo some sozinho quando o hub voltar."
    ) | Set-Content -Path $avisoArq -Encoding utf8 -ErrorAction Stop
  } catch { }
}

while ($true) {
  # O .env também é relido a CADA volta: preencher o SMTP e reiniciar pelo
  # reiniciar.txt tem de valer. Lido só na partida, a senha nova ficaria de
  # fora e o e-mail continuaria sem sair, sem explicação na tela.
  CarregarEnv

  # Resolve o node AGORA, não na partida: em 12/08 o AppData estava fora do ar
  # no logon e o caminho resolvido uma vez ficou morto para sempre.
  $node = AcharNode
  if (-not $node) {
    Anotar "NODE NAO ENCONTRADO em lugar nenhum — tento de novo em 15s"
    $seguidas++
    if ($seguidas -ge 3) { AvisarNaMesa }
    Start-Sleep -Seconds 15
    continue
  }

  # HTTPS (443/80) + redirecionador do 8082 antigo — o proxy sai sozinho se a
  # porta já estiver ocupada por uma cópia anterior, então tentar a CADA volta
  # não faz mal e ressuscita o proxy se ele tiver morrido.
  try {
    Start-Process -FilePath $node -ArgumentList "`"$raiz\scripts\https-proxy.mjs`"" -WorkingDirectory $raiz -WindowStyle Hidden -ErrorAction Stop
  } catch { Anotar "falha ao subir o proxy https: $($_.Exception.Message)" }

  Anotar "subindo o R2 Hub em http://0.0.0.0:8081 (node: $node)"
  $inicio = Get-Date
  $codigo = "?"
  try {
    $p = Start-Process -FilePath $node -ArgumentList "`"$entrada`"" -WorkingDirectory $raiz `
      -RedirectStandardOutput $saidaOut -RedirectStandardError $saidaErr `
      -WindowStyle Hidden -PassThru -ErrorAction Stop
    # 25s de pé = subiu de verdade: zera o contador e tira o aviso da Área de
    # Trabalho AGORA (antes ele só saía quando o node PARAVA, então o aviso
    # ficava lá assustando todo mundo com o hub funcionando).
    Wait-Process -Id $p.Id -Timeout 25 -ErrorAction SilentlyContinue
    if (-not $p.HasExited) {
      $seguidas = 0
      if (Test-Path $avisoArq) { Remove-Item $avisoArq -Force -ErrorAction SilentlyContinue }
      # Espera em passos curtos em vez de bloquear de vez, para poder atender
      # o pedido de reinício: rodando como SISTEMA, ninguém sem privilégio de
      # administrador consegue derrubar o node — e publicar uma versão nova
      # passaria a exigir elevação toda vez. Quem puder ESCREVER na pasta do
      # projeto cria o arquivo `reiniciar.txt` e o vigia faz o resto.
      while (-not $p.HasExited) {
        Wait-Process -Id $p.Id -Timeout 5 -ErrorAction SilentlyContinue
        if (Test-Path $sinalReiniciar) {
          Remove-Item $sinalReiniciar -Force -ErrorAction SilentlyContinue
          Anotar "pedido de reinicio recebido (publicacao nova) — derrubando o node"
          try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch { }
          break
        }
      }
    }
    $codigo = $p.ExitCode
  } catch {
    # AQUI morava o diagnóstico que se perdia: o erro do PowerShell ao iniciar
    # o processo não passa pelo 2>&1 do comando nativo.
    Anotar "FALHA AO INICIAR O NODE: $($_.Exception.Message)"
  }
  foreach ($arq in @($saidaOut, $saidaErr)) {
    try {
      if ((Test-Path $arq) -and (Get-Item $arq).Length -gt 0) {
        Get-Content $arq -ErrorAction Stop | ForEach-Object { Anotar "  node| $_" }
        Clear-Content $arq -ErrorAction SilentlyContinue
      }
    } catch { }
  }
  Anotar "o node parou (codigo $codigo) — volta em 5s"

  # subiu e ficou de pé por um tempo = vida normal; morrer em segundos = não subiu
  if (((Get-Date) - $inicio).TotalSeconds -lt 20) { $seguidas++ } else { $seguidas = 0 }
  if ($seguidas -ge 3) { AvisarNaMesa }
  if ($seguidas -eq 0 -and (Test-Path $avisoArq)) { Remove-Item $avisoArq -Force -ErrorAction SilentlyContinue }

  Start-Sleep -Seconds 5
}
