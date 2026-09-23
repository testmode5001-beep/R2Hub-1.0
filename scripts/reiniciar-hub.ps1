# Reinicia o R2 Hub (tarefa "R2 Hub", que roda como SISTEMA).
# Chamado pelo REINICIAR-HUB.bat, que cuida da elevacao.
$ErrorActionPreference = "Continue"

$souAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $souAdmin) {
  Write-Host "  Precisa de administrador. Use o REINICIAR-HUB.bat." -ForegroundColor Yellow
  Read-Host "  Enter para fechar"; exit 1
}

Write-Host ""
Write-Host "  R2 HUB - REINICIAR" -ForegroundColor Yellow
Write-Host "  ------------------"
Write-Host ""

Write-Host "  1/3  Parando..."
schtasks /end /tn "R2 Hub" | Out-Null

# O /end derruba o vigia, mas o node pode ficar orfao segurando a porta 8081 —
# e ai o vigia novo sobe, nao consegue abrir a porta e morre em laco.
Start-Sleep -Seconds 2
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*index.mjs*" -or $_.CommandLine -like "*https-proxy*" } |
  ForEach-Object {
    Write-Host "       derrubando node orfao (PID $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
Start-Sleep -Seconds 2

Write-Host "  2/3  Subindo de novo..."
schtasks /run /tn "R2 Hub" | Out-Null

Write-Host "  3/3  Esperando o hub responder..."
$ok = $false
$fim = (Get-Date).AddSeconds(90)
while (-not $ok -and (Get-Date) -lt $fim) {
  Start-Sleep -Seconds 3
  try { $ok = (Invoke-WebRequest -Uri "http://127.0.0.1:8081" -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200 } catch { }
}

Write-Host ""
if ($ok) {
  Write-Host "  PRONTO - o hub esta no ar com a versao nova." -ForegroundColor Green
  Write-Host "  Quem estiver com a pagina aberta vai ver o aviso de atualizar."
} else {
  Write-Host "  O hub nao respondeu em 90s." -ForegroundColor Red
  Write-Host "  Veja logs\servidor.log - as linhas 'ambiente:' e 'FALHA AO INICIAR'."
}
Write-Host ""
Read-Host "  Enter para fechar"
