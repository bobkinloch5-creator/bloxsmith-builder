import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PluginProjectSummary = {
  id: string;
  name: string;
  game_type: string;
  updated_at: string;
};

export type PluginProjectAccess = {
  id: string;
  user_id: string;
  name: string;
};

export async function listPluginProjectsForUser(userId: string): Promise<PluginProjectSummary[]> {
  const [{ data: owned }, { data: collabs }] = await Promise.all([
    supabaseAdmin
      .from("projects")
      .select("id,name,game_type,updated_at")
      .or(`user_id.eq.${userId},owner_id.eq.${userId}`)
      .order("updated_at", { ascending: false }),
    supabaseAdmin.from("project_collaborators").select("project_id").eq("user_id", userId),
  ]);

  const collabIds = Array.from(
    new Set(((collabs ?? []) as { project_id: string }[]).map((row) => row.project_id)),
  );
  let shared: PluginProjectSummary[] = [];
  if (collabIds.length) {
    const { data } = await supabaseAdmin
      .from("projects")
      .select("id,name,game_type,updated_at")
      .in("id", collabIds)
      .order("updated_at", { ascending: false });
    shared = (data ?? []) as PluginProjectSummary[];
  }

  const byId = new Map<string, PluginProjectSummary>();
  [...((owned ?? []) as PluginProjectSummary[]), ...shared].forEach((project) =>
    byId.set(project.id, project),
  );
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function getPluginProjectForUser(
  userId: string,
  projectId: string,
): Promise<PluginProjectAccess | null> {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id,user_id,owner_id,name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;
  if ((project.user_id ?? project.owner_id) === userId) {
    return { id: project.id, user_id: (project.user_id ?? project.owner_id) as string, name: project.name };
  }

  const { data: collab } = await supabaseAdmin
    .from("project_collaborators")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  return collab ? (project as PluginProjectAccess) : null;
}

export async function getAccessiblePluginProjectIds(
  userId: string,
  requestedIds: string[],
): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(requestedIds));
  const allowed = new Set<string>();
  if (uniqueIds.length === 0) return allowed;

  const [{ data: owned }, { data: collabs }] = await Promise.all([
    supabaseAdmin
      .from("projects")
      .select("id")
      .or(`user_id.eq.${userId},owner_id.eq.${userId}`)
      .in("id", uniqueIds),
    supabaseAdmin
      .from("project_collaborators")
      .select("project_id")
      .eq("user_id", userId)
      .in("project_id", uniqueIds),
  ]);

  (owned ?? []).forEach((project: { id: string }) => allowed.add(project.id));
  (collabs ?? []).forEach((row: { project_id: string }) => allowed.add(row.project_id));
  return allowed;
}
