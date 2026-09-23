# Para o servidor do R2 Hub: primeiro o laço (senão ele levanta o node de
# novo em 5 segundos) e depois o node.
$laco = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like "*servidor.ps1*" }
foreach ($p in $laco) { Stop-Process -Id $p.ProcessId -Force; Write-Host "laco $($p.ProcessId) parado" }

Start-Sleep -Seconds 1

$node = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*server\index.mjs*" -or $_.CommandLine -like "*https-proxy.mjs*" }
foreach ($p in $node) { Stop-Process -Id $p.ProcessId -Force; Write-Host "node $($p.ProcessId) parado" }

Start-Sleep -Seconds 2
$aberta = netstat -ano | Select-String "LISTENING" | Select-String ":8081"
if ($aberta) { Write-Host "ainda tem algo na porta 8081:`n$aberta" } else { Write-Host "R2 Hub parado (porta 8081 livre)." }
