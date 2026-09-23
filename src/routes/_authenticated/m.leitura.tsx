// /m/leitura — leitura de OP pelo celular. Única rota móvel do hub: coluna
// única em altura real, foto → OCR no aparelho → conferência → fila do painel.
// Mesma sessão e mesmas permissões do resto (_authenticated + tab.painel).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { LeituraMovel, type CamposLeitura } from "@/components/mobile/LeituraMovel";
import { logout } from "@/lib/api/auth.functions";
import { listLeituras, registrarLeituraOp } from "@/lib/api/leituras.functions";
import { clearStoredSession, getStoredSession, hasPerm, type SessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/m/leitura")({
  /* Mesmo motivo do hub: a sessão vem do localStorage, que o servidor não
     tem. Ver o comentário em hub.tsx. */
  ssr: false,
  head: () => ({ meta: [{ title: "R2 Hub · Leitura" }] }),
  component: LeituraMovelPage,
});

function LeituraMovelPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profile] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);

  const pode = !!profile && (hasPerm(profile, "tab.op") || hasPerm(profile, "tab.painel"));
  /* senha provisória do gestor: troca primeiro, lê OP depois */
  const trocarSenha = !!profile?.precisaTrocarSenha;
  useEffect(() => {
    if (trocarSenha) navigate({ to: "/trocar-senha", replace: true });
  }, [trocarSenha, navigate]);
  const { data: fila } = useQuery<any[]>({
    queryKey: ["leituras"],
    queryFn: () => listLeituras() as Promise<any[]>,
    refetchInterval: 30_000,
    enabled: pode,
  });

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    try { await logout(); } catch { /* sessão pode já ter expirado */ }
    clearStoredSession();
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) return null;
  if (!pode) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f1f1f1", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ font: "800 20px/1.3 Inter,sans-serif", color: "#252425" }}>Seu acesso não inclui a leitura de OP.</div>
          <p style={{ font: "400 14.5px/1.5 Inter,sans-serif", color: "#5c5a5c", marginTop: 10 }}>Peça na Equipe para liberarem o Painel de produção.</p>
          <button onClick={() => void sair()} style={{ marginTop: 16, background: "#252425", color: "#ffe815", border: 0, borderRadius: 10, padding: "13px 22px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif" }}>Sair</button>
        </div>
      </div>
    );
  }

  const aoRegistrar = (dados: CamposLeitura) =>
    registrarLeituraOp({
      data: {
        op: dados.op, cliente: dados.cliente || null, descricao: dados.descricao || null,
        medida: dados.medida, substrato: dados.substrato, metragem: dados.metragem,
        carreiras: dados.carreiras || null, nucleo: dados.nucleo || null,
        rolos: dados.rolos || null, entrega: dados.entrega || null,
      },
    }).then(() => qc.invalidateQueries({ queryKey: ["leituras"] }));

  return (
    <LeituraMovel
      nome={profile.nome}
      fila={Array.isArray(fila) ? fila.filter((l: any) => !l.usada).length : 0}
      aoRegistrar={aoRegistrar}
      aoSair={() => void sair()}
      aoAbrirHub={() => {
        // exceção por sessão: o /hub deixa de devolver o celular para cá
        sessionStorage.setItem("r2.hub-completo", "1");
        navigate({ to: "/hub", search: { tela: "home" } });
      }}
    />
  );
}
