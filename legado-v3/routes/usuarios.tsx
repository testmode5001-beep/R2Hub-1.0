import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  listUsuarios, createUsuario, updateUsuario, resetSenha, excluirUsuario,
  getUsuarioPermissoes, setUsuarioPermissao, aplicarTemplateCargo, forcarLogout, listAuditoria,
  listRoles, createRole, updateRole, deleteRole,
} from "@/lib/api/usuarios.functions";
import { getStoredSession, hasPerm, PERMISSION_GROUPS, PERMISSION_LABELS, type SessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Administração — R2 Hub" }] }),
  component: AdminPage,
});

type RoleInfo = { nome: string; label: string; sistema: number };

/** Lista de cargos (dinâmica — o gestor cria/edita no painel). */
function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => listRoles() });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AdminPage() {
  const navigate = useNavigate();
  const [me] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);
  const [aba, setAba] = useState<"usuarios" | "cargos" | "auditoria">("usuarios");

  if (!me) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!hasPerm(me, "usuarios.gerenciar")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <i className="ti ti-lock text-4xl text-muted-foreground"></i>
        <div className="font-display text-xl font-extrabold">Acesso restrito</div>
        <div className="text-sm text-muted-foreground">Apenas gestores podem acessar a administração.</div>
        <Link to="/app" className="mt-2 bg-foreground text-yellow px-4 py-2 rounded-[10px] text-sm font-bold">Voltar</Link>
      </div>
    );
  }

  const podePermissoes = hasPerm(me, "permissoes.gerenciar");
  const podeAuditoria = hasPerm(me, "auditoria.ver");

  return (
    <div className="fade-page min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-[18px] pt-[18px] max-w-[680px] w-full mx-auto">
        <div className="flex items-center gap-[10px] min-w-0">
          <button onClick={() => navigate({ to: "/app" })} className="p-1.5 rounded-lg hover:bg-card -ml-1.5" aria-label="Voltar">
            <i className="ti ti-arrow-left text-xl"></i>
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted-foreground">Administração</div>
            <div className="font-display text-[18px] font-extrabold tracking-[-0.4px] leading-[1.1] truncate">Equipe</div>
          </div>
        </div>
      </div>

      <div className="max-w-[680px] w-full mx-auto flex px-[18px] pt-[10px] gap-[2px] overflow-x-auto">
        <TabBtn ativo={aba === "usuarios"} onClick={() => setAba("usuarios")}>Usuários</TabBtn>
        {podePermissoes && <TabBtn ativo={aba === "cargos"} onClick={() => setAba("cargos")}>Cargos</TabBtn>}
        {podeAuditoria && <TabBtn ativo={aba === "auditoria"} onClick={() => setAba("auditoria")}>Logs</TabBtn>}
      </div>

      <div className="px-[18px] py-[14px] max-w-[680px] w-full mx-auto pb-8 flex-1">
        {aba === "usuarios" && <AbaUsuarios me={me} podePermissoes={podePermissoes} />}
        {aba === "cargos" && podePermissoes && <AbaCargos />}
        {aba === "auditoria" && podeAuditoria && <AbaAuditoria />}
      </div>
    </div>
  );
}

function TabBtn({ ativo, onClick, children }: any) {
  return (
    <button onClick={onClick} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-[2.5px] transition ${ativo ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>
      {children}
    </button>
  );
}

/* ===================== USUÁRIOS ===================== */

function AbaUsuarios({ me, podePermissoes }: { me: SessionUser; podePermissoes: boolean }) {
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [resetando, setResetando] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState<any | null>(null);
  const [editandoNome, setEditandoNome] = useState<any | null>(null);
  const [permissoesDe, setPermissoesDe] = useState<any | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listUsuarios(),
    refetchInterval: 15000,
  });
  const { data: rolesData } = useRoles();
  const roles: RoleInfo[] = (rolesData?.roles ?? []) as RoleInfo[];

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  }

  async function mudarRole(u: any, role: string) {
    try {
      await updateUsuario({ data: { id: u.id, role } });
      toast.success("Cargo atualizado");
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function toggleAtivo(u: any) {
    try {
      await updateUsuario({ data: { id: u.id, ativo: !u.ativo } });
      toast.success(u.ativo ? "Usuário desativado" : "Usuário ativado");
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  async function forcarLogoutUsuario(u: any) {
    try {
      await forcarLogout({ data: { id: u.id } });
      toast.success(`Sessões de ${u.nome} encerradas.`);
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <>
      <button
        onClick={() => setCriando(true)}
        className="w-full mb-3 bg-yellow text-foreground rounded-[10px] py-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] hover:opacity-85"
      >
        <i className="ti ti-user-plus"></i> Criar usuário
      </button>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {users.map((u: any) => (
            <div key={u.id} className={`bg-card rounded-[12px] p-3 ${!u.ativo ? "opacity-60" : ""}`} style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-foreground text-yellow flex items-center justify-center text-sm font-extrabold shrink-0">
                  {u.nome?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {u.nome} {u.id === me.id && <span className="text-[10px] text-muted-foreground font-normal">(você)</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    @{u.username} · {u.ativo ? "Ativo" : "Inativo"}
                    {u.sessoes_ativas > 0 && (
                      <span className="text-[color:var(--success,#16a34a)] font-bold"> · <i className="ti ti-circle-filled text-[7px]"></i> {u.sessoes_ativas} sessão(ões)</span>
                    )}
                  </div>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => mudarRole(u, e.target.value)}
                  disabled={u.id === me.id}
                  className="text-xs font-semibold bg-background border border-border rounded-[8px] px-2 py-1.5"
                >
                  {roles.map((r) => (
                    <option key={r.nome} value={r.nome}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1 mt-2 justify-end flex-wrap">
                {podePermissoes && u.role !== "admin" && (
                  <MiniBtn onClick={() => setPermissoesDe(u)} icon="ti-shield-lock">Permissões</MiniBtn>
                )}
                <MiniBtn onClick={() => setEditandoNome(u)} icon="ti-pencil">Nome</MiniBtn>
                <MiniBtn onClick={() => setResetando(u)} icon="ti-key">Resetar senha</MiniBtn>
                {u.sessoes_ativas > 0 && u.id !== me.id && (
                  <MiniBtn onClick={() => forcarLogoutUsuario(u)} icon="ti-logout-2">Forçar logout</MiniBtn>
                )}
                <MiniBtn onClick={() => toggleAtivo(u)} icon={u.ativo ? "ti-user-off" : "ti-user-check"} disabled={u.id === me.id}>
                  {u.ativo ? "Desativar" : "Ativar"}
                </MiniBtn>
                <MiniBtn onClick={() => setExcluindo(u)} icon="ti-trash" destrutivo disabled={u.id === me.id}>Excluir</MiniBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {criando && <ModalCriarUsuario onClose={() => setCriando(false)} onDone={() => { setCriando(false); recarregar(); }} />}
      {resetando && <ModalResetSenha usuario={resetando} onClose={() => setResetando(null)} onDone={() => { setResetando(null); recarregar(); }} />}
      {editandoNome && <ModalEditarNome usuario={editandoNome} onClose={() => setEditandoNome(null)} onDone={() => { setEditandoNome(null); recarregar(); }} />}
      {excluindo && <ModalExcluir usuario={excluindo} onClose={() => setExcluindo(null)} onDone={() => { setExcluindo(null); recarregar(); }} />}
      {permissoesDe && <ModalPermissoes usuario={permissoesDe} onClose={() => setPermissoesDe(null)} />}
    </>
  );
}

function MiniBtn({ onClick, icon, children, destrutivo, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[11px] font-bold px-2 py-1.5 rounded-[8px] border border-border hover:bg-background disabled:opacity-40 ${destrutivo ? "text-destructive hover:bg-destructive/10" : ""}`}
    >
      <i className={`ti ${icon} mr-1`}></i>{children}
    </button>
  );
}

function Modal({ titulo, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[360px] max-h-[85vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[16px] font-extrabold">{titulo}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }: any) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  );
}

const inp = "w-full bg-background border border-border rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-foreground";

function ModalCriarUsuario({ onClose, onDone }: any) {
  const [f, setF] = useState({ username: "", nome: "", senha: "", role: "comercial" });
  const [saving, setSaving] = useState(false);
  const { data: rolesData } = useRoles();
  const roles: RoleInfo[] = (rolesData?.roles ?? []) as RoleInfo[];

  async function salvar() {
    setSaving(true);
    try {
      await createUsuario({ data: f });
      toast.success(`Usuário ${f.username} criado.`);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titulo="Criar usuário" onClose={onClose}>
      <Campo label="Login (para entrar no sistema)">
        <input value={f.username} onChange={(e) => setF((s) => ({ ...s, username: e.target.value }))} placeholder="maria.silva" autoCapitalize="none" className={inp} />
      </Campo>
      <Campo label="Nome completo">
        <input value={f.nome} onChange={(e) => setF((s) => ({ ...s, nome: e.target.value }))} placeholder="Maria Silva" className={inp} />
      </Campo>
      <Campo label="Senha inicial (mín. 6 caracteres)">
        <input type="text" value={f.senha} onChange={(e) => setF((s) => ({ ...s, senha: e.target.value }))} placeholder="••••••" className={inp} />
      </Campo>
      <Campo label="Cargo">
        <select value={f.role} onChange={(e) => setF((s) => ({ ...s, role: e.target.value }))} className={inp}>
          {roles.map((r) => <option key={r.nome} value={r.nome}>{r.label}</option>)}
        </select>
      </Campo>
      <button onClick={salvar} disabled={saving || !f.username || !f.nome || f.senha.length < 6} className="w-full bg-foreground text-yellow rounded-[10px] py-2.5 font-bold text-[13px] disabled:opacity-40">
        {saving ? "Criando..." : "Criar usuário"}
      </button>
    </Modal>
  );
}

function ModalResetSenha({ usuario, onClose, onDone }: any) {
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      await resetSenha({ data: { id: usuario.id, novaSenha: senha } });
      toast.success(`Senha de ${usuario.nome} redefinida.`);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titulo={`Resetar senha — ${usuario.nome}`} onClose={onClose}>
      <Campo label="Nova senha (mín. 6 caracteres)">
        <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" className={inp} />
      </Campo>
      <p className="text-[11px] text-muted-foreground mb-3">
        O usuário será desconectado de todas as sessões abertas.
      </p>
      <button onClick={salvar} disabled={saving || senha.length < 6} className="w-full bg-foreground text-yellow rounded-[10px] py-2.5 font-bold text-[13px] disabled:opacity-40">
        {saving ? "Salvando..." : "Redefinir senha"}
      </button>
    </Modal>
  );
}

function ModalEditarNome({ usuario, onClose, onDone }: any) {
  const [nome, setNome] = useState(usuario.nome ?? "");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      await updateUsuario({ data: { id: usuario.id, nome } });
      toast.success("Nome atualizado.");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titulo={`Alterar nome — @${usuario.username}`} onClose={onClose}>
      <Campo label="Nome completo">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} />
      </Campo>
      <button onClick={salvar} disabled={saving || nome.trim().length < 2} className="w-full bg-foreground text-yellow rounded-[10px] py-2.5 font-bold text-[13px] disabled:opacity-40">
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </Modal>
  );
}

function ModalExcluir({ usuario, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false);

  async function excluir() {
    setSaving(true);
    try {
      await excluirUsuario({ data: { id: usuario.id } });
      toast.success(`Usuário ${usuario.nome} excluído.`);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal titulo="Excluir usuário?" onClose={onClose}>
      <p className="text-[12px] text-muted-foreground mb-4">
        <strong>{usuario.nome}</strong> (@{usuario.username}) será removido permanentemente.
        Se ele tiver pedidos vinculados, a exclusão será bloqueada — nesse caso, desative-o.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-background border-[1.5px] border-border">Cancelar</button>
        <button onClick={excluir} disabled={saving} className="flex-1 rounded-[10px] py-2 px-3 text-[13px] font-bold bg-destructive text-white disabled:opacity-40">
          {saving ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </Modal>
  );
}

/* ===================== PERMISSÕES POR USUÁRIO ===================== */

function ModalPermissoes({ usuario, onClose }: { usuario: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["usuario-permissoes", usuario.id],
    queryFn: () => getUsuarioPermissoes({ data: { id: usuario.id } }),
  });

  const granted = new Set((data?.granted ?? []) as string[]);

  async function toggle(permission: string, habilitada: boolean) {
    try {
      await setUsuarioPermissao({ data: { id: usuario.id, permission: permission as any, habilitada } });
      qc.invalidateQueries({ queryKey: ["usuario-permissoes", usuario.id] });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar permissão");
    }
  }

  async function aplicarPadrao() {
    try {
      await aplicarTemplateCargo({ data: { id: usuario.id } });
      toast.success(`Permissões redefinidas para o padrão de ${data?.roleLabel ?? usuario.role}.`);
      qc.invalidateQueries({ queryKey: ["usuario-permissoes", usuario.id] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao aplicar padrão");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[420px] max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[16px] font-extrabold flex items-center gap-2">
            <i className="ti ti-shield-lock"></i>Permissões
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-3">
          {usuario.nome} · <span className="font-bold">{data?.roleLabel ?? usuario.role}</span>
        </p>

        {isLoading || !data ? (
          <div className="text-center text-muted-foreground py-10">Carregando...</div>
        ) : (
          <>
            <button
              onClick={aplicarPadrao}
              className="w-full mb-3 rounded-[10px] py-2 text-[12px] font-bold bg-background border border-border hover:border-foreground"
            >
              <i className="ti ti-restore mr-1"></i>Aplicar padrão do cargo {data?.roleLabel ?? usuario.role}
            </button>

            {PERMISSION_GROUPS.map((grupo) => (
              <div key={grupo.titulo} className="mb-3">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-1">{grupo.titulo}</div>
                <div className="space-y-[6px]">
                  {grupo.permissoes.map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer select-none bg-background border border-border rounded-[8px] px-3 py-2">
                      <input
                        type="checkbox"
                        checked={granted.has(p)}
                        onChange={(e) => toggle(p, e.target.checked)}
                        className="w-4 h-4 accent-[var(--foreground)] cursor-pointer"
                      />
                      <span className="text-[13px] font-semibold flex-1">{PERMISSION_LABELS[p] ?? p}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== CARGOS ===================== */

function AbaCargos() {
  const qc = useQueryClient();
  const { data, isLoading } = useRoles();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<RoleInfo | null>(null);

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["roles"] });
    qc.invalidateQueries({ queryKey: ["usuarios"] });
  }

  async function excluir(r: RoleInfo) {
    try {
      await deleteRole({ data: { nome: r.nome } });
      toast.success(`Cargo ${r.label} excluído.`);
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir cargo");
    }
  }

  if (isLoading || !data) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  const roles = data.roles as RoleInfo[];
  const usos = new Map((data.usos as { role: string; qtde: number }[]).map((u) => [u.role, u.qtde]));
  const permsPorRole = new Map<string, string[]>();
  for (const p of data.permissoes as { role: string; permission: string }[]) {
    permsPorRole.set(p.role, [...(permsPorRole.get(p.role) ?? []), p.permission]);
  }

  return (
    <>
      <div className="bg-yellow/30 border border-yellow rounded-[12px] p-3 mb-3 text-xs">
        <div className="font-bold mb-1 flex items-center gap-1"><i className="ti ti-info-circle"></i> Como funcionam os cargos</div>
        O cargo é um <b>modelo de permissões</b>: define o que a pessoa recebe ao ser criada (ou ao usar
        “aplicar padrão”). Depois, cada usuário pode ser ajustado individualmente.
      </div>

      <button
        onClick={() => setCriando(true)}
        className="w-full mb-3 bg-yellow text-foreground rounded-[10px] py-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] hover:opacity-85"
      >
        <i className="ti ti-briefcase-plus"></i> Criar cargo
      </button>

      <div className="space-y-2">
        {roles.map((r) => {
          const qtde = usos.get(r.nome) ?? 0;
          const perms = permsPorRole.get(r.nome) ?? [];
          return (
            <div key={r.nome} className="bg-card rounded-[12px] p-3" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-bold flex-1 min-w-0 truncate">
                  {r.label}
                  {!!r.sistema && <span className="ml-2 text-[10px] font-extrabold px-2 py-[2px] rounded-[10px] bg-foreground text-yellow">SISTEMA</span>}
                </div>
                <span className="text-[11px] text-muted-foreground">{qtde} usuário(s)</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-[2px]">
                @{r.nome} · {r.sistema ? "acesso total" : `${perms.length} permissão(ões)`}
              </div>
              {!r.sistema && (
                <div className="flex gap-1 mt-2 justify-end flex-wrap">
                  <MiniBtn onClick={() => setEditando(r)} icon="ti-edit">Editar</MiniBtn>
                  <MiniBtn onClick={() => excluir(r)} icon="ti-trash" destrutivo disabled={qtde > 0}>Excluir</MiniBtn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {criando && <ModalCargo onClose={() => setCriando(false)} onDone={() => { setCriando(false); recarregar(); }} />}
      {editando && (
        <ModalCargo
          cargo={editando}
          permissoesAtuais={permsPorRole.get(editando.nome) ?? []}
          onClose={() => setEditando(null)}
          onDone={() => { setEditando(null); recarregar(); }}
        />
      )}
    </>
  );
}

function ModalCargo({ cargo, permissoesAtuais = [], onClose, onDone }: {
  cargo?: RoleInfo;
  permissoesAtuais?: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const editMode = !!cargo;
  const [label, setLabel] = useState(cargo?.label ?? "");
  const [nome, setNome] = useState(cargo?.nome ?? "");
  const [sel, setSel] = useState<Set<string>>(() => new Set(permissoesAtuais));
  const [saving, setSaving] = useState(false);

  function toggle(p: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p); else n.add(p);
      return n;
    });
  }

  async function salvar() {
    setSaving(true);
    try {
      if (editMode) {
        await updateRole({ data: { nome: cargo!.nome, label: label.trim(), permissoes: [...sel] as any } });
        toast.success("Cargo atualizado.");
      } else {
        const slug = (nome.trim() || label.trim())
          .normalize("NFD").replace(/[̀-ͯ]/g, "")
          .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
        await createRole({ data: { nome: slug, label: label.trim(), permissoes: [...sel] as any } });
        toast.success(`Cargo ${label} criado.`);
      }
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cargo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-[18px] p-5 w-full max-w-[420px] max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[16px] font-extrabold flex items-center gap-2">
            <i className="ti ti-briefcase"></i>{editMode ? `Editar cargo` : "Criar cargo"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="ti ti-x text-lg"></i></button>
        </div>

        <Campo label="Nome do cargo">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Expedição" className={inp} />
        </Campo>
        {!editMode && (
          <Campo label="Identificador (opcional — gerado do nome)">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="expedicao" autoCapitalize="none" className={inp} />
          </Campo>
        )}

        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
          Permissões do modelo ({sel.size})
        </div>
        {PERMISSION_GROUPS.map((grupo) => (
          <div key={grupo.titulo} className="mb-3">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-1">{grupo.titulo}</div>
            <div className="space-y-[6px]">
              {grupo.permissoes.map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer select-none bg-background border border-border rounded-[8px] px-3 py-2">
                  <input type="checkbox" checked={sel.has(p)} onChange={() => toggle(p)} className="w-4 h-4 accent-[var(--foreground)] cursor-pointer" />
                  <span className="text-[13px] font-semibold flex-1">{PERMISSION_LABELS[p] ?? p}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-background border border-border">Cancelar</button>
          <button onClick={salvar} disabled={saving || label.trim().length < 2} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold bg-foreground text-yellow disabled:opacity-40">
            {saving ? "Salvando..." : editMode ? "Salvar" : "Criar cargo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== LOGS ===================== */

const ACAO_LABELS: Record<string, string> = {
  "login": "Entrou no sistema",
  "logout": "Saiu do sistema",
  "usuario.criar": "Criou usuário",
  "usuario.editar": "Alterou usuário",
  "usuario.excluir": "Excluiu usuário",
  "usuario.resetar_senha": "Resetou senha",
  "usuario.trocar_senha": "Trocou a própria senha",
  "permissao.alterar": "Alterou permissão",
  "permissao.aplicar_template": "Aplicou padrão de cargo",
  "usuario.forcar_logout": "Forçou logout",
  "cargo.criar": "Criou cargo",
  "cargo.editar": "Editou cargo",
  "cargo.excluir": "Excluiu cargo",
  "cliente.criar_pasta": "Criou pasta de cliente",
  "pedido.criar": "Criou pedido",
  "pedido.editar": "Editou pedido",
  "pedido.status": "Mudou status",
  "pedido.excluir": "Excluiu pedido",
  "anexo.upload": "Enviou arquivo",
  "anexo.excluir": "Apagou anexo",
  "cliche.solicitar": "Solicitou clichê",
  "cliche.registrar": "Registrou chegada de clichê",
  "cliche.motivo_criar": "Criou motivo de clichê",
  "faca.enviar_afiacao": "Enviou faca p/ afiação",
  "faca.receber": "Recebeu faca da afiação",
  "faca.substrato_criar": "Criou substrato de faca",
};

function AbaAuditoria() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["auditoria"],
    queryFn: () => listAuditoria(),
    refetchInterval: 15000,
  });
  const [expandido, setExpandido] = useState<string | null>(null);

  if (isLoading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-1.5">
      {logs.length === 0 && <div className="text-center text-muted-foreground py-12">Nenhum registro ainda.</div>}
      {logs.map((l: any) => (
        <div
          key={l.id}
          onClick={() => setExpandido(expandido === l.id ? null : l.id)}
          className="bg-card rounded-[10px] px-3 py-2 cursor-pointer hover:opacity-90"
          style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-bold truncate">{l.user_nome ?? "Sistema"}</span>
            <span className="text-muted-foreground flex-1 truncate">{ACAO_LABELS[l.acao] ?? l.acao}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(l.created_at)}</span>
          </div>
          {expandido === l.id && l.detalhe && (
            <pre className="mt-2 text-[10px] bg-background border border-border rounded-[8px] p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(JSON.parse(l.detalhe), null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
