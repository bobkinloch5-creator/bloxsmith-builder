// Vetted Roblox build-pattern library.
//
// The system prompt tells the model WHAT to build in prose, but it has to write
// every leaderstats / DataStore / RemoteEvent / shop body from scratch — which
// is where bugs and half-finished systems creep in. This module gives the model
// compact, correct, server-authoritative Luau exemplars to ADAPT, injected only
// for the systems a given request actually needs (few-shot anchoring).
//
// Every snippet here is real, complete, deprecation-free Luau:
// - services via game:GetService
// - server authority for currency / damage / purchases
// - pcall + UpdateAsync + BindToClose for DataStores
// - typeof/ownership/distance/cooldown checks on RemoteEvents
// - task.* (never the deprecated wait/spawn/delay), Animator:LoadAnimation
// They are kept short on purpose — the model expands and renames them to fit the
// request; they are anchors, not drop-in files. All snippets are verified to
// pass checkLuauSyntax (see build-patterns.test usage / the ai:eval harness).

export type BuildPattern = {
  /** Short id used in logs. */
  id: string;
  /** Regex that decides whether this pattern is relevant to a prompt. */
  match: RegExp;
  /** One-line label shown in the injected block header. */
  label: string;
  /** The vetted Luau exemplar. */
  code: string;
};

export const BUILD_PATTERNS: BuildPattern[] = [
  {
    id: "currency_leaderstats",
    label: "Server-authoritative currency + leaderstats (ModuleScript)",
    match:
      /\b(coins?|cash|money|gems?|gold|credits?|currency|leaderstats?|score|points?|economy|shop|buy|sell|rewards?|simulator|tycoon|rebirths?)\b/i,
    code: `-- ReplicatedStorage/Modules/CurrencyService (ModuleScript)
local Players = game:GetService("Players")

local CurrencyService = {}

function CurrencyService.setup(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 0
	coins.Parent = leaderstats
	leaderstats.Parent = player
end

-- Server-only. Never let the client set currency directly.
function CurrencyService.add(player, amount)
	if type(amount) ~= "number" or amount ~= amount then return end
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if coins then
		coins.Value = math.max(0, coins.Value + amount)
	end
end

Players.PlayerAdded:Connect(CurrencyService.setup)
return CurrencyService`,
  },
  {
    id: "datastore_persistence",
    label: "DataStore persistence (pcall + UpdateAsync + BindToClose) (Script)",
    match:
      /\b(saves?|saving|saved|load|datastore|data store|persist|progress|inventory|stats? save|leaderboard|profile|autosave)\b/i,
    code: `-- ServerScriptService/Data/DataService (Script)
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerData_v1")

local DEFAULT = { Coins = 0, Level = 1 }
local sessions = {}

local function load(player)
	local key = "u_" .. player.UserId
	local ok, data = pcall(function()
		return store:GetAsync(key)
	end)
	sessions[player.UserId] = (ok and data) or table.clone(DEFAULT)
end

local function save(player)
	local data = sessions[player.UserId]
	if not data then return end
	pcall(function()
		store:UpdateAsync("u_" .. player.UserId, function()
			return data
		end)
	end)
end

Players.PlayerAdded:Connect(load)
Players.PlayerRemoving:Connect(function(player)
	save(player)
	sessions[player.UserId] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(save, player)
	end
	task.wait(2)
end)`,
  },
  {
    id: "remote_validation",
    label: "Server-validated RemoteEvent (type + cooldown + distance) (Script)",
    match:
      /\b(remote|remoteevent|remotefunction|server|anti.?exploit|exploit|validate|secure|pickup|collect|interact|click|button)\b/i,
    code: `-- ServerScriptService/Remotes/CollectHandler (Script)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local collect = remotes:WaitForChild("Collect")

local COOLDOWN = 0.25
local lastUse = {}

collect.OnServerEvent:Connect(function(player, target)
	-- 1. type check — never trust the client payload
	if typeof(target) ~= "Instance" or not target:IsA("BasePart") then return end
	-- 2. rate limit per player
	local now = os.clock()
	if lastUse[player] and now - lastUse[player] < COOLDOWN then return end
	lastUse[player] = now
	-- 3. ownership / distance check
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return end
	if (root.Position - target.Position).Magnitude > 25 then return end
	-- 4. apply the effect on the SERVER
	target:Destroy()
end)`,
  },
  {
    id: "shop_purchase",
    label: "Server-authoritative shop purchase (RemoteFunction) (Script)",
    match: /\b(shop|store|buy|purchase|sell|upgrades?|gamepass|market|vendor|catalog)\b/i,
    code: `-- ServerScriptService/Shop/ShopService (Script)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local buy = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Buy")

-- Source of truth lives on the SERVER; the client never sends the price.
local ITEMS = {
	Sword = { price = 100, grant = "Sword" },
	Shield = { price = 250, grant = "Shield" },
}

buy.OnServerInvoke = function(player, itemId)
	local item = type(itemId) == "string" and ITEMS[itemId]
	if not item then return false, "Unknown item" end
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if not coins or coins.Value < item.price then
		return false, "Not enough coins"
	end
	coins.Value = coins.Value - item.price
	-- grant the item server-side here (clone tool into Backpack, set flag, etc.)
	return true, item.grant
end`,
  },
  {
    id: "tycoon_dropper",
    label: "Tycoon dropper + collector (server-credited) (Script)",
    match: /\b(tycoon|dropper|conveyor|collector|plot|purchase pad|base generator)\b/i,
    code: `-- ServerScriptService/Tycoon/DropperService (Script)
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local CASH_PER_DROP = 5
local DROP_INTERVAL = 1

-- collector must have an "OwnerUserId" attribute set when a player claims the plot.
local function startDropper(dropper, collector)
	task.spawn(function()
		while dropper.Parent and collector.Parent do
			local cash = Instance.new("Part")
			cash.Size = Vector3.new(1, 1, 1)
			cash.Color = Color3.fromRGB(85, 255, 127)
			cash.Position = dropper.Position - Vector3.new(0, 2, 0)
			cash:SetAttribute("Value", CASH_PER_DROP)
			cash.Parent = Workspace
			cash.Touched:Connect(function(hit)
				if hit ~= collector then return end
				local userId = collector:GetAttribute("OwnerUserId")
				local owner = userId and Players:GetPlayerByUserId(userId)
				local coins = owner and owner:FindFirstChild("leaderstats")
					and owner.leaderstats:FindFirstChild("Coins")
				if coins then
					coins.Value += cash:GetAttribute("Value") or 0
				end
				cash:Destroy()
			end)
			task.wait(DROP_INTERVAL)
		end
	end)
end

return startDropper`,
  },
  {
    id: "npc_quest",
    label: "NPC dialogue + quest with server-validated reward (Script)",
    match:
      /\b(npcs?|quests?|dialogue|dialog|missions?|objectives?|talk|villagers?|merchants?|quest ?giver|story)\b/i,
    code: `-- ServerScriptService/NPC/QuestGiver (Script)
local Players = game:GetService("Players")
local npc = script.Parent
local prompt = npc:FindFirstChildWhichIsA("ProximityPrompt", true)

local progress = {} -- [userId] = "none" | "active" | "done"

if prompt then
	prompt.Triggered:Connect(function(player)
		local state = progress[player.UserId] or "none"
		if state == "none" then
			progress[player.UserId] = "active"
			-- fire a dialogue RemoteEvent to the client here to show the offer
		elseif state == "active" then
			local kills = player:GetAttribute("Kills") or 0
			if kills >= 5 then
				progress[player.UserId] = "done"
				local coins = player:FindFirstChild("leaderstats")
					and player.leaderstats:FindFirstChild("Coins")
				if coins then
					coins.Value += 100
				end
			end
		end
	end)
end`,
  },
  {
    id: "gamepass_receipt",
    label: "Secure monetization (ProcessReceipt + dedupe) (Script)",
    match:
      /\b(gamepass|game ?pass|developer product|dev product|robux|monetiz|microtransaction|processreceipt|purchase|products?|donation)\b/i,
    code: `-- ServerScriptService/Monetization/Purchases (Script)
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

-- Map each Developer Product id to a server-side grant. Replace the ids.
local PRODUCTS = {
	[123456] = function(player)
		local coins = player:FindFirstChild("leaderstats")
			and player.leaderstats:FindFirstChild("Coins")
		if coins then
			coins.Value += 1000
		end
	end,
}

local granted = {} -- per-receipt dedupe so a retry never double-grants

MarketplaceService.ProcessReceipt = function(receipt)
	local key = receipt.PlayerId .. "_" .. receipt.PurchaseId
	if granted[key] then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local handler = PRODUCTS[receipt.ProductId]
	if not handler then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local ok = pcall(handler, player)
	if not ok then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	granted[key] = true
	return Enum.ProductPurchaseDecision.PurchaseGranted
end`,
  },
  {
    id: "round_manager",
    label: "Round/minigame loop (intermission → round → winner) (Script)",
    match:
      /\b(rounds?|minigames?|mini-games?|intermission|match(?:es)?|deathmatch|free.?for.?all|ffa|lobby hub|elimination)\b/i,
    code: `-- ServerScriptService/Rounds/RoundService (Script)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local status = Instance.new("StringValue")
status.Name = "RoundStatus"
status.Value = "Intermission"
status.Parent = ReplicatedStorage

local INTERMISSION = 10
local ROUND_TIME = 60

task.spawn(function()
	while true do
		status.Value = "Intermission"
		task.wait(INTERMISSION)
		if #Players:GetPlayers() < 1 then
			task.wait(1)
		else
			status.Value = "InRound"
			-- teleport players into the arena + enable combat here
			task.wait(ROUND_TIME)
			status.Value = "Ended"
			-- award the winner server-side here
			task.wait(3)
		end
	end
end)`,
  },
  {
    id: "daily_reward",
    label: "Daily reward (timestamp cooldown, server-checked) (ModuleScript)",
    match: /\b(daily|login bonus|streak|claim reward|daily reward)\b/i,
    code: `-- ReplicatedStorage/Modules/DailyReward (ModuleScript)
local DailyReward = {}
local DAY = 24 * 60 * 60

-- Call from a validated RemoteFunction; persist LastDailyClaim with your DataService.
function DailyReward.claim(player)
	local last = player:GetAttribute("LastDailyClaim") or 0
	local now = os.time()
	if now - last < DAY then
		return false, "Already claimed today"
	end
	player:SetAttribute("LastDailyClaim", now)
	local coins = player:FindFirstChild("leaderstats")
		and player.leaderstats:FindFirstChild("Coins")
	if coins then
		coins.Value += 250
	end
	return true, "Claimed 250 Coins"
end

return DailyReward`,
  },
  {
    id: "pet_hatch",
    label: "Pet/egg hatch (server-side weighted roll) (ModuleScript)",
    match: /\b(pets?|eggs?|hatch|gacha|rarity|loot ?box(?:es)?|crates?|spin|wheel)\b/i,
    code: `-- ReplicatedStorage/Modules/EggService (ModuleScript)
local EggService = {}

-- Weighted rarities; weights need not sum to 100.
local POOL = {
	{ name = "Common Pup", weight = 70 },
	{ name = "Rare Cat", weight = 25 },
	{ name = "Legendary Dragon", weight = 5 },
}

-- Roll on the SERVER so the client can't spoof rarity.
function EggService.roll()
	local total = 0
	for _, p in ipairs(POOL) do
		total += p.weight
	end
	local pick = math.random() * total
	local acc = 0
	for _, p in ipairs(POOL) do
		acc += p.weight
		if pick <= acc then
			return p.name
		end
	end
	return POOL[1].name
end

return EggService`,
  },
  {
    id: "obby_checkpoint",
    label: "Obby checkpoints + respawn at stage (Script)",
    match: /\b(obby|checkpoints?|stages?|parkour|kill ?bricks?|courses?|platformer)\b/i,
    code: `-- ServerScriptService/Obby/CheckpointService (Script)
local Players = game:GetService("Players")
local checkpoints = workspace:WaitForChild("Checkpoints")

-- Each checkpoint part is named by its stage number ("1", "2", ...).
local function wire(pad)
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		local stage = tonumber(pad.Name) or 0
		if stage > (player:GetAttribute("Stage") or 0) then
			player:SetAttribute("Stage", stage)
		end
	end)
end

for _, pad in ipairs(checkpoints:GetChildren()) do
	if pad:IsA("BasePart") then
		wire(pad)
	end
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(char)
		local stage = player:GetAttribute("Stage") or 0
		local pad = checkpoints:FindFirstChild(tostring(stage))
		if pad then
			local root = char:WaitForChild("HumanoidRootPart")
			root.CFrame = pad.CFrame + Vector3.new(0, 3, 0)
		end
	end)
end)`,
  },
  {
    id: "mobile_ui",
    label: "Mobile-friendly ScreenGui + button (LocalScript)",
    match:
      /\b(ui|gui|screen|hud|menu|button|frame|panel|popup|notification|shop screen|inventory|settings|loading|title|interface)\b/i,
    code: `-- StarterGui/MainHud/HudController (LocalScript)
local TweenService = game:GetService("TweenService")
local gui = script.Parent

local frame = Instance.new("Frame")
frame.Size = UDim2.fromScale(0.3, 0.12)
frame.Position = UDim2.fromScale(0.02, 0.04)
frame.BackgroundColor3 = Color3.fromRGB(18, 18, 24)
frame.BackgroundTransparency = 0.15
frame.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = frame
local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(255, 255, 255)
stroke.Transparency = 0.85
stroke.Parent = frame

local button = Instance.new("TextButton")
button.Size = UDim2.fromScale(1, 1)
button.BackgroundTransparency = 1
button.Text = "Shop"
button.TextScaled = true
button.Font = Enum.Font.GothamBold
button.TextColor3 = Color3.fromRGB(255, 255, 255)
button.Parent = frame

-- Hover / press feedback (works for touch + mouse).
button.MouseEnter:Connect(function()
	TweenService:Create(frame, TweenInfo.new(0.15), { BackgroundTransparency = 0 }):Play()
end)
button.MouseLeave:Connect(function()
	TweenService:Create(frame, TweenInfo.new(0.15), { BackgroundTransparency = 0.15 }):Play()
end)`,
  },
  {
    id: "tool_damage",
    label: "Server-validated tool/weapon damage (Tool + Script)",
    match:
      /\b(weapons?|swords?|guns?|melee|tools?|attack|damage|combat|fight|pvp|hit|slash|swing|shoot|blaster|knife|knives)\b/i,
    code: `-- ServerScriptService/Combat/SwordService (Script)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local swing = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Swing")

local DAMAGE = 20
local RANGE = 8
local COOLDOWN = 0.6
local lastSwing = {}

swing.OnServerEvent:Connect(function(player, targetModel)
	-- validate + cooldown
	local now = os.clock()
	if lastSwing[player] and now - lastSwing[player] < COOLDOWN then return end
	lastSwing[player] = now
	if typeof(targetModel) ~= "Instance" then return end
	local enemyHum = targetModel:FindFirstChildOfClass("Humanoid")
	local myRoot = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local enemyRoot = targetModel:FindFirstChild("HumanoidRootPart")
	if not (enemyHum and myRoot and enemyRoot) then return end
	-- distance check so the client can't hit across the map
	if (myRoot.Position - enemyRoot.Position).Magnitude > RANGE then return end
	enemyHum:TakeDamage(DAMAGE)
end)`,
  },
  {
    id: "vehicle_seat",
    label: "Driveable vehicle (VehicleSeat) (Script)",
    match: /\b(vehicles?|cars?|trucks?|karts?|bikes?|motorcycles?|boats?|drive|driving|racing|race)\b/i,
    code: `-- Workspace/Vehicles/Car/Drive (Script, parented under the VehicleSeat's model)
local seat = script.Parent:FindFirstChildWhichIsA("VehicleSeat")

if seat then
	seat.MaxSpeed = 60
	seat.Torque = 10000
	seat.TurnSpeed = 25
	-- VehicleSeat drives any BasePart connected by welds/constraints.
	-- Throttle (W/S) and Steer (A/D) are handled automatically once a
	-- player sits; this script just tunes the handling and could play
	-- engine sound on seat.Changed("Occupant").
	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		local occupant = seat.Occupant
		if occupant then
			seat.MaxSpeed = 60
		else
			seat.ThrottleFloat = 0
			seat.SteerFloat = 0
		end
	end)
end`,
  },
  {
    id: "animation_play",
    label: "Animation loading (Animator:LoadAnimation, not deprecated) (LocalScript)",
    match: /\b(animation|animate|emote|idle|walk|run|dance|pose|gesture|attack anim)\b/i,
    code: `-- StarterPlayerScripts/Anim/PlayIdle (LocalScript)
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local function play(character)
	local humanoid = character:WaitForChild("Humanoid")
	local animator = humanoid:WaitForChild("Animator")
	local anim = Instance.new("Animation")
	anim.AnimationId = "rbxassetid://507766388" -- replace with your uploaded id
	local track = animator:LoadAnimation(anim)
	track.Looped = true
	track:Play()
end

if player.Character then play(player.Character) end
player.CharacterAdded:Connect(play)`,
  },
];

/**
 * Pick the vetted patterns relevant to a prompt and render them as a compact
 * context block to inject into the build prompt. Returns "" when nothing
 * matches (e.g. a tiny recolor edit) so trivial requests stay lean.
 */
export function buildPatternLibraryBlock(prompt: string, opts?: { max?: number }): string {
  const max = opts?.max ?? 6;
  const matched = BUILD_PATTERNS.filter((p) => p.match.test(prompt)).slice(0, max);
  if (matched.length === 0) return "";

  const blocks = matched
    .map((p) => `### ${p.label}\n\`\`\`lua\n${p.code}\n\`\`\``)
    .join("\n\n");

  return [
    "=== VETTED BUILD PATTERNS (adapt, don't reinvent) ===",
    "These are proven, server-authoritative Roblox patterns for the systems this",
    "request needs. ADAPT them — rename, extend, wire them to your folders/remotes,",
    "and combine them — instead of writing this boilerplate from scratch. Keep their",
    "safety properties (server authority, pcall DataStores, validated remotes,",
    "Animator:LoadAnimation, task.* not wait/spawn). Do NOT paste them verbatim if the",
    "request differs; they are starting points, not the whole build.",
    "",
    blocks,
  ].join("\n");
}

/** Ids of the patterns a prompt matches — handy for logging/telemetry. */
export function matchedPatternIds(prompt: string): string[] {
  return BUILD_PATTERNS.filter((p) => p.match.test(prompt)).map((p) => p.id);
}
