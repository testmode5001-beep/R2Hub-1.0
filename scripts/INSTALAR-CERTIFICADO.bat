@echo off
REM Dois cliques aqui instala o certificado do R2 Hub neste computador.
REM Existe porque arquivo .ps1 nao roda com dois cliques (o Windows abre no
REM Bloco de Notas) — este .bat chama o script do jeito certo.
REM O pushd/popd faz o Windows aceitar rodar direto da pasta da REDE
REM (o cmd nao trabalha em \\server\... sem mapear uma letra antes).
title R2 Hub - instalar certificado
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-certificado.ps1"
popd
