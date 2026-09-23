' Sobe o servidor do R2 Hub sem abrir janela nenhuma (o "0" do Run).
' E uma copia deste arquivo que fica na pasta Inicializar do Windows, para o
' hub voltar sozinho toda vez que alguem entra nesta conta.
' Esta maquina nao deixa criar tarefa agendada sem administrador -- por isso a
' pasta Inicializar; para subir no boot, veja instalar-servico-admin.ps1.
Dim shell, raiz, script
Set shell = CreateObject("WScript.Shell")
raiz = "C:\Users\arte01.FILITEC\Desktop\R2 Hub\DesignHub-v2"
script = raiz & "\scripts\servidor.ps1"
' A pasta atual e HERDADA de quem chama. No logon isso pode ser um caminho que
' nem existe (unidade de rede que ainda nao montou) e ai o cmd que sobe o node
' morre com "nao pode encontrar o caminho especificado" -- o hub amanhece fora
' do ar sem nenhum erro claro (foi o que aconteceu em 10/08). Cravar aqui.
shell.CurrentDirectory = raiz
shell.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & script & """", 0, False
