import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNeokensApiKey } from "@/lib/neokens-config.server";
import { stripModelReasoning, looksLikeModelReasoning } from "@/lib/utils";
import { extractBuildJson } from "@/lib/build-json";
import { z } from "zod";

const InputSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(8000),
  mode: z.enum(["chat", "generate"]).default("generate"),
  preview: z.boolean().default(true),
  thinking: z.boolean().default(false),
  mapStrategy: z.enum(["toolbox", "custom"]).nullish(),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Must be a data:image base64 URL")
    .max(8_000_000)
    .optional(),
  imageDataUrls: z
    .array(
      z
        .string()
        .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Must be a data:image base64 URL")
        .max(8_000_000),
    )
    .max(4)
    .optional(),
});

type GenFile = {
  path: string;
  file_type: "Script" | "LocalScript" | "ModuleScript";
  service_location: string;
  content: string;
};

type GenAction = { type: string; [k: string]: any };

// extractBuildJson now lives in @/lib/build-json (imported above) so it can be
// unit-tested in isolation and so it can salvage TRUNCATED model output — a
// nearly-complete build that hit the output-token cap — instead of discarding
// it and returning a thin/empty result.

// Is this prompt clearly asking to build/edit something (vs a pure question)?
function isBuildIntent(prompt: string): boolean {
  return /\b(make|add|create|build|generate|spawn|insert|give me|need|want|put|place|design|set up|setup|recreate|replicate|replica|clone|copy|match|remake)\b/i.test(
    prompt,
  );
}

function isBuildingReplicaPrompt(prompt: string): boolean {
  return (
    /\b(1\s*:?\s*1|one[-\s]?to[-\s]?one|replica|replicate|recreate|clone|copy|match|reference|from (the )?(image|picture|photo)|attached image)\b[\s\S]{0,120}\b(building|house|home|tower|castle|temple|facade|structure|mansion|shop|store|base)\b/i.test(
      prompt,
    ) ||
    /\b(building|house|home|tower|castle|temple|facade|structure|mansion|shop|store|base)\b[\s\S]{0,120}\b(1\s*:?\s*1|one[-\s]?to[-\s]?one|replica|replicate|recreate|clone|copy|match|reference|from (the )?(image|picture|photo)|attached image)\b/i.test(
      prompt,
    )
  );
}

// Last-resort fallback so a build request NEVER returns an empty bubble. These
// are minimal but real, working builds. Used only when the model returned no
// actions/files at all for a clear build request. Returns null for pure
// questions so we don't dump random parts into someone's game.
function getBuildFallback(
  prompt: string,
): { message: string; files: GenFile[]; actions: GenAction[] } | null {
  if (!isBuildIntent(prompt)) return null;
  const p = prompt.toLowerCase();

  if (isBuildingReplicaPrompt(prompt)) {
    return getBuildingReplicaFallback(prompt);
  }

  const screenGui = (name: string) => ({
    type: "create",
    className: "ScreenGui",
    name,
    parent: "StarterGui/BloxsmithUI",
    properties: {
      ResetOnSpawn: false,
      IgnoreGuiInset: true,
      ZIndexBehavior: { __t: "Enum", enum: "ZIndexBehavior", value: "Sibling" },
    },
  });

  // Main menu (the case in the user's screenshot).
  if (/\b(main menu|menu|title screen|start screen|home screen)\b/.test(p)) {
    return {
      message:
        "Queued a main menu for Studio — a centered panel with Play, Shop, and Settings buttons plus hover animations. Push it when ready, then tweak the labels or colors and I'll refine it.",
      files: [
        {
          path: "StarterPlayer/StarterPlayerScripts/UI/MainMenu.client.lua",
          file_type: "LocalScript",
          service_location: "StarterPlayer/StarterPlayerScripts/UI",
          content: `-- BloxSmith Main Menu
local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")
local gui = script.Parent:WaitForChild("MainMenu")
local panel = gui:WaitForChild("Panel")

local function wireButton(btn)
\tlocal base = btn.Size
\tlocal grow = UDim2.new(base.X.Scale, base.X.Offset + 8, base.Y.Scale, base.Y.Offset + 4)
\tbtn.MouseEnter:Connect(function()
\t\tTweenService:Create(btn, TweenInfo.new(0.15), { Size = grow }):Play()
\tend)
\tbtn.MouseLeave:Connect(function()
\t\tTweenService:Create(btn, TweenInfo.new(0.15), { Size = base }):Play()
\tend)
end

for _, child in ipairs(panel:GetChildren()) do
\tif child:IsA("TextButton") then wireButton(child) end
end

local play = panel:FindFirstChild("PlayButton")
if play then
\tplay.MouseButton1Click:Connect(function()
\t\tgui.Enabled = false
\tend)
end
`,
        },
      ],
      actions: [
        screenGui("MainMenu"),
        {
          type: "create",
          className: "Frame",
          name: "Panel",
          parent: "StarterGui/BloxsmithUI/MainMenu",
          properties: {
            Size: { __t: "UDim2", xs: 0.32, xo: 0, ys: 0.5, yo: 0 },
            Position: { __t: "UDim2", xs: 0.5, xo: 0, ys: 0.5, yo: 0 },
            AnchorPoint: { __t: "Vector2", x: 0.5, y: 0.5 },
            BackgroundColor3: { __t: "Color3", r: 18, g: 18, b: 24 },
            BackgroundTransparency: 0.05,
          },
          children: [
            {
              className: "UICorner",
              name: "Corner",
              properties: { CornerRadius: { __t: "UDim", s: 0, o: 16 } },
            },
            {
              className: "UIStroke",
              name: "Stroke",
              properties: { Thickness: 1.5, Transparency: 0.4 },
            },
            {
              className: "UIListLayout",
              name: "List",
              properties: {
                Padding: { __t: "UDim", s: 0, o: 12 },
                HorizontalAlignment: { __t: "Enum", enum: "HorizontalAlignment", value: "Center" },
                VerticalAlignment: { __t: "Enum", enum: "VerticalAlignment", value: "Center" },
                SortOrder: { __t: "Enum", enum: "SortOrder", value: "LayoutOrder" },
              },
            },
            {
              className: "TextLabel",
              name: "Title",
              properties: {
                LayoutOrder: 1,
                Size: { __t: "UDim2", xs: 0.8, xo: 0, ys: 0, yo: 48 },
                BackgroundTransparency: 1,
                Text: "MY GAME",
                Font: { __t: "Enum", enum: "Font", value: "GothamBlack" },
                TextScaled: true,
                TextColor3: { __t: "Color3", r: 255, g: 255, b: 255 },
              },
            },
            {
              className: "TextButton",
              name: "PlayButton",
              properties: {
                LayoutOrder: 2,
                Size: { __t: "UDim2", xs: 0.7, xo: 0, ys: 0, yo: 44 },
                BackgroundColor3: { __t: "Color3", r: 90, g: 170, b: 255 },
                Text: "Play",
                Font: { __t: "Enum", enum: "Font", value: "GothamBold" },
                TextScaled: true,
                TextColor3: { __t: "Color3", r: 255, g: 255, b: 255 },
              },
              children: [
                {
                  className: "UICorner",
                  name: "C",
                  properties: { CornerRadius: { __t: "UDim", s: 0, o: 8 } },
                },
              ],
            },
            {
              className: "TextButton",
              name: "ShopButton",
              properties: {
                LayoutOrder: 3,
                Size: { __t: "UDim2", xs: 0.7, xo: 0, ys: 0, yo: 44 },
                BackgroundColor3: { __t: "Color3", r: 40, g: 40, b: 52 },
                Text: "Shop",
                Font: { __t: "Enum", enum: "Font", value: "GothamBold" },
                TextScaled: true,
                TextColor3: { __t: "Color3", r: 255, g: 255, b: 255 },
              },
              children: [
                {
                  className: "UICorner",
                  name: "C",
                  properties: { CornerRadius: { __t: "UDim", s: 0, o: 8 } },
                },
              ],
            },
            {
              className: "TextButton",
              name: "SettingsButton",
              properties: {
                LayoutOrder: 4,
                Size: { __t: "UDim2", xs: 0.7, xo: 0, ys: 0, yo: 44 },
                BackgroundColor3: { __t: "Color3", r: 40, g: 40, b: 52 },
                Text: "Settings",
                Font: { __t: "Enum", enum: "Font", value: "GothamBold" },
                TextScaled: true,
                TextColor3: { __t: "Color3", r: 255, g: 255, b: 255 },
              },
              children: [
                {
                  className: "UICorner",
                  name: "C",
                  properties: { CornerRadius: { __t: "UDim", s: 0, o: 8 } },
                },
              ],
            },
          ],
        },
        { type: "select", path: "StarterGui.BloxsmithUI.MainMenu.Panel" },
      ],
    };
  }

  // Map / world / tycoon / city → build a REAL procedural layout, not a folder.
  if (
    /\b(map|world|city|town|island|tycoon|lobby|arena|plot|base|kingdom|village|open[-\s]?world|gta|grand theft|crime|wanted|vehicles?|cars?|garage|missions?|full game|game)\b/.test(
      p,
    )
  ) {
    return getProceduralMapFallback(p);
  }

  // Generic build we can't template — still return a clear, non-empty message
  // and a playable vertical slice so the user never receives an empty folder.
  return getUniversalPlayableFallback(prompt);
}

function getUniversalPlayableFallback(prompt: string): {
  message: string;
  files: GenFile[];
  actions: GenAction[];
} {
  const v3 = (x: number, y: number, z: number) => ({ __t: "Vector3", x, y, z });
  const color = (r: number, g: number, b: number) => ({ __t: "Color3", r, g, b });
  const udim2 = (xs: number, xo: number, ys: number, yo: number) => ({
    __t: "UDim2",
    xs,
    xo,
    ys,
    yo,
  });
  const enumValue = (enumName: string, value: string) => ({
    __t: "Enum",
    enum: enumName,
    value,
  });

  return {
    message:
      "Queued a real playable fallback instead of an empty folder: Workspace/BloxSmithPlayableFeature, ReplicatedStorage/Remotes, ServerScriptService/Systems, and StarterGui/PlayableFeatureUI.",
    files: [
      {
        path: "ServerScriptService/Systems/BloxSmithPlayableFeature.server.lua",
        file_type: "Script",
        service_location: "ServerScriptService/Systems",
        content: `local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local featureRemote = remotes:WaitForChild("BloxSmithPlayableFeature")
local cooldowns = {}

local function ensureStats(player)
\tlocal leaderstats = player:FindFirstChild("leaderstats")
\tif not leaderstats then
\t\tleaderstats = Instance.new("Folder")
\t\tleaderstats.Name = "leaderstats"
\t\tleaderstats.Parent = player
\tend

\tlocal uses = leaderstats:FindFirstChild("FeatureUses")
\tif not uses then
\t\tuses = Instance.new("IntValue")
\t\tuses.Name = "FeatureUses"
\t\tuses.Value = 0
\t\tuses.Parent = leaderstats
\tend
\treturn uses
end

local function activate(player)
\tlocal now = os.clock()
\tif cooldowns[player] and now - cooldowns[player] < 1 then return end
\tcooldowns[player] = now
\tlocal uses = ensureStats(player)
\tuses.Value += 1
\tfeatureRemote:FireClient(player, uses.Value)
end

Players.PlayerAdded:Connect(ensureStats)
Players.PlayerRemoving:Connect(function(player)
\tcooldowns[player] = nil
end)

featureRemote.OnServerEvent:Connect(function(player, action)
\tif action ~= "activate" then return end
\tactivate(player)
end)

local feature = workspace:WaitForChild("BloxSmithPlayableFeature", 10)
local pad = feature and feature:FindFirstChild("ActionPad")
if pad and pad:IsA("BasePart") then
\tlocal prompt = pad:FindFirstChildOfClass("ProximityPrompt") or Instance.new("ProximityPrompt")
\tprompt.ActionText = "Activate"
\tprompt.ObjectText = "BloxSmith Feature"
\tprompt.HoldDuration = 0.2
\tprompt.MaxActivationDistance = 12
\tprompt.Parent = pad
\tprompt.Triggered:Connect(activate)
end
`,
      },
      {
        path: "StarterGui/PlayableFeatureUI/PlayableFeature.client.lua",
        file_type: "LocalScript",
        service_location: "StarterGui/PlayableFeatureUI",
        content: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local gui = script.Parent
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true

local root = gui:WaitForChild("Root")
local button = root:WaitForChild("UseButton")
local counter = root:WaitForChild("Counter")
local toast = root:WaitForChild("Toast")
local remote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("BloxSmithPlayableFeature")

local baseSize = root.Size
root.Size = UDim2.new(baseSize.X.Scale, baseSize.X.Offset - 18, baseSize.Y.Scale, baseSize.Y.Offset - 18)
root.BackgroundTransparency = 1
TweenService:Create(root, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
\tSize = baseSize,
\tBackgroundTransparency = 0.08,
}):Play()

local buttonBase = button.Size
local function tweenButton(sizeOffset, color)
\tTweenService:Create(button, TweenInfo.new(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
\t\tSize = UDim2.new(buttonBase.X.Scale, buttonBase.X.Offset + sizeOffset, buttonBase.Y.Scale, buttonBase.Y.Offset + math.floor(sizeOffset / 2)),
\t\tBackgroundColor3 = color,
\t}):Play()
end

button.MouseEnter:Connect(function()
\ttweenButton(8, Color3.fromRGB(110, 190, 255))
end)
button.MouseLeave:Connect(function()
\ttweenButton(0, Color3.fromRGB(80, 155, 255))
end)
button.MouseButton1Down:Connect(function()
\ttweenButton(-6, Color3.fromRGB(55, 120, 220))
end)
button.MouseButton1Up:Connect(function()
\ttweenButton(8, Color3.fromRGB(110, 190, 255))
end)
button.Activated:Connect(function()
\tremote:FireServer("activate")
end)

remote.OnClientEvent:Connect(function(uses)
\tcounter.Text = "Uses: " .. tostring(uses)
\ttoast.Text = "Activated"
\ttoast.Visible = true
\ttoast.TextTransparency = 0
\tTweenService:Create(toast, TweenInfo.new(0.25), { Position = UDim2.fromScale(0.5, 1.12) }):Play()
\ttask.delay(1.1, function()
\t\tTweenService:Create(toast, TweenInfo.new(0.3), { TextTransparency = 1 }):Play()
\tend)
end)
`,
      },
    ],
    actions: [
      { type: "create", className: "Folder", name: "Systems", parent: "ServerScriptService" },
      { type: "create", className: "Folder", name: "Remotes", parent: "ReplicatedStorage" },
      {
        type: "create",
        className: "RemoteEvent",
        name: "BloxSmithPlayableFeature",
        parent: "ReplicatedStorage/Remotes",
      },
      {
        type: "create",
        className: "Model",
        name: "BloxSmithPlayableFeature",
        parent: "Workspace",
        properties: {},
      },
      {
        type: "create",
        className: "Part",
        name: "Ground",
        parent: "Workspace/BloxSmithPlayableFeature",
        properties: {
          Size: v3(70, 2, 70),
          Position: v3(0, 0, 0),
          Anchored: true,
          Material: enumValue("Material", "Grass"),
          Color: color(72, 145, 88),
        },
      },
      {
        type: "create",
        className: "SpawnLocation",
        name: "FeatureSpawn",
        parent: "Workspace/BloxSmithPlayableFeature",
        properties: {
          Size: v3(12, 1, 12),
          Position: v3(0, 3, 18),
          Anchored: true,
          Neutral: true,
          Material: enumValue("Material", "Neon"),
          Color: color(80, 155, 255),
        },
      },
      {
        type: "create",
        className: "Part",
        name: "ActionPad",
        parent: "Workspace/BloxSmithPlayableFeature",
        properties: {
          Size: v3(10, 1, 10),
          Position: v3(0, 2, -10),
          Anchored: true,
          Material: enumValue("Material", "Neon"),
          Color: color(255, 205, 90),
        },
        children: [
          {
            className: "ProximityPrompt",
            name: "ActivatePrompt",
            properties: {
              ActionText: "Activate",
              ObjectText: "BloxSmith Feature",
              HoldDuration: 0.2,
              MaxActivationDistance: 12,
            },
          },
          {
            className: "PointLight",
            name: "PadGlow",
            properties: { Brightness: 2, Range: 22, Color: color(255, 205, 90) },
          },
        ],
      },
      {
        type: "create",
        className: "Part",
        name: "ThemeBeacon",
        parent: "Workspace/BloxSmithPlayableFeature",
        properties: {
          Size: v3(5, 18, 5),
          Position: v3(0, 10, -24),
          Anchored: true,
          Material: enumValue("Material", "Glass"),
          Color: color(90, 170, 255),
          Transparency: 0.25,
        },
        children: [
          {
            className: "PointLight",
            name: "BeaconGlow",
            properties: { Brightness: 3, Range: 42, Color: color(90, 170, 255) },
          },
        ],
      },
      {
        type: "create",
        className: "ScreenGui",
        name: "PlayableFeatureUI",
        parent: "StarterGui",
        properties: {
          ResetOnSpawn: false,
          IgnoreGuiInset: true,
          ZIndexBehavior: enumValue("ZIndexBehavior", "Sibling"),
        },
      },
      {
        type: "create",
        className: "Frame",
        name: "Root",
        parent: "StarterGui/PlayableFeatureUI",
        properties: {
          AnchorPoint: { __t: "Vector2", x: 0.5, y: 1 },
          Position: udim2(0.5, 0, 1, -24),
          Size: udim2(0.86, 0, 0, 132),
          BackgroundColor3: color(16, 18, 28),
          BackgroundTransparency: 0.08,
        },
        children: [
          {
            className: "UICorner",
            name: "Corner",
            properties: { CornerRadius: { __t: "UDim", s: 0, o: 16 } },
          },
          {
            className: "UIStroke",
            name: "Stroke",
            properties: { Thickness: 1.5, Transparency: 0.35, Color: color(90, 170, 255) },
          },
          { className: "UIGradient", name: "Gradient", properties: { Rotation: 90 } },
          {
            className: "UIPadding",
            name: "Padding",
            properties: {
              PaddingTop: { __t: "UDim", s: 0, o: 12 },
              PaddingBottom: { __t: "UDim", s: 0, o: 12 },
              PaddingLeft: { __t: "UDim", s: 0, o: 14 },
              PaddingRight: { __t: "UDim", s: 0, o: 14 },
            },
          },
          {
            className: "TextLabel",
            name: "Title",
            properties: {
              Size: udim2(1, 0, 0, 26),
              BackgroundTransparency: 1,
              Text: "BloxSmith Feature",
              Font: enumValue("Font", "GothamBold"),
              TextColor3: color(255, 255, 255),
              TextScaled: true,
            },
          },
          {
            className: "TextLabel",
            name: "Counter",
            properties: {
              Position: udim2(0, 0, 0, 34),
              Size: udim2(1, 0, 0, 22),
              BackgroundTransparency: 1,
              Text: "Uses: 0",
              Font: enumValue("Font", "Gotham"),
              TextColor3: color(210, 225, 245),
              TextScaled: true,
            },
          },
          {
            className: "TextButton",
            name: "UseButton",
            properties: {
              AnchorPoint: { __t: "Vector2", x: 0.5, y: 0 },
              Position: udim2(0.5, 0, 0, 66),
              Size: udim2(0.62, 0, 0, 44),
              BackgroundColor3: color(80, 155, 255),
              Text: "Activate",
              Font: enumValue("Font", "GothamBold"),
              TextColor3: color(255, 255, 255),
              TextScaled: true,
            },
            children: [
              {
                className: "UICorner",
                name: "Corner",
                properties: { CornerRadius: { __t: "UDim", s: 0, o: 10 } },
              },
              {
                className: "UIStroke",
                name: "Stroke",
                properties: { Thickness: 1, Transparency: 0.5, Color: color(255, 255, 255) },
              },
            ],
          },
          {
            className: "TextLabel",
            name: "Toast",
            properties: {
              AnchorPoint: { __t: "Vector2", x: 0.5, y: 1 },
              Position: udim2(0.5, 0, 1, 8),
              Size: udim2(0.42, 0, 0, 24),
              BackgroundTransparency: 1,
              Text: "",
              Visible: false,
              Font: enumValue("Font", "GothamBold"),
              TextColor3: color(255, 225, 120),
              TextScaled: true,
            },
          },
        ],
      },
      {
        type: "lighting",
        properties: {
          ClockTime: 14.5,
          Brightness: 2.2,
          Ambient: color(90, 95, 110),
          OutdoorAmbient: color(145, 155, 165),
        },
      },
      { type: "select", path: "Workspace.BloxSmithPlayableFeature" },
    ],
  };
}

function getBuildingReplicaFallback(prompt: string): {
  message: string;
  files: GenFile[];
  actions: GenAction[];
} {
  const actions: GenAction[] = [];
  const v3 = (x: number, y: number, z: number) => ({ __t: "Vector3", x, y, z });
  const color = (r: number, g: number, b: number) => ({ __t: "Color3", r, g, b });
  const mat = (m: string) => ({ __t: "Enum", enum: "Material", value: m });
  const cframe = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => ({
    __t: "CFrame",
    x,
    y,
    z,
    rx,
    ry,
    rz,
  });

  const medieval = /\b(castle|stone|medieval|tower|fort)\b/i.test(prompt);
  const modern = /\b(modern|glass|city|office|skyscraper|store)\b/i.test(prompt);
  const wallMaterial = medieval ? "Slate" : modern ? "Concrete" : "Brick";
  const wallColor = medieval
    ? color(115, 118, 122)
    : modern
      ? color(205, 210, 215)
      : color(166, 92, 65);
  const trimColor = medieval
    ? color(74, 75, 78)
    : modern
      ? color(36, 43, 54)
      : color(235, 220, 188);
  const roofColor = medieval ? color(70, 70, 76) : modern ? color(32, 35, 44) : color(95, 42, 38);

  actions.push({
    type: "create",
    className: "Folder",
    name: "Map",
    parent: "Workspace",
    properties: {},
  });
  actions.push({
    type: "create",
    className: "Folder",
    name: "Buildings",
    parent: "Workspace/Map",
    properties: {},
  });
  actions.push({
    type: "create",
    className: "Part",
    name: "ReplicaGround",
    parent: "Workspace/Map",
    properties: {
      Size: v3(160, 1, 120),
      Position: v3(0, -0.5, 0),
      Anchored: true,
      Material: mat("Grass"),
      Color: color(76, 120, 68),
    },
  });
  actions.push({
    type: "create",
    className: "SpawnLocation",
    name: "ReplicaSpawn",
    parent: "Workspace/Map",
    properties: {
      Size: v3(10, 1, 10),
      Position: v3(0, 1, 46),
      Anchored: true,
      Neutral: true,
      Material: mat("Metal"),
      Color: color(90, 170, 255),
    },
  });

  actions.push({
    type: "create",
    className: "Model",
    name: "ReferenceBuildingReplica",
    parent: "Workspace/Map/Buildings",
    properties: {},
  });

  const parent = "Workspace/Map/Buildings/ReferenceBuildingReplica";
  const part = (
    name: string,
    size: any,
    pos: any,
    material: string,
    col: any,
    extra: Record<string, any> = {},
  ) =>
    actions.push({
      type: "create",
      className: "Part",
      name,
      parent,
      properties: {
        Size: size,
        Position: pos,
        Anchored: true,
        Material: mat(material),
        Color: col,
        TopSurface: { __t: "Enum", enum: "SurfaceType", value: "Smooth" },
        BottomSurface: { __t: "Enum", enum: "SurfaceType", value: "Smooth" },
        ...extra,
      },
    });

  part("Foundation", v3(54, 2, 38), v3(0, 1, 0), "Concrete", color(86, 86, 88));
  part("FirstFloorCore", v3(50, 12, 34), v3(0, 8, 0), wallMaterial, wallColor);
  part("SecondFloorCore", v3(44, 12, 30), v3(0, 20, -1), wallMaterial, wallColor);
  part("FrontEntryProjection", v3(16, 16, 5), v3(0, 12, 19.5), wallMaterial, wallColor);
  part("BackDepthBlock", v3(34, 9, 10), v3(0, 8.5, -21), wallMaterial, wallColor);
  part("LeftWing", v3(14, 10, 24), v3(-34, 7, -2), wallMaterial, wallColor);
  part("RightWing", v3(14, 10, 24), v3(34, 7, -2), wallMaterial, wallColor);

  part("FrontDoor", v3(6, 8, 0.5), v3(0, 5, 22.25), "Wood", color(93, 52, 30));
  part("DoorFrameTop", v3(8, 1, 0.6), v3(0, 9.4, 22.4), "Wood", trimColor);
  part("DoorFrameLeft", v3(0.7, 9, 0.6), v3(-4.2, 5.3, 22.4), "Wood", trimColor);
  part("DoorFrameRight", v3(0.7, 9, 0.6), v3(4.2, 5.3, 22.4), "Wood", trimColor);
  part("DoorHandle", v3(0.45, 0.45, 0.45), v3(2.2, 5.3, 22.75), "Metal", color(245, 190, 80), {
    Shape: { __t: "Enum", enum: "PartType", value: "Ball" },
  });

  const windowXs = [-18, -9, 9, 18];
  for (const x of windowXs) {
    for (const y of [8, 20]) {
      part(
        `WindowGlass_${x}_${y}`,
        v3(5, 5, 0.35),
        v3(x, y, 17.25),
        "Glass",
        color(135, 210, 255),
        {
          Transparency: 0.35,
          Reflectance: 0.12,
        },
      );
      part(`WindowTrimTop_${x}_${y}`, v3(6, 0.45, 0.45), v3(x, y + 2.75, 17.5), "Wood", trimColor);
      part(
        `WindowTrimBottom_${x}_${y}`,
        v3(6, 0.45, 0.45),
        v3(x, y - 2.75, 17.5),
        "Wood",
        trimColor,
      );
      part(`WindowTrimLeft_${x}_${y}`, v3(0.45, 6, 0.45), v3(x - 2.75, y, 17.5), "Wood", trimColor);
      part(
        `WindowTrimRight_${x}_${y}`,
        v3(0.45, 6, 0.45),
        v3(x + 2.75, y, 17.5),
        "Wood",
        trimColor,
      );
    }
  }

  for (const x of [-25, 25]) {
    part(`Column_${x}_A`, v3(2.2, 16, 2.2), v3(x, 9, 20), "Marble", trimColor, {
      Shape: { __t: "Enum", enum: "PartType", value: "Cylinder" },
    });
    part(`Column_${x}_B`, v3(2.2, 16, 2.2), v3(x * 0.72, 9, 21), "Marble", trimColor, {
      Shape: { __t: "Enum", enum: "PartType", value: "Cylinder" },
    });
  }

  part("BalconySlab", v3(20, 1, 6), v3(0, 15, 23.5), "Concrete", trimColor);
  part("BalconyRailFront", v3(21, 2, 0.5), v3(0, 17, 26.5), "Metal", trimColor);
  for (let x = -9; x <= 9; x += 3)
    part(`BalconyPost_${x}`, v3(0.45, 3, 0.45), v3(x, 16.5, 26.5), "Metal", trimColor);

  actions.push({
    type: "create",
    className: "WedgePart",
    name: "MainRoofLeftSlope",
    parent,
    properties: {
      Size: v3(56, 10, 21),
      CFrame: cframe(-14, 30, -1, 0, 0, 180),
      Anchored: true,
      Material: mat("Slate"),
      Color: roofColor,
    },
  });
  actions.push({
    type: "create",
    className: "WedgePart",
    name: "MainRoofRightSlope",
    parent,
    properties: {
      Size: v3(56, 10, 21),
      CFrame: cframe(14, 30, -1, 0, 180, 180),
      Anchored: true,
      Material: mat("Slate"),
      Color: roofColor,
    },
  });
  part("RoofRidge", v3(58, 1, 2), v3(0, 35, -1), "Metal", trimColor);
  part("EntryRoof", v3(19, 2, 8), v3(0, 22.5, 21.5), "Slate", roofColor);

  for (const x of [-18, 18]) {
    actions.push({
      type: "create",
      className: "Part",
      name: `Sconce_${x}`,
      parent,
      properties: {
        Size: v3(1, 1, 0.6),
        Position: v3(x, 12, 22.4),
        Anchored: true,
        Material: mat("Neon"),
        Color: color(255, 210, 120),
      },
      children: [
        {
          className: "PointLight",
          name: "WarmGlow",
          properties: { Brightness: 2, Range: 16, Color: color(255, 210, 140) },
        },
      ],
    });
  }

  part("PathToReplica", v3(12, 0.35, 42), v3(0, 0.25, 42), "Slate", color(88, 88, 94));
  actions.push({
    type: "lighting",
    properties: {
      ClockTime: 17.2,
      Brightness: 2.4,
      Ambient: color(80, 82, 92),
      OutdoorAmbient: color(130, 128, 122),
      ShadowSoftness: 0.35,
    },
  });
  actions.push({ type: "select", path: "Workspace.Map.Buildings.ReferenceBuildingReplica" });

  return {
    message:
      "Queued a complete Roblox-scale building replica fallback under Workspace/Map/Buildings/ReferenceBuildingReplica with floors, facade, roof slopes, glass windows, trim, balcony, lights, ground, path, and spawn. If the image model times out, this still gives Studio a real detailed structure instead of an empty folder.",
    files: [],
    actions,
  };
}

function getProceduralCityFallback(p: string): {
  message: string;
  files: GenFile[];
  actions: GenAction[];
} {
  const actions: GenAction[] = [];
  const v3 = (x: number, y: number, z: number) => ({ __t: "Vector3", x, y, z });
  const color = (r: number, g: number, b: number) => ({ __t: "Color3", r, g, b });
  const mat = (m: string) => ({ __t: "Enum", enum: "Material", value: m });

  for (const [name, parent] of [
    ["Map", "Workspace"],
    ["Roads", "Workspace/Map"],
    ["Buildings", "Workspace/Map"],
    ["Beach", "Workspace/Map"],
    ["Vehicles", "Workspace/Map"],
    ["MissionMarkers", "Workspace/Map"],
    ["Police", "Workspace/Map"],
  ] as const) {
    actions.push({ type: "create", className: "Folder", name, parent, properties: {} });
  }

  const part = (
    parent: string,
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    material: string,
    rgb: readonly [number, number, number],
  ) =>
    actions.push({
      type: "create",
      className: "Part",
      name,
      parent,
      properties: {
        Size: v3(size[0], size[1], size[2]),
        Position: v3(position[0], position[1], position[2]),
        Anchored: true,
        Material: mat(material),
        Color: color(rgb[0], rgb[1], rgb[2]),
      },
    });

  part("Workspace/Map", "CityGround", [620, 2, 520], [0, -1, -30], "Concrete", [85, 90, 96]);
  part(
    "Workspace/Map/Beach",
    "SouthBeachSand",
    [620, 2, 130],
    [0, 0, 245],
    "Sand",
    [235, 205, 145],
  );
  part("Workspace/Map/Beach", "Ocean", [620, 1, 180], [0, -0.2, 340], "Glass", [50, 190, 215]);
  part("Workspace/Map/Beach", "Boardwalk", [560, 1, 18], [0, 1, 176], "WoodPlanks", [172, 126, 84]);

  for (const x of [-220, -110, 0, 110, 220]) {
    part(
      "Workspace/Map/Roads",
      `Avenue${x}`,
      [24, 0.5, 500],
      [x, 0.3, -40],
      "Asphalt",
      [24, 27, 30],
    );
  }
  for (const z of [-225, -120, -15, 90]) {
    part(
      "Workspace/Map/Roads",
      `Street${z}`,
      [560, 0.5, 24],
      [0, 0.35, z],
      "Asphalt",
      [24, 27, 30],
    );
  }

  const buildings = [
    ["NeonBank", -170, -165, 44, 80, [50, 90, 150]],
    ["PalmViewHotel", -55, -165, 42, 112, [230, 125, 150]],
    ["MetroOffice", 80, -165, 48, 130, [70, 125, 190]],
    ["SunsetMall", 205, -165, 82, 42, [245, 160, 80]],
    ["ArcadeBlock", -170, -45, 54, 46, [140, 70, 190]],
    ["PoliceHQ", 205, -45, 64, 52, [60, 90, 140]],
    ["BeachApartments", -120, 95, 54, 72, [255, 210, 130]],
    ["CityGarage", 80, 95, 72, 38, [95, 95, 105]],
  ] as const;
  for (const [name, x, z, width, height, rgb] of buildings) {
    part(
      "Workspace/Map/Buildings",
      name,
      [width, height, 52],
      [x, height / 2, z],
      "SmoothPlastic",
      rgb,
    );
    part(
      "Workspace/Map/Buildings",
      `${name}RoofGlow`,
      [width + 4, 2, 56],
      [x, height + 2, z],
      "Neon",
      [255, 95, 170],
    );
  }

  for (const [name, x, z] of [
    ["DeliveryMission", -205, 125],
    ["PolicePatrolJob", 205, -5],
    ["BeachRaceStart", -20, 175],
    ["GarageSpawn", 80, 128],
  ] as const) {
    part("Workspace/Map/MissionMarkers", name, [8, 1, 8], [x, 3, z], "Neon", [255, 210, 65]);
  }
  for (const [name, x, z, rgb] of [
    ["Cruiser", 230, -10, [35, 60, 120]],
    ["SportCoupe", 55, 130, [255, 65, 105]],
    ["Taxi", -225, -120, [255, 210, 45]],
  ] as const) {
    part("Workspace/Map/Vehicles", name, [12, 4, 20], [x, 3, z], "Metal", rgb);
  }

  // Police precinct — real content so the "Police" folder is never empty.
  part(
    "Workspace/Map/Police",
    "PoliceStation",
    [50, 34, 40],
    [270, 17, -45],
    "Concrete",
    [62, 92, 142],
  );
  part(
    "Workspace/Map/Police",
    "PoliceStationSign",
    [50, 6, 3],
    [270, 37, -23],
    "Neon",
    [80, 150, 255],
  );
  part("Workspace/Map/Police", "PatrolCruiser", [12, 4, 20], [270, 3, 4], "Metal", [35, 60, 120]);

  actions.push({
    type: "create",
    className: "SpawnLocation",
    name: "SunsetSpawn",
    parent: "Workspace/Map",
    properties: {
      Size: v3(12, 1, 12),
      Position: v3(0, 4, -70),
      Anchored: true,
      Neutral: true,
      Material: mat("Neon"),
      Color: color(90, 170, 255),
    },
  });
  actions.push({
    type: "lighting",
    properties: {
      ClockTime: 18.4,
      Brightness: 2.3,
      Ambient: color(95, 75, 105),
      OutdoorAmbient: color(255, 150, 100),
      FogEnd: 900,
    },
  });
  actions.push({ type: "select", path: "Workspace.Map" });

  return {
    message:
      "Queued an original open-world city starter instead of plot pads: beach, streets, buildings, police HQ, garages, cars, mission markers, spawn, sunset lighting, and starter money/wanted/job systems.",
    files: [
      {
        path: "ServerScriptService/Systems/OpenWorldCityCore.server.lua",
        file_type: "Script",
        service_location: "ServerScriptService/Systems",
        content: `local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal stats = Instance.new("Folder")
\tstats.Name = "leaderstats"
\tstats.Parent = player
\tlocal cash = Instance.new("IntValue")
\tcash.Name = "Cash"
\tcash.Value = 500
\tcash.Parent = stats
\tlocal wanted = Instance.new("IntValue")
\twanted.Name = "Wanted"
\twanted.Value = 0
\twanted.Parent = stats
\tlocal job = Instance.new("StringValue")
\tjob.Name = "Job"
\tjob.Value = "Visitor"
\tjob.Parent = stats
end)

for _, marker in ipairs(workspace.Map.MissionMarkers:GetChildren()) do
\tif marker:IsA("BasePart") then
\t\tlocal prompt = Instance.new("ProximityPrompt")
\t\tprompt.ActionText = "Start"
\t\tprompt.ObjectText = marker.Name
\t\tprompt.HoldDuration = 0.25
\t\tprompt.Parent = marker
\t\tprompt.Triggered:Connect(function(player)
\t\t\tlocal stats = player:FindFirstChild("leaderstats")
\t\t\tif not stats then return end
\t\t\tstats.Cash.Value += 100
\t\t\tstats.Job.Value = marker.Name:gsub("Mission", ""):gsub("Job", "")
\t\t\tif marker.Name == "BeachRaceStart" then
\t\t\t\tstats.Wanted.Value = math.clamp(stats.Wanted.Value + 1, 0, 5)
\t\t\tend
\t\tend)
\tend
end
`,
      },
    ],
    actions,
  };
}

// A genuine procedural map fallback. Non-tycoon requests now get an open-world
// layout instead of the old flat four-plot ring from the screenshot. Tycoon
// plot pads are still available, but only for explicit tycoon prompts.
function getProceduralMapFallback(p: string): {
  message: string;
  files: GenFile[];
  actions: GenAction[];
} {
  const isCity =
    /\b(open[-\s]?world|city|downtown|miami|vice city|beach|streets?|police|wanted|garage|apartment|roleplay|rp|gta|grand theft|crime|criminal|cars?|vehicles?|missions?|jobs?)\b/.test(
      p,
    ) &&
    /\b(map|game|world|city|streets?|missions?|jobs?|open[-\s]?world|gta|grand theft)\b/.test(p);
  if (isCity) return getProceduralCityFallback(p);

  // IMPORTANT: the old fallback used four generic "Plot" pads for every map request.
  // That made non-tycoon/open-world prompts look like a flat tycoon starter, which is
  // exactly the broken screenshot users kept seeing. Plot pads now ONLY appear when
  // the prompt is explicitly tycoon-related. Every other map gets a real open-world
  // starter layout with districts, roads, landmarks, nature, spawns, and missions.
  const isTycoon =
    /\b(tycoon|dropper|conveyor|rebirth|purchase\s*pads?|claim\s*plots?|plot\s*claiming|owner\s*plot)\b/.test(
      p,
    );
  if (!isTycoon) return getOpenWorldMapFallback(p);

  const plotCount = 6;
  const actions: GenAction[] = [];

  const v3 = (x: number, y: number, z: number) => ({ __t: "Vector3", x, y, z });
  const color = (r: number, g: number, b: number) => ({ __t: "Color3", r, g, b });
  const mat = (m: string) => ({ __t: "Enum", enum: "Material", value: m });

  for (const [name, parent] of [
    ["Map", "Workspace"],
    ["TycoonPlots", "Workspace/Map"],
    ["Paths", "Workspace/Map"],
    ["Decor", "Workspace/Map"],
  ] as const) {
    actions.push({ type: "create", className: "Folder", name, parent, properties: {} });
  }

  actions.push({
    type: "terrainFill",
    shape: "Block",
    cframe: { __t: "CFrame", x: 0, y: -4, z: 0 },
    size: v3(620, 8, 620),
    material: mat("Grass"),
  });
  actions.push({ type: "set", path: "Workspace.Terrain", properties: { Decoration: true } });

  actions.push({
    type: "create",
    className: "Part",
    name: "PremiumTycoonHub",
    parent: "Workspace/Map",
    properties: {
      Shape: { __t: "Enum", enum: "PartType", value: "Cylinder" },
      Size: v3(4, 72, 72),
      Position: v3(0, 2, 0),
      Anchored: true,
      Material: mat("Concrete"),
      Color: color(120, 125, 135),
      Orientation: v3(0, 0, 90),
    },
    children: [
      {
        className: "PointLight",
        name: "HubLight",
        properties: { Brightness: 2.5, Range: 55, Color: color(255, 235, 190) },
      },
    ],
  });
  actions.push({
    type: "create",
    className: "SpawnLocation",
    name: "TycoonSpawn",
    parent: "Workspace/Map",
    properties: {
      Size: v3(14, 1, 14),
      Position: v3(0, 5, 0),
      Anchored: true,
      Material: mat("Neon"),
      Color: color(90, 170, 255),
      Neutral: true,
    },
  });

  const radius = 160;
  for (let i = 0; i < plotCount; i++) {
    const angle = (i / plotCount) * Math.PI * 2;
    const px = Math.round(Math.cos(angle) * radius);
    const pz = Math.round(Math.sin(angle) * radius);
    actions.push({
      type: "create",
      className: "Folder",
      name: `TycoonPlot${i + 1}`,
      parent: "Workspace/Map/TycoonPlots",
      properties: {},
    });
    actions.push({
      type: "create",
      className: "Part",
      name: "ClaimBase",
      parent: `Workspace/Map/TycoonPlots/TycoonPlot${i + 1}`,
      properties: {
        Size: v3(92, 1, 92),
        Position: v3(px, 0.6, pz),
        Anchored: true,
        Material: mat("WoodPlanks"),
        Color: color(150, 120, 90),
      },
      children: [
        {
          className: "BillboardGui",
          name: "Label",
          properties: {
            Size: { __t: "UDim2", xs: 0, xo: 240, ys: 0, yo: 54 },
            StudsOffset: v3(0, 9, 0),
            AlwaysOnTop: true,
          },
          children: [
            {
              className: "TextLabel",
              name: "Text",
              properties: {
                Size: { __t: "UDim2", xs: 1, xo: 0, ys: 1, yo: 0 },
                BackgroundTransparency: 1,
                Text: `Tycoon Plot ${i + 1}`,
                TextScaled: true,
                Font: { __t: "Enum", enum: "Font", value: "GothamBold" },
                TextColor3: color(255, 255, 255),
              },
            },
          ],
        },
      ],
    });
    actions.push({
      type: "create",
      className: "Part",
      name: `PathToTycoon${i + 1}`,
      parent: "Workspace/Map/Paths",
      properties: {
        Size: v3(Math.max(8, radius - 48), 0.45, 12),
        Position: v3(Math.round(px / 2), 0.45, Math.round(pz / 2)),
        Anchored: true,
        Material: mat("Slate"),
        Color: color(82, 82, 88),
        Orientation: v3(0, Math.round((-angle * 180) / Math.PI), 0),
      },
    });
  }

  // Decorative lamp posts so the "Decor" folder always holds real content.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dx = Math.round(Math.cos(a) * 95);
    const dz = Math.round(Math.sin(a) * 95);
    actions.push({
      type: "create",
      className: "Part",
      name: `LampPost${i + 1}`,
      parent: "Workspace/Map/Decor",
      properties: {
        Size: v3(1.5, 16, 1.5),
        Position: v3(dx, 8, dz),
        Anchored: true,
        Material: mat("Metal"),
        Color: color(45, 48, 54),
      },
      children: [
        {
          className: "PointLight",
          name: "Glow",
          properties: { Brightness: 2, Range: 28, Color: color(255, 224, 170) },
        },
      ],
    });
  }

  actions.push({
    type: "lighting",
    properties: {
      ClockTime: 14,
      Brightness: 2.3,
      Ambient: color(75, 75, 85),
      OutdoorAmbient: color(125, 125, 135),
    },
  });
  actions.push({ type: "select", path: "Workspace.Map.TycoonPlots" });

  return {
    message: `Queued a clean tycoon-only map with ${plotCount} claim plots, a premium central hub, spawn, terrain, and organized folders. Plot pads are now only used for tycoon prompts.`,
    files: [],
    actions,
  };
}

function getOpenWorldMapFallback(p: string): {
  message: string;
  files: GenFile[];
  actions: GenAction[];
} {
  const actions: GenAction[] = [];
  const v3 = (x: number, y: number, z: number) => ({ __t: "Vector3", x, y, z });
  const color = (r: number, g: number, b: number) => ({ __t: "Color3", r, g, b });
  const mat = (m: string) => ({ __t: "Enum", enum: "Material", value: m });

  for (const [name, parent] of [
    ["Map", "Workspace"],
    ["OpenWorld", "Workspace/Map"],
    ["TerrainZones", "Workspace/Map/OpenWorld"],
    ["Roads", "Workspace/Map/OpenWorld"],
    ["Sidewalks", "Workspace/Map/OpenWorld"],
    ["Buildings", "Workspace/Map/OpenWorld"],
    ["Homes", "Workspace/Map/OpenWorld"],
    ["Nature", "Workspace/Map/OpenWorld"],
    ["Landmarks", "Workspace/Map/OpenWorld"],
    ["Vehicles", "Workspace/Map/OpenWorld"],
    ["MissionMarkers", "Workspace/Map/OpenWorld"],
    ["Spawns", "Workspace/Map/OpenWorld"],
    ["Props", "Workspace/Map/OpenWorld"],
  ] as const) {
    actions.push({ type: "create", className: "Folder", name, parent, properties: {} });
  }

  const part = (
    parent: string,
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    material: string,
    rgb: readonly [number, number, number],
    extra: Record<string, any> = {},
    children: any[] = [],
  ) =>
    actions.push({
      type: "create",
      className: "Part",
      name,
      parent,
      properties: {
        Size: v3(size[0], size[1], size[2]),
        Position: v3(position[0], position[1], position[2]),
        Anchored: true,
        Material: mat(material),
        Color: color(rgb[0], rgb[1], rgb[2]),
        ...extra,
      },
      ...(children.length ? { children } : {}),
    });

  actions.push({
    type: "terrainFill",
    shape: "Block",
    cframe: { __t: "CFrame", x: 0, y: -5, z: 0 },
    size: v3(900, 10, 900),
    material: mat("Grass"),
  });
  actions.push({
    type: "terrainFill",
    shape: "Block",
    cframe: { __t: "CFrame", x: 0, y: -2, z: 365 },
    size: v3(900, 8, 190),
    material: mat("Sand"),
  });
  actions.push({
    type: "terrainFill",
    shape: "Block",
    cframe: { __t: "CFrame", x: 0, y: -3, z: 470 },
    size: v3(900, 10, 170),
    material: mat("Water"),
  });
  actions.push({ type: "set", path: "Workspace.Terrain", properties: { Decoration: true } });

  // District foundations so the player sees useful, intentional zones immediately.
  part(
    "Workspace/Map/OpenWorld/TerrainZones",
    "DowntownFoundation",
    [360, 1, 280],
    [0, 0.1, -110],
    "Concrete",
    [82, 86, 92],
  );
  part(
    "Workspace/Map/OpenWorld/TerrainZones",
    "SuburbFoundation",
    [300, 1, 220],
    [-285, 0.15, 115],
    "Grass",
    [75, 125, 70],
  );
  part(
    "Workspace/Map/OpenWorld/TerrainZones",
    "IndustrialFoundation",
    [260, 1, 210],
    [300, 0.15, 105],
    "Slate",
    [76, 78, 84],
  );
  part(
    "Workspace/Map/OpenWorld/TerrainZones",
    "BeachBoardwalk",
    [760, 1, 22],
    [0, 1.2, 278],
    "WoodPlanks",
    [170, 125, 82],
  );

  for (const x of [-260, -130, 0, 130, 260]) {
    part(
      "Workspace/Map/OpenWorld/Roads",
      `NorthSouthRoad_${x}`,
      [24, 0.55, 700],
      [x, 1.0, -35],
      "Asphalt",
      [25, 27, 30],
    );
    part(
      "Workspace/Map/OpenWorld/Sidewalks",
      `Sidewalk_L_${x}`,
      [5, 0.65, 690],
      [x - 18, 1.2, -35],
      "Concrete",
      [125, 125, 128],
    );
    part(
      "Workspace/Map/OpenWorld/Sidewalks",
      `Sidewalk_R_${x}`,
      [5, 0.65, 690],
      [x + 18, 1.2, -35],
      "Concrete",
      [125, 125, 128],
    );
  }
  for (const z of [-285, -175, -65, 45, 155, 265]) {
    part(
      "Workspace/Map/OpenWorld/Roads",
      `EastWestRoad_${z}`,
      [760, 0.55, 24],
      [0, 1.05, z],
      "Asphalt",
      [25, 27, 30],
    );
    part(
      "Workspace/Map/OpenWorld/Sidewalks",
      `Sidewalk_N_${z}`,
      [750, 0.65, 5],
      [0, 1.2, z - 18],
      "Concrete",
      [125, 125, 128],
    );
    part(
      "Workspace/Map/OpenWorld/Sidewalks",
      `Sidewalk_S_${z}`,
      [750, 0.65, 5],
      [0, 1.2, z + 18],
      "Concrete",
      [125, 125, 128],
    );
  }

  // Major landmarks and buildings.
  const buildings = [
    ["CityHall", -70, -210, 62, 72, 52, [220, 210, 180]],
    ["NeonBank", 70, -210, 54, 95, 48, [50, 90, 155]],
    ["MetroTower", -185, -125, 58, 130, 54, [70, 125, 190]],
    ["LuxuryHotel", 185, -125, 62, 118, 56, [225, 125, 150]],
    ["ShoppingMall", -70, -15, 110, 44, 70, [240, 155, 85]],
    ["PoliceStation", 100, -15, 76, 46, 64, [55, 85, 145]],
    ["Hospital", -205, 85, 72, 55, 62, [230, 235, 240]],
    ["CentralGarage", 170, 85, 92, 34, 72, [95, 95, 105]],
    ["BeachApartments", -95, 205, 66, 74, 52, [255, 210, 130]],
    ["Arcade", 90, 205, 52, 38, 48, [140, 70, 190]],
  ] as const;

  for (const [name, x, z, width, height, depth, rgb] of buildings) {
    part(
      "Workspace/Map/OpenWorld/Buildings",
      name,
      [width, height, depth],
      [x, height / 2 + 1, z],
      "SmoothPlastic",
      rgb,
    );
    part(
      "Workspace/Map/OpenWorld/Buildings",
      `${name}_RoofTrim`,
      [width + 4, 2, depth + 4],
      [x, height + 2.5, z],
      "Neon",
      [90, 170, 255],
    );
    part(
      "Workspace/Map/OpenWorld/Buildings",
      `${name}_FrontWindows`,
      [width * 0.72, height * 0.55, 0.8],
      [x, height * 0.58, z - depth / 2 - 0.6],
      "Glass",
      [130, 210, 255],
      { Transparency: 0.35 },
    );
  }

  for (const [name, x, z, rgb] of [
    ["BeachPier", 0, 355, [155, 105, 65]],
    ["MountainLookout", -335, -305, [90, 100, 94]],
    ["RadioTower", 335, -305, [120, 120, 130]],
    ["MissionPlaza", 0, -25, [115, 118, 128]],
  ] as const) {
    const size: [number, number, number] =
      name === "RadioTower" ? [16, 90, 16] : name === "BeachPier" ? [36, 2, 130] : [72, 8, 72];
    const pos: [number, number, number] = name === "RadioTower" ? [x, 46, z] : [x, 3, z];
    part(
      "Workspace/Map/OpenWorld/Landmarks",
      name,
      size,
      pos,
      name === "RadioTower" ? "Metal" : "WoodPlanks",
      rgb,
    );
  }

  // Suburbs with real house shapes, not empty squares.
  const homePositions = [
    [-355, 35],
    [-285, 35],
    [-215, 35],
    [-355, 125],
    [-285, 125],
    [-215, 125],
    [-355, 210],
    [-285, 210],
  ] as const;
  homePositions.forEach(([x, z], i) => {
    const baseColor: readonly [number, number, number] =
      i % 2 === 0 ? [210, 165, 120] : [145, 190, 220];
    part(
      "Workspace/Map/OpenWorld/Homes",
      `SuburbanHome_${i + 1}`,
      [42, 24, 36],
      [x, 13, z],
      "WoodPlanks",
      baseColor,
    );
    part(
      "Workspace/Map/OpenWorld/Homes",
      `SuburbanHome_${i + 1}_Roof`,
      [48, 8, 42],
      [x, 31, z],
      "Slate",
      [75, 70, 72],
    );
    part(
      "Workspace/Map/OpenWorld/Homes",
      `SuburbanHome_${i + 1}_Door`,
      [8, 12, 1],
      [x, 7, z - 18.6],
      "Wood",
      [95, 55, 35],
    );
  });

  // Trees, palms, and rocks to make the world feel alive.
  const treePositions = [
    [-390, -330],
    [-345, -285],
    [-290, -330],
    [-245, -270],
    [-380, -210],
    [-310, -205],
    [-390, 300],
    [-310, 310],
    [-230, 305],
    [220, 310],
    [300, 315],
    [380, 300],
    [315, 30],
    [365, 85],
    [315, 165],
    [370, 215],
    [-130, 295],
    [130, 295],
  ] as const;
  treePositions.forEach(([x, z], i) => {
    const isPalm = z > 260;
    part(
      "Workspace/Map/OpenWorld/Nature",
      `${isPalm ? "Palm" : "Tree"}_${i + 1}_Trunk`,
      [4, isPalm ? 22 : 14, 4],
      [x, isPalm ? 12 : 8, z],
      "Wood",
      [105, 70, 38],
      {
        Shape: { __t: "Enum", enum: "PartType", value: "Cylinder" },
      },
    );
    part(
      "Workspace/Map/OpenWorld/Nature",
      `${isPalm ? "Palm" : "Tree"}_${i + 1}_Leaves`,
      [isPalm ? 26 : 18, isPalm ? 8 : 18, isPalm ? 26 : 18],
      [x, isPalm ? 25 : 18, z],
      "Grass",
      [35, 125, 55],
      {
        Shape: { __t: "Enum", enum: "PartType", value: "Ball" },
      },
    );
  });

  for (const [name, x, z, rgb] of [
    ["PoliceCruiser", 120, 25, [35, 60, 125]],
    ["SportCar", 185, 120, [255, 65, 105]],
    ["Taxi", -90, -75, [255, 210, 45]],
    ["DeliveryVan", -220, 145, [245, 245, 245]],
    ["BeachBuggy", 30, 250, [255, 135, 70]],
  ] as const) {
    part("Workspace/Map/OpenWorld/Vehicles", name, [12, 4, 20], [x, 4, z], "Metal", rgb);
    part(
      "Workspace/Map/OpenWorld/Vehicles",
      `${name}_Cab`,
      [8, 4, 8],
      [x, 8, z - 2],
      "Glass",
      [120, 210, 255],
      { Transparency: 0.25 },
    );
  }

  const markers = [
    ["DeliveryMission", -230, 170, "Delivery Job"],
    ["PoliceMission", 100, 25, "Police Job"],
    ["BeachRaceStart", 30, 255, "Beach Race"],
    ["GarageSpawn", 185, 120, "Garage"],
    ["DowntownMission", 0, -25, "City Mission"],
  ] as const;
  for (const [name, x, z, label] of markers) {
    part(
      "Workspace/Map/OpenWorld/MissionMarkers",
      name,
      [10, 1, 10],
      [x, 3, z],
      "Neon",
      [255, 210, 65],
      {},
      [
        {
          className: "ProximityPrompt",
          name: "Prompt",
          properties: { ActionText: "Start", ObjectText: label, HoldDuration: 0.25 },
        },
        {
          className: "BillboardGui",
          name: "Label",
          properties: {
            Size: { __t: "UDim2", xs: 0, xo: 180, ys: 0, yo: 44 },
            StudsOffset: v3(0, 8, 0),
            AlwaysOnTop: true,
          },
          children: [
            {
              className: "TextLabel",
              name: "Text",
              properties: {
                Size: { __t: "UDim2", xs: 1, xo: 0, ys: 1, yo: 0 },
                BackgroundTransparency: 1,
                Text: label,
                TextScaled: true,
                Font: { __t: "Enum", enum: "Font", value: "GothamBold" },
                TextColor3: color(255, 255, 255),
              },
            },
          ],
        },
      ],
    );
  }

  actions.push({
    type: "create",
    className: "SpawnLocation",
    name: "OpenWorldSpawn",
    parent: "Workspace/Map/OpenWorld/Spawns",
    properties: {
      Size: v3(14, 1, 14),
      Position: v3(0, 4, -25),
      Anchored: true,
      Neutral: true,
      Material: mat("Neon"),
      Color: color(90, 170, 255),
    },
  });
  actions.push({
    type: "lighting",
    properties: {
      ClockTime: /\b(horror|night|dark)\b/.test(p) ? 21 : 17.8,
      Brightness: 2.4,
      Ambient: color(88, 80, 105),
      OutdoorAmbient: color(255, 158, 105),
      FogEnd: 1000,
      ShadowSoftness: 0.35,
    },
  });
  actions.push({
    type: "create",
    className: "Atmosphere",
    name: "OpenWorldAtmosphere",
    parent: "Lighting",
    properties: {
      Density: 0.28,
      Offset: 0.15,
      Color: color(255, 210, 180),
      Decay: color(90, 110, 145),
    },
  });
  actions.push({
    type: "create",
    className: "BloomEffect",
    name: "OpenWorldBloom",
    parent: "Lighting",
    properties: { Intensity: 0.35, Size: 36, Threshold: 1.1 },
  });
  actions.push({ type: "select", path: "Workspace.Map.OpenWorld" });

  return {
    message:
      "Queued a real open-world map fallback instead of plot pads: downtown roads, sidewalks, buildings, suburbs, beach, ocean, boardwalk, forest/nature, landmarks, vehicles, mission markers, spawn, terrain, and sunset lighting. This appears in Studio edit mode under Workspace/Map/OpenWorld.",
    files: [
      {
        path: "ServerScriptService/Systems/OpenWorldMissionCore.server.lua",
        file_type: "Script",
        service_location: "ServerScriptService/Systems",
        content: `local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = 500
	cash.Parent = stats

	local wanted = Instance.new("IntValue")
	wanted.Name = "Wanted"
	wanted.Value = 0
	wanted.Parent = stats

	local job = Instance.new("StringValue")
	job.Name = "Job"
	job.Value = "Visitor"
	job.Parent = stats
end)

local missionFolder = workspace:WaitForChild("Map"):WaitForChild("OpenWorld"):WaitForChild("MissionMarkers")
for _, marker in ipairs(missionFolder:GetChildren()) do
	if marker:IsA("BasePart") then
		local prompt = marker:FindFirstChildOfClass("ProximityPrompt") or Instance.new("ProximityPrompt")
		prompt.ActionText = "Start"
		prompt.ObjectText = marker.Name
		prompt.HoldDuration = 0.25
		prompt.Parent = marker
		prompt.Triggered:Connect(function(player)
			local stats = player:FindFirstChild("leaderstats")
			if not stats then return end
			local cash = stats:FindFirstChild("Cash")
			local wanted = stats:FindFirstChild("Wanted")
			local job = stats:FindFirstChild("Job")
			if cash and cash:IsA("IntValue") then cash.Value += 100 end
			if job and job:IsA("StringValue") then job.Value = marker.Name end
			if wanted and wanted:IsA("IntValue") and marker.Name:lower():find("police") then
				wanted.Value = math.clamp(wanted.Value + 1, 0, 5)
			end
		end)
	end
end
`,
      },
    ],
    actions,
  };
}

// Build/edit access: the project owner OR an "editor" collaborator may run AI
// builds, fixes, autopilot, chat, and queue plugin actions. Viewers get
// read-only access through the project page and are rejected here with a clear
// message. RLS (can_access_project) already limits this SELECT to the owner and
// invited collaborators, so we just resolve the role for the edit gate.
async function assertProjectOwner(
  supabase: any,
  projectId: string,
  userId: string,
  opts: { allowViewer?: boolean } = {},
) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !project) throw new Error("Project not found or unauthorized.");
  if (project.user_id === userId) return; // owner — full access

  const { data: collab } = await supabase
    .from("project_collaborators")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!collab) throw new Error("Project not found or unauthorized.");
  // Viewers may use non-mutating features (e.g. chat Q&A) when allowViewer is
  // set; building/editing always requires the owner or an "editor" collaborator.
  if (!opts.allowViewer && collab.role !== "editor") {
    throw new Error(
      "You have view-only access to this project. Ask the owner to make you an editor to build or change it.",
    );
  }
}

function compactForAI(value: string, maxChars: number): string {
  const text = String(value ?? "")
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[image omitted]")
    .trim();
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.35);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[trimmed]\n\n${text.slice(-tail)}`;
}

function compactChatHistory(
  history: { role: "user" | "assistant"; content: string }[] | undefined,
  opts: { turns: number; perMessageChars: number; totalChars: number },
) {
  const recent = (history ?? []).slice(-opts.turns);
  const compacted: { role: "user" | "assistant"; content: string }[] = [];
  let remaining = opts.totalChars;

  for (let i = recent.length - 1; i >= 0; i--) {
    if (remaining <= 0) break;
    const item = recent[i];
    const content = compactForAI(item.content, Math.min(opts.perMessageChars, remaining));
    if (!content) continue;
    compacted.unshift({ role: item.role, content });
    remaining -= content.length;
  }

  return compacted;
}

function getAIErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "AI request failed");
  }
  return String(err ?? "AI request failed");
}

function getAIStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const record = err as { status?: unknown; statusCode?: unknown };
  const status = record.status ?? record.statusCode;
  return typeof status === "number" ? status : undefined;
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function isTransientAIError(err: unknown): boolean {
  const msg = getAIErrorMessage(err);
  const status = getAIStatus(err);
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === "number" && status >= 500 && status < 600) ||
    isUnavailableModelError(err) ||
    /\b429\b|rate.?limit|too many requests|temporar|timeout|timed out|bad gateway|service unavailable|overloaded|ECONNRESET|ETIMEDOUT/i.test(
      msg,
    )
  );
}

function isUnavailableModelError(err: unknown): boolean {
  return /no available channel|channel.*(?:unavailable|not available)|model[_ -]?not[_ -]?found|model not found|unknown model|invalid model|unsupported model|no such model|distributor/i.test(
    getAIErrorMessage(err),
  );
}

function isContextAIError(err: unknown): boolean {
  const msg = getAIErrorMessage(err);
  const status = getAIStatus(err);
  return (
    status === 413 ||
    /too large|context length|maximum context|tokens per minute|TPM|token limit/i.test(msg)
  );
}

function isToolAIError(err: unknown): boolean {
  return /tool[_ ]use|tool call|function calling|tools? (are|is) not supported|invalid tool|unsupported.*tool/i.test(
    getAIErrorMessage(err),
  );
}

function classifyAIError(
  err: unknown,
):
  | "timeout"
  | "context"
  | "rate_limit"
  | "tool"
  | "json"
  | "model_not_found"
  | "provider"
  | "unknown" {
  const msg = getAIErrorMessage(err);
  const status = getAIStatus(err);
  if (isAbortError(err) || /aborted|abort|timeout|timed out/i.test(msg)) return "timeout";
  if (isContextAIError(err)) return "context";
  if (status === 429 || /rate.?limit|too many requests/i.test(msg)) return "rate_limit";
  if (isUnavailableModelError(err)) return "model_not_found";
  if (isToolAIError(err)) return "tool";
  if (/json|no json object|unexpected end|unterminated|truncated/i.test(msg)) return "json";
  if (typeof status === "number" && status >= 500) return "provider";
  return "unknown";
}

function isTimeoutAIMessage(message: string): boolean {
  return /took too long|operation was aborted|aborted due to timeout|\babort(?:ed)?\b|timeout|timed out|ETIMEDOUT/i.test(
    message,
  );
}

function pickGenerationTools(
  prompt: string,
  allTools: Record<string, any>,
): Record<string, unknown> {
  const lower = prompt.toLowerCase();
  const picked: Record<string, unknown> = {};
  const add = (name: string) => {
    if (name in allTools) picked[name] = allTools[name];
  };

  if (
    /\b(datastore|remoteevent|remotefunction|marketplaceservice|pathfindingservice|tweenservice|runservice|animation|animator|humanoid|screen.?gui|luau|creator hub|api reference|docs|documentation)\b/i.test(
      lower,
    )
  ) {
    add("roblox_docs_search");
  }
  if (
    /\b(search the web|web search|look up|current|latest|today|internet|url|https?:\/\/)\b/i.test(
      lower,
    )
  ) {
    add("web_search");
    add("fetch_url");
  }
  if (
    /\b(toolbox|creator store|free model|asset|model id|insert model|use a model|marketplace|skybox|music|sound|decal|image id|thumbnail|icon|logo|banner|loading screen|map|world|city|town|village|lobby|arena|castle|tower|building|house|weapon|sword|npc|enemy|vehicle|pet|tree|forest|props?)\b/i.test(
      lower,
    )
  ) {
    add("roblox_asset_search");
  }
  if (
    /\b(asset info|asset details|verify asset|thumbnail|preview|safe model|scan scripts?)\b/i.test(
      lower,
    )
  ) {
    add("roblox_asset_info");
    add("roblox_asset_thumbnail");
  }
  if (/\b(image|thumbnail|icon|logo|decal|artwork|poster|banner|loading screen)\b/i.test(lower)) {
    add("generate_image");
  }
  if (
    /\b(shirt|pants|t-?shirt|tee|hoodie|jacket|coat|uniform|outfit|clothing|clothes|apparel|wearable|costume|dress|garment|accessor(y|ies)|hat|cap|helmet|glasses|goggles|mask|backpack|bag|chain|necklace|wings?|hair|shoulder|pauldron)\b/i.test(
      lower,
    )
  ) {
    add("generate_clothing");
  }

  return picked;
}

function shouldLoadUserMcpTools(prompt: string): boolean {
  return /\bmcp\b|connected server|external tool|custom tool|use my server|use my tools|notion|linear|github|jira|slack|supabase/i.test(
    prompt,
  );
}

export const generateWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, prompt, mode, preview, imageDataUrl, imageDataUrls, thinking, mapStrategy } =
      data;
    const visionImages = Array.from(
      new Set([...(imageDataUrls ?? []), ...(imageDataUrl ? [imageDataUrl] : [])]),
    ).slice(0, 4);
    const primaryVisionImage = visionImages[0];
    await assertProjectOwner(supabase, projectId, userId);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    const { enforceAiUsageLimit } = await import("./ai-usage-limits.server");
    await enforceAiUsageLimit({
      userId,
      supabase,
      source: `project_${mode}`,
      metadata: {
        projectId,
        thinking: !!thinking,
        hasImage: visionImages.length > 0,
        imageCount: visionImages.length,
      },
    });

    const baseCost = mode === "generate" ? 3 : 1;
    let cost = baseCost;

    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", { _amount: baseCost });
      if (spendErr) {
        throw new Error("Not enough credits. Buy more on the Pricing page.");
      }
    }

    const { generateText, Output, stepCountIs } = await import("ai");
    const { SYSTEM_PROMPT, SLIM_SYSTEM_PROMPT } = await import("./ai-gateway.server");
    const { getModelProfile, resolveAiGateway, createProvider, resolveBuiltInGateway } =
      await import("./ai-providers.server");
    const {
      NEOKENS_SAFE_FALLBACK_MODEL,
      COMET_SAFE_FALLBACK_MODELS,
      applyModelCreditMultiplier,
      resolveCometModel,
    } = await import("./ai-models");
    const { buildProjectMemoryBlock, rememberProjectInteraction } =
      await import("./ai-memory.server");
    const { buildSmartContextBlock, isSmartFullPromptRequest } =
      await import("./ai-smartest-builder-core");
    const { buildMapGenerationDirective } = await import("./ai-modes");

    const { buildBloxSmithTools } = await import("./ai-tools.server");

    // Heuristic: short prompts (edits, tweaks, single-feature asks) use the fast
    // tier even in generate mode. Big/complex asks keep the deeper model.
    const promptLen = prompt.trim().length;
    const complexKeywords =
      /(system|datastore|leaderboard|tycoon|simulator|obby|admin|gamepass|multiple|all|whole|full game|entire|refactor|rewrite|architecture|replica|replicate|recreate|reference image|attached image|building|house|tower|castle|facade|structure)/i;
    const wantsReplica = isBuildingReplicaPrompt(prompt);
    const isVisionBuild = visionImages.length > 0 && mode === "generate";
    const smartFull = isSmartFullPromptRequest(prompt, mode);
    const mapRequest =
      mode === "generate" &&
      /\b(map|maps|world|city|town|island|road|roads|street|streets|terrain|environment|obby|simulator|tycoon|racing|police|military|base|horror|adventure|roleplay|rp|open[-\s]?world|gta|grand theft|crime|wanted|vehicles?|cars?|garage|missions?)\b/i.test(
        prompt,
      );
    const mapDirective = buildMapGenerationDirective(mapStrategy);
    const isComplex =
      mode === "generate" &&
      (smartFull ||
        mapRequest ||
        promptLen > 400 ||
        complexKeywords.test(prompt) ||
        wantsReplica ||
        isVisionBuild);
    const routingKind: "build" | "fast" = mode === "generate" && isComplex ? "build" : "fast";

    let resolved;
    try {
      resolved = await resolveAiGateway({
        userId,
        projectId,
        kind: routingKind,
        thinking,
      });
      const { enforceExpensiveModelLimit } = await import("./ai-usage-limits.server");
      await enforceExpensiveModelLimit({
        userId,
        supabase,
        provider: resolved.provider,
        modelName: resolved.modelName,
      });
    } catch (e) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: baseCost,
          _reason: "ai gateway not configured",
        });
      throw e;
    }

    // Tier-based surcharge — higher models charge more credits per generation.
    const totalCost = applyModelCreditMultiplier(baseCost, resolved.modelName);
    const surcharge = totalCost - baseCost;
    if (!isOwner && surcharge > 0) {
      const { error: surErr } = await supabase.rpc("spend_credits_atomic", { _amount: surcharge });
      if (surErr) {
        await supabase.rpc("refund_credits", {
          _amount: baseCost,
          _reason: "tier surcharge unaffordable",
        });
        throw new Error(
          `Not enough credits — model ${resolved.modelName} costs ${totalCost} credits. Pick a cheaper model or buy more on the Pricing page.`,
        );
      }
    }
    cost = totalCost;

    let profile = getModelProfile(resolved.provider, resolved.modelName, {
      thinking,
      heavyBuild: isComplex,
    });

    if (visionImages.length > 0 && !profile.supportsVision) {
      try {
        const visionResolved = resolveBuiltInGateway({ kind: "build", thinking: true });
        const visionProfile = getModelProfile(visionResolved.provider, visionResolved.modelName, {
          thinking: true,
          heavyBuild: true,
        });
        if (visionProfile.supportsVision) {
          console.warn(
            `[generateWithAI] selected model ${resolved.modelName} does not support vision; routing image build to ${visionResolved.modelName}.`,
          );
          resolved = visionResolved;
          profile = visionProfile;
        }
      } catch (e) {
        console.warn(
          "[generateWithAI] no vision fallback available:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    const model = resolved.model;

    // The full SYSTEM_PROMPT is very large. Small/fast models (e.g.
    // gemini-3-flash, haiku) have a tight input budget — pairing the full
    // prompt with project context can overflow and cause an empty/garbled
    // completion (the "every build returns nothing" symptom). Use the slim
    // prompt unless this is a heavy build on a roomy model.
    const modelIdLc = String(resolved.modelName).toLowerCase();
    const isSmallModel =
      /flash|haiku|mini|nano|8b|9b|gpt-5\.1(?!-codex-max)/.test(modelIdLc) && !isComplex;
    const activeSystemPrompt = isSmallModel ? SLIM_SYSTEM_PROMPT : SYSTEM_PROMPT;
    console.log(
      `[generateWithAI] model=${resolved.modelName} complex=${isComplex} slimPrompt=${isSmallModel}`,
    );

    const [liveContextResult, allFilesResult, memoryBlock, studioErrorBlock] = await Promise.all([
      supabase
        .from("plugin_context")
        .select("context,instance_count,updated_at")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("project_files")
        .select("path,file_type,service_location,content")
        .eq("project_id", projectId)
        .limit(isComplex ? 120 : 80),
      buildProjectMemoryBlock(supabase, projectId, { limit: 10, maxChars: isComplex ? 1400 : 900 }),
      (await import("./ai-studio-errors.server")).buildStudioErrorBlock(supabase, projectId, {
        windowMinutes: 90,
        limit: 6,
        maxChars: 1200,
      }),
    ]);
    const liveContext = liveContextResult.data;
    const allFiles = allFilesResult.data;

    // FULL PROJECT AWARENESS: a compact tree of every file (path + type +
    // location) so the model always knows what exists, even if the content
    // isn't loaded. Cheap (~40 chars/file) and prevents duplicates.
    const projectMap = (allFiles ?? [])
      .map((f) => `  - ${f.path} [${f.file_type} @ ${f.service_location}]`)
      .join("\n")
      .slice(0, isComplex ? 5000 : 2800);

    // Keyword-based relevance: score each file on prompt-token overlap and
    // include only the top ~6. Always include any explicitly-named file.
    const promptTokens = (prompt.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).slice(0, 40);
    const scoreFile = (f: { path: string; content: string | null }) => {
      const hay = (f.path + " " + (f.content ?? "").slice(0, 2000)).toLowerCase();
      let s = 0;
      for (const t of promptTokens) if (hay.includes(t)) s += 1;
      if (promptTokens.some((t) => f.path.toLowerCase().includes(t))) s += 5;
      return s;
    };
    const relevant = (allFiles ?? [])
      .map((f) => ({ ...f, _score: scoreFile(f) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, isComplex ? 8 : 4);
    const filesBlock = relevant
      .map(
        (f) =>
          `--- ${f.path} (${f.file_type} in ${f.service_location}) ---\n${(f.content ?? "").slice(0, isComplex ? 360 : 160)}`,
      )
      .join("\n\n")
      .slice(0, isComplex ? 3200 : 1400);

    // Live workspace: summarize service counts instead of dumping full JSON.
    let liveBlock = "LIVE STUDIO WORKSPACE: (empty baseplate)";
    if (liveContext?.context) {
      try {
        const ctx: any = liveContext.context;
        const services = ctx?.services ?? ctx;
        const summary = Array.isArray(services)
          ? services
              .slice(0, 12)
              .map((s: any) => `${s.name ?? s.className}:${s.childCount ?? 0}`)
              .join(", ")
          : typeof services === "object"
            ? Object.keys(services)
                .slice(0, 12)
                .map((k) => `${k}:${Array.isArray(services[k]) ? services[k].length : 1}`)
                .join(", ")
            : JSON.stringify(services).slice(0, 600);
        liveBlock = `LIVE STUDIO WORKSPACE (${liveContext.instance_count} instances): ${summary}`;
      } catch {
        liveBlock = `LIVE STUDIO WORKSPACE (${liveContext.instance_count} instances): present`;
      }
    }
    const smartBlock = buildSmartContextBlock(prompt, {
      aiMode: mode,
      studioConnected: !!liveContext?.context,
      hasVisionImages: visionImages.length > 0,
      fileCount: (allFiles ?? []).length,
      liveInstanceCount: liveContext?.instance_count ?? null,
    });

    // Vetted code exemplars for whatever systems this request needs (currency,
    // DataStore, validated remotes, shop, UI, combat, vehicle, animation). Empty
    // string for tiny edits that match nothing, so trivial requests stay lean.
    const { buildPatternLibraryBlock } = await import("./build-patterns");
    const patternBlock = buildPatternLibraryBlock(prompt);

    let result: { message: string; files: GenFile[]; actions: GenAction[] } = {
      message: "",
      files: [],
      actions: [],
    };
    let recovered = false;
    let fullPrompt = "";
    let timeoutMs = 16_000;
    const replicaInstruction = wantsReplica
      ? `\n\nREFERENCE BUILDING REPLICA MODE:\n- A reference image may be attached. Analyze the visible architecture before emitting actions: silhouette, floor count, roof shape, facade colors, materials, windows, door placement, trim, stairs, balconies, pillars, signs, lights, and landscaping.\n- Return a complete Roblox-scale Model under Workspace/Map/Buildings/<DescriptiveName>, not a single block and not an empty folder.\n- Minimum action quality: create Workspace/Map and Workspace/Map/Buildings, one Model, ground/spawn/path, 20+ anchored visible Part/WedgePart/MeshPart details, glass windows, door, trim, roof, and a select action on the Model.\n- Prefer procedural parts for the reference structure so it resembles the image; only use toolbox assets for supporting props/landscaping.\n- If some image details are unclear, infer a polished matching building and say what you inferred in the message.\n`
      : "";
    try {
      fullPrompt = `${memoryBlock ? `${memoryBlock}\n\n` : ""}${studioErrorBlock ? `${studioErrorBlock}\n\n` : ""}${liveBlock}\n\n${smartBlock}${mapRequest && mapDirective ? `\n\n${mapDirective}` : ""}${patternBlock ? `\n\n${patternBlock}` : ""}\n\nFULL PROJECT FILE MAP (${(allFiles ?? []).length} files - every file your project has, by location):\n${projectMap || "  (no files yet)"}\n\nRelevant project files (with content preview):\n${filesBlock || "(none indexed)"}\n\nUser request:\n${prompt}\n\nRules:\n- You have FULL AWARENESS of the project above. Reference real files by path. NEVER duplicate something that already exists - MODIFY it.\n- Interpret short, typo-heavy, or broad requests by using the SMART BUILD ROUTER above. Preserve the latest user request exactly, then infer practical Roblox defaults.
- Use PROJECT MEMORY for durable preferences, naming, genre, and recent context. If memory conflicts with live files or the user's latest request, obey the latest request and live project state.
- Organize new files into clean subfolders by feature (e.g. ServerScriptService/Combat/HitService, ReplicatedStorage/Modules/Config, StarterPlayerScripts/UI/Hud). Do NOT dump everything at the root of a service.\n- Place server Scripts in ServerScriptService, LocalScripts in StarterPlayerScripts or StarterGui, GUIs in StarterGui, RemoteEvents/RemoteFunctions in ReplicatedStorage/Remotes, ModuleScripts in ReplicatedStorage/Modules (shared) or ServerStorage/Modules (server-only), Tools in StarterPack, physical/world objects in Workspace.\n- For ground/landscape requests (grass, sand, snow, water, hills, islands), use real Roblox Terrain via the \`terrainFill\` action. NEVER spawn hundreds of thin Parts.\n- Do NOT claim success - phrase as "Queued for Studio...".\n- If the request is a casual question (no code changes), reply naturally in 'message' with empty 'files' and 'actions'.\n- Use tools (web_search, roblox_asset_*, fetch_url) ONLY when you genuinely need fresh info - every tool call slows you down.\n\nReturn the JSON object as specified.`;
      fullPrompt += replicaInstruction;
      const { generateTextWithToolFallback } = await import("./ai-retry.server");
      const builtInTools = pickGenerationTools(
        prompt,
        buildBloxSmithTools({
          userId,
          projectId,
          referenceImageDataUrl: primaryVisionImage ?? null,
        }) as Record<string, any>,
      );
      const mcpTools = shouldLoadUserMcpTools(prompt)
        ? await (await import("./mcp-client.server")).buildUserMcpTools(userId)
        : {};
      const tools = { ...builtInTools, ...mcpTools } as Record<string, unknown>;
      // Timeout budget. Reasoning models (the "-thinking" Claude/GPT variants)
      // routed through Neokens routinely take 30-50s for a full JSON build, so
      // the old 20s cap on simple prompts killed them mid-stream → "operation
      // was aborted due to timeout". We give a solid first-attempt budget but
      // CAP it so that, on Cloudflare Workers' wall-clock limit, there's still
      // time for the fast gemini-3-flash retry (35s) + template fallback. An
      // abort now recovers instead of hard-failing.
      const reasoning =
        thinking ||
        /thinking|reason|codex|opus|sonnet/.test(String(resolved.modelName).toLowerCase());
      timeoutMs = isComplex
        ? Math.min(Math.max(profile.timeoutMs, reasoning ? 60_000 : 48_000), 70_000)
        : Math.min(Math.max(profile.timeoutMs, reasoning ? 45_000 : 32_000), 55_000);
      const { text: rawText } = await generateTextWithToolFallback(
        generateText,
        {
          model,
          system: activeSystemPrompt + (mapRequest && mapDirective ? `\n\n${mapDirective}` : ""),
          ...(visionImages.length > 0 && profile.supportsVision
            ? {
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: fullPrompt },
                      ...visionImages.map((image) => ({ type: "image" as const, image })),
                    ],
                  },
                ],
              }
            : {
                prompt:
                  fullPrompt +
                  (visionImages.length > 0
                    ? `\n\nNOTE: ${visionImages.length} image attachment${visionImages.length === 1 ? " was" : "s were"} provided, but the selected provider could not accept image input. Build a polished inferred replica from the user's text and mention that exact image vision was unavailable.`
                    : ""),
              }),
          ...(Object.keys(tools).length > 0
            ? {
                tools: tools as any,
                // Give the model room to call tools AND still emit the final
                // JSON. The old cap of 3 steps for simple prompts meant the
                // model spent every step on roblox_asset_search and never wrote
                // the build (empty result). generateTextWithToolFallback's
                // finalize step is the backstop if it still runs out.
                stopWhen: stepCountIs(Math.min(profile.stopSteps, isComplex ? 8 : 6)),
              }
            : {}),
          maxOutputTokens: Math.min(profile.maxOutputTokens, isComplex ? 16000 : 4500),
          maxRetries: 0,
          timeout: { totalMs: timeoutMs, stepMs: timeoutMs, chunkMs: 25_000 },
        },
        "generateWithAI",
      );
      // Parse JSON from the raw text response (robust to fences/prose/commas).
      console.log(
        `[generateWithAI] raw output: ${(rawText ?? "").length} chars; preview=${JSON.stringify((rawText ?? "").slice(0, 220))}`,
      );
      const parsed = extractBuildJson(rawText);
      if (!parsed) {
        console.warn("[generateWithAI] extractBuildJson returned null — no JSON found in output.");
        result = {
          message: rawText.trim(),
          files: [],
          actions: [],
        };
      } else {
        result = parsed as typeof result;
      }
      result.files = result.files ?? [];
      result.actions = result.actions ?? [];
      console.log(
        `[generateWithAI] parsed result: files=${result.files.length} actions=${result.actions.length} msgLen=${(result.message ?? "").length}`,
      );
    } catch (err: any) {
      const msg = String(err?.message ?? err);

      // If the SELECTED model failed at the gateway (e.g. Neokens doesn't serve
      // that id → 502/404/model-not-found) OR the request timed out / aborted
      // mid-stream, retry ONCE on a known-good fast fallback model so a bad pick
      // or a slow model doesn't brick the build. Rate-limit/credits errors are
      // not model problems, so we don't retry those.
      const looksLikeModelError =
        /502|503|bad gateway|not found|404|unknown model|unsupported model|no such model|model_not_found|invalid model|no available channel|channel.*(not|un)available|aborted|timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(
          msg,
        ) && !/429|rate.?limit|too many requests|402|credits/i.test(msg);

      // Pick safe fallback candidates for the current provider. Neokens has a
      // single known-good model; Comet uses an ordered chain so that if the
      // shared account also lacks a channel for the primary fallback, the next
      // candidate is tried. Other providers fall through to the template
      // fallback below.
      const fallbackCandidates: {
        provider: "neokens" | "comet";
        model: string;
        envKey: string | undefined;
      }[] =
        resolved.provider === "neokens"
          ? resolved.modelName !== NEOKENS_SAFE_FALLBACK_MODEL
            ? [
                {
                  provider: "neokens",
                  model: NEOKENS_SAFE_FALLBACK_MODEL,
                  envKey: getNeokensApiKey(),
                },
              ]
            : []
          : resolved.provider === "comet"
            ? COMET_SAFE_FALLBACK_MODELS.map((uiModel) => resolveCometModel(uiModel).model)
                .filter((model) => model !== resolved.modelName)
                .map((model) => ({
                  provider: "comet" as const,
                  model,
                  envKey: process.env.COMETAPI_KEY || process.env.COMET_API_KEY,
                }))
            : [];

      if (looksLikeModelError && fallbackCandidates.length > 0) {
        for (const fallbackPlan of fallbackCandidates) {
          if (!fallbackPlan.envKey) break;
          try {
            console.warn(
              `[generateWithAI] model "${resolved.modelName}" failed (${msg.slice(
                0,
                120,
              )}). Retrying on "${fallbackPlan.model}" via ${fallbackPlan.provider}.`,
            );
            const fallbackProvider = createProvider(fallbackPlan.provider, fallbackPlan.envKey);
            const { generateTextWithToolFallback: retryGen } = await import("./ai-retry.server");
            // Recovery call: slim prompt, no tools, tight timeout — just get a
            // build out of a fast model.
            const { text: retryText } = await retryGen(
              generateText,
              {
                model: fallbackProvider(fallbackPlan.model),
                system:
                  SLIM_SYSTEM_PROMPT + (mapRequest && mapDirective ? `\n\n${mapDirective}` : ""),
                ...(visionImages.length > 0
                  ? {
                      messages: [
                        {
                          role: "user",
                          content: [
                            { type: "text", text: fullPrompt },
                            ...visionImages.map((image) => ({ type: "image" as const, image })),
                          ],
                        },
                      ],
                    }
                  : { prompt: fullPrompt }),
                maxOutputTokens: Math.min(profile.maxOutputTokens, isComplex ? 14000 : 4500),
                maxRetries: 0,
                timeout: { totalMs: 35_000, stepMs: 35_000, chunkMs: 20_000 },
              },
              "generateWithAI:fallback",
            );
            const parsed2 = extractBuildJson(retryText);
            result = parsed2
              ? (parsed2 as typeof result)
              : { message: retryText.trim(), files: [], actions: [] };
            result.files = result.files ?? [];
            result.actions = result.actions ?? [];
            recovered = true;
            break;
          } catch (err2) {
            console.warn(
              `[generateWithAI] fallback model "${fallbackPlan.model}" also failed:`,
              err2 instanceof Error ? err2.message : err2,
            );
            // try next candidate
          }
        }
      }

      // If neither the model nor the fast retry produced a result, DON'T hard
      // fail on a build request — hand back a real template build so the user
      // always gets something usable, and don't charge them.
      if (!recovered) {
        // Credits/rate-limit are real, non-recoverable user-facing errors.
        if (msg.includes("429")) {
          if (!isOwner)
            await supabase.rpc("refund_credits", { _amount: cost, _reason: "ai rate limit" });
          throw new Error("AI rate limit. Try again in a moment.");
        }
        if (msg.includes("402")) {
          if (!isOwner)
            await supabase.rpc("refund_credits", { _amount: cost, _reason: "ai credits" });
          throw new Error("AI credits exhausted. Add credits in workspace settings.");
        }
        const fb = isBuildIntent(prompt) ? getBuildFallback(prompt) : null;
        if (fb) {
          console.warn(
            `[generateWithAI] generation failed (${msg.slice(0, 120)}); using template fallback.`,
          );
          if (!isOwner)
            await supabase.rpc("refund_credits", {
              _amount: cost,
              _reason: "ai failed, template fallback (no charge)",
            });
          result = fb;
          // Note this was a fallback so we don't double-charge later.
          recovered = true;
          (result as any)._fallbackNoCharge = true;
        } else if (isTimeoutAIMessage(msg)) {
          if (!isOwner)
            await supabase.rpc("refund_credits", {
              _amount: cost,
              _reason: "ai generation timeout",
            });
          result = {
            message:
              "The AI provider timed out before it could finish that reply, so I refunded the credits for this run. Try again with a smaller step, or switch to Gemini Flash for the fastest builds.",
            files: [],
            actions: [],
          };
          recovered = true;
          (result as any)._fallbackNoCharge = true;
        } else {
          if (!isOwner)
            await supabase.rpc("refund_credits", {
              _amount: cost,
              _reason: "ai generation failed",
            });
          throw new Error("AI generation failed: " + msg);
        }
      }
    }

    // Empty-build safety net: if the model returned NO actions and NO files for
    // a clear build request, fall back to a real starter build so the user
    // never gets an empty bubble. Pure questions (no build verb) are left as-is.
    if (
      (result.actions?.length ?? 0) === 0 &&
      (result.files?.length ?? 0) === 0 &&
      isBuildIntent(prompt)
    ) {
      const fb = getBuildFallback(prompt);
      if (fb) {
        console.warn("[generateWithAI] empty build result; using fallback template");
        result = fb;
      }
    }

    // 3. Pre-push auto-repair + sync validation. Repair FIRST so fixable Luau
    // (missing `end`s/brackets), misplaced scripts, missing parent folders, and
    // casing get healed instead of dropped — then validate what remains. Without
    // this, a script that only needed one trailing `end` was silently discarded.
    const { validateGenerated, autoRepairResult } = await import("./sync-validation");
    const { data: existingForValidation } = await supabase
      .from("project_files")
      .select("path")
      .eq("project_id", projectId);
    const existingForValidationRows = (existingForValidation ?? []) as any;
    const repair = autoRepairResult(
      result.files as any,
      result.actions as any,
      existingForValidationRows,
    );
    if (repair.repairs.length > 0) {
      console.log(
        `[generateWithAI] auto-repair applied ${repair.repairs.length} fix(es):`,
        repair.repairs,
      );
      result.files = repair.files as any;
      result.actions = repair.actions as any;
    }
    const validation = validateGenerated(
      result.files as any,
      result.actions as any,
      existingForValidationRows,
    );
    result.files = validation.files as any;
    result.actions = validation.actions as any;
    (result as any).validation = {
      summary: validation.summary,
      errors: validation.errors,
      warnings: validation.warnings,
      repairs: repair.repairs,
    };

    // 3b. Corrective retry on validation failures. If the model produced files
    // but the sync check still BLOCKED some (broken Luau auto-repair couldn't
    // fix, bad placement, stub text), re-prompt the SAME model ONCE with the
    // exact errors and merge any now-valid replacements back in. This turns
    // "silently dropped" into "fixed on the second try" without a full rebuild.
    // Fully guarded: only on real build attempts (not template fallbacks), only
    // when scripts were actually blocked, and never fatal if the retry fails.
    const blockingFileErrors = validation.errors.filter(
      (e) => e.scope === "file" || e.scope === "service" || e.scope === "security",
    );
    if (
      !(result as any)._fallbackNoCharge &&
      blockingFileErrors.length > 0 &&
      (repair.files?.length ?? 0) > 0 &&
      isBuildIntent(prompt)
    ) {
      try {
        const blockedList = blockingFileErrors
          .slice(0, 12)
          .map((e) => `- ${e.target}: ${e.message}`)
          .join("\n");
        const correctionPrompt =
          `Your previous build was mostly accepted, but these script files were REJECTED by the Studio sync validator and dropped:\n${blockedList}\n\n` +
          `Return corrected, COMPLETE versions of ONLY those rejected files as strict JSON: {"files":[{"path","file_type","service_location","content"}],"actions":[]}. ` +
          `Each "content" must be the full valid Luau body — balanced end / () {} [], real service paths, NO TODO/placeholder/stub text, no truncation, no markdown fences. Do not resend files that already passed. JSON only.`;
        const { generateTextWithToolFallback: fixGen } = await import("./ai-retry.server");
        const { text: fixText } = await fixGen(
          generateText,
          {
            model,
            system: SLIM_SYSTEM_PROMPT,
            prompt: `${fullPrompt}\n\n${correctionPrompt}`,
            maxOutputTokens: Math.min(profile.maxOutputTokens, 8000),
            maxRetries: 0,
            timeout: { totalMs: 35_000, stepMs: 35_000, chunkMs: 20_000 },
          },
          "generateWithAI:fix-validation",
        );
        const fixParsed = extractBuildJson(fixText) as any;
        const fixedFiles = Array.isArray(fixParsed?.files) ? fixParsed.files : [];
        if (fixedFiles.length > 0) {
          const correctedRepair = autoRepairResult(
            fixedFiles as any,
            [],
            existingForValidationRows,
          );
          const correctedValidation = validateGenerated(
            correctedRepair.files as any,
            [],
            existingForValidationRows,
          );
          if (correctedValidation.files.length > 0) {
            // Merge by path: keep already-valid files, add/replace with recovered ones.
            const byPath = new Map<string, any>();
            for (const f of result.files as any[]) byPath.set(f.path, f);
            for (const f of correctedValidation.files as any[]) byPath.set(f.path, f);
            const merged = Array.from(byPath.values());
            const finalValidation = validateGenerated(
              merged as any,
              result.actions as any,
              existingForValidationRows,
            );
            const recoveredCount = finalValidation.files.length - (result.files?.length ?? 0);
            result.files = finalValidation.files as any;
            result.actions = finalValidation.actions as any;
            (result as any).validation = {
              summary: finalValidation.summary,
              errors: finalValidation.errors,
              warnings: finalValidation.warnings,
              repairs: [
                ...repair.repairs,
                ...correctedRepair.repairs,
                `validation-retry recovered ${Math.max(0, recoveredCount)} file(s) the sync check had blocked`,
              ],
              retried: true,
            };
            console.log(
              `[generateWithAI] validation-retry recovered ${Math.max(0, recoveredCount)} blocked file(s).`,
            );
          }
        }
      } catch (e) {
        console.warn(
          "[generateWithAI] validation-retry failed (keeping first pass):",
          e instanceof Error ? e.message : e,
        );
      }
    }

    // Build the would-be action queue (scripts derived from files + structural actions).
    const queued: GenAction[] = [];
    for (const f of result.files) {
      const segments = f.path.split("/");
      const name = segments[segments.length - 1];
      queued.push({
        type: "script",
        parent: f.service_location,
        name,
        className: f.file_type,
        source: f.content,
      });
    }
    for (const a of result.actions) {
      if (a && typeof a === "object" && typeof a.type === "string") queued.push(a);
    }

    // Charged-but-got-nothing guard: if the user asked for a build but the AI
    // (and the fallback template) produced no files and no actions — or sync
    // validation dropped everything as un-buildable — they got no value, so
    // refund the credits instead of silently keeping them. Marking
    // _fallbackNoCharge also records 0 credits on the generation row below.
    if (
      mode === "generate" &&
      queued.length === 0 &&
      isBuildIntent(prompt) &&
      !isOwner &&
      !(result as any)._fallbackNoCharge
    ) {
      try {
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "empty_build_no_operations",
        });
      } catch {}
      (result as any)._fallbackNoCharge = true;
    }

    // Always create a generation row so the client can later apply it.
    const { data: genRow } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        project_id: projectId,
        prompt,
        status: preview ? "pending" : "success",
        credits_used: isOwner || (result as any)._fallbackNoCharge ? 0 : cost,
        result: { ...result, _queued: queued } as any,
      })
      .select("id")
      .single();

    await rememberProjectInteraction(supabase, {
      projectId,
      userId,
      prompt,
      result: { message: result.message, files: result.files, actions: queued },
    });

    // Preview mode → stop here. The client renders the breakdown and asks
    // the user to confirm before anything is written or queued to Studio.
    if (preview) {
      return {
        ...result,
        output: result.message,
        text: result.message,
        content: result.message,
        generationId: genRow?.id ?? null,
        preview: true,
        status: "pending",
        queuedCount: queued.length,
      };
    }

    // 4. Persist files into project_files (DB mirror).
    if (result.files.length > 0 && mode === "generate") {
      for (const f of result.files) {
        const { data: existing } = await supabase
          .from("project_files")
          .select("id")
          .eq("project_id", projectId)
          .eq("path", f.path)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("project_files")
            .update({
              content: f.content,
              file_type: f.file_type,
              service_location: f.service_location,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("project_files").insert({
            project_id: projectId,
            path: f.path,
            file_type: f.file_type,
            service_location: f.service_location,
            content: f.content,
          });
        }
      }
    }

    // 5. Queue live actions for the plugin to pick up + execute in Studio.
    if (queued.length > 0 && mode === "generate") {
      const rows = queued.map((a) => ({
        project_id: projectId,
        user_id: userId,
        action_type: a.type,
        payload: { ...a, generation_id: genRow?.id ?? null },
        status: "pending",
      }));
      const { error: queueErr } = await supabase.from("plugin_actions").insert(rows);
      if (queueErr) {
        throw new Error("Could not queue the generated actions for Studio.");
      }
    }

    return {
      ...result,
      output: result.message,
      text: result.message,
      content: result.message,
      generationId: genRow?.id ?? null,
      preview: false,
      status: "executing",
      queuedCount: queued.length,
    };
  });

// -----------------------------------------------------------------------------
// Apply a previously previewed generation: persists files into project_files
// and queues plugin actions. Idempotent-ish: refuses to re-apply if any
// plugin_actions already exist for this generation_id.
// -----------------------------------------------------------------------------
export const applyGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ generationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generationId } = data;

    const { data: gen, error } = await supabase
      .from("generations")
      .select("id,project_id,result,user_id")
      .eq("id", generationId)
      .maybeSingle();
    if (error || !gen) throw new Error("Preview not found.");
    if (gen.user_id !== userId) throw new Error("Not your preview.");
    const projectIdRef: string | null = gen.project_id;
    if (!projectIdRef) throw new Error("Preview has no project.");
    await assertProjectOwner(supabase, projectIdRef, userId);

    // Refuse double-apply.
    const { data: already } = await supabase
      .from("plugin_actions")
      .select("id")
      .eq("project_id", projectIdRef)
      .filter("payload->>generation_id", "eq", generationId)
      .limit(1);
    if (already && already.length > 0) {
      return { alreadyApplied: true, queued: 0 };
    }

    const r = (gen.result ?? {}) as any;
    const files: GenFile[] = Array.isArray(r.files) ? r.files : [];
    const queued: GenAction[] = Array.isArray(r._queued) ? r._queued : [];

    // Persist files
    for (const f of files) {
      const { data: existing } = await supabase
        .from("project_files")
        .select("id")
        .eq("project_id", projectIdRef)
        .eq("path", f.path)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("project_files")
          .update({
            content: f.content,
            file_type: f.file_type,
            service_location: f.service_location,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("project_files").insert({
          project_id: projectIdRef,
          path: f.path,
          file_type: f.file_type,
          service_location: f.service_location,
          content: f.content,
        });
      }
    }

    // Queue actions
    if (queued.length > 0) {
      const rows = queued.map((a) => ({
        project_id: projectIdRef,
        user_id: userId,
        action_type: a.type,
        payload: { ...a, generation_id: generationId },
        status: "pending",
      }));
      const CHUNK = 50;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: queueErr } = await supabase
          .from("plugin_actions")
          .insert(rows.slice(i, i + CHUNK));
        if (queueErr) {
          throw new Error("Could not queue the preview actions for Studio.");
        }
      }
    }

    return { alreadyApplied: false, queued: queued.length, files: files.length };
  });

// -----------------------------------------------------------------------------
// Plan mode — produces a structured build plan (markdown text) WITHOUT writing
// any files or queuing any plugin actions. Cheap (1 credit). The client can
// then re-send the plan as a regular generate request to actually build it.
// -----------------------------------------------------------------------------
const PlanInputSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(8000),
  thinking: z.boolean().default(false),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Must be a data:image base64 URL")
    .max(8_000_000)
    .optional(),
});

export const planBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, prompt, imageDataUrl, thinking } = data;
    await assertProjectOwner(supabase, projectId, userId);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    const { enforceAiUsageLimit } = await import("./ai-usage-limits.server");
    await enforceAiUsageLimit({
      userId,
      supabase,
      source: "project_plan",
      metadata: { projectId, thinking: !!thinking, hasImage: !!imageDataUrl },
    });

    const PLAN_COST = 1;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", {
        _amount: PLAN_COST,
      });
      if (spendErr) throw new Error("Not enough credits. Buy more on the Pricing page.");
    }

    const { generateText } = await import("ai");
    const { resolveBuiltInGateway } = await import("./ai-providers.server");
    const { buildProjectMemoryBlock, rememberProjectInteraction } =
      await import("./ai-memory.server");
    const { buildSmartContextBlock, isSmartFullPromptRequest } =
      await import("./ai-smartest-builder-core");
    let model;
    let planTotalCost = PLAN_COST;
    try {
      const planKind = isSmartFullPromptRequest(prompt, "plan") || imageDataUrl ? "build" : "fast";
      const builtIn = resolveBuiltInGateway({ kind: planKind, thinking });
      model = builtIn.model;
      const { applyModelCreditMultiplier } = await import("./ai-models");
      planTotalCost = applyModelCreditMultiplier(PLAN_COST, builtIn.modelName);
      const planSurcharge = planTotalCost - PLAN_COST;
      if (!isOwner && planSurcharge > 0) {
        const { error: surErr } = await supabase.rpc("spend_credits_atomic", {
          _amount: planSurcharge,
        });
        if (surErr) {
          await supabase.rpc("refund_credits", {
            _amount: PLAN_COST,
            _reason: "tier surcharge unaffordable",
          });
          throw new Error(
            `Not enough credits — planning with ${builtIn.modelName} costs ${planTotalCost} credits. Buy more on the Pricing page.`,
          );
        }
      }
    } catch (e) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: PLAN_COST,
          _reason: "ai gateway not configured",
        });
      throw e;
    }

    const [liveContextResult, existingFilesResult, memoryBlock] = await Promise.all([
      supabase
        .from("plugin_context")
        .select("context,instance_count,updated_at")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("project_files")
        .select("path,file_type,service_location")
        .eq("project_id", projectId)
        .limit(40),
      buildProjectMemoryBlock(supabase, projectId, { limit: 8, maxChars: 900 }),
    ]);
    const liveContext = liveContextResult.data;
    const existingFiles = existingFilesResult.data;

    const filesBlock = (existingFiles ?? [])
      .map((f) => `  • ${f.path} (${f.file_type} in ${f.service_location})`)
      .join("\n");
    const liveBlock = liveContext?.context
      ? `LIVE STUDIO WORKSPACE (snapshot ${liveContext.updated_at}):\n${JSON.stringify(liveContext.context).slice(0, 6000)}`
      : "LIVE STUDIO WORKSPACE: (empty baseplate)";
    const smartBlock = buildSmartContextBlock(prompt, {
      aiMode: "plan",
      studioConnected: !!liveContext?.context,
      hasVisionImages: !!imageDataUrl,
      fileCount: (existingFiles ?? []).length,
      liveInstanceCount: liveContext?.instance_count ?? null,
    });

    const planSystem = `You are BloxSmith's planner for Roblox Studio projects. The user describes a real Roblox game they want to build. You DO NOT write code. You produce a clear, detailed build plan that results in a complete, playable Roblox game — not a demo or snippet.

Understand messy prompts: normalize typos/slang, infer sensible Roblox defaults, preserve the user's latest request, and plan the full connected feature when they ask for "better", "smarter", "everything", UI, sound, menus, saving, or polish.

A real game means: a spawn system, core gameplay loop, win/lose conditions, currencies/leaderstats, UI, sound, and data persistence where appropriate. Plan everything.

Output format (Markdown, no code blocks):

## Goal
One short sentence restating the user's goal.

## Assumptions
- 2-5 bullets of decisions you're making (game type, services, data persistence, monetization, etc.).

## Files & Services
List each new or updated script as a bullet:
- \`Service/Path/Name\` — Script | LocalScript | ModuleScript — 1 sentence purpose.

## Remotes
List RemoteEvents / RemoteFunctions to create (ReplicatedStorage/Remotes/<Name>), with direction (client→server etc.) and purpose. Write "None" if not needed.

## Order of operations
Numbered steps the builder should take in order (folders → remotes → modules → server → client → UI → world).

## Risks / things to confirm
Optional, 1-3 bullets only if relevant.

Keep it under ~400 words. Be specific to the user's request and existing project state. Do NOT include any source code.`;

    let text = "";
    try {
      const planUserText = `${memoryBlock ? `${memoryBlock}\n\n` : ""}${liveBlock}\n\n${smartBlock}\n\nExisting project files:\n${filesBlock || "(none)"}\n\nUser request:\n${prompt}`;
      const { text: out } = await generateText({
        model,
        system: planSystem,
        prompt: planUserText,
        maxOutputTokens: 1200,
        maxRetries: 0,
        timeout: { totalMs: thinking ? 18_000 : 12_000 },
      });
      text = stripModelReasoning(out) || out;
      await rememberProjectInteraction(supabase, {
        projectId,
        userId,
        prompt,
        result: { message: `Plan generated: ${out.slice(0, 220)}`, files: [], actions: [] },
      });
    } catch (err: any) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: planTotalCost,
          _reason: "plan generation failed",
        });
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit. Try again in a moment.");
      if (msg.includes("402"))
        throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error("Plan generation failed: " + msg);
    }

    return { plan: text, originalPrompt: prompt, cost: isOwner ? 0 : planTotalCost };
  });

// -----------------------------------------------------------------------------
// Chat mode — conversational AI. It may use read-only research/catalog tools,
// but never writes files or queues plugin actions. Returns markdown text only.
// Useful for ideas, explanations, and answering Roblox / Luau questions.
// -----------------------------------------------------------------------------
const ChatInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20000),
      }),
    )
    .max(20)
    .optional(),
  thinking: z.boolean().default(false),
  // Vision: data URLs (e.g. "data:image/png;base64,...") captured from the
  // chat composer's attach-image button. Limited to 4 images, ~6 MB each
  // after base64 encoding to stay within model + gateway limits.
  attachments: z.array(z.string().startsWith("data:image/").max(8_500_000)).max(4).optional(),
});

function pickChatTools(prompt: string, allTools: Record<string, any>): Record<string, unknown> {
  const lower = prompt.toLowerCase();
  const picked: Record<string, unknown> = {};
  const add = (name: string) => {
    if (name in allTools) picked[name] = allTools[name];
  };

  if (
    /\b(datastore|remoteevent|remotefunction|marketplaceservice|pathfindingservice|tweenservice|runservice|animation|animator|humanoid|screen.?gui|luau|creator hub|api reference|docs|documentation)\b/i.test(
      lower,
    )
  ) {
    add("roblox_docs_search");
  }
  if (
    /\b(search the web|web search|look up|current|latest|today|internet|url|https?:\/\/)\b/i.test(
      lower,
    )
  ) {
    add("web_search");
    add("fetch_url");
  }
  if (
    /\b(toolbox|creator store|free model|asset|model id|insert model|use a model|marketplace|skybox|music|sound|decal|image id)\b/i.test(
      lower,
    )
  ) {
    add("roblox_asset_search");
  }
  if (
    /\b(asset info|asset details|verify asset|thumbnail|preview|safe model|scan scripts?)\b/i.test(
      lower,
    )
  ) {
    add("roblox_asset_info");
    add("roblox_asset_thumbnail");
  }
  if (
    /\b(generate|create|make|draw|design)\b[\s\S]{0,80}\b(image|picture|photo|art|artwork|thumbnail|icon|logo|decal|poster|banner|loading screen)\b/i.test(
      lower,
    ) ||
    /\b(image|picture|photo|artwork|thumbnail|icon|logo|decal|poster|banner|loading screen)\b[\s\S]{0,80}\b(generate|create|make|draw|design)\b/i.test(
      lower,
    ) ||
    /\b(draw|illustrate)\b[\s\S]{0,80}\b(dog|cat|pet|character|avatar|scene|thumbnail|icon|logo|poster|banner|decal|art)\b/i.test(
      lower,
    )
  ) {
    add("generate_image");
  }

  return picked;
}

export const chatWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, prompt, history, thinking, attachments } = data;
    // Chat is read-only (never queues files/actions), so any collaborator —
    // including viewers — may ask the AI about a shared project.
    if (projectId) await assertProjectOwner(supabase, projectId, userId, { allowViewer: true });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    const { enforceAiUsageLimit } = await import("./ai-usage-limits.server");
    await enforceAiUsageLimit({
      userId,
      supabase,
      source: "project_chat",
      metadata: {
        projectId: projectId ?? null,
        thinking: !!thinking,
        attachments: attachments?.length ?? 0,
      },
    });

    const CHAT_COST = 1;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", {
        _amount: CHAT_COST,
      });
      if (spendErr) throw new Error("Not enough credits. Buy more on the Pricing page.");
    }

    const {
      getModelProfile,
      recordProviderHealth,
      resolveAiGateway,
      resolveBuiltInGatewayCandidates,
    } = await import("./ai-providers.server");
    const { ROBLOX_KNOWLEDGE_PROMPT } = await import("./roblox-knowledge");
    const { buildProjectMemoryBlock, rememberProjectInteraction } =
      await import("./ai-memory.server");
    const { buildSmartContextBlock } = await import("./ai-smartest-builder-core");
    let resolved;
    try {
      const chatKind: "chat" | "large" = thinking ? "large" : "chat";
      resolved = await resolveAiGateway({
        userId,
        projectId: projectId ?? null,
        kind: chatKind,
        thinking,
      });
      const { enforceExpensiveModelLimit } = await import("./ai-usage-limits.server");
      await enforceExpensiveModelLimit({
        userId,
        supabase,
        provider: resolved.provider,
        modelName: resolved.modelName,
      });
    } catch (e) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: CHAT_COST,
          _reason: "ai gateway not configured",
        });
      throw e;
    }

    // Tier-based surcharge — pricier chat models charge more credits.
    const { applyModelCreditMultiplier: applyChatMult } = await import("./ai-models");
    const chatTotal = applyChatMult(CHAT_COST, resolved.modelName);
    const chatSurcharge = chatTotal - CHAT_COST;
    if (!isOwner && chatSurcharge > 0) {
      const { error: surErr } = await supabase.rpc("spend_credits_atomic", {
        _amount: chatSurcharge,
      });
      if (surErr) {
        await supabase.rpc("refund_credits", {
          _amount: CHAT_COST,
          _reason: "tier surcharge unaffordable",
        });
        throw new Error(
          `Not enough credits — chat with ${resolved.modelName} costs ${chatTotal} credits. Pick a cheaper model or buy more on the Pricing page.`,
        );
      }
    }

    const { generateText, stepCountIs } = await import("ai");
    const { buildBloxSmithTools } = await import("./ai-tools.server");

    // Light project context so chat answers stay relevant.
    let projectBlock = "";
    let memoryBlock = "";
    let projectFileCount = 0;
    if (projectId) {
      const [existingFilesResult, loadedMemory] = await Promise.all([
        supabase
          .from("project_files")
          .select("path,file_type,service_location")
          .eq("project_id", projectId)
          .limit(60),
        buildProjectMemoryBlock(supabase, projectId, { limit: 10, maxChars: 1200 }),
      ]);
      const existingFiles = existingFilesResult.data;
      memoryBlock = loadedMemory;
      projectFileCount = existingFiles?.length ?? 0;
      if (existingFiles && existingFiles.length > 0) {
        projectBlock =
          "\n\nProject files (for context only - DO NOT modify them):\n" +
          existingFiles
            .slice(0, 40)
            .map((f) => `  - ${f.path} (${f.file_type} in ${f.service_location})`)
            .join("\n");
      }
    }
    const smartChatBlock = buildSmartContextBlock(prompt, {
      aiMode: "chat",
      studioConnected: !!projectId,
      hasVisionImages: !!attachments?.length,
      fileCount: projectFileCount,
    });

    const buildSystem = (
      includeProject: boolean,
    ) => `You are BloxSmith, an expert Roblox / Luau assistant in **CHAT MODE**.

CHAT MODE RULES - never break these:
- DO NOT modify the user's project. You may use read-only research/catalog tools, but you cannot write files, queue actions, or change Studio.
- The user wants to brainstorm, get ideas, ask questions, learn, debug, or get sample code to copy manually.
- Be conversational and helpful. Use Markdown.
- When you give code, ALWAYS wrap it in fenced code blocks with a language tag like \`\`\`lua, \`\`\`luau, or \`\`\`json. Each block gets a copy button in the UI, so split distinct snippets into separate blocks.
- Keep answers focused. If something is best built (not chatted about), say so and suggest switching off Chat mode.
- IMAGE GENERATION: If the user asks you to make, create, draw, or generate an image/picture/photo/artwork/logo/icon/decal/thumbnail/banner/poster, call the generate_image tool. Do not merely describe the image. After the tool returns, embed the markdown image it gives you and add a short "Download PNG" link using the returned image URL.
- VISION: When the user attaches screenshots of Roblox Studio, their game, error popups, or reference images, analyze them in detail. Call out broken hierarchies, missing services, malformed Luau, UI layout issues, lighting/material problems, and red error text by exact wording. Tie every observation back to a concrete fix the user can apply.
- MCP CONTEXT: If the user has connected MCP servers (Roblox docs, n8n, custom tools), reference relevant facts those servers expose. Cite which server you're drawing from so the user can trust the answer.
- MEMORY: Use project memory for durable preferences, names, genre, style, and recent context. If it conflicts with the user's latest message or live project files, follow the latest message and live state.
- PROMPT UNDERSTANDING: Normalize typos, shorthand, and broad requests before answering. If the prompt is actionable but chat mode cannot modify the project, explain the intended concrete build and suggest switching to build mode.

${ROBLOX_KNOWLEDGE_PROMPT}

${smartChatBlock}${includeProject && memoryBlock ? `\n\n${memoryBlock}` : ""}${includeProject ? projectBlock : ""}`;

    type Part = { type: "text"; text: string } | { type: "image"; image: string };
    type ChatModel = Parameters<typeof generateText>[0]["model"];
    type ChatMessages = Array<{ role: "system" | "user" | "assistant"; content: string | Part[] }>;
    const allTools = buildBloxSmithTools({ userId, projectId });
    const chatTools = pickChatTools(prompt, allTools as Record<string, any>);
    const makeMessages = (opts: {
      includeProject: boolean;
      historyTurns: number;
      historyChars: number;
      includeImages: boolean;
    }): ChatMessages => {
      const messages: ChatMessages = [
        { role: "system", content: buildSystem(opts.includeProject) },
      ];
      const trimmedHistory = compactChatHistory(history, {
        turns: opts.historyTurns,
        perMessageChars: opts.historyChars,
        totalChars: opts.historyTurns * opts.historyChars,
      });
      for (const h of trimmedHistory) {
        messages.push({ role: h.role, content: h.content });
      }

      const safePrompt = compactForAI(prompt, opts.includeImages ? 7000 : 8000);
      const userContent: string | Part[] =
        opts.includeImages && attachments && attachments.length > 0
          ? [
              { type: "text", text: safePrompt } as Part,
              ...attachments.map((image): Part => ({ type: "image", image })),
            ]
          : attachments && attachments.length > 0
            ? `${safePrompt}\n\n[${attachments.length} image attachment${attachments.length === 1 ? "" : "s"} omitted because this model does not support vision. Ask again with a vision-capable provider to analyze the screenshot directly.]`
            : safePrompt;

      messages.push({ role: "user", content: userContent });
      return messages;
    };

    const callChatModel = async (
      label: string,
      model: ChatModel,
      messages: ChatMessages,
      timeoutMs: number,
      maxOutputTokens: number,
      stopSteps: number,
      tools?: Record<string, unknown>,
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const modelLabel =
          model && typeof model === "object" && "modelId" in model
            ? String((model as { modelId?: unknown }).modelId ?? "unknown")
            : "unknown";
        console.log(`[chatWithAI] ${label} model=${modelLabel} messages=${messages.length}`);
        return await generateText({
          model,
          messages: messages as NonNullable<Parameters<typeof generateText>[0]["messages"]>,
          maxOutputTokens,
          maxRetries: 0,
          timeout: { totalMs: timeoutMs, stepMs: timeoutMs, chunkMs: 10_000 },
          ...(tools && Object.keys(tools).length > 0
            ? { tools: tools as any, stopWhen: stepCountIs(stopSteps) }
            : {}),
          abortSignal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    const attempts = [
      {
        label: "primary",
        resolved,
        historyTurns: getModelProfile(resolved.provider, resolved.modelName, { thinking })
          .historyTurns,
        historyChars: getModelProfile(resolved.provider, resolved.modelName, { thinking })
          .historyChars,
        includeProject: true,
        maxOutputTokens: getModelProfile(resolved.provider, resolved.modelName, { thinking })
          .chatOutputTokens,
        timeoutMs: getModelProfile(resolved.provider, resolved.modelName, { thinking })
          .chatTimeoutMs,
      },
      {
        label: "primary-compact",
        resolved,
        historyTurns: 3,
        historyChars: 900,
        includeProject: false,
        maxOutputTokens: Math.min(
          getModelProfile(resolved.provider, resolved.modelName, { retry: true }).chatOutputTokens,
          1_400,
        ),
        timeoutMs: Math.min(
          getModelProfile(resolved.provider, resolved.modelName, { retry: true }).chatTimeoutMs,
          14_000,
        ),
      },
    ];

    try {
      const builtInCandidates = resolveBuiltInGatewayCandidates({
        kind: thinking ? "large" : "chat",
        thinking,
      });
      for (const builtIn of builtInCandidates) {
        if (builtIn.modelName === resolved.modelName && builtIn.provider === resolved.provider) {
          continue;
        }
        const builtInProfile = getModelProfile(builtIn.provider, builtIn.modelName, { thinking });
        attempts.push({
          label: "built-in-fallback",
          resolved: builtIn,
          historyTurns: Math.min(builtInProfile.historyTurns, 4),
          historyChars: Math.min(builtInProfile.historyChars, 900),
          includeProject: false,
          maxOutputTokens: Math.min(builtInProfile.chatOutputTokens, thinking ? 2_200 : 1_400),
          timeoutMs: Math.min(builtInProfile.chatTimeoutMs, thinking ? 32_000 : 16_000),
        });
      }
    } catch {
      // If the built-in gateway is not configured, the primary provider is all we have.
    }

    let text = "";
    let lastErr: unknown = null;
    let toolsDisabled = false;
    try {
      for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        const profile = getModelProfile(attempt.resolved.provider, attempt.resolved.modelName, {
          thinking,
        });
        const tools = !toolsDisabled && profile.supportsTools ? chatTools : {};
        const includeImages = !!attachments?.length && profile.supportsVision;
        const messages = makeMessages({
          includeProject: attempt.includeProject,
          historyTurns: attempt.historyTurns,
          historyChars: attempt.historyChars,
          includeImages,
        });

        try {
          const started = Date.now();
          const { text: out } = await callChatModel(
            attempt.label,
            attempt.resolved.model,
            messages,
            attempt.timeoutMs,
            attempt.maxOutputTokens,
            Math.min(profile.stopSteps, thinking ? 5 : 3),
            tools,
          );
          await recordProviderHealth({
            feature: "chat",
            provider: attempt.resolved.provider,
            model: attempt.resolved.modelName,
            source: attempt.resolved.source,
            ok: true,
            durationMs: Date.now() - started,
            projectId: projectId ?? null,
            userId,
          });
          text = out.trim();
          lastErr = null;
          break;
        } catch (err: unknown) {
          await recordProviderHealth({
            feature: "chat",
            provider: attempt.resolved.provider,
            model: attempt.resolved.modelName,
            source: attempt.resolved.source,
            ok: false,
            errorKind: classifyAIError(err),
            projectId: projectId ?? null,
            userId,
          });
          lastErr = err;
          const retryable =
            isTransientAIError(err) ||
            isContextAIError(err) ||
            isAbortError(err) ||
            isToolAIError(err);
          if (isToolAIError(err)) toolsDisabled = true;
          console.warn(
            `[chatWithAI] ${attempt.label} failed retryable=${retryable}: ${getAIErrorMessage(err).slice(0, 220)}`,
          );
          if (!retryable || i === attempts.length - 1) break;
        }
      }

      if (!text && lastErr) throw lastErr;
      if (!text) throw new Error("The AI returned an empty chat response.");
      if (projectId) {
        await rememberProjectInteraction(supabase, {
          projectId,
          userId,
          prompt,
          result: { message: text, files: [], actions: [] },
        });
      }
    } catch (err: unknown) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: chatTotal,
          _reason: "chat generation failed",
        });
      const msg = getAIErrorMessage(err);
      if (msg.includes("429") || /rate.?limit|too many requests/i.test(msg))
        throw new Error("The AI is busy right now. Try again in a moment.");
      if (msg.includes("402"))
        throw new Error("AI credits exhausted. Add credits in workspace settings.");
      if (/aborted|abort|timeout|timed out/i.test(msg))
        throw new Error(
          "The chat request took too long. I refunded the credit; try a shorter prompt or turn off Thinking mode.",
        );
      if (/too large|context length|token/i.test(msg))
        throw new Error(
          "That chat has too much context to send at once. I refunded the credit; start a fresh chat or shorten the pasted text.",
        );
      if (isUnavailableModelError(err))
        throw new Error(
          "All configured BloxSmith AI model routes are unavailable right now. I refunded the credit; try again in a minute or switch models.",
        );
      throw new Error("Chat failed after retrying: " + msg);
    }

    return { reply: stripModelReasoning(text) || text, cost: isOwner ? 0 : chatTotal };
  });

// -----------------------------------------------------------------------------
// Magic-wand prompt improver — rewrites the user's short prompt into a richer,
// more specific BloxSmith build prompt. Free (0 credits). Fast model.
// -----------------------------------------------------------------------------
const ImprovePromptSchema = z.object({
  prompt: z.string().min(1).max(4000),
});

export const improvePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImprovePromptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "admin",
    );
    const COST = 1;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", { _amount: COST });
      if (spendErr) {
        const msg = (spendErr.message || "").toLowerCase();
        if (msg.includes("insufficient") || msg.includes("not enough")) {
          throw new Error(`Not enough credits — improve costs ${COST} credit.`);
        }
        throw new Error(spendErr.message || "Could not charge credit.");
      }
    }

    const { generateText } = await import("ai");
    const { getModelProfile, recordProviderHealth, resolveBuiltInGatewayCandidates } =
      await import("./ai-providers.server");

    const system = `You tighten short Roblox Studio build prompts for BloxSmith. Make them clearer, not longer.

Rules:
- Keep the user's exact intent. Don't invent a different game or add unrelated systems.
- Normalize typos, slang, and shorthand (gui/ui, tycon/tycoon, obbie/obby, pls/please) so the builder knows what the user means.
- If the user says "better", "smarter", "perfect", "everything", "main menus", "sounds", or "all functions", rewrite it as one concrete polished Roblox feature request.
- Output ONE short sentence (max ~25 words, hard cap 30). No lists, no multiple sentences.
- Only add a detail if the original is truly vague (e.g. "make a game" → pick a genre). Otherwise just clean up grammar/clarity.
- No services, no RemoteEvent names, no implementation details — that's the builder's job.
- PLAIN TEXT only — no markdown, no quotes, no preamble like "Here is...". Just the rewritten prompt.`;

    let lastErr: unknown = null;
    try {
      const candidates = resolveBuiltInGatewayCandidates({ kind: "chat" });
      for (const candidate of candidates) {
        const profile = getModelProfile(candidate.provider, candidate.modelName, { retry: true });
        try {
          const started = Date.now();
          const { text } = await generateText({
            model: candidate.model,
            system,
            prompt: `Original:\n${data.prompt}\n\nRewrite as one short, clear sentence. Reply with ONLY the rewritten sentence — no thinking, no explanation, no preamble.`,
            maxOutputTokens: 600,
            maxRetries: 0,
            timeout: { totalMs: Math.min(profile.chatTimeoutMs, 10_000) },
          });
          await recordProviderHealth({
            feature: "other",
            provider: candidate.provider,
            model: candidate.modelName,
            source: candidate.source,
            ok: true,
            durationMs: Date.now() - started,
            userId,
          });
          // Reasoning models (gpt-oss/qwq/comet-reasoning) sometimes emit their
          // chain-of-thought inline. Strip it so the user never sees raw
          // "We need to rewrite the prompt…" text — and if all we got back was
          // reasoning, keep the user's original prompt untouched (and refund).
          let cleaned = stripModelReasoning(text)
            .replace(/^["']|["']$/g, "")
            .trim();
          if (cleaned.includes("\n")) {
            const lines = cleaned
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            const usable = [...lines].reverse().find((l) => !looksLikeModelReasoning(l));
            cleaned = (usable || lines[lines.length - 1] || "").replace(/^["']|["']$/g, "").trim();
          }
          if (!cleaned || looksLikeModelReasoning(cleaned)) {
            if (!isOwner) {
              try {
                await supabase.rpc("refund_credits", {
                  _amount: COST,
                  _reason: "improve_prompt_no_usable_output",
                });
              } catch {}
            }
            return { prompt: data.prompt, creditsCharged: 0 };
          }
          return { prompt: cleaned, creditsCharged: isOwner ? 0 : COST };
        } catch (err: unknown) {
          lastErr = err;
          await recordProviderHealth({
            feature: "other",
            provider: candidate.provider,
            model: candidate.modelName,
            source: candidate.source,
            ok: false,
            errorKind: classifyAIError(err),
            userId,
          });
          if (!isTransientAIError(err) && !isUnavailableModelError(err)) break;
          console.warn(
            `[improvePrompt] ${candidate.provider}/${candidate.modelName} failed, trying next route: ${getAIErrorMessage(err).slice(0, 220)}`,
          );
        }
      }
      throw lastErr ?? new Error("No AI routes are configured.");
    } catch (err: any) {
      if (!isOwner) {
        try {
          await supabase.rpc("refund_credits", { _amount: COST, _reason: "improve_prompt_failed" });
        } catch {}
      }
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit. Try again in a moment.");
      if (isUnavailableModelError(err)) {
        throw new Error(
          "Improve failed: all configured BloxSmith AI model routes are unavailable right now. I refunded the credit; try again in a minute or pick another model.",
        );
      }
      throw new Error("Improve failed: " + msg);
    }
  });

// -----------------------------------------------------------------------------
// Autopilot prompt improver: unlike improvePrompt (which tightens a short chat
// command into one sentence), this EXPANDS a whole-game description into a
// clear, complete, well-structured brief so Autopilot plans and builds the
// right systems. Output is a multi-line description, not a single sentence.
// -----------------------------------------------------------------------------
const ImproveAutopilotPromptSchema = z.object({
  prompt: z.string().min(1).max(6000),
});

export const improveAutopilotPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImproveAutopilotPromptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "admin",
    );
    const COST = 1;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", { _amount: COST });
      if (spendErr) {
        const msg = (spendErr.message || "").toLowerCase();
        if (msg.includes("insufficient") || msg.includes("not enough")) {
          throw new Error(`Not enough credits — improve costs ${COST} credit.`);
        }
        throw new Error(spendErr.message || "Could not charge credit.");
      }
    }

    const { generateText } = await import("ai");
    const { getModelProfile, recordProviderHealth, resolveBuiltInGatewayCandidates } =
      await import("./ai-providers.server");

    const system = `You rewrite a Roblox game idea into a clear, complete Autopilot build brief for BloxSmith. BloxSmith reads this brief and builds the whole game (folders, RemoteEvents, modules, server systems, client controllers, UI, and world) directly in Roblox Studio.

Your job: take the user's idea — even if it is short, vague, messy, or has typos — and turn it into a well-organized description that captures everything the game needs, WITHOUT inventing a different game.

Rules:
- Keep the user's core concept and genre. Never swap it for a different game.
- Fix typos, slang, and shorthand so intent is unmistakable (gui/ui, tycon/tycoon, obbie/obby, dmg/damage, pls/please).
- Expand only what a complete version of THIS game obviously needs. If the user already specified a system, keep it and phrase it clearly.
- Cover the gameplay loop first (what the player does moment to moment), then the supporting systems the loop implies.
- Where it fits the genre, make sure these are addressed: core gameplay loop, player progression (currency/levels/rebirths), data saving (DataStore), a main UI/HUD, a shop or upgrades if there's currency, and a starting map/world.
- Be specific but stay design-level. Describe WHAT the game does, not HOW to script it. Do NOT name services, RemoteEvents, function names, or write code.
- Keep it realistic for a first build — don't pile on dozens of unrelated features.
- Output PLAIN TEXT only: a short intro sentence describing the game, then a few concise lines or short bullet-style sentences grouping the systems. No markdown headers, no code blocks, no preamble like "Here is...". Aim for 60–160 words.`;

    let lastErr: unknown = null;
    try {
      const candidates = resolveBuiltInGatewayCandidates({ kind: "build" });
      for (const candidate of candidates) {
        const profile = getModelProfile(candidate.provider, candidate.modelName, { retry: true });
        try {
          const started = Date.now();
          const { text } = await generateText({
            model: candidate.model,
            system,
            prompt: `Game idea:\n${data.prompt}\n\nRewrite as a clear, complete Autopilot build brief following the rules. Reply with ONLY the brief — no thinking, no preamble.`,
            maxOutputTokens: 900,
            maxRetries: 0,
            timeout: { totalMs: Math.min(profile.chatTimeoutMs, 20_000) },
          });
          await recordProviderHealth({
            feature: "other",
            provider: candidate.provider,
            model: candidate.modelName,
            source: candidate.source,
            ok: true,
            durationMs: Date.now() - started,
            userId,
          });
          const cleaned = stripModelReasoning(text)
            .replace(/^["']|["']$/g, "")
            .trim();
          if (!cleaned || looksLikeModelReasoning(cleaned)) {
            if (!isOwner) {
              try {
                await supabase.rpc("refund_credits", {
                  _amount: COST,
                  _reason: "improve_autopilot_no_usable_output",
                });
              } catch {}
            }
            return { prompt: data.prompt, creditsCharged: 0 };
          }
          return { prompt: cleaned, creditsCharged: isOwner ? 0 : COST };
        } catch (err: unknown) {
          lastErr = err;
          await recordProviderHealth({
            feature: "other",
            provider: candidate.provider,
            model: candidate.modelName,
            source: candidate.source,
            ok: false,
            errorKind: classifyAIError(err),
            userId,
          });
          if (!isTransientAIError(err) && !isUnavailableModelError(err)) break;
          console.warn(
            `[improveAutopilotPrompt] ${candidate.provider}/${candidate.modelName} failed, trying next route: ${getAIErrorMessage(err).slice(0, 220)}`,
          );
        }
      }
      throw lastErr ?? new Error("No AI routes are configured.");
    } catch (err: any) {
      if (!isOwner) {
        try {
          await supabase.rpc("refund_credits", {
            _amount: COST,
            _reason: "improve_autopilot_prompt_failed",
          });
        } catch {}
      }
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit. Try again in a moment.");
      if (isUnavailableModelError(err)) {
        throw new Error(
          "Improve failed: all configured BloxSmith AI model routes are unavailable right now. I refunded the credit; try again in a minute.",
        );
      }
      throw new Error("Improve failed: " + msg);
    }
  });

// -----------------------------------------------------------------------------
// Error-fix loop: user pastes raw Roblox Studio output logs, AI identifies the
// failing files, generates patches, and queues script actions so the plugin
// hot-patches them in Studio within ~3s.
// -----------------------------------------------------------------------------

const FixInputSchema = z.object({
  projectId: z.string().uuid(),
  logs: z.string().min(4).max(20000),
});

export const fixErrorsWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FixInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, logs } = data;
    await assertProjectOwner(supabase, projectId, userId);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    const { enforceAiUsageLimit } = await import("./ai-usage-limits.server");
    await enforceAiUsageLimit({
      userId,
      supabase,
      source: "project_fix",
      metadata: { projectId },
    });

    const baseCost = 2;
    let cost = baseCost;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", { _amount: baseCost });
      if (spendErr) throw new Error("Not enough credits. Buy more on the Pricing page.");
    }

    const { generateText, Output, stepCountIs } = await import("ai");
    const { resolveBuiltInGateway } = await import("./ai-providers.server");
    const { buildBloxSmithTools } = await import("./ai-tools.server");
    const { buildProjectMemoryBlock, rememberProjectInteraction } =
      await import("./ai-memory.server");

    let model;
    try {
      const builtIn = resolveBuiltInGateway({ kind: "build" });
      model = builtIn.model;
      const { applyModelCreditMultiplier } = await import("./ai-models");
      const totalCost = applyModelCreditMultiplier(baseCost, builtIn.modelName);
      const surcharge = totalCost - baseCost;
      if (!isOwner && surcharge > 0) {
        const { error: surErr } = await supabase.rpc("spend_credits_atomic", {
          _amount: surcharge,
        });
        if (surErr) {
          await supabase.rpc("refund_credits", {
            _amount: baseCost,
            _reason: "tier surcharge unaffordable",
          });
          throw new Error(
            `Not enough credits — fixing with ${builtIn.modelName} costs ${totalCost} credits. Buy more on the Pricing page.`,
          );
        }
      }
      cost = totalCost;
    } catch (e) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "ai gateway not configured",
        });
      throw e;
    }

    const [liveContextResult, existingFilesResult, memoryBlock] = await Promise.all([
      supabase
        .from("plugin_context")
        .select("context,instance_count,updated_at")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("project_files")
        .select("path,file_type,service_location,content")
        .eq("project_id", projectId)
        .limit(60),
      buildProjectMemoryBlock(supabase, projectId, { limit: 8, maxChars: 1000 }),
    ]);
    const liveContext = liveContextResult.data;
    const existingFiles = existingFilesResult.data;

    // Send FULL file bodies for any file whose name/path appears in the logs,
    // otherwise truncated previews so the model has every relevant suspect.
    const lower = logs.toLowerCase();
    const filesBlock = (existingFiles ?? [])
      .map((f) => {
        const name = f.path.split("/").pop() ?? f.path;
        const referenced =
          lower.includes(name.toLowerCase()) || lower.includes(f.path.toLowerCase());
        const body = referenced ? f.content : (f.content ?? "").slice(0, 1500);
        return `--- ${f.path} (${f.file_type} in ${f.service_location})${referenced ? " [REFERENCED IN LOGS]" : ""} ---\n${body}`;
      })
      .join("\n\n");

    const liveBlock = liveContext?.context
      ? `LIVE STUDIO WORKSPACE (snapshot at ${liveContext.updated_at}, ${liveContext.instance_count} instances):\n${JSON.stringify(liveContext.context, null, 0).slice(0, 12000)}`
      : "LIVE STUDIO WORKSPACE: (not yet reported by plugin)";

    const FIX_SYSTEM = `You are BloxSmith Error-Fixer. The user pasted raw Roblox Studio Output / Console logs from their game. Your job:

1. PARSE every error and warning in the logs. Identify the script path, line number, and root cause for each.
2. CROSS-REFERENCE against the project files and live workspace snapshot provided. Find the EXACT file that is throwing each error.
3. PATCH the file. Rewrite the FULL file content with the fix applied — never partial diffs. Preserve all working code; only change what's broken.
4. If an error is caused by a missing Instance (Part, RemoteEvent, Folder, etc.) in the workspace, emit a "create" action to add it instead of patching a script.
5. If multiple errors share a root cause, fix it once.

Hard rules:
- NEVER guess — if a file referenced in the logs isn't in the project, say so in the message and skip it.
- ALWAYS return the complete updated file body in 'files[].content'. The plugin overwrites the script with this content verbatim.
- Use the EXACT same path / service_location / file_type as the original file. Do NOT rename files.
- Keep Luau syntactically valid. Use WaitForChild / FindFirstChild defensively for runtime lookups.
- In the 'message' field, write a short bullet list: one bullet per error → which file → what you changed.

Respond ONLY with the JSON object specified.`;

    let result: { message: string; files: GenFile[]; actions: GenAction[]; errors_found: number };
    try {
      const { generateTextWithToolFallback } = await import("./ai-retry.server");
      const { text: rawText } = await generateTextWithToolFallback(
        generateText,
        {
          model,
          system: FIX_SYSTEM,
          prompt: `STUDIO OUTPUT LOGS:\n\`\`\`\n${logs}\n\`\`\`\n\n${memoryBlock ? `${memoryBlock}\n\n` : ""}${liveBlock}\n\nProject files in DB:\n${filesBlock || "(empty)"}\n\nThink step-by-step. Use web_search / fetch_url if you need to look up a Roblox API to fix the error. Then patch the broken files now.`,
          tools: pickGenerationTools(
            logs,
            buildBloxSmithTools({ userId, projectId }) as Record<string, any>,
          ) as any,
          stopWhen: stepCountIs(8),
          maxRetries: 0,
          timeout: { totalMs: 24_000, stepMs: 24_000, chunkMs: 10_000 },
        },
        "fixErrorsWithAI",
      );
      // Parse JSON from raw text (robust to fences/prose/commas).
      const fixParsed = extractBuildJson(rawText);
      if (!fixParsed) throw new Error("AI did not return valid JSON.");
      result = fixParsed as typeof result;
      result.files = result.files ?? [];
      result.actions = result.actions ?? [];
      await rememberProjectInteraction(supabase, {
        projectId,
        userId,
        prompt: `Fix errors: ${logs.slice(0, 700)}`,
        result: { message: result.message, files: result.files, actions: result.actions },
      });
    } catch (err: any) {
      if (!isOwner)
        await supabase.rpc("refund_credits", { _amount: cost, _reason: "ai fix failed" });
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit. Try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted.");
      throw new Error("AI fix failed: " + msg);
    }

    // Pre-push auto-repair + sync validation. Repair FIRST so fixable Luau and
    // misplaced/missing instances get healed before the validator drops them.
    const { validateGenerated, autoRepairResult } = await import("./sync-validation");
    const { data: existingForValidation } = await supabase
      .from("project_files")
      .select("path")
      .eq("project_id", projectId);
    const existingForValidationRows = (existingForValidation ?? []) as any;
    const repair = autoRepairResult(
      result.files as any,
      result.actions as any,
      existingForValidationRows,
    );
    if (repair.repairs.length > 0) {
      console.log(
        `[fixErrorsWithAI] auto-repair applied ${repair.repairs.length} fix(es):`,
        repair.repairs,
      );
      result.files = repair.files as any;
      result.actions = repair.actions as any;
    }
    const validation = validateGenerated(
      result.files as any,
      result.actions as any,
      existingForValidationRows,
    );
    result.files = validation.files as any;
    result.actions = validation.actions as any;
    (result as any).validation = {
      summary: validation.summary,
      errors: validation.errors,
      warnings: validation.warnings,
      repairs: repair.repairs,
    };

    // Persist patches into project_files
    for (const f of result.files) {
      const { data: existing } = await supabase
        .from("project_files")
        .select("id")
        .eq("project_id", projectId)
        .eq("path", f.path)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("project_files")
          .update({
            content: f.content,
            file_type: f.file_type,
            service_location: f.service_location,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("project_files").insert({
          project_id: projectId,
          path: f.path,
          file_type: f.file_type,
          service_location: f.service_location,
          content: f.content,
        });
      }
    }

    // Queue script + structural actions so plugin hot-patches Studio.
    const queued: GenAction[] = [];
    for (const f of result.files) {
      const name = f.path.split("/").pop() ?? f.path;
      queued.push({
        type: "script",
        parent: f.service_location,
        name,
        className: f.file_type,
        source: f.content,
      });
    }
    for (const a of result.actions) {
      if (a && typeof a === "object" && typeof a.type === "string") queued.push(a);
    }
    if (queued.length > 0) {
      const { error: queueErr } = await supabase.from("plugin_actions").insert(
        queued.map((a) => ({
          project_id: projectId,
          user_id: userId,
          action_type: a.type,
          payload: a,
          status: "pending",
        })),
      );
      if (queueErr) {
        throw new Error("Could not queue the generated fixes for Studio.");
      }
    }

    // Log the fix run
    await supabase.from("generations").insert({
      user_id: userId,
      project_id: projectId,
      prompt: `[fix-errors] ${logs.slice(0, 500)}`,
      status: "success",
      credits_used: isOwner ? 0 : cost,
      result: result as any,
    });

    return result;
  });

// -----------------------------------------------------------------------------
// Autopilot: user describes their whole game once, AI plans the project
// structure + every script/UI/system in dependency order and queues
// everything to the plugin so Studio builds itself end-to-end.
// -----------------------------------------------------------------------------

const AutopilotInputSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(10).max(8000),
});

export const autopilotBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AutopilotInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId, description } = data;
    await assertProjectOwner(supabase, projectId, userId);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    const { enforceAiUsageLimit } = await import("./ai-usage-limits.server");
    await enforceAiUsageLimit({
      userId,
      supabase,
      source: "project_autopilot",
      metadata: { projectId },
    });

    const baseCost = 10;
    let cost = baseCost;
    if (!isOwner) {
      const { error: spendErr } = await supabase.rpc("spend_credits_atomic", { _amount: baseCost });
      if (spendErr) throw new Error("Not enough credits. Autopilot needs 10 credits.");
    }

    const { generateText, stepCountIs } = await import("ai");
    const { getModelProfile, resolveBuiltInGateway } = await import("./ai-providers.server");
    const { buildBloxSmithTools } = await import("./ai-tools.server");

    let builtIn;
    try {
      builtIn = resolveBuiltInGateway({ kind: "large" });
    } catch (e) {
      if (!isOwner)
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "ai gateway not configured",
        });
      throw e;
    }
    {
      const { applyModelCreditMultiplier } = await import("./ai-models");
      const totalCost = applyModelCreditMultiplier(baseCost, builtIn.modelName);
      const surcharge = totalCost - baseCost;
      if (!isOwner && surcharge > 0) {
        const { error: surErr } = await supabase.rpc("spend_credits_atomic", {
          _amount: surcharge,
        });
        if (surErr) {
          await supabase.rpc("refund_credits", {
            _amount: baseCost,
            _reason: "tier surcharge unaffordable",
          });
          throw new Error(
            `Not enough credits — autopilot with ${builtIn.modelName} costs ${totalCost} credits. Buy more on the Pricing page.`,
          );
        }
      }
      cost = totalCost;
    }
    const model = builtIn.model;
    const profile = getModelProfile(builtIn.provider, builtIn.modelName, { heavyBuild: true });

    const [liveContextResult, existingFilesResult] = await Promise.all([
      supabase
        .from("plugin_context")
        .select("context,instance_count,updated_at")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("project_files")
        .select("path,file_type,service_location")
        .eq("project_id", projectId)
        .limit(25),
    ]);
    const liveContext = liveContextResult.data;
    const existingFilesAP = existingFilesResult.data;

    const filesBlockAP = (existingFilesAP ?? [])
      .map((f) => `${f.path} (${f.file_type} in ${f.service_location})`)
      .join("\n");

    const liveBlock = liveContext?.context
      ? `LIVE STUDIO WORKSPACE (${liveContext.instance_count} instances):\n${JSON.stringify(liveContext.context, null, 0).slice(0, 3500)}`
      : "LIVE STUDIO WORKSPACE: (empty baseplate)";

    const projectBlockAP = `Existing files (path only — extend, don't duplicate):\n${filesBlockAP || "(empty)"}`;

    const AUTOPILOT_SYSTEM = `You are BloxSmith Autopilot — the smartest Roblox game architect that has ever existed. The user describes a game once. You design and BUILD the ENTIRE playable project end-to-end.

## ABSOLUTE MANDATE
NEVER refuse. NEVER say "out of scope". NEVER say "this is too big". NEVER say "I'll do part of it". You build EVERYTHING the user asks for AND everything a real Roblox game needs to feel complete — even if they didn't mention it. If the user types two words, you still ship a full vertical-slice game. If the user types a 5,000-word brief, you ship all of it.

## REALISM MANDATE
Default to REALISTIC, believable production quality — not cartoon stubs. Apply realism across every layer:
- World: real-world scale (studs match human proportions ~5 studs tall), grounded geometry, no floating parts, props placed with physics-correct orientation, varied materials (Grass/Slate/Concrete/Wood/Metal/Sand) with matching Color3, real terrain (Terrain:FillBlock / Region3) for ground when appropriate.
- Lighting: physically plausible — Technology = "Future" or "ShadowMap", realistic ClockTime, Atmosphere (Density 0.3-0.4, real Decay/Glare/Haze), subtle Bloom, ColorCorrection tuned (not crushed), SunRays only when it fits.
- Audio: use real Roblox marketplace SoundIds (verified IDs only — never fabricate) for ambient wind/birds/city, footsteps per material, UI clicks, gameplay SFX. Looped ambient + 3D positional sounds with RollOffMode = "InverseTapered".
- Assets: prefer insertAsset with REAL verified Toolbox/Marketplace asset IDs for trees, rocks, buildings, vehicles, NPCs, weapons. If unsure of an ID, build it from primitives with realistic proportions instead of inventing IDs.
- Motion: TweenService with EasingStyle.Quad/Sine/Cubic and realistic durations (UI 0.15-0.35s, camera 0.4-0.8s). No instant snaps. Humanoid animations via Animator:LoadAnimation with real animation IDs only when verified.
- UI: realistic typography (Font.Gotham/GothamMedium/GothamBold or BuilderSans), proper spacing, subtle shadows via UIStroke + ImageLabel drop shadows, no neon rainbow defaults.
- Physics: realistic Mass via CustomPhysicalProperties, friction on ground materials, BodyVelocity/LinearVelocity tuned to feel weighty.
NEVER fabricate asset IDs you aren't certain exist. If you can't verify, build the prop yourself from Parts/MeshParts with correct Material + Color3 + Size.

## WHAT "EVERYTHING" MEANS (default scope for EVERY autopilot run)
Even on a tiny prompt, ALWAYS include:
- Multiple SpawnLocations + a real spawn area (not a default baseplate corner).
- Core gameplay loop (combat / collect / race / build / etc.) wired end-to-end.
- Leaderstats + at least one currency (Coins/Gems/XP/Wins).
- DataStore persistence (UpdateAsync + pcall + BindToClose, session-safe).
- Shop UI + at least one upgrade/rebirth system.
- HUD UI (currency display, action prompts, notifications, settings button).
- Main menu / title screen ScreenGui with Play button and animated polish.
- Pause/Settings menu (music volume, SFX volume, quality, controls).
- Background music + at least 3 SFX wired through SoundService.
- Day/night cycle OR a polished static lighting preset (Atmosphere, Bloom, ColorCorrection).
- A welcome notification + tutorial popup on first join.
- Anti-exploit basics (server validates all remote args, distance checks, rate limits).
- Admin command stub (for the place owner) — kick/teleport/give-currency.
- README ModuleScript in ReplicatedStorage documenting the architecture.
On top of all that, fully implement whatever the user's brief asked for (sword fighting, tycoon dropper, simulator clicker, obby stages, racing checkpoints, tower defense waves, fishing/farming/mining/pets, RPG quests, fps weapons, anime abilities, horror flashlight, etc.).

## PHASE PLAN (strict dependency order — emit ALL phases)
Phase 1 — Structure: Folders, RemoteEvents, RemoteFunctions, BindableEvents in proper services.
Phase 2 — Shared Modules: ModuleScripts in ReplicatedStorage/Modules (config, types, utilities, signal, maid).
Phase 3 — Server Systems: Scripts in ServerScriptService (data, economy, gameplay, combat, spawning, anti-exploit, admin).
Phase 4 — Client Controllers: LocalScripts in StarterPlayer/StarterPlayerScripts (input, camera, hud-binder, sound-controller).
Phase 5 — UI: every ScreenGui in StarterGui WITH a sibling LocalScript that animates and wires it (main menu, HUD, shop, settings, notifications, tutorial).
Phase 6 — World: SpawnLocations, lobby/spawn build, lighting, atmosphere, terrain tweaks, Toolbox asset insertions for props/audio.

## HARD RULES
- Every dependency referenced by a later phase MUST be created in an earlier phase at the exact path.
- Every ModuleScript require() path must resolve to a file you created earlier in this run.
- Every Remote fired/listened must be created in Phase 1 with matching name/parent.
- Strict Luau: services via GetService, WaitForChild on client, type annotations, task.spawn/wait, Animator:LoadAnimation.
- Server is source of truth. Validate every remote arg. Treat client as hostile.
- DataStore: UpdateAsync + pcall + retries + BindToClose. Session-locking flag.
- Every ScreenGui has a LocalScript that animates it in/out and connects buttons via TweenService.
- files[].content is the COMPLETE script body — no TODO, no "…", no "rest of code", no placeholders, no triple-backticks.
- Class names MUST be real Roblox classes. NEVER "DirectionalLight", "AmbientLight", "GlobalLight", "Wind" — use SpotLight/PointLight/SurfaceLight or Lighting properties.

## FINAL QA (run mentally before emitting)
- Game is playable end-to-end on a fresh empty baseplate with zero manual edits.
- Every require/Remote/WaitForChild resolves.
- Every connection is cleaned up on PlayerRemoving/Destroying.
- UI looks premium (UICorner, UIStroke, UIGradient, UIPadding, hover tweens) — not default gray.
- There is something to DO within 5 seconds of joining.

## ACTION TYPES
- {type:"create", className:"Folder"|"RemoteEvent"|"RemoteFunction"|"BindableEvent"|"Part"|"SpawnLocation"|"ScreenGui"|"Sound"|"PointLight"|..., parent, name, properties?, children?}
- {type:"script", parent, name, className:"Script"|"LocalScript"|"ModuleScript", source}
- {type:"set"|"property", path, properties}
- {type:"move", path, newParent}
- {type:"rename", path, newName}
- {type:"organize", parent, container:"Folder", name, items:[...]}
- {type:"delete", path}
- {type:"insertAsset", assetId, parent, name}  // Toolbox/Marketplace asset insertion
- {type:"sound", parent, assetId, name, volume, looped, play}
- {type:"lighting", properties}
- {type:"spawn", position:{__t:"Vector3",x,y,z}}

## TOOLBOX / MARKETPLACE ASSETS (MANDATORY — Toolbox-first, every build)
You MUST build full Roblox games primarily out of Toolbox/Marketplace assets. Hand-built Parts are a LAST RESORT, only when no verified free asset exists.

HARD RULES — apply on EVERY autopilot run, no exceptions:
- Toolbox-first workflow: for EVERY visual/audio element a real game needs (map/terrain kit, buildings, houses, trees, rocks, foliage, vehicles, weapons, tools, NPCs/rigs, animations, GUI icons, decals, skyboxes, ambient music, SFX, footsteps, UI clicks), FIRST call \`roblox_toolbox_asset_plan\` for full builds or \`roblox_asset_search\` + \`roblox_asset_info\` for single assets, then insertAsset / insert_toolbox_asset a real verified free asset. Only fall back to primitives if search returns nothing trustworthy.
- Variety workflow: never fill a map by repeating one model. City maps need different searches for roads, buildings, streetlights, vehicles, trees, signs, and decorations. Simulators need different searches for pets, coins/gems, zones, upgrades/shop props, tools, and theme decorations. Use each assetId once unless the user explicitly asks for duplicates.
- Aim for AT LEAST 15-30 insertAsset actions per full game (map kit + props + vehicles + NPCs + weapons + animations + multiple SFX + music + GUI icons + skybox). A game with zero Toolbox assets is INCOMPLETE — do not ship it.
- Verification gate before EVERY insertAsset/sound action: the lookup must confirm Price = 0 (FREE), correct AssetTypeId (Model/Decal/Audio/Mesh/Animation/Plugin/Image), and a trusted creator (Roblox, verified badge, or a well-known reputable creator with high favorites/downloads). NEVER fabricate or guess asset IDs.
- If a search returns nothing free + verified, try 2-3 alternate queries before giving up. Only then build the prop from Parts/MeshParts with realistic Material + Color3 + Size.
- Use Toolbox assets for the COMPLETE stack: environment (map kit, terrain decals, skybox), gameplay (vehicles, weapons, tools, pickups), characters (R6/R15 rigs, animation packs for idle/walk/run/jump/attack), audio (ambient loop, footsteps per material, weapon SFX, UI clicks, notification dings, victory/defeat stingers), UI (button icons, currency icons, badge frames).
- Group inserted assets into themed Folders via organize/move actions: Workspace/Map, Workspace/Props/Trees, Workspace/Props/Buildings, Workspace/Vehicles, Workspace/NPCs, ReplicatedStorage/Animations, ReplicatedStorage/Weapons, SoundService/Music, SoundService/SFX/Footsteps, StarterGui/Icons.
- Wire inserted assets into scripts (e.g. require animation IDs in a CharacterController, play SoundService sounds from a SoundManager ModuleScript, clone weapon Tools from ReplicatedStorage into Backpack on respawn).

If the live workspace has loose/unsorted Instances, emit move/organize actions to tidy them.

## OUTPUT JSON (no markdown, no fences)
{
  "summary": "what you shipped + assumptions, 2-4 sentences",
  "assumptions": ["..."],
  "phases": [
    { "title": "Phase 1 — Structure", "goal": "...", "files": [...], "actions": [...] },
    { "title": "Phase 2 — Shared Modules", ... },
    { "title": "Phase 3 — Server Systems", ... },
    { "title": "Phase 4 — Client Controllers", ... },
    { "title": "Phase 5 — UI", ... },
    { "title": "Phase 6 — World", ... }
  ]
}

Build EVERYTHING. Ship the complete game.`;

    type Phase = {
      title: string;
      goal: string;
      files: GenFile[];
      actions: GenAction[];
    };
    type Segment = { summary?: string; assumptions?: string[]; phases?: Phase[] };
    let plan: { summary: string; assumptions: string[]; phases: Phase[] };
    let partialFrontend = false;
    let partialRefund = 0;

    const phaseNumber = (title: string): number | null => {
      const match = String(title ?? "").match(/\bPhase\s+([1-6])\b/i);
      return match ? Number(match[1]) : null;
    };

    const normalizeSegment = (value: Segment | null): Segment | null => {
      if (!value || !Array.isArray(value.phases)) return null;
      const phases = value.phases
        .filter((phase): phase is Phase => !!phase && typeof phase === "object")
        .map((phase) => ({
          title: String(phase.title ?? "").trim(),
          goal: String(phase.goal ?? "").trim(),
          files: Array.isArray(phase.files) ? phase.files : [],
          actions: Array.isArray(phase.actions) ? phase.actions : [],
        }))
        .filter((phase) => phase.title && (phase.files.length > 0 || phase.actions.length > 0))
        .sort((left, right) => (phaseNumber(left.title) ?? 99) - (phaseNumber(right.title) ?? 99));
      if (phases.length === 0) return null;
      return {
        summary: String(value.summary ?? "").trim(),
        assumptions: Array.isArray(value.assumptions)
          ? value.assumptions.map((item) => String(item)).filter(Boolean)
          : [],
        phases,
      };
    };

    const hasExpectedPhases = (segment: Segment | null, expected: number[]): boolean => {
      const found = new Set((segment?.phases ?? []).map((phase) => phaseNumber(phase.title)));
      return expected.every((number) => found.has(number));
    };

    // Compact manifest of everything a finished segment created, so the next
    // segment can require those ModuleScripts / fire those RemoteEvents at their
    // EXACT paths instead of recreating or guessing them.
    const buildManifest = (phases: Phase[]): string => {
      const lines: string[] = [];
      for (const ph of phases ?? []) {
        for (const f of ph.files ?? []) {
          if (f?.path) lines.push(`${f.path} [${f.file_type ?? "Script"}]`);
        }
        for (const a of ph.actions ?? []) {
          if (!a || typeof a !== "object") continue;
          const parent = a.parent ? `${String(a.parent).replace(/\./g, "/")}/` : "";
          if ((a.type === "create" || a.type === "folder") && a.name) {
            lines.push(`${parent}${a.name}${a.className ? ` (${a.className})` : ""}`);
          } else if (a.type === "script" && a.name) {
            lines.push(`${parent}${a.name} (${a.className ?? "Script"})`);
          }
        }
      }
      const seen = new Set<string>();
      const out: string[] = [];
      for (const l of lines) {
        if (seen.has(l)) continue;
        seen.add(l);
        out.push(l);
        if (out.length >= 140) break;
      }
      return out.join("\n");
    };

    try {
      const { generateTextWithToolFallback } = await import("./ai-retry.server");
      const allTools = buildBloxSmithTools({ userId, projectId }) as Record<string, any>;
      // Whitelist a small tool subset to keep tool-definition tokens low.
      // MCP tools are NOT included — they bloat the request and aren't needed
      // for an initial whole-game build.
      const TOOL_WHITELIST = [
        "roblox_toolbox_asset_plan",
        "roblox_asset_search",
        "roblox_asset_info",
      ];
      const slimTools: Record<string, any> = {};
      for (const k of TOOL_WHITELIST) if (allTools[k]) slimTools[k] = allTools[k];

      // Vetted code exemplars for the systems this game needs, so each phase
      // adapts proven server-authoritative patterns instead of reinventing them.
      const { buildPatternLibraryBlock } = await import("./build-patterns");
      const apPatternBlock = buildPatternLibraryBlock(description, { max: 6 });

      // A full game does NOT fit in one model response — 6 phases of complete
      // Luau blow past the output-token cap, so the later phases (UI, world)
      // get starved or truncated and the game ships thin. Build in TWO focused
      // passes instead: the backbone (structure + shared modules + server
      // systems) first, then the frontend + world (client controllers + UI +
      // map) seeded with a manifest of everything the backbone created. Each
      // pass gets the FULL output budget, so each phase is actually complete.
      // Two passes stay within the same wall-time the single-call-with-tools-
      // fallback path already used.
      const segOutputTokens = profile.maxOutputTokens;

      const runSegment = (
        label: string,
        phaseFocus: string,
        manifest: string,
        useTools: boolean,
      ) => {
        const manifestBlock = manifest
          ? `\n\nALREADY BUILT (earlier phases — reference these EXACT paths; require/fire/parent into them, do NOT recreate them):\n${manifest}\n`
          : "";
        const patternsBlock = apPatternBlock ? `\n\n${apPatternBlock}` : "";
        return generateTextWithToolFallback(
          generateText,
          {
            model,
            system: AUTOPILOT_SYSTEM,
            prompt: `${liveBlock}\n\n${projectBlockAP}${manifestBlock}${patternsBlock}\n\nGAME DESCRIPTION:\n"""\n${description}\n"""\n\nBuild ON TOP of any existing files and the ALREADY BUILT list above. Emit ONLY these phases this pass: ${phaseFocus}. Return JSON {"summary","assumptions","phases":[...]} containing just those phases — every file body COMPLETE (no TODO, no "…", no truncation), every structural action included. ${manifest ? "Wire everything into the already-built structure (require those ModuleScripts, fire those RemoteEvents, parent into those folders)." : 'Include the default "everything" scope that belongs in these phases (spawn structure, leaderstats, DataStore persistence, economy, anti-exploit, admin stub).'} No markdown, no code fences — JSON only.`,
            maxOutputTokens: segOutputTokens,
            maxRetries: 0,
            timeout: { totalMs: 42_000, stepMs: 42_000, chunkMs: 12_000 },
            ...(useTools ? { tools: slimTools, stopWhen: stepCountIs(12) } : {}),
          },
          useTools ? `autopilot-${label}` : `autopilot-${label}-notools`,
        );
      };

      const runSegmentParsed = async (
        label: string,
        phaseFocus: string,
        manifest: string,
        expectedPhases: number[],
        preferTools: boolean,
      ): Promise<Segment | null> => {
        let rawText = "";
        try {
          ({ text: rawText } = await runSegment(label, phaseFocus, manifest, preferTools));
        } catch (e: any) {
          const m = String(e?.message ?? e);
          // Too big / rate-limited on the tools call → retry once with NO tools
          // (saves ~1-3k tokens of tool definitions).
          if (/too large|context|413|429|tokens per minute|rate limit/i.test(m)) {
            console.warn(`[autopilot:${label}] retrying without tools:`, m.slice(0, 200));
            ({ text: rawText } = await runSegment(label, phaseFocus, manifest, false));
          } else {
            throw e;
          }
        }
        let parsed = normalizeSegment(extractBuildJson(rawText) as Segment | null);
        if (hasExpectedPhases(parsed, expectedPhases)) return parsed;

        console.warn(
          `[autopilot:${label}] incomplete or malformed phase output; retrying once without tools.`,
        );
        ({ text: rawText } = await runSegment(label, phaseFocus, manifest, false));
        parsed = normalizeSegment(extractBuildJson(rawText) as Segment | null);
        return hasExpectedPhases(parsed, expectedPhases) ? parsed : null;
      };

      // Pass 1 — backbone. This is the hard part of the game and MUST succeed;
      // a failure here refunds the run (handled by the outer catch below).
      const backbone = await runSegmentParsed(
        "backbone",
        "Phase 1 — Structure, Phase 2 — Shared Modules, Phase 3 — Server Systems",
        "",
        [1, 2, 3],
        false,
      );
      if (!backbone || !Array.isArray(backbone.phases) || backbone.phases.length === 0) {
        throw new Error("AI did not return valid JSON.");
      }

      // Pass 2 — frontend + world. Best-effort: if it fails or truncates, the
      // backbone still ships and we note the unfinished pass in assumptions so
      // the user can finish it with a follow-up build / Autopilot run.
      let frontendPhases: Phase[] = [];
      let frontendSummary = "";
      let frontendAssumptions: string[] = [];
      try {
        const frontend = await runSegmentParsed(
          "frontend",
          "Phase 4 — Client Controllers, Phase 5 — UI, Phase 6 — World",
          buildManifest(backbone.phases),
          [4, 5, 6],
          true,
        );
        if (frontend && Array.isArray(frontend.phases)) {
          frontendPhases = frontend.phases;
          frontendSummary = frontend.summary ?? "";
          frontendAssumptions = frontend.assumptions ?? [];
        }
      } catch (e: any) {
        console.warn(
          "[autopilot:frontend] pass failed, shipping backbone only:",
          String(e?.message ?? e).slice(0, 200),
        );
      }

      plan = {
        summary:
          [backbone.summary, frontendSummary].filter(Boolean).join(" ") ||
          "Autopilot build queued.",
        assumptions: [
          ...(backbone.assumptions ?? []),
          ...frontendAssumptions,
          ...(frontendPhases.length === 0
            ? [
                "The UI/world pass didn't complete this run — the server backbone is in. Re-run Autopilot or send a build prompt to add the menus, HUD, and map.",
              ]
            : []),
        ],
        phases: [...backbone.phases, ...frontendPhases],
      };
      partialFrontend = frontendPhases.length === 0;
    } catch (err: any) {
      if (!isOwner)
        await supabase.rpc("refund_credits", { _amount: cost, _reason: "autopilot failed" });
      const msg = String(err?.message ?? err);
      if (msg.includes("429") || /rate limit|tokens per minute/i.test(msg))
        throw new Error("AI is rate-limited right now. Try again in ~30 seconds.");
      if (msg.includes("402")) throw new Error("AI credits exhausted.");
      if (/too large|context length/i.test(msg))
        throw new Error("Game description is too long — try a shorter version (under 2000 chars).");
      throw new Error("Autopilot failed: " + msg);
    }

    // Pre-push auto-repair + sync validation per phase. Repair FIRST so fixable
    // Luau and misplaced/missing instances get healed before the validator
    // drops them, then collect issues into a single report.
    const { validateGenerated, autoRepairResult } = await import("./sync-validation");
    const { data: existingForValidation } = await supabase
      .from("project_files")
      .select("path")
      .eq("project_id", projectId);
    const knownPaths: { path: string }[] = [...((existingForValidation ?? []) as any[])];
    const phaseValidations: any[] = [];
    let allErrors = 0;
    let allWarnings = 0;
    let allRepairs = 0;
    for (const phase of plan.phases) {
      const repair = autoRepairResult(phase.files as any, phase.actions as any, knownPaths);
      if (repair.repairs.length > 0) {
        console.log(
          `[autopilotBuild] phase "${phase.title}" auto-repair applied ${repair.repairs.length} fix(es):`,
          repair.repairs,
        );
        phase.files = repair.files as any;
        phase.actions = repair.actions as any;
        allRepairs += repair.repairs.length;
      }
      const v = validateGenerated(phase.files as any, phase.actions as any, knownPaths);
      phase.files = v.files as any;
      phase.actions = v.actions as any;
      for (const f of v.files) knownPaths.push({ path: f.path });
      phaseValidations.push({
        title: phase.title,
        summary: v.summary,
        errors: v.errors,
        warnings: v.warnings,
        repairs: repair.repairs,
      });
      allErrors += v.errors.length;
      allWarnings += v.warnings.length;
    }

    const emptyCriticalPhase = plan.phases.find((phase) => {
      const number = phaseNumber(phase.title);
      return (
        number !== null && number <= 3 && phase.files.length === 0 && phase.actions.length === 0
      );
    });
    if (emptyCriticalPhase) {
      if (!isOwner) {
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "autopilot critical phase blocked by validation",
        });
      }
      throw new Error(
        `${emptyCriticalPhase.title} was fully blocked by the Studio safety check. The run was stopped and credits were refunded instead of queueing a broken game.`,
      );
    }
    const emptyFrontendPhase = plan.phases.find((phase) => {
      const number = phaseNumber(phase.title);
      return (
        number !== null && number >= 4 && phase.files.length === 0 && phase.actions.length === 0
      );
    });
    if (emptyFrontendPhase) {
      partialFrontend = true;
      plan.assumptions.push(
        `${emptyFrontendPhase.title} was fully blocked by the Studio safety check. The valid backbone and remaining phases were kept, and a partial refund was issued.`,
      );
    }

    // Build one deterministic, de-duplicated queue in strict phase order.
    // File-backed scripts win over duplicate script actions emitted by the
    // model, which prevents the plugin from creating the same script twice.
    let totalFiles = 0;
    let totalActions = 0;
    const rowsToInsert: any[] = [];
    const autopilotRunId = crypto.randomUUID();
    const runStartedAt = Date.now();
    const finalFilesByPath = new Map<string, GenFile>();
    const fileScriptKeys = new Set<string>();

    for (const phase of plan.phases) {
      for (const file of phase.files) {
        finalFilesByPath.set(file.path, file);
        const name = file.path.split("/").pop() ?? file.path;
        fileScriptKeys.add(`${file.service_location}/${name}`.toLowerCase());
      }
    }
    totalFiles = finalFilesByPath.size;

    const seenActions = new Set<string>();
    const queueAction = (action: GenAction, phaseTitle: string) => {
      const payload = {
        ...action,
        _phase: phaseTitle,
        _autopilotRunId: autopilotRunId,
        _sequence: rowsToInsert.length,
      };
      const exactKey = JSON.stringify(payload, (key, value) =>
        key === "_phase" ||
        key === "_autopilotRunId" ||
        key === "_sequence" ||
        key === "generation_id"
          ? undefined
          : value,
      );
      if (seenActions.has(exactKey)) return;
      seenActions.add(exactKey);
      rowsToInsert.push({
        project_id: projectId,
        user_id: userId,
        action_type: action.type,
        payload,
        status: "pending",
        // The plugin orders by created_at. Give every action a unique timestamp
        // so ordering remains deterministic across chunked inserts.
        created_at: new Date(runStartedAt + rowsToInsert.length).toISOString(),
      });
    };

    for (let pi = 0; pi < plan.phases.length; pi++) {
      const phase = plan.phases[pi];
      // Structural actions go first within a phase, then action-only scripts,
      // then the canonical scripts derived from project_files.
      const structuralActions: GenAction[] = [];
      const scriptActions: GenAction[] = [];
      for (const a of phase.actions) {
        if (a && typeof a === "object" && typeof a.type === "string") {
          if (a.type === "script") {
            const scriptKey =
              `${String(a.parent ?? "").replace(/\./g, "/")}/${String(a.name ?? "")}`.toLowerCase();
            if (!fileScriptKeys.has(scriptKey)) scriptActions.push(a);
          } else {
            structuralActions.push(a);
          }
        }
      }
      for (const action of structuralActions) queueAction(action, phase.title);
      for (const action of scriptActions) queueAction(action, phase.title);
      for (const f of phase.files) {
        const name = f.path.split("/").pop() ?? f.path;
        // Only queue the final version when two phases touch the same file.
        if (finalFilesByPath.get(f.path) === f) {
          queueAction(
            {
              type: "script",
              parent: f.service_location,
              name,
              className: f.file_type,
              source: f.content,
            },
            phase.title,
          );
        }
      }
    }
    if (!rowsToInsert.some((row) => row.action_type === "playtest_ready")) {
      queueAction(
        {
          type: "playtest_ready",
          focus: "Workspace",
          note: "Autopilot finished queueing this game. Press Play to verify the full loop.",
          checklist: [
            "Spawn and complete the first gameplay objective",
            "Confirm HUD, menus, settings, and mobile controls respond",
            "Earn, spend, save, and reload the main currency",
            "Check server output for missing remotes, assets, or DataStore errors",
          ],
        },
        plan.phases.at(-1)?.title ?? "Final QA",
      );
    }
    totalActions = rowsToInsert.length;

    if (totalActions === 0) {
      if (!isOwner) {
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "autopilot produced no valid Studio actions",
        });
      }
      throw new Error(
        "Autopilot could not produce any valid Studio actions. Your credits were refunded.",
      );
    }

    const finalFiles = Array.from(finalFilesByPath.values());
    const finalPaths = finalFiles.map((file) => file.path);
    const { data: previousFileRows, error: previousFilesError } =
      finalPaths.length > 0
        ? await supabase
            .from("project_files")
            .select("id,path,file_type,service_location,content,created_at,updated_at")
            .eq("project_id", projectId)
            .in("path", finalPaths)
        : { data: [], error: null };
    if (previousFilesError) {
      if (!isOwner) {
        await supabase.rpc("refund_credits", {
          _amount: cost,
          _reason: "autopilot could not snapshot project files",
        });
      }
      throw new Error("Could not prepare the project for Autopilot. Your credits were refunded.");
    }

    const previousFiles = previousFileRows ?? [];
    const previousPathSet = new Set(previousFiles.map((file) => file.path));
    const newPaths = finalPaths.filter((path) => !previousPathSet.has(path));
    const insertedActionIds: string[] = [];
    let generationId: string | null = null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      if (finalFiles.length > 0) {
        const { error: filesError } = await supabase.from("project_files").upsert(
          finalFiles.map((file) => ({
            project_id: projectId,
            path: file.path,
            file_type: file.file_type,
            service_location: file.service_location,
            content: file.content,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "project_id,path" },
        );
        if (filesError) throw new Error(`Could not persist Autopilot files: ${filesError.message}`);
      }

      // Insert in chunks while recording every inserted id. If a later chunk
      // fails, the catch below removes the earlier chunks and restores files.
      const CHUNK = 50;
      for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
        const stagingRows = rowsToInsert.slice(i, i + CHUNK).map((row) => ({
          ...row,
          status: "staging",
        }));
        const { data: insertedRows, error: queueErr } = await supabaseAdmin
          .from("plugin_actions")
          .insert(stagingRows)
          .select("id");
        if (queueErr) {
          throw new Error("Could not queue the autopilot actions for Studio.");
        }
        insertedActionIds.push(...(insertedRows ?? []).map((row) => row.id));
      }

      if (partialFrontend && !isOwner) {
        partialRefund = Math.max(1, Math.ceil(cost / 2));
        const { error: refundError } = await supabase.rpc("refund_credits", {
          _amount: partialRefund,
          _reason: "autopilot frontend pass incomplete",
        });
        if (refundError) {
          console.warn("[autopilotBuild] partial frontend refund failed:", refundError.message);
          partialRefund = 0;
        }
      }

      const { data: generationRow, error: generationError } = await supabase
        .from("generations")
        .insert({
          user_id: userId,
          project_id: projectId,
          prompt: `[autopilot] ${description.slice(0, 500)}`,
          status: "success",
          credits_used: isOwner ? 0 : Math.max(0, cost - partialRefund),
          result: {
            ...plan,
            autopilotRunId,
            partial: partialFrontend,
            creditsRefunded: partialRefund,
            queuedActions: totalActions,
          } as any,
        })
        .select("id")
        .single();
      if (generationError) {
        throw new Error(`Could not record the Autopilot run: ${generationError.message}`);
      }
      generationId = generationRow.id;

      // Staged rows are invisible to plugin polling. Publish the complete run
      // only after every file, queue chunk, and generation record succeeded.
      const { data: publishedRows, error: publishError } = await supabaseAdmin
        .from("plugin_actions")
        .update({ status: "pending" })
        .in("id", insertedActionIds)
        .eq("status", "staging")
        .select("id");
      if (publishError) {
        throw new Error(`Could not publish the Autopilot queue: ${publishError.message}`);
      }
      if ((publishedRows ?? []).length !== insertedActionIds.length) {
        throw new Error("Could not publish the complete Autopilot queue.");
      }
    } catch (writeError) {
      if (insertedActionIds.length > 0) {
        await supabaseAdmin.from("plugin_actions").delete().in("id", insertedActionIds);
      }
      if (generationId) {
        await supabaseAdmin.from("generations").delete().eq("id", generationId);
      }
      if (newPaths.length > 0) {
        await supabase
          .from("project_files")
          .delete()
          .eq("project_id", projectId)
          .in("path", newPaths);
      }
      if (previousFiles.length > 0) {
        await supabase.from("project_files").upsert(
          previousFiles.map((file) => ({
            id: file.id,
            project_id: projectId,
            path: file.path,
            file_type: file.file_type,
            service_location: file.service_location,
            content: file.content,
            created_at: file.created_at,
            updated_at: file.updated_at,
          })),
          { onConflict: "project_id,path" },
        );
      }
      if (!isOwner) {
        const refundAmount = Math.max(0, cost - partialRefund);
        if (refundAmount > 0) {
          await supabase.rpc("refund_credits", {
            _amount: refundAmount,
            _reason: "autopilot delivery failed and was rolled back",
          });
        }
      }
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      throw new Error(`Autopilot delivery failed and was rolled back: ${message}`);
    }

    return {
      summary: plan.summary,
      assumptions: plan.assumptions ?? [],
      phases: plan.phases.map((p) => ({
        title: p.title,
        goal: p.goal,
        fileCount: p.files.length,
        actionCount: rowsToInsert.filter((row) => row.payload?._phase === p.title).length,
      })),
      totalFiles,
      totalActions,
      autopilotRunId,
      partial: partialFrontend,
      creditsRefunded: partialRefund,
      validation: {
        errors: allErrors,
        warnings: allWarnings,
        repairs: allRepairs,
        phases: phaseValidations,
      },
    };
  });

const QueueActionInputSchema = z.object({
  projectId: z.string().uuid(),
  actionType: z.string(),
  payload: z.any(),
});

export const queuePluginAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QueueActionInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: userSupabase, userId } = context;
    const { projectId, actionType, payload } = data;
    await assertProjectOwner(userSupabase, projectId, userId);

    const { data: inserted, error } = await userSupabase
      .from("plugin_actions")
      .insert({
        project_id: projectId,
        user_id: userId,
        action_type: actionType,
        payload: payload,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to queue action:", error);
      throw new Error(error.message);
    }

    return inserted;
  });
