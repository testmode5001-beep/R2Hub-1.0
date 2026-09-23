@echo off
REM Reinicia o R2 Hub. Use depois de publicar uma versao nova.
REM Pede elevacao sozinho (responda SIM na janela azul do Windows), porque o
REM hub roda como SISTEMA desde que passou a subir no boot.
REM
REM A primeira versao deste arquivo tentava passar o comando inteiro na linha
REM do Start-Process, com aspas dentro de aspas dentro de aspas - o cmd comia
REM as aspas e nada acontecia, sem nem dar erro. Agora chama um .ps1 de
REM verdade, no mesmo formato do instalador (que funcionou).
title R2 Hub - reiniciar
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%~dp0reiniciar-hub.ps1\"'"
