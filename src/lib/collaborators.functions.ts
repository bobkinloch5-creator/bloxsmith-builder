import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeProfileUsername } from "@/lib/profile-username";
import { z } from "zod";

const MAX_TEAM_SIZE = 5;
const MAX_COLLABORATORS = MAX_TEAM_SIZE - 1;

type ProfileLite = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

async function getProjectAccess(userId: string, projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,user_id,owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) throw new Error("Project not found");
  const ownerId = data.user_id ?? data.owner_id;
  if (ownerId === userId) return { project: { ...data, user_id: ownerId }, isOwner: true };

  const { data: collab } = await supabaseAdmin
    .from("project_collaborators")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!collab) throw new Error("You do not have access to this project");
  return { project: { ...data, user_id: ownerId }, isOwner: false };
}

async function assertOwner(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);
  if (!access.isOwner) throw new Error("Only the project owner can manage collaborators");
  return access.project;
}

async function profilesById(ids: string[]) {
  if (ids.length === 0) return new Map<string, ProfileLite>();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name,username,avatar_url")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p: any) => [p.id, p as ProfileLite]));
}

export const listCollaborators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { project, isOwner } = await getProjectAccess(userId, data.projectId);
    const { data: rows, error } = await supabaseAdmin
      .from("project_collaborators")
      .select("id,project_id,user_id,role,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const profileMap = await profilesById([project.user_id, ...(rows ?? []).map((r: any) => r.user_id)]);
    const ownerProfile = profileMap.get(project.user_id);
    return {
      owner: {
        id: project.user_id,
        display_name: ownerProfile?.display_name ?? "Project owner",
        username: ownerProfile?.username ?? null,
        avatar_url: ownerProfile?.avatar_url ?? null,
      },
      isOwner,
      maxTeamSize: MAX_TEAM_SIZE,
      collaborators: (rows ?? []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          created_at: row.created_at,
          display_name: profile?.display_name ?? "Teammate",
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      }),
    };
  });

export const inviteCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        username: z.string().min(2).max(80),
        role: z.enum(["viewer", "editor"]).default("editor"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const project = await assertOwner(userId, data.projectId);
    const username = normalizeProfileUsername(data.username.replace(/^@+/, ""));
    if (!username) throw new Error("Enter a valid BloxSmith username.");

    const { count, error: countErr } = await supabaseAdmin
      .from("project_collaborators")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) >= MAX_COLLABORATORS) {
      throw new Error(`Projects support ${MAX_TEAM_SIZE} people total: 1 owner and ${MAX_COLLABORATORS} collaborators.`);
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .or(`username_normalized.eq.${username},username.eq.${username}`)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error(`No BloxSmith user found for @${username}. Ask them to set a unique username in Profile settings.`);
    if (profile.id === project.user_id) throw new Error("That user already owns this project.");

    const { error } = await supabaseAdmin.from("project_collaborators").insert({
      project_id: data.projectId,
      user_id: profile.id,
      role: data.role,
    });
    if (error) {
      if ((error.message || "").toLowerCase().includes("duplicate")) {
        throw new Error("That user is already a collaborator on this project.");
      }
      throw new Error(error.message);
    }

    return {
      collaborator: {
        user_id: profile.id,
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        role: data.role,
      },
    };
  });

export const updateCollaboratorRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        collaboratorId: z.string().uuid(),
        role: z.enum(["viewer", "editor"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.projectId);
    const { error } = await supabaseAdmin
      .from("project_collaborators")
      .update({ role: data.role })
      .eq("id", data.collaboratorId)
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        collaboratorId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwner(userId, data.projectId);
    const { error } = await supabaseAdmin
      .from("project_collaborators")
      .delete()
      .eq("id", data.collaboratorId)
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
