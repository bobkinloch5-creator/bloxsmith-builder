import { resolveBuiltInGateway } from "./ai-providers.server";

export type Severity = "error" | "warning" | "info";
export type FindingKind =
  | "missing_remote"
  | "script_placement"
  | "data_save"
  | "broken_ui"
  | "missing_folder"
  | "broken_button"
  | "syntax"
  | "runtime_error"
  | "backdoor"
  | "missing_pcall"
  | "zero_size_ui"
  | "orphaned_remote"
  | "performance"
  | "missing_spawn"
  | "missing_asset"
  | "broken_npc"
  | "broken_tool"
  | "deprecated_api"
  | "other";

export type Finding = {
  id: string;
  severity: Severity;
  kind: FindingKind;
  title: string;
  detail: string;
  target: string; // Studio path the problem relates to
};

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  target: string;
  actionType: string; // a plugin action type: script / create / set / move / ...
};

export type PlaytestPlan = {
  summary: string;
  steps: PlanStep[];
};

export type ProjectFile = {
  path: string;
  file_type: string;
  service_location: string;
  content: string;
};

export type StudioError = { file_path: string | null; error_message: string };

let counter = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

function cleanStudioName(value: string | undefined, fallback: string) {
  const cleaned = String(value || fallback)
    .split("/")
    .pop()
    ?.replace(/[^A-Za-z0-9_ ]+/g, " ")
    .trim()
    .replace(/\s+/g, "") || fallback;
  return cleaned || fallback;
}

function uniqueActions(actions: any[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (!action || typeof action.type !== "string") return false;
    const key = JSON.stringify({
      type: action.type,
      path: action.path,
      parent: action.parent,
      name: action.name,
      property: action.property,
      to: action.to,
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nearestGuiRoot(target: string) {
  const parts = String(target || "").split("/").filter(Boolean);
  const starterGuiIndex = parts.findIndex((p) => p === "StarterGui");
  if (starterGuiIndex >= 0 && parts[starterGuiIndex + 1]) {
    return parts.slice(0, starterGuiIndex + 2).join("/");
  }
  return "StarterGui/BloxSmithUI";
}

function inferMoveDestination(step: PlanStep) {
  const text = `${step.title} ${step.detail} ${step.target}`.toLowerCase();
  if (/localplayer|mouse|userinputservice|playergui|camera|button|screen|gui/.test(text)) return "StarterGui";
  if (/datastore|leaderstats|serverstorage|serverscript|bindtoclose|marketplaceservice/.test(text)) return "ServerScriptService";
  if (/remote|shared|module|replicatedstorage/.test(text)) return "ReplicatedStorage";
  return "ServerScriptService";
}

function inferCreateAction(step: PlanStep) {
  const parts = String(step.target || "ReplicatedStorage/BloxSmithRemote").split("/").filter(Boolean);
  const name = cleanStudioName(parts.pop(), "BloxSmithRemote");
  const parent = parts.join("/") || "ReplicatedStorage";
  const text = `${step.title} ${step.detail} ${step.target}`.toLowerCase();
  const className =
    /folder|directory|container/.test(text)
      ? "Folder"
      : /function|invoke/.test(text)
        ? "RemoteFunction"
        : "RemoteEvent";
  return { type: "create", className, name, parent };
}

function buildButtonWiringSource(steps: PlanStep[]) {
  const names = Array.from(
    new Set(
      steps
        .map((step) => cleanStudioName(step.target, "ActionButton"))
        .filter((name) => /button/i.test(name)),
    ),
  );
  const buttonNames = names.length > 0 ? names : ["PlayButton", "SettingsButton", "ShopButton", "CloseButton", "ActionButton"];
  return `-- BloxSmith Playtest repair
-- Wires common UI buttons so generated menus/dialogues respond during testing.
local TweenService = game:GetService("TweenService")
local gui = script.Parent
local buttonNames = { ${buttonNames.map((name) => JSON.stringify(name)).join(", ")} }

local function connectButton(button)
\tif not (button:IsA("TextButton") or button:IsA("ImageButton")) then return end
\tif button:GetAttribute("BloxSmithWired") then return end
\tbutton:SetAttribute("BloxSmithWired", true)
\tlocal normalSize = button.Size
\tbutton.MouseEnter:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
\t\t\tSize = normalSize + UDim2.fromOffset(4, 2)
\t\t}):Play()
\tend)
\tbutton.MouseLeave:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize }):Play()
\tend)
\tbutton.Activated:Connect(function()
\t\tprint("[BloxSmith Playtest] clicked", button:GetFullName())
\t\tif button.Name == "CloseButton" then
\t\t\tlocal root = button:FindFirstAncestorOfClass("ScreenGui") or gui
\t\t\tif root:IsA("ScreenGui") then root.Enabled = false end
\t\tend
\tend)
end

for _, name in ipairs(buttonNames) do
\tlocal button = gui:FindFirstChild(name, true)
\tif button then connectButton(button) end
end

for _, item in ipairs(gui:GetDescendants()) do
\tif item:IsA("TextButton") or item:IsA("ImageButton") then
\t\tconnectButton(item)
\tend
end`;
}

function buildDiagnosticsSource(opts: { request: string; steps: PlanStep[] }) {
  const stepLines = opts.steps
    .slice(0, 12)
    .map((step, index) => `-- ${index + 1}. ${step.title} (${step.actionType}) @ ${step.target}\n--    ${step.detail.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");
  return `-- BloxSmith Playtest diagnostic script
-- Created because the automatic action converter needed a safe fallback.
-- Request: ${opts.request.replace(/\s+/g, " ").slice(0, 240)}
${stepLines}

print("[BloxSmith Playtest] Diagnostic fixes were applied. Review the listed issues, then run Playtest again.")`;
}

function deterministicActionsForSteps(opts: {
  request: string;
  steps: PlanStep[];
  files: ProjectFile[];
}) {
  const actions: any[] = [];
  const buttonSteps: PlanStep[] = [];

  actions.push({ type: "create", className: "Folder", name: "BloxSmithPlaytest", parent: "ReplicatedStorage" });

  for (const step of opts.steps.slice(0, 12)) {
    const text = `${step.actionType} ${step.title} ${step.detail} ${step.target}`.toLowerCase();
    if (step.actionType === "create" || /missing remote|remoteevent|remotefunction|missing folder/.test(text)) {
      actions.push(inferCreateAction(step));
    }
    if (step.actionType === "move" || /wrong place|placement|local script|localscript|server script|serverscript/.test(text)) {
      actions.push({ type: "move", path: step.target, to: inferMoveDestination(step) });
    }
    if (step.actionType === "set" && step.target) {
      actions.push({ type: "set", path: step.target, property: "Visible", value: true });
    }
    if (/button|activated|mousebutton|clickable|clicking it does nothing/.test(text)) {
      buttonSteps.push(step);
    }
  }

  if (buttonSteps.length > 0) {
    const guiRoot = nearestGuiRoot(buttonSteps[0].target);
    actions.push({
      type: "script",
      path: `${guiRoot}/BloxSmithButtonWiring`,
      source: buildButtonWiringSource(buttonSteps),
    });
  }

  actions.push({
    type: "script",
    path: "ServerScriptService/BloxSmithPlaytestDiagnostics",
    source: buildDiagnosticsSource(opts),
  });

  return uniqueActions(actions).slice(0, 40);
}

/**
 * Fast, deterministic heuristics over the synced project files + captured
 * Studio Output errors. These run with zero AI cost and catch the most common
 * Roblox mistakes the user named (missing RemoteEvents, bad script placement,
 * no DataStore saving, broken UI references, syntax issues). The AI step then
 * turns these + the user's request into a clear, human plan.
 */
export function runHeuristics(files: ProjectFile[], errors: StudioError[]): Finding[] {
  const found: Finding[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  const allSource = files.map((f) => f.content || "").join("\n");

  const isScript = (f: ProjectFile) =>
    /Script$/.test(f.file_type) || ["Script", "LocalScript", "ModuleScript"].includes(f.file_type);

  // 1) Runtime errors captured from the Studio Output window.
  for (const e of errors.slice(0, 25)) {
    found.push({
      id: nid("err"),
      severity: "error",
      kind: "runtime_error",
      title: "Runtime error in Output",
      detail: e.error_message.slice(0, 300),
      target: e.file_path || "Output",
    });
  }

  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;

    // 2) RemoteEvent referenced but never created anywhere in the project.
    const remoteRefs = [...src.matchAll(/(?:WaitForChild|FindFirstChild)\(\s*["']([A-Za-z0-9_]+)["']\s*\)/g)]
      .map((m) => m[1])
      .filter((name) => /remote|event|rf|re_|fire|invoke/i.test(name) || src.includes(`${name}:FireServer`) || src.includes(`${name}:FireClient`));
    for (const name of new Set(remoteRefs)) {
      const createdSomewhere =
        new RegExp(`Instance\\.new\\(\\s*["']Remote(?:Event|Function)["']`).test(allSource) &&
        allSource.includes(name);
      const existsAsFile = files.some(
        (o) => /Remote(Event|Function)/.test(o.file_type) && o.path.endsWith(name),
      );
      if (!createdSomewhere && !existsAsFile) {
        found.push({
          id: nid("rem"),
          severity: "error",
          kind: "missing_remote",
          title: `Missing RemoteEvent: ${name}`,
          detail: `${f.path} calls "${name}" but no RemoteEvent/RemoteFunction named "${name}" is created or present. Client/server messaging will error.`,
          target: `ReplicatedStorage/${name}`,
        });
      }
    }

    // 3) Script placement: server APIs used inside a LocalScript or vice versa.
    if (f.file_type === "LocalScript" && /DataStoreService|:GetDataStore\(/.test(src)) {
      found.push({
        id: nid("place"),
        severity: "error",
        kind: "script_placement",
        title: "DataStore used in a LocalScript",
        detail: `${f.path} uses DataStoreService, which only works on the server. It must be a Script in ServerScriptService.`,
        target: f.path,
      });
    }
    if (
      f.file_type === "Script" &&
      /:GetMouse\(\)|UserInputService|game\.Players\.LocalPlayer/.test(src) &&
      !/RunService:IsClient/.test(src)
    ) {
      found.push({
        id: nid("place"),
        severity: "warning",
        kind: "script_placement",
        title: "Client API used in a server Script",
        detail: `${f.path} references LocalPlayer / input APIs from a server Script. These run on the client only — this likely belongs in a LocalScript.`,
        target: f.path,
      });
    }

    // 4) Saving issues: DataStore get without any set/update (reads but never saves).
    if (/:GetDataStore\(/.test(src)) {
      const reads = /:GetAsync\(/.test(src);
      const writes = /:SetAsync\(|:UpdateAsync\(|:IncrementAsync\(/.test(src);
      if (reads && !writes) {
        found.push({
          id: nid("save"),
          severity: "error",
          kind: "data_save",
          title: "Data loads but never saves",
          detail: `${f.path} reads from a DataStore (GetAsync) but never writes (SetAsync/UpdateAsync). Player progress (coins, stats) won't persist.`,
          target: f.path,
        });
      }
      if (writes && !/BindToClose/.test(allSource)) {
        found.push({
          id: nid("save"),
          severity: "warning",
          kind: "data_save",
          title: "No save on game close",
          detail: `Saving exists but there's no game:BindToClose handler, so data can be lost when the server shuts down.`,
          target: f.path,
        });
      }
    }

    // 5) Syntax red flags (cheap checks; the plugin/Studio is the source of truth).
    const opens = (src.match(/\b(function|if|for|while|do)\b/g) || []).length;
    const ends = (src.match(/\bend\b/g) || []).length;
    if (opens > 0 && ends < opens - 1) {
      found.push({
        id: nid("syn"),
        severity: "warning",
        kind: "syntax",
        title: "Possibly missing 'end'",
        detail: `${f.path} has ${opens} block openers but only ${ends} 'end' keywords — it may not compile.`,
        target: f.path,
      });
    }
  }

  // 6) Broken UI: a TextButton/ImageButton with no .Activated/.MouseButton1Click handler anywhere.
  const buttons = files.filter((f) => /TextButton|ImageButton/.test(f.file_type));
  for (const b of buttons) {
    const name = b.path.split("/").pop() || b.path;
    const wired = new RegExp(`${name}[^\\n]*(Activated|MouseButton1Click|MouseButton1Down)`).test(allSource) ||
      allSource.includes(`${name}.Activated`);
    if (!wired) {
      found.push({
        id: nid("btn"),
        severity: "warning",
        kind: "broken_button",
        title: `Button not wired: ${name}`,
        detail: `${b.path} is a clickable button but nothing connects to its Activated/MouseButton1Click event, so clicking it does nothing.`,
        target: b.path,
      });
    }
  }

  // 7) Missing common folders the project's scripts assume.
  const needsReplicatedStorage = /ReplicatedStorage[:.]/.test(allSource);
  const hasReplicatedStorageFolder = files.some((f) => f.service_location === "ReplicatedStorage");
  if (needsReplicatedStorage && !hasReplicatedStorageFolder) {
    found.push({
      id: nid("fold"),
      severity: "warning",
      kind: "missing_folder",
      title: "ReplicatedStorage looks empty",
      detail: `Scripts reference ReplicatedStorage but nothing is stored there. Shared modules/remotes may be missing.`,
      target: "ReplicatedStorage",
    });
  }

  // 8) Backdoor detection: require(assetId) or loadstring patterns.
  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;
    if (/require\s*\(\s*\d{6,}\s*\)/.test(src)) {
      found.push({
        id: nid("back"),
        severity: "error",
        kind: "backdoor",
        title: "Possible backdoor: require(assetId)",
        detail: `${f.path} contains require(large_number) which is a common Roblox backdoor pattern. This script should be inspected and the require removed.`,
        target: f.path,
      });
    }
    if (/loadstring\s*\(/.test(src)) {
      found.push({
        id: nid("back"),
        severity: "error",
        kind: "backdoor",
        title: "Possible backdoor: loadstring()",
        detail: `${f.path} uses loadstring() which can execute arbitrary code. This is a security risk and is disabled in published Roblox games.`,
        target: f.path,
      });
    }
    if (/HttpService.*:GetAsync|HttpService.*:PostAsync/.test(src) && !/roblox\.com|roproxy/.test(src)) {
      found.push({
        id: nid("back"),
        severity: "warning",
        kind: "backdoor",
        title: "Suspicious HTTP request",
        detail: `${f.path} makes HTTP requests to external URLs. Verify these are safe and intentional.`,
        target: f.path,
      });
    }
  }

  // 9) Missing pcall around DataStore operations.
  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;
    if (/:GetAsync\(|:SetAsync\(|:UpdateAsync\(|:RemoveAsync\(|:IncrementAsync\(/.test(src)) {
      // Check if the DataStore call is wrapped in pcall/xpcall
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/:GetAsync\(|:SetAsync\(|:UpdateAsync\(|:RemoveAsync\(|:IncrementAsync\(/.test(line)) {
          // Look at surrounding lines for pcall
          const context = lines.slice(Math.max(0, i - 3), i + 1).join(" ");
          if (!/pcall|xpcall/.test(context)) {
            found.push({
              id: nid("pcall"),
              severity: "warning",
              kind: "missing_pcall",
              title: "DataStore call without pcall",
              detail: `${f.path} line ${i + 1}: DataStore operations can fail and should be wrapped in pcall() to prevent script crashes.`,
              target: f.path,
            });
            break; // One warning per file is enough
          }
        }
      }
    }
  }

  // 10) UI elements with zero size.
  const uiElements = files.filter((f) => /Frame|TextLabel|TextButton|ImageLabel|ImageButton|ScrollingFrame/.test(f.file_type));
  for (const ui of uiElements) {
    const name = ui.path.split("/").pop() || ui.path;
    // Check if the content mentions size 0 or if file_type suggests it's a UI element with no size config
    if (ui.content && /Size\s*=\s*UDim2\.new\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(ui.content)) {
      found.push({
        id: nid("uisz"),
        severity: "warning",
        kind: "zero_size_ui",
        title: `Zero-size UI element: ${name}`,
        detail: `${ui.path} has Size = UDim2.new(0,0,0,0) which makes it invisible. Set a real size.`,
        target: ui.path,
      });
    }
  }

  // 11) Orphaned RemoteEvents (created but never connected to).
  const createdRemotes = [...allSource.matchAll(/Instance\.new\(["']Remote(?:Event|Function)["']\)[\s\S]{0,80}Name\s*=\s*["']([A-Za-z0-9_]+)["']/g)]
    .map((m) => m[1]);
  for (const remoteName of new Set(createdRemotes)) {
    const hasHandler = new RegExp(`${remoteName}[\\s\\S]{0,30}(?:OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke|:Connect)`).test(allSource);
    const hasFire = new RegExp(`${remoteName}[\\s\\S]{0,30}(?:FireServer|FireClient|FireAllClients|InvokeServer|InvokeClient)`).test(allSource);
    if (!hasHandler && !hasFire) {
      found.push({
        id: nid("orph"),
        severity: "warning",
        kind: "orphaned_remote",
        title: `Orphaned remote: ${remoteName}`,
        detail: `A RemoteEvent/Function named "${remoteName}" is created but nothing connects to it or fires it. It may be unused or missing its handler.`,
        target: `ReplicatedStorage/${remoteName}`,
      });
    }
  }

  // 12) Performance anti-patterns.
  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;
    // Instance.new inside a while/RenderStepped/Heartbeat loop without Debris
    if (/(?:RenderStepped|Heartbeat|Stepped):Connect.*Instance\.new/s.test(src) && !/Debris/.test(src)) {
      found.push({
        id: nid("perf"),
        severity: "warning",
        kind: "performance",
        title: "Instance.new in per-frame loop",
        detail: `${f.path} creates new instances every frame without cleanup (Debris). This will cause memory leaks and lag.`,
        target: f.path,
      });
    }
    // while true do without task.wait
    if (/while\s+true\s+do/.test(src) && !/task\.wait|wait\(/.test(src)) {
      found.push({
        id: nid("perf"),
        severity: "error",
        kind: "performance",
        title: "Infinite loop without wait",
        detail: `${f.path} has a 'while true do' loop without any task.wait() or wait() call. This will freeze the game.`,
        target: f.path,
      });
    }
  }

  // 13) Missing SpawnLocation — game needs at least one.
  const hasSpawn = files.some((f) => /SpawnLocation/.test(f.file_type) || /SpawnLocation|:IsA\(["']SpawnLocation/.test(f.content || ""));
  const hasWorkspaceContent = files.some((f) => f.service_location === "Workspace" || f.service_location?.startsWith("Workspace/"));
  if (hasWorkspaceContent && !hasSpawn) {
    found.push({
      id: nid("spn"),
      severity: "warning",
      kind: "missing_spawn",
      title: "No SpawnLocation found",
      detail: "The project has Workspace content but no SpawnLocation. Players will spawn at the default position (0,100,0) which may be above or below the map.",
      target: "Workspace",
    });
  }

  // 14) Missing / broken asset references (empty or zeroed asset IDs).
  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;
    const brokenAsset =
      /\b(SoundId|Texture|TextureId|MeshId|Image|HatAttachment|Decal)\s*=\s*["'](?:rbxassetid:\/\/0?|)["']/.test(src) ||
      /rbxassetid:\/\/0\b/.test(src);
    if (brokenAsset) {
      found.push({
        id: nid("asset"),
        severity: "warning",
        kind: "missing_asset",
        title: "Empty or zeroed asset ID",
        detail: `${f.path} sets a SoundId/Texture/MeshId/Image to an empty string or rbxassetid://0. The sound/decal/mesh will be silent or invisible — fill in a real free asset ID.`,
        target: f.path,
      });
    }
  }

  // 15) NPC models with no Humanoid (won't walk, animate, or take damage).
  const npcModels = files.filter(
    (f) =>
      f.file_type === "Model" &&
      /\b(NPC|Npc|Enemy|Mob|Zombie|Guard|Villager|Merchant|Boss|Character|Monster)\b/.test(f.path),
  );
  for (const m of npcModels) {
    const childPrefix = m.path + "/";
    const hasHumanoid = files.some(
      (o) => o.file_type === "Humanoid" && o.path.startsWith(childPrefix),
    );
    if (!hasHumanoid) {
      found.push({
        id: nid("npc"),
        severity: "warning",
        kind: "broken_npc",
        title: `NPC has no Humanoid: ${m.path.split("/").pop()}`,
        detail: `${m.path} looks like an NPC but contains no Humanoid, so it can't walk, animate, pathfind, or take damage. Add a Humanoid (and a PrimaryPart) to make it a working character.`,
        target: m.path,
      });
    }
  }

  // 16) Tools with no Handle (can't be equipped without one unless RequiresHandle=false).
  const tools = files.filter((f) => f.file_type === "Tool");
  for (const t of tools) {
    const childPrefix = t.path + "/";
    const hasHandle = files.some(
      (o) => o.path.startsWith(childPrefix) && /\/Handle$/.test(o.path) && /Part|MeshPart/.test(o.file_type),
    );
    if (!hasHandle) {
      found.push({
        id: nid("tool"),
        severity: "warning",
        kind: "broken_tool",
        title: `Tool has no Handle: ${t.path.split("/").pop()}`,
        detail: `${t.path} is a Tool with no part named "Handle". It won't appear in the player's hand when equipped unless you set Tool.RequiresHandle = false. Add a Part named Handle.`,
        target: t.path,
      });
    }
  }

  // 17) Deprecated / legacy APIs — still run, but cause lag and subtle bugs.
  const DEPRECATED: Array<{ re: RegExp; fix: string }> = [
    { re: /(?:^|[^.\w])wait\s*\(/m, fix: "use task.wait() instead of the global wait() (more accurate, no throttling)" },
    { re: /(?:^|[^.\w])spawn\s*\(/m, fix: "use task.spawn() instead of the global spawn()" },
    { re: /(?:^|[^.\w])delay\s*\(/m, fix: "use task.delay() instead of the global delay()" },
    { re: /:remove\s*\(\s*\)/m, fix: "use :Destroy() instead of the deprecated :remove()" },
    { re: /Humanoid:LoadAnimation\b/m, fix: "load animations on the Humanoid's Animator (Humanoid:WaitForChild('Animator'):LoadAnimation) — Humanoid:LoadAnimation is deprecated" },
    { re: /workspace:FindPartOnRay\b|:FindPartOnRay\b/m, fix: "use workspace:Raycast() instead of the deprecated FindPartOnRay" },
  ];
  for (const f of files) {
    const src = f.content || "";
    if (!isScript(f)) continue;
    for (const d of DEPRECATED) {
      if (d.re.test(src)) {
        found.push({
          id: nid("dep"),
          severity: "info",
          kind: "deprecated_api",
          title: "Deprecated API in use",
          detail: `${f.path}: ${d.fix}.`,
          target: f.path,
        });
        break; // one deprecated-API note per file is enough
      }
    }
  }

  return found;
}

/**
 * Convert approved plan steps into concrete, ready-to-apply plugin actions
 * (with real Luau source, instance names, parents, etc.). Returns an array of
 * plugin action objects the Studio plugin understands. Falls back to safe,
 * minimal actions if the AI is unavailable.
 */
export async function buildActionsForSteps(opts: {
  request: string;
  steps: PlanStep[];
  files: ProjectFile[];
}): Promise<any[]> {
  try {
    const gw = resolveBuiltInGateway({ kind: "build", thinking: true });
    const { generateText } = await import("ai");
    const fileIndex = opts.files.map((f) => ({
      path: f.path,
      file_type: f.file_type,
      service_location: f.service_location,
    }));
    const sys =
      "You are BloxSmith Playtest AI. Convert approved fix steps into concrete Roblox Studio plugin actions. " +
      "Output ONLY a JSON array of actions. Each action is one of:\n" +
      '{"type":"script","path":"ServerScriptService/Name","source":"<luau>"}\n' +
      '{"type":"create","className":"RemoteEvent","name":"Buy","parent":"ReplicatedStorage"}\n' +
      '{"type":"create","className":"Folder","name":"Remotes","parent":"ReplicatedStorage"}\n' +
      '{"type":"move","path":"StarterGui/Handler","to":"ServerScriptService"}\n' +
      '{"type":"set","path":"...","property":"...","value":...}\n' +
      "Use valid Roblox service paths and syntactically valid Luau. Keep changes minimal and focused on the steps. No prose, no markdown.";
    const user = `USER REQUEST: ${opts.request}\n\nAPPROVED STEPS:\n${JSON.stringify(opts.steps, null, 0)}\n\nFILE INDEX:\n${JSON.stringify(fileIndex.slice(0, 120), null, 0)}`;
    const { text } = await generateText({
      model: gw.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const actions = parsed
        .filter((a) => a && typeof a.type === "string")
        .slice(0, 40);
      if (actions.length > 0) return actions;
    }
  } catch {
    // fall through to deterministic minimal actions
  }
  return deterministicActionsForSteps(opts);
}

/**
 * Ask the model to (a) interpret the user's plain-language request, (b) prioritise
 * the heuristic findings against it, and (c) produce a short, human plan. Returns
 * a structured plan; falls back to a deterministic plan if the AI is unavailable.
 */
export async function synthesizePlan(opts: {
  request: string;
  findings: Finding[];
  fileIndex: { path: string; file_type: string }[];
}): Promise<PlaytestPlan> {
  const fallback: PlaytestPlan = {
    summary:
      opts.findings.length > 0
        ? `Found ${opts.findings.length} issue(s). Proposed fixes are listed below.`
        : "No obvious problems found in the current scan.",
    steps: opts.findings.slice(0, 8).map((f) => ({
      id: f.id,
      title: f.title,
      detail: f.detail,
      target: f.target,
      actionType:
        f.kind === "missing_remote"
          ? "create"
          : f.kind === "script_placement"
            ? "move"
            : "script",
    })),
  };

  try {
    const gw = resolveBuiltInGateway({ kind: "build", thinking: true });
    const { generateText } = await import("ai");
    const sys =
      "You are BloxSmith Playtest AI, a Roblox QA developer. You receive a user's plain-language request, a list of detected issues, and a file index. " +
      "Interpret what the user actually wants, choose the issues that matter for that request, and output a SHORT fix plan. " +
      "Respond with ONLY JSON: {\"summary\":string,\"steps\":[{\"id\":string,\"title\":string,\"detail\":string,\"target\":string,\"actionType\":string}]}. " +
      "actionType must be one of: script, update_script, create, create_part, set, move, rename, organize. No prose, no markdown.";
    const user = `USER REQUEST: ${opts.request || "(general health check)"}\n\nDETECTED ISSUES:\n${JSON.stringify(opts.findings, null, 0)}\n\nFILE INDEX:\n${JSON.stringify(opts.fileIndex.slice(0, 120), null, 0)}`;
    const { text } = await generateText({
      model: gw.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    });
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.steps)) {
      return {
        summary: String(parsed.summary || fallback.summary),
        steps: parsed.steps.slice(0, 12).map((s: any, i: number) => ({
          id: String(s.id || `step_${i}`),
          title: String(s.title || "Fix"),
          detail: String(s.detail || ""),
          target: String(s.target || ""),
          actionType: String(s.actionType || "script"),
        })),
      };
    }
  } catch {
    // AI unavailable or returned non-JSON — deterministic plan is fine.
  }
  return fallback;
}
