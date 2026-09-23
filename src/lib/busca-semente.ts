// Termo que a busca do topo "planta" para a próxima tela colher. Quem clica em
// uma faca no resultado global vai parar no catálogo JÁ filtrado por ela — sem
// isso a pessoa teria de digitar tudo de novo depois de navegar.
// Vale uma leitura só: a tela consome no momento em que monta.
let semente = "";

export function semearBusca(termo: string) {
  semente = String(termo || "");
}

export function colherBusca(): string {
  const t = semente;
  semente = "";
  return t;
}
