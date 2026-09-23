# Roda UMA vez em cada computador da equipe (NÃO precisa de administrador).
#
# Instala o certificado "R2 Hub CA" no Windows para o navegador confiar no
# endereço https do hub — sem isso aparece "site inseguro" e o Windows não
# deixa o hub avisar na bandeja.
#
# Chamado pelo INSTALAR-CERTIFICADO.bat (dois cliques) na mesma pasta.
$ErrorActionPreference = "Stop"

$HUB_IP   = "192.168.0.145"
$HUB_HTTP = "http://$HUB_IP:8081"

Write-Host ""
Write-Host "  R2 HUB - CERTIFICADO DE SEGURANCA" -ForegroundColor Yellow
Write-Host "  ---------------------------------"
Write-Host ""

# 1) Acha o certificado: na pasta do projeto, nos Downloads, ou baixa do hub.
$destinoTmp = Join-Path $env:TEMP "r2hub-ca.crt"
$candidatos = @(
  (Join-Path $PSScriptRoot "certs\ca.crt"),        # cópia no share (pasta "Instalar no meu PC")
  (Join-Path $PSScriptRoot "..\certs\ca.crt"),     # projeto, nesta máquina
  (Join-Path $env:USERPROFILE "Downloads\r2hub-ca.crt")
)
$cert = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cert) {
  Write-Host "  Baixando o certificado do hub..." -NoNewline
  try {
    Invoke-WebRequest -Uri "$HUB_HTTP/r2hub-ca.crt" -OutFile $destinoTmp -UseBasicParsing -TimeoutSec 15
    $cert = $destinoTmp
    Write-Host " ok"
  } catch {
    Write-Host " FALHOU" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Nao consegui falar com o hub em $HUB_HTTP" -ForegroundColor Red
    Write-Host "  Confira se este computador esta na rede da empresa."
    Read-Host "  Enter para fechar"
    exit 1
  }
}

# 2) Instala no repositório do USUÁRIO (sem administrador). O Windows mostra
#    uma janela de confirmação de segurança — é esperado, clique em SIM.
Write-Host "  Instalando... (se o Windows perguntar, clique em SIM)"
Write-Host ""
certutil -user -addstore Root "$cert" | Out-Null

# 3) Confere de verdade, em vez de só dizer "pronto".
$instalado = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like "*R2 Hub*" -or $_.Issuer -like "*R2 Hub*" }
Write-Host ""
if ($instalado) {
  Write-Host "  PRONTO - certificado instalado." -ForegroundColor Green
  Write-Host "  Vale ate: $($instalado[0].NotAfter.ToString('dd/MM/yyyy'))"
  Write-Host ""
  Write-Host "  AGORA:" -ForegroundColor Yellow
  Write-Host "   1) Feche o navegador INTEIRO e abra de novo."
  Write-Host "   2) Entre pelo endereco novo:  https://$HUB_IP"
  Write-Host "   3) No hub: engrenagem (Preferencias) > 'Ativar avisos do Windows'."
  Write-Host ""
  Write-Host "  Guarde o endereco https nos favoritos e apague o antigo."
} else {
  Write-Host "  NAO CONFIRMEI a instalacao." -ForegroundColor Red
  Write-Host "  Se apareceu a janela de seguranca e voce clicou em NAO, rode de novo e clique em SIM."
}
Write-Host ""
Read-Host "  Enter para fechar"
