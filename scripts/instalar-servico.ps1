# Instala o R2 Hub como tarefa do Windows que sobe SOZINHA ao entrar na conta.
# Não precisa de administrador e não pede senha nenhuma.
#
# Para o hub subir no BOOT (sem ninguém logar), rode em seguida o
# instalar-servico-admin.ps1 num PowerShell "como administrador".
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$script = Join-Path $raiz "scripts\servidor.ps1"
$nome = "R2 Hub"

$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $raiz

$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew

$viaTarefa = $true
try {
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config `
    -Description "Servidor do R2 Hub (porta 8081) - build de producao" -Force -ErrorAction Stop | Out-Null
  Start-ScheduledTask -TaskName $nome
} catch {
  # Esta máquina nega criação de tarefa agendada para usuário comum ("Acesso
  # negado"). Plano B sem administrador: a pasta Inicializar do Windows.
  $viaTarefa = $false
  $vbs = Join-Path $raiz "scripts\iniciar-hub.vbs"
  $inicio = [Environment]::GetFolderPath("Startup")
  Copy-Item $vbs (Join-Path $inicio "R2 Hub.vbs") -Force
  Write-Host "Sem permissao para tarefa agendada — usando a pasta Inicializar."
  & wscript.exe $vbs
}
Start-Sleep -Seconds 10

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" } |
  Select-Object -First 1).IPAddress
if ($viaTarefa) { Write-Host "Tarefa '$nome' criada e iniciada." }
else { Write-Host "R2 Hub instalado na pasta Inicializar e ja rodando." }
Write-Host ("Endereco: http://" + $ip + ":8081")
