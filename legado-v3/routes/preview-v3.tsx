// ⚠️ ROTA TEMPORÁRIA DE DESENVOLVIMENTO — preview do design com dados de
// exemplo, sem login. Serve só para validar layout/alinhamento no navegador.
// REMOVER antes de qualquer deploy.
// /preview-v3?tela=central (v1a) | v5 (grid anterior) | home | todos
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AfiacaoV1a } from "@/components/v1a/AfiacaoV1a";
import { ApontamentosV1a } from "@/components/v1a/ApontamentosV1a";
import { AprovacaoV1a } from "@/components/v1a/AprovacaoV1a";
import { ArquivosV1a } from "@/components/v1a/ArquivosV1a";
import { CalculadorasV1a } from "@/components/v1a/CalculadorasV1a";
import { CentralV1a } from "@/components/v1a/CentralV1a";
import { EquipeV1a } from "@/components/v1a/EquipeV1a";
import { EstoqueV1a } from "@/components/v1a/EstoqueV1a";
import { FacasV1a } from "@/components/v1a/FacasV1a";
import { AvisoV1a, EstagioV1a } from "@/components/v1a/HubV1a";
import { ClicheChegouModalV1a } from "@/components/v1a/modais/ClicheChegouModalV1a";
import { ListaModalV1a } from "@/components/v1a/modais/ListaModalV1a";
import { NovaArteModalV1a } from "@/components/v1a/modais/NovaArteModalV1a";
import { PedidoModalV1a, type PedidoModal } from "@/components/v1a/modais/PedidoModalV1a";
import { HomeV1a } from "@/components/v1a/HomeV1a";
import { LeituraV1a } from "@/components/v1a/LeituraV1a";
import { MuralV1a } from "@/components/v1a/MuralV1a";
import { NovaSolicitacaoV1a } from "@/components/v1a/NovaSolicitacaoV1a";
import { PainelV1a } from "@/components/v1a/PainelV1a";
import { PantoneV1a } from "@/components/v1a/PantoneV1a";
import { PedidosV1a } from "@/components/v1a/PedidosV1a";
import { CentralV3 } from "@/components/v3/CentralV3";
import type { SessionUser } from "@/lib/session";

export const Route = createFileRoute("/preview-v3")({
  head: () => ({ meta: [{ title: "Preview V3 — R2 Hub" }] }),
  component: PreviewV3,
});

const USER: SessionUser = {
  id: "mock", username: "preview", nome: "Consectetour Silva", role: "admin", permissions: [],
};

const DIA = 86_400_000;
function ped(n: number, extra: Partial<any> = {}) {
  return {
    id: `p${n}`,
    numero: n,
    cliente: "Mercado Bom Preço",
    materia: "Polietileno",
    largura: 70,
    altura: 50,
    cores: "3",
    status: "cliche",
    tipo: "normal",
    created_at: new Date(Date.now() - 3 * DIA).toISOString(),
    ...extra,
  };
}

const PEDIDOS: any[] = [
  ped(1, { status: "aguardando", cliente: "Mercado Bom Preço", origem: "producao", prazo: new Date(Date.now() + 4 * DIA).toISOString() }),
  ped(2, { status: "cliche", cliente: "Frigorífico Vale Verde", origem: "vendas", prazo: new Date(Date.now() + 6 * DIA).toISOString() }),
  ped(3, { status: "cliche", cliente: "Laticínios Serra Azul", origem: "interno", prazo: new Date(Date.now() - 2 * DIA).toISOString() }),
  ped(4, { status: "nova", cliente: "Padaria Trigo Bom", created_at: new Date(Date.now() - 0.4 * DIA).toISOString() }),
  ped(5, { status: "criacao", cliente: "Café Serrano", materia: "BOPP Matte", largura: 100, altura: 60, cores: "CMYK", created_at: new Date(Date.now() - 1 * DIA).toISOString() }),
  ped(6, { status: "revisao", cliente: "Vinhos Altavista", materia: "Papel couché", largura: 90, altura: 120, cores: "4+PANTONE", created_at: new Date(Date.now() - 6 * DIA).toISOString() }),
  ped(7, { status: "aprovada", cliente: "Doces da Vó", materia: "Térmico", largura: 60, altura: 40, cores: "2", created_at: new Date(Date.now() - 2 * DIA).toISOString() }),
  ped(8, { tipo: "cliche", status: "nova", cliente: "Biscoitos Vitória", codigo_produto: "PRD-0451", motivo: "Desgaste", created_at: new Date(Date.now() - 1.2 * DIA).toISOString() }),
  ...Array.from({ length: 6 }, (_, i) =>
    ped(9 + i, {
      status: i % 3 === 0 ? "cancelado" : "concluido",
      cliente: "Supermercado Rossi",
      materia: "BOPP brilho",
      largura: 50,
      altura: 40,
      created_at: new Date(Date.now() - (30 + i) * DIA).toISOString(),
      updated_at: new Date(Date.now() - (20 + i) * DIA).toISOString(),
    })),
];

/* ————— Adaptadores app → modais v1a (na integração real vêm da rota) ————— */
const ST_LABEL: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design", aguardando: "Revisão", revisao: "Revisão",
  aprovada: "Design aprovado", cliche: "Clichê solicitado", concluido: "Finalizado", cancelado: "Finalizado",
};

const fmt2 = (n: number) => String(n).padStart(2, "0");
const ddmm = (s?: string) => { const d = s ? new Date(s) : new Date(); return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}`; };
const numDe = (p: any) => `#${String(p.numero).padStart(4, "0")}`;

function paraModal(p: any): PedidoModal {
  const prazoDate = p.prazo ? new Date(p.prazo) : new Date(new Date(p.created_at).getTime() + 7 * DIA);
  const diff = Math.round((prazoDate.getTime() - Date.now()) / DIA);
  const cores = p.cores ? (String(p.cores).match(/^\d+$/) ? `${p.cores} cores` : String(p.cores)) : "—";
  const spec = p.tipo === "cliche"
    ? `CÓD ${p.codigo_produto ?? "—"} · Reposição · ${cores}`
    : `${p.largura}×${p.altura} · ${p.materia ?? "—"} · ${cores}`;
  return {
    num: numDe(p),
    cliente: p.cliente,
    spec,
    status: ST_LABEL[p.status] ?? "Aguardando Design",
    prazo: ddmm(p.prazo ?? prazoDate.toISOString()),
    dias: Math.abs(diff),
    atraso: diff < 0,
    origem: p.origem ?? (p.tipo === "cliche" ? "interno" : "vendas"),
  };
}

function itensDe(tipo: "abertos" | "finalizados") {
  const fim = (p: any) => ["concluido", "cancelado"].includes(p.status);
  return PEDIDOS.filter((p) => (tipo === "abertos" ? !fim(p) : fim(p))).map((p) => ({
    num: numDe(p),
    cliente: p.cliente as string,
    medida: p.tipo === "cliche" ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}×${p.altura}`,
    sub: p.tipo === "cliche" ? "Clichê" : (p.materia ?? "—"),
    prazo: ddmm(p.prazo),
    apro: p.status === "cancelado" ? "—" : ddmm(p.updated_at ?? p.created_at),
    status: ST_LABEL[p.status] ?? "Aguardando Design",
  }));
}

function PreviewV3() {
  const tela = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("tela") ?? "central")
    : "central";
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  /* Modais hospedadas pela rota (mesmo padrão da integração real). */
  const [pedidoModal, setPedidoModal] = useState<PedidoModal | null>(null);
  const [lista, setLista] = useState<null | "abertos" | "finalizados">(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [avisoGeral, setAvisoGeral] = useState("");

  const filtered = PEDIDOS.filter((p) => (filtro === "todos" ? true : p.status === filtro))
    .filter((p) => !busca.trim() || p.cliente.toLowerCase().includes(busca.toLowerCase()));

  const nada = () => { /* preview: navegação desativada */ };

  const abrirPedido = (id: string) => {
    const p = PEDIDOS.find((x) => x.id === id);
    if (p) setPedidoModal(paraModal(p));
  };
  const abrirNova = () => setNovaAberta(true);

  const modais = (
    <>
      {lista && (
        <ListaModalV1a
          tipo={lista}
          itens={itensDe(lista)}
          fechar={() => setLista(null)}
          onAbrir={(item) => {
            setLista(null);
            const p = PEDIDOS.find((x) => numDe(x) === item.num);
            if (p) setPedidoModal(paraModal(p));
          }}
          onExportar={() => setAvisoGeral("Exportar planilha — entra na integração com o back-end.")}
        />
      )}
      {pedidoModal && (
        <PedidoModalV1a pedido={pedidoModal} fechar={() => setPedidoModal(null)} aoNavegar={nada} />
      )}
      {novaAberta && (
        <NovaArteModalV1a
          onFechar={() => setNovaAberta(false)}
          onEnviar={(resumo) => { setNovaAberta(false); setAvisoGeral(`Solicitação enviada — ${resumo}. (grava no back-end na integração)`); }}
        />
      )}
      {avisoGeral && <AvisoV1a texto={avisoGeral} onFechar={() => setAvisoGeral("")} />}
    </>
  );

  if (tela === "central") {
    return (
      <CentralV1a
        profile={USER}
        pedidos={PEDIDOS}
        versao="V. 0.01"
        onOpen={abrirPedido}
        onVerTodos={() => setLista("abertos")}
        aoNavegar={nada}
        onNova={abrirNova}
        onLogout={nada}
      >
        {modais}
      </CentralV1a>
    );
  }

  if (tela === "pedidos") {
    return (
      <PedidosV1a
        profile={USER}
        pedidos={PEDIDOS}
        versao="V. 0.01"
        onOpen={abrirPedido}
        aoNavegar={nada}
        onNova={abrirNova}
        onLogout={nada}
      >
        {modais}
      </PedidosV1a>
    );
  }

  if (tela === "aprovacao") {
    return (
      <AprovacaoV1a
        profile={USER}
        pedidos={PEDIDOS}
        versao="V. 0.01"
        onOpen={abrirPedido}
        aoNavegar={nada}
        onLogout={nada}
      >
        {modais}
      </AprovacaoV1a>
    );
  }

  if (tela === "fabrica") {
    return (
      <PainelV1a profile={USER} pedidos={PEDIDOS} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </PainelV1a>
    );
  }

  if (tela === "leitura" || tela === "op") {
    return (
      <LeituraV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </LeituraV1a>
    );
  }

  if (tela === "apontamentos") {
    return (
      <ApontamentosV1a profile={USER} pedidos={PEDIDOS} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </ApontamentosV1a>
    );
  }

  if (tela === "facas") {
    return (
      <FacasV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </FacasV1a>
    );
  }

  if (tela === "afiacao") {
    return (
      <AfiacaoV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </AfiacaoV1a>
    );
  }

  if (tela === "estoque") {
    return (
      <EstoqueV1a profile={USER} pedidos={PEDIDOS} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </EstoqueV1a>
    );
  }

  if (tela === "mural") {
    return (
      <MuralV1a profile={USER} pedidos={PEDIDOS} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </MuralV1a>
    );
  }

  if (tela === "pantone") {
    return (
      <PantoneV1a profile={USER} pedidos={PEDIDOS} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </PantoneV1a>
    );
  }

  if (tela === "arquivos") {
    return (
      <ArquivosV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </ArquivosV1a>
    );
  }

  if (tela === "modal-pedido") {
    return (
      <EstagioV1a>
        <PedidoModalV1a
          pedido={{
            num: "#0006", cliente: "Vinhos Altavista", spec: "90×120 · Papel couché · 4+PANTONE",
            status: "Revisão", prazo: "08/08", dias: 4, atraso: false, origem: "vendas",
          }}
          fechar={nada}
          aoNavegar={nada}
        />
      </EstagioV1a>
    );
  }

  if (tela === "modal-lista") {
    return (
      <EstagioV1a>
        <ListaModalV1a tipo="abertos" itens={itensDe("abertos")} fechar={nada} onAbrir={nada} onExportar={nada} />
      </EstagioV1a>
    );
  }

  if (tela === "modal-cliche") {
    return (
      <EstagioV1a>
        <ClicheChegouModalV1a
          num="#0412"
          cliente="Mercado Bom Preço"
          cores="Ciano ×1, Magenta ×1, Amarelo ×1, Preto ×1"
          fechar={nada}
          onSalvar={nada}
        />
      </EstagioV1a>
    );
  }

  if (tela === "modal-nova-arte") {
    return (
      <EstagioV1a>
        <NovaArteModalV1a onFechar={nada} onEnviar={nada} />
      </EstagioV1a>
    );
  }

  if (tela === "calculadoras") {
    return (
      <CalculadorasV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </CalculadorasV1a>
    );
  }

  if (tela === "nova") {
    return (
      <NovaSolicitacaoV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={nada} onLogout={nada}>
        {modais}
      </NovaSolicitacaoV1a>
    );
  }

  if (tela === "equipe") {
    return (
      <EquipeV1a profile={USER} versao="V. 0.01" aoNavegar={nada} onNova={abrirNova} onLogout={nada}>
        {modais}
      </EquipeV1a>
    );
  }

  if (tela === "home") {
    return (
      <HomeV1a
        profile={USER}
        pedidos={PEDIDOS}
        versao="V. 0.01"
        aoNavegar={nada}
        onNova={abrirNova}
        onAbrirPedido={abrirPedido}
        onLogout={nada}
      >
        {modais}
      </HomeV1a>
    );
  }

  return (
    <CentralV3
      profile={USER}
      isLoading={false}
      pedidos={PEDIDOS}
      filtered={filtered}
      filtro={filtro}
      setFiltro={setFiltro}
      busca={busca}
      setBusca={setBusca}
      onOpen={nada}
      onVerTodos={nada}
      aoAbrirMenu={nada}
      onHome={nada}
      canCreate
      onNova={nada}
      onLogout={nada}
      modoTodos={tela === "todos"}
      onVoltar={nada}
    />
  );
}
