@echo off
REM Dois cliques aqui faz o R2 Hub passar a subir junto com o Windows.
REM Pede a elevacao sozinho (aparece a janela azul do Windows perguntando
REM se pode alterar o computador - responda SIM), assim ninguem precisa
REM lembrar de "clicar com o botao direito > executar como administrador".
title R2 Hub - subir junto com o Windows
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0instalar-servico-admin.ps1\"'"
