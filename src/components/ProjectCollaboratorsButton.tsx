import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/lib/collaborators.functions";
import { profileHandle } from "@/lib/profile-username";
import { Check, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

type Collaborator = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type TeamState = {
  owner: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  isOwner: boolean;
  maxTeamSize: number;
  collaborators: Collaborator[];
};

function Avatar({
  name,
  url,
}: {
  name: string;
  url?: string | null;
}) {
  return (
    <div className="h-9 w-9 overflow-hidden rounded-xl border border-border bg-surface-elevated grid place-items-center text-xs font-bold text-primary">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ProjectCollaboratorsButton({ projectId }: { projectId: string }) {
  const listTeam = useServerFn(listCollaborators);
  const invite = useServerFn(inviteCollaborator);
  const updateRole = useServerFn(updateCollaboratorRole);
  const remove = useServerFn(removeCollaborator);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<TeamState | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const result = (await listTeam({ data: { projectId } })) as TeamState;
      setTeam(result);
    } catch (err: any) {
      toast.error(err?.message || "Could not load collaborators.");
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open, projectId]);

  const count = (team?.collaborators.length ?? 0) + 1;
  const max = team?.maxTeamSize ?? 5;
  const canAdd = !!team?.isOwner && count < max;
  const ownerName = team?.owner.display_name || profileHandle(team?.owner.username).slice(1) || "Owner";
  const statusText = useMemo(() => {
    if (!team) return "Collaborators";
    return `${count}/${max} team`;
  }, [count, max, team]);

  const add = async () => {
    const handle = username.trim().replace(/^@+/, "");
    if (!handle) return;
    setBusy(true);
    try {
      await invite({ data: { projectId, username: handle, role: "editor" } });
      setUsername("");
      toast.success(`Added @${handle} to this project.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not add collaborator.");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (collaboratorId: string, role: "editor" | "viewer") => {
    setBusy(true);
    try {
      await updateRole({ data: { projectId, collaboratorId, role } });
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update role.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (collaboratorId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    setBusy(true);
    try {
      await remove({ data: { projectId, collaboratorId } });
      toast.success("Collaborator removed.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove collaborator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-lg border border-border px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-surface"
        aria-label="Project collaborators"
        title="Project collaborators"
      >
        <UserPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Collaborate</span>
        <span className="hidden xl:inline text-muted-foreground">{statusText}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-[min(560px,100%)] max-h-[min(720px,calc(100vh-2rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Project Collaborators</h3>
                  <p className="text-xs text-muted-foreground">
                    Private project access. Credits stay separate for every user.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Close collaborators"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-4 space-y-4">
              {!team ? (
                <div className="py-12 grid place-items-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={ownerName} url={team.owner.avatar_url} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{ownerName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {profileHandle(team.owner.username) || "Project owner"} · Owner
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                        Owner
                      </span>
                    </div>
                  </div>

                  {team.isOwner && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void add();
                      }}
                      className="rounded-xl border border-border bg-surface/30 p-3 space-y-2"
                    >
                      <label className="text-xs font-medium text-muted-foreground">
                        Add by BloxSmith username
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="@buildername"
                          maxLength={80}
                          disabled={!canAdd || busy}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={!canAdd || busy || !username.trim()}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Team size: {count}/{max}. Collaborators use their own credits for AI, 3D, and image work.
                      </p>
                    </form>
                  )}

                  <div className="space-y-2">
                    {team.collaborators.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No collaborators yet. Add a username to let someone work on this Roblox project with you.
                      </div>
                    ) : (
                      team.collaborators.map((member) => {
                        const name = member.display_name || profileHandle(member.username).slice(1) || "Teammate";
                        return (
                          <div
                            key={member.id}
                            className="rounded-xl border border-border bg-surface/35 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={name} url={member.avatar_url} />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {profileHandle(member.username) || "No username"} · {member.role}
                                </div>
                              </div>
                            </div>
                            {team.isOwner && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={member.role}
                                  disabled={busy}
                                  onChange={(e) => changeRole(member.id, e.target.value as "editor" | "viewer")}
                                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                                >
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <button
                                  onClick={() => removeMember(member.id, name)}
                                  disabled={busy}
                                  className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  title="Remove collaborator"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
