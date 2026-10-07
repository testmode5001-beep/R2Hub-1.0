// Termo que a busca do topo "planta" para a próxima tela colher. Quem clica em
// uma faca no resultado global vai parar no catálogo JÁ filtrado por ela; sem
// isso a pessoa teria de digitar tudo de novo depois de navegar.
// Vale uma leitura só: a tela consome no momento em que monta.
let semente = "";

export function semearBusca(termo: string) {
  semente = String(termo || "");
  /* A tela que já está aberta não remonta quando a navegação aponta para ela
     mesma (ex.: estar em Pantones e escolher uma cor na busca do topo). O
     aviso deixa essa tela conferir e colher; as outras seguem colhendo ao
     montar, como sempre. */
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hub:semente"));
}

export function colherBusca(): string {
  const t = semente;
  semente = "";
  return t;
}

/** Olha a semente sem consumir: para a tela decidir se ela é para si. */
export function espiarBusca(): string {
  return semente;
}
