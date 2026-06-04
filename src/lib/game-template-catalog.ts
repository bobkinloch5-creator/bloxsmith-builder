export type GameTemplateCatalogItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url: string;
  credits_cost: number;
  difficulty: "easy" | "intermediate" | "advanced";
  features: string[];
  build_spec: { prompt: string };
  install_count: number;
  active: boolean;
};

export const GAME_TEMPLATE_CATALOG: GameTemplateCatalogItem[] = [
  {
    id: "catalog-simulator",
    slug: "coin-clicker-simulator-pro",
    name: "Coin Clicker Simulator Pro",
    category: "Simulator",
    description:
      "A polished simulator starter with leaderstats, coin zones, upgrades, rebirths, pets, boosts, and a clean HUD.",
    thumbnail_url: "/template-previews/simulator-real.webp",
    credits_cost: 12,
    difficulty: "intermediate",
    features: ["Leaderstats and DataStore shell", "Coin zones and multipliers", "Upgrade shop", "Rebirth loop", "Boost UI"],
    build_spec: {
      prompt:
        "Build a Roblox coin clicker simulator with leaderstats, server-validated currency, coin zones, upgrades, rebirths, pets, boosts, and a polished simulator HUD.",
    },
    install_count: 184,
    active: true,
  },
  {
    id: "catalog-obby",
    slug: "lava-tower-obby-deluxe",
    name: "Lava Tower Obby Deluxe",
    category: "Obby",
    description:
      "A checkpoint obby kit with kill bricks, moving platforms, stage saves, victory rewards, skip-stage hooks, and timer UI.",
    thumbnail_url: "/template-previews/obby-real.webp",
    credits_cost: 10,
    difficulty: "easy",
    features: ["Checkpoint stages", "Kill brick system", "Moving platforms", "Stage save data", "Timer and win UI"],
    build_spec: {
      prompt:
        "Build a Roblox lava tower obby with checkpoints, kill bricks, moving platforms, stage save data, skip-stage product hooks, timer UI, and a victory reward screen.",
    },
    install_count: 211,
    active: true,
  },
  {
    id: "catalog-tycoon",
    slug: "factory-tycoon-starter",
    name: "Factory Tycoon Starter",
    category: "Tycoon",
    description:
      "A secure tycoon foundation with plot claiming, purchase pads, droppers, conveyors, collectors, rebirths, and owner-only controls.",
    thumbnail_url: "/template-previews/tycoon-real.webp",
    credits_cost: 16,
    difficulty: "advanced",
    features: ["Plot claiming", "Purchase pads", "Droppers and conveyors", "Collector validation", "Rebirth upgrades"],
    build_spec: {
      prompt:
        "Build a Roblox factory tycoon with plot claiming, purchase pads, droppers, conveyors, collectors, rebirth upgrades, save data, and server-side anti-exploit checks.",
    },
    install_count: 143,
    active: true,
  },
  {
    id: "catalog-pet",
    slug: "pet-hatchery-simulator",
    name: "Pet Hatchery Simulator",
    category: "Pet",
    description:
      "A pet game kit with eggs, rarity rolls, inventory, equip slots, coin boosts, notifications, and server-authenticated hatching.",
    thumbnail_url: "/template-previews/pet-real.webp",
    credits_cost: 18,
    difficulty: "advanced",
    features: ["Egg hatching", "Rarity tiers", "Pet inventory", "Equip slots", "Server hatch validation"],
    build_spec: {
      prompt:
        "Build a Roblox pet hatchery simulator with egg machines, weighted rarity rolls, pet inventory, equip slots, pet coin boosts, notifications, and server-authenticated hatching.",
    },
    install_count: 167,
    active: true,
  },
  {
    id: "catalog-mining",
    slug: "crystal-mining-simulator",
    name: "Crystal Mining Simulator",
    category: "Mining",
    description:
      "A mining loop with breakable ores, pickaxe upgrades, backpack capacity, sell zone, rebirth boosts, and cave progression.",
    thumbnail_url: "/template-previews/mining-real.webp",
    credits_cost: 14,
    difficulty: "intermediate",
    features: ["Breakable ores", "Tool upgrades", "Backpack capacity", "Sell zone", "Cave progression"],
    build_spec: {
      prompt:
        "Build a Roblox crystal mining simulator with breakable ores, pickaxe upgrades, backpack capacity, sell zone, rebirth boosts, cave progression, and save data.",
    },
    install_count: 132,
    active: true,
  },
  {
    id: "catalog-fighting",
    slug: "sword-arena-rounds",
    name: "Sword Arena Rounds",
    category: "Fighting",
    description:
      "A round-based sword fighting arena with lobby, maps, teams, safe weapon grants, scoreboard, rewards, and anti-spam checks.",
    thumbnail_url: "/template-previews/fighting-real.webp",
    credits_cost: 15,
    difficulty: "intermediate",
    features: ["Round manager", "Lobby and arena flow", "Sword tool grant", "Scoreboard", "Reward payout"],
    build_spec: {
      prompt:
        "Build a Roblox sword fighting round game with lobby, map voting, team assignment, safe sword grants, scoreboard, rewards, cooldowns, and server combat validation.",
    },
    install_count: 118,
    active: true,
  },
  {
    id: "catalog-racing",
    slug: "kart-racing-circuit",
    name: "Kart Racing Circuit",
    category: "Racing",
    description:
      "A racing template with spawn grid, laps, checkpoints, finish detection, placements, reward payout, and mobile-friendly race UI.",
    thumbnail_url: "/template-previews/racing-real.webp",
    credits_cost: 17,
    difficulty: "advanced",
    features: ["Spawn grid", "Lap checkpoints", "Finish placements", "Race countdown", "Reward payout"],
    build_spec: {
      prompt:
        "Build a Roblox kart racing circuit with spawn grid, lap checkpoints, finish detection, placements, countdown UI, reward payout, and mobile-friendly controls.",
    },
    install_count: 96,
    active: true,
  },
  {
    id: "catalog-roleplay",
    slug: "city-roleplay-map",
    name: "City Roleplay Map Kit",
    category: "Roleplay",
    description:
      "A city roleplay starter with job spawns, interactable doors, apartments, vehicles, role tags, and clean profile-style UI.",
    thumbnail_url: "/template-previews/roleplay-real.webp",
    credits_cost: 13,
    difficulty: "intermediate",
    features: ["City districts", "Job spawns", "Door interactions", "Vehicle pads", "Role tag UI"],
    build_spec: {
      prompt:
        "Build a Roblox city roleplay map kit with job spawns, interactable doors, apartments, vehicle pads, role tags, starter cash, and modern profile-style UI.",
    },
    install_count: 154,
    active: true,
  },
  {
    id: "catalog-horror",
    slug: "haunted-school-horror",
    name: "Haunted School Horror",
    category: "Horror",
    description:
      "A spooky story game starter with objectives, keys, doors, chase trigger, flashlight, jumpscare-safe effects, and chapter UI.",
    thumbnail_url: "/template-previews/horror-real.webp",
    credits_cost: 19,
    difficulty: "advanced",
    features: ["Objective tracker", "Keys and doors", "Chase trigger", "Flashlight tool", "Chapter UI"],
    build_spec: {
      prompt:
        "Build a Roblox haunted school horror game with objectives, keys, locked doors, chase trigger, flashlight tool, safe jumpscare effects, chapter UI, and progress saves.",
    },
    install_count: 101,
    active: true,
  },
  {
    id: "catalog-defense",
    slug: "tower-defense-lite",
    name: "Tower Defense Lite",
    category: "Tower Defense",
    description:
      "A compact tower defense framework with waves, enemy pathing, tower placement zones, upgrades, cash rewards, and health UI.",
    thumbnail_url: "/template-previews/tower-defense-real.webp",
    credits_cost: 20,
    difficulty: "advanced",
    features: ["Wave manager", "Enemy pathing", "Tower placement", "Upgrade flow", "Base health UI"],
    build_spec: {
      prompt:
        "Build a Roblox tower defense starter with wave manager, enemy pathing, tower placement zones, tower upgrades, cash rewards, base health UI, and server validation.",
    },
    install_count: 87,
    active: true,
  },
];

const dataService = `-- DataService.lua
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("BloxSmithTemplateData_v1")

local DataService = {}
local cache = {}

function DataService:Get(player)
  if cache[player.UserId] then return cache[player.UserId] end
  local ok, data = pcall(function()
    return store:GetAsync(tostring(player.UserId))
  end)
  cache[player.UserId] = (ok and data) or { Coins = 0, Gems = 0, Level = 1, Inventory = {}, Equipped = {} }
  return cache[player.UserId]
end

function DataService:AddCoins(player, amount)
  local data = self:Get(player)
  data.Coins += math.max(0, amount)
  if player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins") then
    player.leaderstats.Coins.Value = data.Coins
  end
  return data.Coins
end

function DataService:Save(player)
  local data = cache[player.UserId]
  if not data then return end
  pcall(function()
    store:SetAsync(tostring(player.UserId), data)
  end)
end

function DataService:Release(player)
  self:Save(player)
  cache[player.UserId] = nil
end

return DataService
`;

const remotes = `-- Remotes.server.lua
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local folder = ReplicatedStorage:FindFirstChild("BloxSmithRemotes") or Instance.new("Folder")
folder.Name = "BloxSmithRemotes"
folder.Parent = ReplicatedStorage

for _, name in ipairs({ "TemplateAction", "Notify", "OpenShop", "ClaimReward", "BuildRequest" }) do
  if not folder:FindFirstChild(name) then
    local remote = Instance.new("RemoteEvent")
    remote.Name = name
    remote.Parent = folder
  end
end
`;

const leaderstats = `-- Leaderstats.server.lua
local Players = game:GetService("Players")
local DataService = require(script.Parent.Services.DataService)

Players.PlayerAdded:Connect(function(player)
  local stats = Instance.new("Folder")
  stats.Name = "leaderstats"
  stats.Parent = player

  local coins = Instance.new("IntValue")
  coins.Name = "Coins"
  coins.Value = DataService:Get(player).Coins or 0
  coins.Parent = stats

  local level = Instance.new("IntValue")
  level.Name = "Level"
  level.Value = DataService:Get(player).Level or 1
  level.Parent = stats
end)

Players.PlayerRemoving:Connect(function(player)
  DataService:Release(player)
end)
`;

const clientHud = `-- TemplateHUD.client.lua
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("BloxSmithRemotes")

local gui = Instance.new("ScreenGui")
gui.Name = "BloxSmithTemplateHUD"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(290, 86)
frame.Position = UDim2.new(0, 18, 0, 18)
frame.BackgroundColor3 = Color3.fromRGB(12, 18, 28)
frame.BorderSizePixel = 0
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 14)
corner.Parent = frame

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.fromOffset(16, 10)
title.Size = UDim2.new(1, -32, 0, 26)
title.Font = Enum.Font.GothamBold
title.TextSize = 18
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "BloxSmith Template"
title.Parent = frame

local sub = Instance.new("TextLabel")
sub.BackgroundTransparency = 1
sub.Position = UDim2.fromOffset(16, 42)
sub.Size = UDim2.new(1, -32, 0, 28)
sub.Font = Enum.Font.Gotham
sub.TextSize = 13
sub.TextColor3 = Color3.fromRGB(170, 220, 255)
sub.TextXAlignment = Enum.TextXAlignment.Left
sub.Text = "Open Studio Explorer to customize the seeded systems."
sub.Parent = frame

remotes:WaitForChild("Notify").OnClientEvent:Connect(function(message)
  sub.Text = tostring(message)
end)
`;

function serviceForPath(path: string) {
  if (path.startsWith("ServerScriptService/")) return "ServerScriptService";
  if (path.startsWith("ReplicatedStorage/")) return "ReplicatedStorage";
  if (path.startsWith("StarterGui/")) return "StarterGui";
  if (path.startsWith("StarterPack/")) return "StarterPack";
  if (path.startsWith("StarterPlayer/")) return "StarterPlayer";
  if (path.startsWith("Workspace/")) return "Workspace";
  return "ReplicatedStorage";
}

export function catalogTemplateBySlug(slug: string) {
  return GAME_TEMPLATE_CATALOG.find((template) => template.slug === slug) ?? null;
}

export function templateProjectFiles(template: Pick<GameTemplateCatalogItem, "slug" | "name" | "category" | "features">) {
  const category = template.category.toLowerCase();
  const systemName = template.name.replace(/[^A-Za-z0-9]/g, "");
  const files = [
    { path: "ServerScriptService/Services/DataService", file_type: "ModuleScript", content: dataService },
    { path: "ServerScriptService/Remotes.server", file_type: "Script", content: remotes },
    { path: "ServerScriptService/Leaderstats.server", file_type: "Script", content: leaderstats },
    { path: "StarterPlayer/StarterPlayerScripts/TemplateHUD.client", file_type: "LocalScript", content: clientHud },
    {
      path: "ReplicatedStorage/Config/TemplateConfig",
      file_type: "ModuleScript",
      content: `-- TemplateConfig.lua
return {
  Name = ${JSON.stringify(template.name)},
  Category = ${JSON.stringify(template.category)},
  Features = ${JSON.stringify(template.features, null, 2)},
  CreditSafe = true,
  PluginRequired = true,
}
`,
    },
    {
      path: `ServerScriptService/Systems/${systemName}Service`,
      file_type: "ModuleScript",
      content: `-- ${systemName}Service.lua
local DataService = require(script.Parent.Parent.Services.DataService)

local Service = {}
Service.Name = ${JSON.stringify(template.name)}

function Service:Start()
  print("[BloxSmith] Started " .. Service.Name)
end

function Service:Reward(player, amount, reason)
  amount = math.clamp(tonumber(amount) or 0, 0, 100000)
  if amount <= 0 then return end
  DataService:AddCoins(player, amount)
  return true
end

return Service
`,
    },
  ];

  if (category.includes("obby")) {
    files.push({
      path: "Workspace/TemplateMap/ObbyStageBuilder.server",
      file_type: "Script",
      content: `-- Builds checkpoint folders, lava kill brick names, and stage metadata for the plugin to materialize.
return {
  StageCount = 25,
  Hazards = { "Lava", "Spinner", "FallingPlatform" },
  Rewards = { Coins = 250, Badge = "TowerComplete" },
}
`,
    });
  } else if (category.includes("tycoon")) {
    files.push({
      path: "ServerScriptService/Systems/TycoonPurchase.server",
      file_type: "Script",
      content: `-- Secure purchase pad starter. Client never decides price or ownership.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remotes = ReplicatedStorage:WaitForChild("BloxSmithRemotes")

remotes.TemplateAction.OnServerEvent:Connect(function(player, action, payload)
  if action ~= "BuyTycoonItem" then return end
  print("[BloxSmith] Validate tycoon purchase for", player.Name, payload and payload.ItemId)
end)
`,
    });
  } else if (category.includes("pet")) {
    files.push({
      path: "ReplicatedStorage/Config/PetEggs",
      file_type: "ModuleScript",
      content: `return {
  StarterEgg = {
    Cost = 250,
    Pets = {
      { Name = "Spark Pup", Rarity = "Common", Weight = 70, Multiplier = 1.1 },
      { Name = "Cyber Cat", Rarity = "Rare", Weight = 25, Multiplier = 1.6 },
      { Name = "King Dragon", Rarity = "Legendary", Weight = 5, Multiplier = 3.5 },
    },
  },
}
`,
    });
  } else if (category.includes("mining")) {
    files.push({
      path: "ReplicatedStorage/Config/OreConfig",
      file_type: "ModuleScript",
      content: `return {
  { Name = "Stone", Health = 5, Reward = 3 },
  { Name = "Crystal", Health = 25, Reward = 18 },
  { Name = "Mythic Core", Health = 120, Reward = 100 },
}
`,
    });
  } else if (category.includes("fighting")) {
    files.push({
      path: "StarterPack/BloxBlade",
      file_type: "Tool",
      content: "-- Tool placeholder. The Studio plugin creates the handle and combat scripts from this entry.",
    });
  } else if (category.includes("racing")) {
    files.push({
      path: "ServerScriptService/Systems/RaceManager.server",
      file_type: "Script",
      content: "-- RaceManager: spawn grid, checkpoint sequence, lap tracking, placements, and reward payout hooks.",
    });
  } else if (category.includes("roleplay")) {
    files.push({
      path: "ReplicatedStorage/Config/RoleplayJobs",
      file_type: "ModuleScript",
      content: `return {
  { Name = "Citizen", Pay = 5 },
  { Name = "Cafe Worker", Pay = 15 },
  { Name = "Mechanic", Pay = 20 },
  { Name = "Police", Pay = 25 },
}
`,
    });
  } else if (category.includes("horror")) {
    files.push({
      path: "StarterPack/Flashlight",
      file_type: "Tool",
      content: "-- Flashlight tool placeholder. Plugin should create light, handle, and local toggle script.",
    });
  } else if (category.includes("tower")) {
    files.push({
      path: "ReplicatedStorage/Config/WaveConfig",
      file_type: "ModuleScript",
      content: `return {
  { Wave = 1, Enemies = 8, Reward = 100 },
  { Wave = 2, Enemies = 14, Reward = 160 },
  { Wave = 3, Enemies = 1, Boss = true, Reward = 400 },
}
`,
    });
  }

  return files.map((file) => ({
    ...file,
    service_location: serviceForPath(file.path),
  }));
}
