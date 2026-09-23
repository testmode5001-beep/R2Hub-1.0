# Faz o R2 Hub subir junto com o WINDOWS, sem precisar de ninguem logado.
# Roda UMA vez, num PowerShell aberto "como administrador".
#
# Hoje o hub sobe pelo atalho na pasta Inicializar, o que exige que alguem
# faca login nesta maquina. Este script troca isso por uma tarefa de BOOT.
#
# O CUIDADO IMPORTANTE: a tarefa roda como SISTEMA, e o SISTEMA se apresenta
# na rede como a CONTA DO COMPUTADOR (FILITEC\DESKTOP-...$), nao como voce.
# Se o compartilhamento \\server\Arte nao aceitar essa conta, o hub sobe mas
# NAO consegue gravar anexo nenhum - falha silenciosa, a pior de todas.
# Por isso o script TESTA primeiro e so instala se o teste passar.
$ErrorActionPreference = "Stop"

$souAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $souAdmin) {
  Write-Host ""
  Write-Host "  Abra o PowerShell com o botao direito > 'Executar como administrador'" -ForegroundColor Yellow
  Write-Host "  e rode este script de novo." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

$raiz    = Split-Path -Parent $PSScriptRoot
$script  = Join-Path $raiz "scripts\servidor.ps1"
$entrada = Join-Path $raiz ".output\server\index.mjs"
$nome    = "R2 Hub"
$share   = "\\server\Arte\Clientes"

Write-Host ""
Write-Host "  R2 HUB - SUBIR JUNTO COM O WINDOWS" -ForegroundColor Yellow
Write-Host "  ----------------------------------"
Write-Host ""

# ————— conferencias basicas antes de mexer em qualquer coisa —————
if (-not (Test-Path $script))  { Write-Host "  Nao achei $script" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $entrada)) { Write-Host "  Falta o build: rode 'npm run build' antes." -ForegroundColor Red; exit 1 }

# ————— TESTE: o SISTEMA enxerga e grava no compartilhamento? —————
Write-Host "  1/4  Testando se a conta SISTEMA grava na pasta da rede..."

$marcador = Join-Path $env:TEMP "r2hub-teste-sistema.txt"
Remove-Item $marcador -Force -ErrorAction SilentlyContinue

# roda um teste curto COMO SISTEMA e guarda o resultado num arquivo
$teste = @"
`$r = @()
try {
  `$arq = Join-Path '$share' ('_teste-sistema-' + [Guid]::NewGuid().ToString('N').Substring(0,8) + '.tmp')
  Set-Content -Path `$arq -Value 'teste do R2 Hub' -ErrorAction Stop
  Remove-Item `$arq -Force -ErrorAction SilentlyContinue
  `$r += 'SHARE=OK'
} catch { `$r += 'SHARE=FALHOU: ' + `$_.Exception.Message }
try {
  `$l = Join-Path '$raiz' 'logs\_teste-sistema.tmp'
  Set-Content -Path `$l -Value 'ok' -ErrorAction Stop
  Remove-Item `$l -Force -ErrorAction SilentlyContinue
  `$r += 'PROJETO=OK'
} catch { `$r += 'PROJETO=FALHOU: ' + `$_.Exception.Message }
`$r += 'QUEM=' + [Security.Principal.WindowsIdentity]::GetCurrent().Name
`$r | Set-Content -Path '$marcador'
"@
$arqTeste = Join-Path $env:TEMP "r2hub-teste-sistema.ps1"
Set-Content -Path $arqTeste -Value $teste -Encoding UTF8

$tarefaTeste = "R2 Hub - teste temporario"
$acaoT = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$arqTeste`""
$comoSistema = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $tarefaTeste -Action $acaoT -Principal $comoSistema -Force | Out-Null
Start-ScheduledTask -TaskName $tarefaTeste
$fim = (Get-Date).AddSeconds(45)
while (-not (Test-Path $marcador) -and (Get-Date) -lt $fim) { Start-Sleep -Milliseconds 500 }
Unregister-ScheduledTask -TaskName $tarefaTeste -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item $arqTeste -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $marcador)) {
  Write-Host "       o teste nao respondeu a tempo." -ForegroundColor Red
  Write-Host "       Nada foi alterado. Tente de novo ou fale com o suporte."
  Read-Host "  Enter para fechar"; exit 1
}
$resultado = Get-Content $marcador
Remove-Item $marcador -Force -ErrorAction SilentlyContinue
$resultado | ForEach-Object { Write-Host "       $_" }

# ATENÇÃO ao mexer aqui: `$resultado -notmatch "..."` NÃO devolve verdadeiro/
# falso quando $resultado é uma LISTA — devolve os itens que não casam, e uma
# lista não-vazia é lida como verdadeiro. Foi assim que a primeira versão
# abortou justamente quando o teste tinha PASSADO. Compare item a item.
$shareOk = @($resultado | Where-Object { $_ -eq "SHARE=OK" }).Count -gt 0
if (-not $shareOk) {
  Write-Host ""
  Write-Host "  PAREI AQUI - nada foi alterado." -ForegroundColor Red
  Write-Host ""
  Write-Host "  A conta SISTEMA nao consegue gravar em $share." -ForegroundColor Yellow
  Write-Host "  Se eu instalasse assim, o hub subiria no boot mas NENHUM anexo"
  Write-Host "  seria salvo - e ninguem perceberia."
  Write-Host ""
  Write-Host "  DUAS SAIDAS (escolha uma, com o TI):"
  Write-Host "   a) Pedir ao TI para liberar a conta do computador"
  Write-Host "      '$env:USERDOMAIN\$env:COMPUTERNAME`$' no compartilhamento; depois rode este script de novo."
  Write-Host "   b) Deixar a tarefa rodando com uma CONTA DE DOMINIO em vez de SISTEMA:"
  Write-Host "      abra o Agendador de Tarefas, crie a tarefa 'R2 Hub' apontando para"
  Write-Host "      $script, gatilho 'Ao iniciar o computador', e marque"
  Write-Host "      'Executar estando o usuario conectado ou nao' - o Windows vai pedir"
  Write-Host "      a senha da conta (digite voce mesmo; eu nao guardo senha)."
  Write-Host ""
  Read-Host "  Enter para fechar"; exit 1
}

# ————— tarefa de boot —————
Write-Host "  2/4  Criando a tarefa que sobe no boot..."
$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -AtStartup
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config `
  -Principal $comoSistema -Description "Servidor do R2 Hub (portas 80/443/8081)" -Force | Out-Null

# ————— tira o atalho do login para nao subir DOIS hubs —————
# Com a tarefa de boot ativa, o atalho da pasta Inicializar levantaria uma
# segunda copia ao fazer login; ela brigaria pela porta 8081 e morreria em
# loop, poluindo o log. Renomeia (nao apaga) para dar para voltar atras.
Write-Host "  3/4  Desativando o atalho antigo da pasta Inicializar..."
$inicializar = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\R2 Hub.vbs"
if (Test-Path $inicializar) {
  Move-Item $inicializar "$inicializar.desativado-pela-tarefa" -Force
  Write-Host "       atalho renomeado (da para voltar atras se precisar)"
} else {
  Write-Host "       nao havia atalho - ok"
}

# ————— firewall + subida —————
Write-Host "  4/4  Liberando as portas no firewall e subindo..."
if (-not (Get-NetFirewallRule -DisplayName "R2 Hub 8081" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "R2 Hub 8081" -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort 80,443,8081 -Profile Private,Domain | Out-Null
}

# derruba a copia que estiver rodando pelo atalho antigo, para a tarefa assumir
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*index.mjs*" -or $_.CommandLine -like "*https-proxy*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*servidor.ps1*" -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Start-ScheduledTask -TaskName $nome

# ————— confere que voltou mesmo —————
$ok = $false
$fim = (Get-Date).AddSeconds(60)
while (-not $ok -and (Get-Date) -lt $fim) {
  Start-Sleep -Seconds 3
  try { $ok = (Invoke-WebRequest -Uri "http://127.0.0.1:8081" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { }
}

Write-Host ""
if ($ok) {
  Write-Host "  PRONTO - o R2 Hub agora sobe junto com o Windows." -ForegroundColor Green
  Write-Host "  Nao precisa mais de ninguem logado nesta maquina."
  Write-Host ""
  Write-Host "  Para conferir de verdade: reinicie o computador SEM fazer login"
  Write-Host "  e abra o hub de outra maquina."
} else {
  Write-Host "  A tarefa foi criada, mas o hub nao respondeu em 60s." -ForegroundColor Red
  Write-Host "  Veja logs\servidor.log - as linhas 'ambiente:' e 'FALHA AO INICIAR'."
  Write-Host "  Para voltar ao jeito antigo: renomeie de volta o arquivo"
  Write-Host "  '$inicializar.desativado-pela-tarefa' tirando o final."
}
Write-Host ""
Read-Host "  Enter para fechar"
