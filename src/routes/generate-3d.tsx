import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Stage, Text, useGLTF } from "@react-three/drei";
import type { Group as ThreeGroup } from "three";
import { toast } from "sonner";
import {
  Accessibility,
  BadgeCheck,
  Bone,
  Box,
  Boxes,
  Brush,
  Building2,
  Car,
  Castle,
  ChevronsRight,
  Clock,
  Coins,
  Crown,
  Diamond,
  Download,
  Drama,
  Drumstick,
  Feather,
  Film,
  Flame,
  Footprints,
  Gamepad2,
  Gauge,
  Gem,
  Ghost,
  Hammer,
  Hand,
  Heart,
  ImagePlus,
  Info,
  LayoutGrid,
  Leaf,
  Loader2,
  Image as ImageIcon,
  Map,
  Mountain,
  Music,
  PaintBucket,
  Palette,
  PartyPopper,
  PawPrint,
  Rabbit,
  Rocket,
  Settings2,
  Shapes,
  ShieldCheck,
  ShipWheel,
  Shirt,
  Skull,
  Smile,
  Sparkles,
  Sparkle,
  Spline,
  Square,
  Stars,
  Sword,
  Swords,
  Trees,
  Triangle,
  Type,
  Upload,
  User,
  Users,
  WandSparkles,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { generate3DModelFn, get3DStatusFn, type Generate3DResult } from "@/lib/tripo.functions";

export const Route = createFileRoute("/generate-3d")({
  component: Generate3DPage,
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      {
        name: "description",
        content:
          "Generate Roblox-ready 3D models, 3D text, and custom animation blueprints with progress, ETA, previews, and Studio plugin support.",
      },
    ],
  }),
});

type Kind = "model" | "text" | "animation";
type Project = { id: string; name: string };

const modelTypes = [
  "pet",
  "character",
  "weapon",
  "prop",
  "building",
  "vehicle",
  "simulator item",
  "map piece",
  "accessory",
  "tool",
];
const styles = ["chunky", "low-poly", "cartoon", "anime", "simulator", "obby", "tycoon", "realistic-lite"];
const themes = ["neon", "fantasy", "sci-fi", "city", "horror", "cute", "medieval", "pirate", "space", "premium"];
const materials = ["plastic", "metal", "wood", "stone", "glass", "crystal", "fabric", "neon"];
const textureLooks = ["clean", "painted", "toy-like", "glossy", "matte", "pixel", "cel-shaded", "worn"];
const animationTypes = ["idle", "walk", "run", "attack", "emote", "dance", "pet", "npc", "tool", "jump"];
const animationStyles = ["snappy", "smooth", "cartoony", "heroic", "scary", "cute", "robotic", "floaty"];
const animationEasings = ["sine", "quad", "back", "elastic", "linear"];
const bodyFocuses = ["full body", "upper body", "arms", "legs", "head", "tool hand", "tail/pet"];
const animationPrompts = [
  "A confident sword slash with wind-up, fast swing, and recovery",
  "A cute pet idle with a bounce, head tilt, and tiny hop",
  "A spooky NPC walk with heavy shoulders and slow steps",
  "A victory dance with two arm pumps and a playful spin",
];
const animationQuickPresets = [
  {
    label: "Idle bounce",
    type: "idle",
    style: "smooth",
    focus: "full body",
    duration: 2,
    intensity: 35,
    looped: true,
    prompt: "A simple Roblox idle bounce with a small head tilt and relaxed arms",
    detail: "Best for NPCs, pets, lobby characters, and starter emotes.",
  },
  {
    label: "Walk cycle",
    type: "walk",
    style: "cartoony",
    focus: "legs",
    duration: 1.25,
    intensity: 45,
    looped: true,
    prompt: "A clean Roblox walk cycle with swinging arms and steady blocky steps",
    detail: "Use this as a readable base before making faster run or chase motions.",
  },
  {
    label: "Sword swing",
    type: "attack",
    style: "snappy",
    focus: "tool hand",
    duration: 0.9,
    intensity: 70,
    looped: false,
    prompt: "A simple sword swing with wind-up, one fast slash, and a reset pose",
    detail: "Good for tools, weapons, and combat tests without overbuilt keyframes.",
  },
  {
    label: "Victory emote",
    type: "dance",
    style: "cute",
    focus: "upper body",
    duration: 2,
    intensity: 55,
    looped: true,
    prompt: "A simple victory emote with two arm pumps and a happy bounce",
    detail: "Works well for rewards, wins, level ups, and social emotes.",
  },
  {
    label: "Pet hop",
    type: "pet",
    style: "floaty",
    focus: "tail/pet",
    duration: 1.6,
    intensity: 50,
    looped: true,
    prompt: "A cute pet hop with a tiny squash, bounce, and soft landing",
    detail: "Use for simulator pets, hover companions, eggs, and small mascots.",
  },
];

const previewSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const optionImages = (group: string, items: string[]) =>
  Object.fromEntries(items.map((item) => [item, `/generator-option-previews/${group}-${previewSlug(item)}.webp`]));

const modelTypeImages = optionImages("model", modelTypes);
const themeImages = optionImages("theme", themes);
const styleImages = optionImages("style", styles);
const materialImages = optionImages("material", materials);
const qualityImages = optionImages("quality", ["turbo", "standard", "detailed"]);
const formatImages = optionImages("format", ["GLB", "OBJ", "FBX"]);
const textureLookImages = optionImages("texture", textureLooks);
const textFontImages = optionImages("textFont", ["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"]);
const textEffectImages = optionImages("textEffect", ["neon", "outline", "gold", "ice", "shadow"]);
const textAnimationImages = optionImages("textAnimation", ["float", "pulse", "spin", "bounce", "none"]);
const animationTypeImages = optionImages("animation", animationTypes);
const animationStyleImages = optionImages("motion", animationStyles);
const animationEasingImages = optionImages("easing", animationEasings);
const bodyFocusImages = optionImages("body", bodyFocuses);

const copy = {
  model: {
    title: "3D Model",
    kicker: "Tripo 3D generation",
    prompt: "Describe your Roblox-ready model",
    placeholder: "A chunky neon hover pet with crystal ears, glowing eyes, and a toy-like silhouette",
    empty: "Generated models appear here with a live 3D preview.",
  },
  text: {
    title: "3D Text",
    kicker: "Roblox text package",
    prompt: "Extra styling notes",
    placeholder: "Make it look like a premium simulator title sign with glowing edges",
    empty: "Preview your text while you tune colors, material, and motion.",
  },
  animation: {
    title: "Animation",
    kicker: "Custom Roblox animation blueprint",
    prompt: "Describe the motion",
    placeholder: "A simple sword swing with one wind-up, one slash, and a clean reset",
    empty: "Pick a preset or write a short motion prompt to preview the animation.",
  },
} satisfies Record<Kind, { title: string; kicker: string; prompt: string; placeholder: string; empty: string }>;

function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  // De-gloss any PBR materials so previews look matte/Roblox-friendly,
  // matching the prompt hint we send to Tripo.
  useEffect(() => {
    scene.traverse((obj: any) => {
      const mat = obj?.material;
      const apply = (m: any) => {
        if (!m) return;
        if ("roughness" in m) m.roughness = 1;
        if ("metalness" in m) m.metalness = 0;
        if ("envMapIntensity" in m) m.envMapIntensity = 0.15;
        if ("clearcoat" in m) m.clearcoat = 0;
        if ("sheen" in m) m.sheen = 0;
        m.needsUpdate = true;
      };
      Array.isArray(mat) ? mat.forEach(apply) : apply(mat);
    });
  }, [scene]);
  return <primitive object={scene} />;
}

function ModelViewer({ url }: { url: string }) {
  const [spin, setSpin] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="absolute inset-0">
      <Canvas
        key={resetKey}
        camera={{ position: [2.4, 1.6, 3.6], fov: 42 }}
        dpr={[1, 2]}
        shadows
      >
        <color attach="background" args={["#06100e"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 5]} intensity={1.15} castShadow />
        <directionalLight position={[-6, 4, -3]} intensity={0.45} color="#7dd3fc" />
        <Suspense
          fallback={
            <Html center>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </Html>
          }
        >
          <Stage intensity={0.4} adjustCamera={1.15} shadows="contact" environment="city">
            <PreviewModel url={url} />
          </Stage>
          <Environment preset="city" background={false} />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2}
          maxDistance={14}
          autoRotate={spin}
          autoRotateSpeed={1.6}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-primary/30 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
        Drag · Scroll to zoom · Right-click pan
      </div>
      <div className="absolute right-3 top-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => setSpin((s) => !s)}
          className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur transition ${
            spin
              ? "border-primary bg-primary/20 text-primary"
              : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
          }`}
        >
          {spin ? "Spinning" : "Auto-spin"}
        </button>
        <button
          type="button"
          onClick={() => setResetKey((k) => k + 1)}
          className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          Reset view
        </button>
      </div>
    </div>
  );
}

function AnimatedTextGroup({
  children,
  animation,
}: {
  children: ReactNode;
  animation: string;
}) {
  const ref = useRef<ThreeGroup>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    switch (animation) {
      case "float":
        g.position.y = 0.3 + Math.sin(t * 1.4) * 0.18;
        g.rotation.y = Math.sin(t * 0.6) * 0.18;
        g.scale.setScalar(1);
        break;
      case "pulse": {
        const s = 1 + Math.sin(t * 3) * 0.08;
        g.scale.setScalar(s);
        g.position.y = 0.3;
        g.rotation.y = 0;
        break;
      }
      case "spin":
        g.rotation.y = t * 0.9;
        g.position.y = 0.3;
        g.scale.setScalar(1);
        break;
      case "bounce": {
        const bounce = Math.abs(Math.sin(t * 2.2));
        g.position.y = 0.15 + bounce * 0.55;
        g.scale.set(1 + (1 - bounce) * 0.12, 1 - (1 - bounce) * 0.15, 1 + (1 - bounce) * 0.12);
        g.rotation.y = 0;
        break;
      }
      default:
        g.position.y = 0.3;
        g.rotation.y = 0;
        g.scale.setScalar(1);
    }
  });
  return <group ref={ref}>{children}</group>;
}

function TextPreview({
  words,
  color,
  secondary,
  effect,
  animation,
}: {
  words: string;
  color: string;
  secondary: string;
  effect: string;
  animation: string;
}) {
  const emissive = effect === "neon" || effect === "gold" || effect === "ice";
  const emissiveColor = effect === "ice" ? "#7dd3fc" : effect === "gold" ? "#fbbf24" : color;
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 1.2, 8], fov: 45 }} dpr={[1, 2]} shadows>
        <color attach="background" args={["#070b12"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, 2, -4]} intensity={0.5} color="#a78bfa" />
        <Suspense fallback={null}>
          <Environment preset="city" background={false} />
          <AnimatedTextGroup animation={animation}>
            <Text
              fontSize={1.15}
              maxWidth={6.8}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
              color={color}
              outlineWidth={effect === "outline" ? 0.08 : 0.045}
              outlineColor={secondary}
              position={[0, 0, 0]}
            >
              {words || "BloxSmith"}
              <meshStandardMaterial
                color={color}
                emissive={emissive ? emissiveColor : "#000000"}
                emissiveIntensity={emissive ? (effect === "neon" ? 1.1 : 0.55) : 0}
                metalness={effect === "gold" ? 0.85 : 0.25}
                roughness={effect === "gold" ? 0.25 : effect === "ice" ? 0.15 : 0.6}
              />
            </Text>
          </AnimatedTextGroup>
          <mesh position={[0, -1.35, -0.22]} receiveShadow>
            <boxGeometry args={[7, 0.22, 0.55]} />
            <meshStandardMaterial
              color={secondary}
              emissive={effect === "neon" ? color : "#000000"}
              emissiveIntensity={effect === "neon" ? 0.45 : 0}
              metalness={0.4}
              roughness={0.4}
            />
          </mesh>
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={14}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-primary/30 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
        Drag · Scroll to zoom · Animation: {animation}
      </div>
    </div>
  );
}

function AnimationPreview({
  type,
  style,
  focus,
  intensity,
  looped,
  duration,
}: {
  type: string;
  style: string;
  focus: string;
  intensity: number;
  looped: boolean;
  duration: number;
}) {
  const motionClass = `preview-motion-${animationTypes.includes(type) ? type : "idle"}`;
  const speed = Math.max(0.7, Math.min(4, duration || 2));
  const power = Math.max(0.25, Math.min(1.25, intensity / 80));
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(20,241,149,0.2),transparent_34%),linear-gradient(180deg,#071017,#05070a)]"
      style={{ ["--preview-speed" as string]: `${speed}s`, ["--preview-power" as string]: String(power) }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(20,241,149,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(20,241,149,0.08)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <div className="absolute left-4 top-4 rounded-xl border border-primary/30 bg-background/75 px-3 py-2 text-xs font-bold text-primary backdrop-blur">
        Live preview
      </div>
      <div className="absolute inset-x-8 bottom-14 h-12 rounded-[50%] bg-primary/10 blur-xl" />
      <div className={`roblox-preview-rig ${motionClass} ${looped ? "is-looped" : "is-once"}`} aria-hidden="true">
        <div className="rig-shadow" />
        <div className="rig-part rig-head">
          <span className="rig-eye rig-eye-left" />
          <span className="rig-eye rig-eye-right" />
          <span className="rig-smile" />
        </div>
        <div className="rig-part rig-torso" />
        <div className="rig-part rig-arm rig-arm-left" />
        <div className="rig-part rig-arm rig-arm-right" />
        <div className="rig-part rig-leg rig-leg-left" />
        <div className="rig-part rig-leg rig-leg-right" />
      </div>
      <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold capitalize">Demo rig: {type} / {style}</span>
          <span className="text-muted-foreground">{looped ? "Looped" : "One-shot"} / {duration}s</span>
        </div>
        <p className="mt-1 text-[10px] leading-normal text-muted-foreground">
          Focus: {focus}. The download is a simple Roblox keyframe blueprint based on this motion.
        </p>
      </div>
      <style>{`
        .roblox-preview-rig {
          position: absolute;
          left: 50%;
          top: 46%;
          width: 118px;
          height: 188px;
          transform: translate(-50%, -50%);
          transform-origin: 50% 80%;
          animation: rigRoot var(--preview-speed) ease-in-out infinite;
        }
        .roblox-preview-rig.is-once {
          animation-iteration-count: 1;
        }
        .rig-part {
          position: absolute;
          border: 2px solid rgba(255,255,255,.22);
          background: linear-gradient(145deg, #2dd4bf, #14f195 46%, #0f766e);
          box-shadow: inset -10px -12px 18px rgba(0,0,0,.24), 0 16px 40px rgba(20,241,149,.18);
        }
        .rig-head {
          left: 36px;
          top: 0;
          width: 46px;
          height: 46px;
          border-radius: 8px;
          background: linear-gradient(145deg, #f8d47b, #e8a74c);
          animation: rigHead var(--preview-speed) ease-in-out infinite;
        }
        .rig-eye {
          position: absolute;
          top: 17px;
          width: 5px;
          height: 5px;
          border-radius: 99px;
          background: #111827;
        }
        .rig-eye-left { left: 14px; }
        .rig-eye-right { right: 14px; }
        .rig-smile {
          position: absolute;
          left: 16px;
          top: 28px;
          width: 14px;
          height: 6px;
          border-bottom: 2px solid #111827;
          border-radius: 0 0 999px 999px;
        }
        .rig-torso {
          left: 33px;
          top: 52px;
          width: 52px;
          height: 68px;
          border-radius: 7px;
          background: linear-gradient(145deg, #1d4ed8, #2563eb 44%, #0f172a);
          animation: rigTorso var(--preview-speed) ease-in-out infinite;
        }
        .rig-arm {
          top: 56px;
          width: 24px;
          height: 68px;
          border-radius: 7px;
          transform-origin: 50% 10%;
          animation: rigArm var(--preview-speed) ease-in-out infinite;
        }
        .rig-arm-left { left: 5px; }
        .rig-arm-right { right: 5px; animation-name: rigArmOpposite; }
        .rig-leg {
          top: 126px;
          width: 27px;
          height: 58px;
          border-radius: 7px;
          background: linear-gradient(145deg, #1e293b, #334155);
          transform-origin: 50% 0;
          animation: rigLeg var(--preview-speed) ease-in-out infinite;
        }
        .rig-leg-left { left: 31px; }
        .rig-leg-right { right: 31px; animation-name: rigLegOpposite; }
        .rig-shadow {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: -12px;
          height: 18px;
          border-radius: 999px;
          background: rgba(0,0,0,.38);
          filter: blur(4px);
          animation: rigShadow var(--preview-speed) ease-in-out infinite;
        }
        .preview-motion-walk .rig-arm-left, .preview-motion-run .rig-arm-left { animation-name: rigWalkArm; }
        .preview-motion-walk .rig-arm-right, .preview-motion-run .rig-arm-right { animation-name: rigWalkArmOpposite; }
        .preview-motion-walk .rig-leg-left, .preview-motion-run .rig-leg-left { animation-name: rigWalkLeg; }
        .preview-motion-walk .rig-leg-right, .preview-motion-run .rig-leg-right { animation-name: rigWalkLegOpposite; }
        .preview-motion-run { animation-name: rigRunRoot; }
        .preview-motion-attack .rig-arm-right { animation-name: rigAttackArm; }
        .preview-motion-attack .rig-torso { animation-name: rigAttackTorso; }
        .preview-motion-dance .rig-arm-left { animation-name: rigDanceArmLeft; }
        .preview-motion-dance .rig-arm-right { animation-name: rigDanceArmRight; }
        .preview-motion-emote .rig-arm-left, .preview-motion-emote .rig-arm-right { animation-name: rigEmoteArm; }
        .preview-motion-jump { animation-name: rigJumpRoot; }
        .preview-motion-pet { transform: translate(-50%, -45%) scale(.78); animation-name: rigPetBounce; }
        .preview-motion-tool .rig-arm-right { animation-name: rigToolArm; }
        .preview-motion-npc .rig-head { animation-name: rigNpcHead; }
        @keyframes rigRoot { 0%,100%{ transform:translate(-50%,-50%) rotate(calc(-2deg * var(--preview-power))) } 50%{ transform:translate(-50%,calc(-50% - 8px * var(--preview-power))) rotate(calc(3deg * var(--preview-power))) } }
        @keyframes rigRunRoot { 0%,100%{ transform:translate(-54%,-50%) rotate(calc(-5deg * var(--preview-power))) } 50%{ transform:translate(-46%,calc(-50% - 12px * var(--preview-power))) rotate(calc(5deg * var(--preview-power))) } }
        @keyframes rigJumpRoot { 0%,100%{ transform:translate(-50%,-42%) scaleY(.96) } 45%{ transform:translate(-50%,calc(-64% - 18px * var(--preview-power))) scaleY(1.03) } }
        @keyframes rigPetBounce { 0%,100%{ transform:translate(-50%,-44%) scale(.78) } 50%{ transform:translate(-50%,calc(-51% - 10px * var(--preview-power))) scale(.82) } }
        @keyframes rigHead { 0%,100%{ transform:rotate(calc(-4deg * var(--preview-power))) } 50%{ transform:rotate(calc(5deg * var(--preview-power))) } }
        @keyframes rigTorso { 0%,100%{ transform:rotate(0) } 50%{ transform:rotate(calc(3deg * var(--preview-power))) } }
        @keyframes rigArm { 0%,100%{ transform:rotate(calc(-15deg * var(--preview-power))) } 50%{ transform:rotate(calc(24deg * var(--preview-power))) } }
        @keyframes rigArmOpposite { 0%,100%{ transform:rotate(calc(17deg * var(--preview-power))) } 50%{ transform:rotate(calc(-25deg * var(--preview-power))) } }
        @keyframes rigLeg { 0%,100%{ transform:rotate(calc(7deg * var(--preview-power))) } 50%{ transform:rotate(calc(-8deg * var(--preview-power))) } }
        @keyframes rigLegOpposite { 0%,100%{ transform:rotate(calc(-7deg * var(--preview-power))) } 50%{ transform:rotate(calc(8deg * var(--preview-power))) } }
        @keyframes rigWalkArm { 0%,100%{ transform:rotate(calc(28deg * var(--preview-power))) } 50%{ transform:rotate(calc(-28deg * var(--preview-power))) } }
        @keyframes rigWalkArmOpposite { 0%,100%{ transform:rotate(calc(-28deg * var(--preview-power))) } 50%{ transform:rotate(calc(28deg * var(--preview-power))) } }
        @keyframes rigWalkLeg { 0%,100%{ transform:rotate(calc(-16deg * var(--preview-power))) } 50%{ transform:rotate(calc(18deg * var(--preview-power))) } }
        @keyframes rigWalkLegOpposite { 0%,100%{ transform:rotate(calc(18deg * var(--preview-power))) } 50%{ transform:rotate(calc(-16deg * var(--preview-power))) } }
        @keyframes rigAttackArm { 0%,100%{ transform:rotate(-18deg) translateY(0) } 35%{ transform:rotate(-92deg) translateY(-8px) } 55%{ transform:rotate(72deg) translateY(6px) } }
        @keyframes rigAttackTorso { 0%,100%{ transform:rotate(0) } 45%{ transform:rotate(calc(-11deg * var(--preview-power))) } }
        @keyframes rigDanceArmLeft { 0%,100%{ transform:rotate(-80deg) } 50%{ transform:rotate(24deg) } }
        @keyframes rigDanceArmRight { 0%,100%{ transform:rotate(80deg) } 50%{ transform:rotate(-24deg) } }
        @keyframes rigEmoteArm { 0%,100%{ transform:rotate(-8deg) } 50%{ transform:rotate(-110deg) } }
        @keyframes rigToolArm { 0%,100%{ transform:rotate(18deg) } 45%{ transform:rotate(-62deg) translateY(-6px) } }
        @keyframes rigNpcHead { 0%,100%{ transform:rotate(-8deg) } 50%{ transform:rotate(8deg) } }
        @keyframes rigShadow { 0%,100%{ transform:scaleX(.9); opacity:.55 } 50%{ transform:scaleX(1.18); opacity:.32 } }
      `}</style>
    </div>
  );
}

function Generate3DPage() {
  const { user } = useAuth();
  const run = useServerFn(generate3DModelFn);
  const getStatus = useServerFn(get3DStatusFn);
  const [kind, setKind] = useState<Kind>("model");
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<Generate3DResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ canGenerate: boolean; isOwner: boolean; credits: number; cost: number; nextAvailable: string | null; fallback?: { configured: boolean; used: number; limit: number; remaining: number; nextReset: string | null } } | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready");
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [modelType, setModelType] = useState("pet");
  const [robloxStyle, setRobloxStyle] = useState("chunky");
  const [theme, setTheme] = useState("neon");
  const [material, setMaterial] = useState("plastic");
  const [textureLook, setTextureLook] = useState("clean");
  const [primaryColor, setPrimaryColor] = useState("#14f195");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [quality, setQuality] = useState<"turbo" | "standard" | "detailed">("turbo");
  const [format, setFormat] = useState<"GLB" | "OBJ" | "FBX">("GLB");
  const [faceLimit, setFaceLimit] = useState(10000);
  const [texture, setTexture] = useState(true);
  const [rigged, setRigged] = useState(false);
  const [animateInPlace, setAnimateInPlace] = useState(false);
  const [textWords, setTextWords] = useState("BloxSmith");
  const [textFont, setTextFont] = useState("GothamBlack");
  const [textEffect, setTextEffect] = useState("neon");
  const [textAnimation, setTextAnimation] = useState("float");
  const [textSize, setTextSize] = useState(8);
  const [animationType, setAnimationType] = useState("idle");
  const [animationTarget, setAnimationTarget] = useState("character");
  const [animationStyle, setAnimationStyle] = useState("snappy");
  const [animationEasing, setAnimationEasing] = useState("sine");
  const [animationBodyFocus, setAnimationBodyFocus] = useState("full body");
  const [animationIntensity, setAnimationIntensity] = useState(55);
  const [animationDuration, setAnimationDuration] = useState(2);
  const [animationLooped, setAnimationLooped] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [playtestChecks, setPlaytestChecks] = useState(true);
  const selectedAnimationPreset =
    animationQuickPresets.find(
      (preset) =>
        preset.type === animationType &&
        preset.style === animationStyle &&
        preset.focus === animationBodyFocus,
    ) ?? animationQuickPresets.find((preset) => preset.type === animationType);

  const stageList =
    kind === "model"
      ? [
          "Checking prompt safety",
          inputMode === "image" ? "Uploading reference image" : "Preparing Tripo request",
          "Generating 3D mesh",
          "Converting Roblox export",
          "Saving permanent download",
        ]
      : kind === "text"
        ? ["Checking text safety", "Building 3D text package", "Adding motion script", "Saving Studio package"]
        : ["Checking motion prompt", "Writing keyframe plan", "Tuning timing and easing", "Saving animation blueprint"];

  const estimatedSeconds =
    kind === "model"
      ? inputMode === "image"
        ? quality === "detailed"
          ? 210
          : 165
        : quality === "detailed"
          ? 180
          : quality === "standard"
            ? 135
            : 95
      : kind === "text"
        ? 18
        : 22;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    getStatus({ data: { generationKind: kind } })
      .then((s: any) => {
        setStatus(s);
        setNextAvailable(s.nextAvailable);
      })
      .catch(() => {});
  }, [user, kind, getStatus]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id,name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setProjects((data ?? []) as Project[]));
  }, [user]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (nextAvailable && status && !status.canGenerate && new Date(nextAvailable).getTime() <= now) {
      setStatus({ ...status, canGenerate: true, nextAvailable: null });
      setNextAvailable(null);
      setLimitMsg(null);
    }
  }, [nextAvailable, now, status]);

  const locked =
    !!status &&
    !status.canGenerate &&
    !status.isOwner &&
    !!nextAvailable &&
    new Date(nextAvailable).getTime() > now;
  const cost = status?.cost ?? (kind === "model" ? 25 : kind === "text" ? 10 : 12);
  const progressEta = Math.max(0, estimatedSeconds - elapsed);
  const selectedSummary =
    kind === "model"
      ? `${modelType} / ${robloxStyle} / ${theme} / ${material}`
      : kind === "text"
        ? `${textFont} / ${textEffect} / ${textAnimation}`
        : `${animationType} / ${animationStyle} / ${animationBodyFocus}`;

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  const fmtDuration = (seconds: number) => {
    if (seconds <= 0) return "now";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  };
  const cooldownEta = (iso: string | null) => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return "now";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  };

  const startProgress = () => {
    if (timer.current) clearInterval(timer.current);
    startedAt.current = Date.now();
    setElapsed(0);
    setProgress(3);
    setStage(stageList[0]);
    timer.current = setInterval(() => {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
      const ratio = Math.min(0.94, elapsedSeconds / estimatedSeconds);
      const stageIndex = Math.min(stageList.length - 1, Math.floor(ratio * stageList.length));
      setElapsed(elapsedSeconds);
      setProgress(Math.max(5, Math.round(ratio * 100)));
      setStage(stageList[stageIndex]);
    }, 1000);
  };

  const stopProgress = (ok: boolean) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(ok ? 100 : 0);
    setStage(ok ? "Ready to download" : "Generation stopped");
  };

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Upload a PNG, JPG, or WEBP image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image uploads must be 8 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setImageName(file.name);
      setInputMode("image");
    };
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  };

  const applyAnimationPreset = (preset: (typeof animationQuickPresets)[number]) => {
    setAnimationType(preset.type);
    setAnimationStyle(preset.style);
    setAnimationBodyFocus(preset.focus);
    setAnimationDuration(preset.duration);
    setAnimationIntensity(preset.intensity);
    setAnimationLooped(preset.looped);
    setPrompt(preset.prompt);
  };

  const generate = async () => {
    if (!user) return toast.error("Please log in to generate.");
    if (locked) return toast.error("Your weekly 3D Studio generation is already used.");
    if (kind === "model" && inputMode === "text" && prompt.trim().length < 3) return toast.error("Describe the model you want.");
    if (kind === "model" && inputMode === "image" && !imageDataUrl) return toast.error("Upload a reference image first.");
    if (kind === "text" && !textWords.trim()) return toast.error("Enter 3D text words.");
    if (kind === "animation" && prompt.trim().length < 3) return toast.error("Describe the animation you want.");

    setBusy(true);
    setResult(null);
    setLimitMsg(null);
    startProgress();
    try {
      const playtestHint = playtestChecks
        ? "\n\nInclude Roblox playtest readiness: collision/import notes, expected Studio test steps, mobile checks, and any safety/performance constraints."
        : "";
      const out = (await run({
        data: {
          generationKind: kind,
          prompt: `${prompt.trim()}${playtestHint}`.trim(),
          ...(projectId ? { projectId } : {}),
          inputMode,
          ...(imageDataUrl ? { imageDataUrl } : {}),
          modelType,
          robloxStyle,
          theme,
          material,
          textureLook,
          primaryColor,
          secondaryColor,
          textWords,
          textFont,
          textEffect,
          textAnimation,
          textSize,
          animationType,
          animationTarget,
          animationStyle,
          animationEasing,
          animationBodyFocus,
          animationIntensity,
          animationDuration,
          animationLooped,
          quality,
          format: rigged && format === "OBJ" ? "FBX" : format,
          faceLimit,
          texture,
          rigged,
          animateInPlace,
        },
      })) as Generate3DResult;
      if (out.ok) {
        stopProgress(true);
        setResult(out);
        setNextAvailable(out.nextAvailable);
        setStatus((s) => (s ? { ...s, canGenerate: false, nextAvailable: out.nextAvailable } : s));
        toast.success(`Generation ready! ${out.creditsSpent} credits used.`);
      } else {
        stopProgress(false);
        setLimitMsg(out.error);
        setNextAvailable(out.nextAvailable ?? null);
        toast.error(out.error);
      }
    } catch (err: any) {
      stopProgress(false);
      toast.error(err?.message ?? "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const disabled =
    busy ||
    locked ||
    (kind === "model"
      ? inputMode === "text"
        ? !prompt.trim()
        : !imageDataUrl
      : kind === "text"
        ? !textWords.trim()
        : !prompt.trim());

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-1/4 w-[480px] h-[480px] bg-primary/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 left-1/4 w-[380px] h-[380px] bg-accent/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8 relative z-10">
        <section className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-center glass p-5 rounded-2xl border border-border/80 shadow-md">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary-glow shadow-[0_0_12px_rgba(20,241,149,0.15)]">
              <Box className="h-3.5 w-3.5" /> Roblox Asset Studio
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              3D, Text, and Animation Generator
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Build model files with Tripo, Studio text packages, and custom animation blueprints from your own prompts.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/80 bg-background/25 p-1.5 shadow-inner">
            <Stat label="Credits" value={status?.isOwner ? "Staff" : String(status?.credits ?? "...")} />
            <Stat label="Cost" value={`${cost} cr`} />
            <Stat label="Cooldown" value={locked ? cooldownEta(nextAvailable) : "Ready"} />
          </div>
        </section>

        {locked && nextAvailable && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <Clock className="h-4 w-4" /> Weekly 3D Studio generation used
                </div>
                <p className="mt-1 text-xs text-muted-foreground font-medium">
                  Normal users can pick one per week: text-to-3D, image-to-3D, 3D text, or animation. Unlocks {fmtDate(nextAvailable)}.
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/30 bg-background/50 px-4 py-2 text-center shadow-md">
                <div className="text-2xl font-black text-amber-200">{cooldownEta(nextAvailable)}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">remaining</div>
              </div>
            </div>
          </div>
        )}

        {status?.fallback?.configured && !status.isOwner && (
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-sky-200">
                  <Clock className="h-4 w-4" /> Fallback Tripo key
                </div>
                <p className="mt-1 text-xs text-muted-foreground font-medium">
                  If the main Tripo key runs out, we auto-retry on a backup key. Limit: 3 generations every 7 days.
                  {" "}
                  <span className="text-sky-200/90">
                    {status.fallback.remaining} of {status.fallback.limit} remaining
                  </span>
                  {status.fallback.nextReset
                    ? ` — oldest use rolls off ${fmtDate(status.fallback.nextReset)}.`
                    : "."}
                </p>
              </div>
              <div className="rounded-xl border border-sky-300/30 bg-background/50 px-4 py-2 text-center shadow-md">
                <div className="text-2xl font-black text-sky-200">
                  {status.fallback.nextReset ? cooldownEta(status.fallback.nextReset) : "Ready"}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {status.fallback.nextReset ? "until 1 use frees up" : "fallback ready"}
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-3.5 md:grid-cols-3">
          <ModeCard
            active={kind === "model"}
            icon={<Box className="h-4.5 w-4.5" />}
            title="3D Models"
            text="Tripo-generated meshes with Roblox export settings."
            onClick={() => setKind("model")}
          />
          <ModeCard
            active={kind === "text"}
            icon={<Type className="h-4.5 w-4.5" />}
            title="3D Text"
            text="Studio-ready signs with glow, motion, and colors."
            onClick={() => setKind("text")}
          />
          <ModeCard
            active={kind === "animation"}
            icon={<Film className="h-4.5 w-4.5" />}
            title="Animations"
            text="Custom prompt-to-keyframe blueprints and controller snippets."
            onClick={() => setKind("animation")}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
          <section className="rounded-2xl border border-border/80 bg-surface/50 p-5 shadow-md sm:p-6 flex flex-col justify-between">
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-primary">{copy[kind].kicker}</div>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">{copy[kind].title} Builder</h2>
                </div>
                <div className="rounded-xl border border-border bg-background/45 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                  ETA {fmtDuration(estimatedSeconds)}
                </div>
              </div>

              {kind === "model" && (
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/80 bg-background/20 p-1">
                  <Tab active={inputMode === "text"} onClick={() => setInputMode("text")} icon={<WandSparkles className="h-3.5 w-3.5" />} label="Text to 3D" />
                  <Tab active={inputMode === "image"} onClick={() => setInputMode("image")} icon={<ImagePlus className="h-3.5 w-3.5" />} label="Image to 3D" />
                </div>
              )}

              {kind === "model" && inputMode === "image" && (
                <div className="mb-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3.5">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-background/25 px-4 py-6 text-center hover:border-primary/40 hover:bg-background/40 transition duration-300">
                    <Upload className="h-6 w-6 text-primary" />
                    <span className="text-sm font-semibold">{imageName || "Upload a safe reference image"}</span>
                    <span className="text-[11px] text-muted-foreground">PNG, JPG, or WEBP. Max 8 MB.</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  {imageDataUrl && (
                    <div className="mt-3 relative rounded-xl overflow-hidden border border-border bg-background/40 p-2">
                      <img src={imageDataUrl} alt="Reference preview" className="max-h-56 w-full rounded-lg object-contain" />
                    </div>
                  )}
                </div>
              )}

            {kind === "text" && (
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                <TextInput label="3D text words" value={textWords} onChange={setTextWords} />
                <NumberInput label="Size" value={textSize} min={1} max={30} onChange={setTextSize} />
              </div>
            )}

            <label className="block text-sm font-bold text-foreground">{copy[kind].prompt}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy[kind].placeholder}
              rows={kind === "animation" ? 3 : 4}
              maxLength={1024}
              disabled={busy}
              className="mt-2 w-full resize-none rounded-xl border border-border/80 bg-background/25 px-3.5 py-3 text-sm outline-none transition focus:border-primary/50 disabled:opacity-60 text-foreground placeholder:text-muted-foreground/60"
            />
            {kind === "animation" && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Simple presets</div>
                    <div className="text-[11px] font-semibold text-muted-foreground">Pick one, then edit the sentence if needed.</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {animationQuickPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyAnimationPreset(preset)}
                        className={`rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 ${
                          animationType === preset.type && animationStyle === preset.style
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/80 bg-background/20"
                        }`}
                      >
                        <div className="text-sm font-bold text-foreground">{preset.label}</div>
                        <p className="mt-1 text-[11px] leading-normal text-muted-foreground">{preset.detail}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <div className="mb-2 flex items-center gap-2 font-bold text-foreground">
                    <Info className="h-4 w-4 text-primary" /> How animation export works
                  </div>
                  <div className="grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
                    <div>
                      <div className="font-bold text-foreground">1. Preview</div>
                      The blocky demo rig shows the motion style before you spend credits.
                    </div>
                    <div>
                      <div className="font-bold text-foreground">2. Download</div>
                      BloxSmith creates a small Lua blueprint with simple keyframes.
                    </div>
                    <div>
                      <div className="font-bold text-foreground">3. Use in Roblox</div>
                      Recreate/publish it in Animation Editor, then paste the asset id into the included player script.
                    </div>
                  </div>
                </div>

                <details className="rounded-xl border border-border/80 bg-background/20 p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-muted-foreground hover:text-foreground">
                    More prompt examples
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {animationPrompts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="rounded-full border border-border/80 bg-background/20 px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground cursor-pointer"
                  >
                    {item}
                  </button>
                    ))}
                  </div>
                </details>
              </div>
            )}

            <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Settings2 className="h-3.5 w-3.5" /> Controls
                </div>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/25 px-3.5 py-2 text-xs font-bold text-muted-foreground transition hover:border-primary/45 hover:text-foreground cursor-pointer"
                >
                  {advancedOpen ? "Hide advanced" : "Advanced Settings"}
                </button>
              </div>

              {projects.length > 0 && (
                <label className="block text-xs font-bold flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Insert package into project</span>
                  <select
                    value={projectId}
                    disabled={busy}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background/25 px-3 py-2.5 text-xs text-foreground focus:border-primary/60"
                  >
                    <option value="">Download only</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/20 p-2.5 text-xs">
                <span className="rounded-lg bg-surface/80 border border-border/60 px-2.5 py-1 text-muted-foreground font-medium">
                  Selected: <span className="font-bold text-foreground">{selectedSummary}</span>
                </span>
                <span className="rounded-lg bg-surface/80 border border-border/60 px-2.5 py-1 text-muted-foreground font-medium">
                  {kind === "model" ? `${quality} / ${format}` : kind === "animation" ? `${animationDuration}s / ${animationLooped ? "looped" : "one-shot"}` : `${textSize} stud size`}
                </span>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/20 px-3.5 py-3 text-xs hover:border-primary/20 transition duration-200">
                <input
                  type="checkbox"
                  checked={playtestChecks}
                  onChange={(e) => setPlaytestChecks(e.target.checked)}
                  className="mt-0.5 h-4.5 w-4.5 accent-emerald-500 rounded cursor-pointer"
                />
                <Gamepad2 className="mt-0.5 h-4.5 w-4.5 text-primary shrink-0" />
                <span>
                  <span className="block font-bold text-foreground">AI playtest readiness</span>
                  <span className="mt-0.5 block text-muted-foreground leading-normal">
                    Adds Roblox import QA, Studio test steps, mobile checks, collision notes, and
                    performance constraints.
                  </span>
                </span>
              </label>

              {advancedOpen && (
                <>
                  {kind === "model" && (
                    <>
                      <Group label="Model type"><VisualChips value={modelType} set={setModelType} items={modelTypes} images={modelTypeImages} /></Group>
                      <Group label="Roblox style"><VisualChips value={robloxStyle} set={setRobloxStyle} items={styles} images={styleImages} compact /></Group>
                    </>
                  )}

                  {kind === "animation" && (
                    <>
                      <div className="rounded-xl border border-border/80 bg-background/20 p-3 text-xs text-muted-foreground">
                        <div className="font-bold text-foreground">Fine tune only if needed</div>
                        Keep animations simple for Roblox. One clear motion is easier to import, publish, and test than a long cinematic sequence.
                      </div>
                      <Group label="Animation type"><Chips value={animationType} set={setAnimationType} items={animationTypes} /></Group>
                      <Group label="Motion style"><Chips value={animationStyle} set={setAnimationStyle} items={animationStyles} /></Group>
                      <Group label="Body focus"><Chips value={animationBodyFocus} set={setAnimationBodyFocus} items={bodyFocuses} /></Group>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <TextInput label="Target" value={animationTarget} onChange={setAnimationTarget} />
                        <NumberInput label="Duration" value={animationDuration} min={0.25} max={30} step={0.25} onChange={setAnimationDuration} />
                      </div>
                      <Group label="Easing"><Chips value={animationEasing} set={setAnimationEasing} items={animationEasings} /></Group>
                      <label className="block text-xs font-medium">
                        Intensity: {animationIntensity}%
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={animationIntensity}
                          onChange={(e) => setAnimationIntensity(Number(e.target.value))}
                          className="mt-1 w-full accent-emerald-500"
                        />
                      </label>
                      <Toggle checked={animationLooped} onChange={setAnimationLooped} label="Looped animation" />
                    </>
                  )}

                  <Group label="Theme"><VisualChips value={theme} set={setTheme} items={themes} images={themeImages} compact /></Group>
                  <Group label="Material"><VisualChips value={material} set={setMaterial} items={materials} images={materialImages} compact /></Group>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
                    <ColorInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} />
                  </div>

                  {kind === "text" && (
                    <>
                      <Group label="Font"><VisualChips value={textFont} set={setTextFont} items={["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"]} images={textFontImages} compact /></Group>
                      <Group label="Effect"><VisualChips value={textEffect} set={setTextEffect} items={["neon", "outline", "gold", "ice", "shadow"]} images={textEffectImages} compact /></Group>
                      <Group label="Animation"><VisualChips value={textAnimation} set={setTextAnimation} items={["float", "pulse", "spin", "bounce", "none"]} images={textAnimationImages} compact /></Group>
                    </>
                  )}

                  {kind === "model" && (
                    <>
                      <Group label="Quality"><VisualChips value={quality} set={(v) => setQuality(v as typeof quality)} items={["turbo", "standard", "detailed"]} images={qualityImages} compact /></Group>
                      <Group label="Format"><VisualChips value={format} set={(v) => setFormat(v as typeof format)} items={["GLB", "OBJ", "FBX"]} images={formatImages} compact /></Group>
                      <label className="block text-xs font-medium">
                        Polygon budget: {faceLimit.toLocaleString()}
                        <input
                          type="range"
                          min={1000}
                          max={50000}
                          step={1000}
                          value={faceLimit}
                          onChange={(e) => setFaceLimit(Number(e.target.value))}
                          className="mt-1 w-full accent-emerald-500"
                        />
                      </label>
                      <Group label="Texture look"><VisualChips value={textureLook} set={setTextureLook} items={textureLooks} images={textureLookImages} compact /></Group>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Toggle checked={texture} onChange={setTexture} label="Generate textures" />
                        <Toggle
                          checked={rigged}
                          onChange={(v) => {
                            setRigged(v);
                            if (v && format === "OBJ") setFormat("FBX");
                          }}
                          label="Rigged FBX export"
                        />
                        <Toggle checked={animateInPlace} onChange={setAnimateInPlace} label="Animation-ready in place" />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {kind === "animation"
                  ? "One weekly 3D Studio generation is shared across animations, text-to-3D, image-to-3D, and 3D text. Safety checks run before any file is created."
                  : "One weekly 3D Studio generation is shared across text-to-3D, image-to-3D, 3D text, and animations. Credits are charged only after a safe file is created."}
              </div>
            </div>
          </div>

            <button
              onClick={generate}
              disabled={disabled}
              className="mt-5 btn-shine w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-primary-glow to-accent py-3.5 text-sm font-bold text-primary-foreground shadow-lg hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 border-0 cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" /> Generating - ETA {fmtDuration(progressEta)}
                </>
              ) : locked ? (
                <>
                  <Clock className="h-4.5 w-4.5" /> Weekly use resets in {cooldownEta(nextAvailable)}
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5" /> Generate {copy[kind].title} - {cost} credits
                </>
              )}
            </button>
          </section>

          <section className="flex flex-col rounded-2xl border border-border/80 bg-surface/50 p-5 shadow-md sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Preview</div>
                <h2 className="text-lg font-bold tracking-tight">Output and Progress</h2>
              </div>
              {result && <BadgeCheck className="h-5.5 w-5.5 text-primary" />}
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[#07100d]">
              {kind === "text" ? (
                <TextPreview words={textWords} color={primaryColor} secondary={secondaryColor} effect={textEffect} animation={textAnimation} />
              ) : result?.previewGlbUrl ? (
                <ModelViewer url={result.previewGlbUrl} />
              ) : kind === "animation" ? (
                <AnimationPreview
                  type={animationType}
                  style={animationStyle}
                  focus={animationBodyFocus}
                  intensity={animationIntensity}
                  looped={animationLooped}
                  duration={animationDuration}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div className="text-muted-foreground">
                    {busy ? (
                      <>
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-3 text-xs">{stage}</p>
                      </>
                    ) : (
                      <>
                        <Box className="mx-auto h-10 w-10 opacity-40" />
                        <p className="mt-2 text-xs">{copy[kind].empty}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {result?.renderedImageUrl && (
              <div className="mt-4 rounded-xl border border-border/80 bg-background/25 p-3 shadow-inner">
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-primary" /> 2D Render</span>
                  <a href={result.renderedImageUrl} download className="text-primary hover:underline normal-case tracking-normal text-xs font-bold">Download PNG</a>
                </div>
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-[#07100d]">
                  <img src={result.renderedImageUrl} alt="Generated 2D render of the 3D model" className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-border/80 bg-background/25 p-4 shadow-inner">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <Gauge className="h-3.5 w-3.5 text-primary" /> {stage}
                </span>
                <span className="text-muted-foreground font-semibold">
                  {busy ? `${fmtDuration(elapsed)} elapsed / ${fmtDuration(progressEta)} left` : `${Math.round(progress)}%`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/80 bg-background/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary-glow to-accent transition-all duration-500 shadow-[0_0_10px_rgba(20,241,149,0.3)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-semibold sm:grid-cols-4">
                {stageList.map((item, index) => (
                  <span key={item} className={index <= Math.floor((progress / 100) * stageList.length) ? "text-foreground font-bold" : ""}>
                    {index + 1}. {item}
                  </span>
                ))}
              </div>
            </div>

            {kind === "animation" && (
              <div className="mt-4 rounded-xl border border-border/80 bg-background/25 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Film className="h-4 w-4 text-primary" /> What users get
                </div>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {selectedAnimationPreset?.detail ?? "A simple Roblox-ready motion blueprint."} The file includes a short keyframe list, a controller snippet, and clear import steps.
                </p>
              </div>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <a
                  href={result.fileUrl}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground font-bold py-3 text-sm shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 cursor-pointer border-0"
                >
                  <Download className="h-4.5 w-4.5" /> Download {result.format === "LUA" ? "Studio package" : result.format}
                </a>
                {result.studioFilePath && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300 font-medium">
                    Project file: <span className="font-mono bg-background/30 px-1 py-0.5 rounded">{result.studioFilePath}</span>
                  </div>
                )}
                <div className="rounded-xl border border-border/80 bg-background/25 p-3.5 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-bold text-foreground">
                    <Info className="h-4 w-4 text-primary shrink-0" /> Roblox Studio insert
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">{result.importTip}</p>
                </div>
                {result.studioScript && (
                  <details className="rounded-xl border border-border/80 bg-background/25 p-3.5 text-xs group cursor-pointer">
                    <summary className="font-bold text-muted-foreground group-hover:text-foreground transition duration-200">Preview generated Roblox code</summary>
                    <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-background/45 p-3.5 border border-border/60 font-mono text-[11px] text-muted-foreground/90">{result.studioScript}</pre>
                  </details>
                )}
                {nextAvailable && (
                  <p className="text-xs text-muted-foreground font-medium">
                    Next generation unlocks {fmtDate(nextAvailable)} ({cooldownEta(nextAvailable)}).
                  </p>
                )}
              </div>
            )}

            {limitMsg && !result && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Clock className="h-4 w-4 shrink-0" /> Not available right now
                </div>
                <p className="mt-1.5 text-xs text-foreground/80 leading-normal">{limitMsg}</p>
                {nextAvailable && (
                  <p className="mt-2 text-[11px] text-muted-foreground font-semibold">
                    Available {fmtDate(nextAvailable)} ({cooldownEta(nextAvailable)}).
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/30 px-3.5 py-2 hover:border-primary/20 transition-all duration-300 shadow-sm text-center">
      <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs sm:text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4.5 text-left transition-all duration-300 ease-out hover:scale-[1.015] active:scale-[0.98] cursor-pointer group ${
        active
          ? "border-primary bg-gradient-to-br from-primary/15 via-background/40 to-primary/5 shadow-[0_0_20px_-5px_oklch(0.73_0.17_158_/_0.22)] text-foreground"
          : "border-border/80 bg-surface/30 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-2.5 font-bold text-sm">
        <span className={`grid h-8.5 w-8.5 place-items-center rounded-lg border transition-colors ${
          active ? "bg-primary text-primary-foreground border-primary/20 shadow-[0_0_10px_rgba(20,241,149,0.2)]" : "bg-background/40 border-border/80 group-hover:text-primary"
        }`}>
          {icon}
        </span>
        {title}
      </div>
      <p className={`mt-2 text-xs leading-relaxed ${active ? "text-foreground/90" : "text-muted-foreground/80"}`}>{text}</p>
    </button>
  );
}

function Tab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
        active
          ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Chips({ value, set, items }: { value: string; set: (v: any) => void; items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => set(item)}
          className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-300 cursor-pointer ${
            value === item
              ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm text-foreground"
              : "border-border/60 bg-background/25 text-muted-foreground hover:text-foreground hover:border-primary/30"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const OPTION_ICONS: Record<string, { icon: LucideIcon; gradient: string }> = {
  // Model types
  pet: { icon: PawPrint, gradient: "from-pink-500/30 via-fuchsia-500/15 to-transparent" },
  character: { icon: User, gradient: "from-amber-400/30 via-orange-500/15 to-transparent" },
  weapon: { icon: Sword, gradient: "from-rose-500/30 via-red-500/15 to-transparent" },
  prop: { icon: Boxes, gradient: "from-amber-500/30 via-yellow-500/15 to-transparent" },
  building: { icon: Building2, gradient: "from-sky-500/30 via-blue-500/15 to-transparent" },
  vehicle: { icon: Car, gradient: "from-red-500/30 via-orange-500/15 to-transparent" },
  "simulator item": { icon: Coins, gradient: "from-yellow-400/30 via-amber-500/15 to-transparent" },
  "map piece": { icon: Map, gradient: "from-emerald-500/30 via-teal-500/15 to-transparent" },
  accessory: { icon: Crown, gradient: "from-amber-400/30 via-yellow-500/15 to-transparent" },
  tool: { icon: Hammer, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  // Styles
  chunky: { icon: Square, gradient: "from-orange-500/30 via-red-500/15 to-transparent" },
  "low-poly": { icon: Triangle, gradient: "from-cyan-500/30 via-blue-500/15 to-transparent" },
  cartoon: { icon: Smile, gradient: "from-pink-500/30 via-rose-500/15 to-transparent" },
  anime: { icon: Stars, gradient: "from-fuchsia-500/30 via-purple-500/15 to-transparent" },
  simulator: { icon: Gamepad2, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
  obby: { icon: LayoutGrid, gradient: "from-sky-500/30 via-cyan-500/15 to-transparent" },
  tycoon: { icon: Coins, gradient: "from-yellow-400/30 via-amber-500/15 to-transparent" },
  "realistic-lite": { icon: Mountain, gradient: "from-stone-500/30 via-zinc-500/15 to-transparent" },
  // Themes
  neon: { icon: Zap, gradient: "from-fuchsia-500/30 via-pink-500/15 to-transparent" },
  fantasy: { icon: Castle, gradient: "from-violet-500/30 via-purple-500/15 to-transparent" },
  "sci-fi": { icon: Rocket, gradient: "from-cyan-500/30 via-blue-500/15 to-transparent" },
  city: { icon: Building2, gradient: "from-slate-500/30 via-zinc-500/15 to-transparent" },
  horror: { icon: Ghost, gradient: "from-red-500/30 via-rose-500/15 to-transparent" },
  cute: { icon: Heart, gradient: "from-pink-400/30 via-rose-400/15 to-transparent" },
  medieval: { icon: ShieldCheck, gradient: "from-amber-500/30 via-stone-500/15 to-transparent" },
  pirate: { icon: ShipWheel, gradient: "from-amber-600/30 via-orange-500/15 to-transparent" },
  space: { icon: Stars, gradient: "from-indigo-500/30 via-violet-500/15 to-transparent" },
  premium: { icon: Crown, gradient: "from-yellow-400/30 via-amber-500/15 to-transparent" },
  // Materials
  plastic: { icon: Square, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
  metal: { icon: ShieldCheck, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  wood: { icon: Trees, gradient: "from-amber-600/30 via-orange-700/15 to-transparent" },
  stone: { icon: Mountain, gradient: "from-stone-500/30 via-zinc-500/15 to-transparent" },
  glass: { icon: Diamond, gradient: "from-cyan-400/30 via-sky-400/15 to-transparent" },
  crystal: { icon: Gem, gradient: "from-fuchsia-500/30 via-violet-500/15 to-transparent" },
  fabric: { icon: Shirt, gradient: "from-rose-500/30 via-pink-500/15 to-transparent" },
  // Texture looks
  clean: { icon: Sparkle, gradient: "from-sky-400/30 via-cyan-400/15 to-transparent" },
  painted: { icon: Brush, gradient: "from-rose-500/30 via-orange-500/15 to-transparent" },
  "toy-like": { icon: Smile, gradient: "from-pink-500/30 via-rose-500/15 to-transparent" },
  glossy: { icon: Sparkles, gradient: "from-cyan-400/30 via-blue-400/15 to-transparent" },
  matte: { icon: PaintBucket, gradient: "from-stone-500/30 via-zinc-500/15 to-transparent" },
  pixel: { icon: LayoutGrid, gradient: "from-emerald-500/30 via-teal-500/15 to-transparent" },
  "cel-shaded": { icon: Palette, gradient: "from-amber-500/30 via-orange-500/15 to-transparent" },
  worn: { icon: Flame, gradient: "from-orange-600/30 via-red-600/15 to-transparent" },
  // Animations
  idle: { icon: User, gradient: "from-sky-500/30 via-blue-500/15 to-transparent" },
  walk: { icon: Footprints, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
  run: { icon: ChevronsRight, gradient: "from-orange-500/30 via-amber-500/15 to-transparent" },
  attack: { icon: Swords, gradient: "from-red-500/30 via-rose-500/15 to-transparent" },
  emote: { icon: PartyPopper, gradient: "from-fuchsia-500/30 via-pink-500/15 to-transparent" },
  dance: { icon: Music, gradient: "from-violet-500/30 via-purple-500/15 to-transparent" },
  npc: { icon: Users, gradient: "from-cyan-500/30 via-sky-500/15 to-transparent" },
  jump: { icon: Wind, gradient: "from-sky-500/30 via-cyan-500/15 to-transparent" },
  // Animation styles
  snappy: { icon: Zap, gradient: "from-yellow-400/30 via-amber-500/15 to-transparent" },
  smooth: { icon: Spline, gradient: "from-cyan-400/30 via-blue-400/15 to-transparent" },
  cartoony: { icon: Smile, gradient: "from-pink-500/30 via-rose-500/15 to-transparent" },
  heroic: { icon: ShieldCheck, gradient: "from-amber-500/30 via-yellow-500/15 to-transparent" },
  scary: { icon: Skull, gradient: "from-red-500/30 via-rose-500/15 to-transparent" },
  robotic: { icon: Settings2, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  floaty: { icon: Feather, gradient: "from-sky-400/30 via-cyan-400/15 to-transparent" },
  // Easings
  sine: { icon: Spline, gradient: "from-cyan-400/30 via-sky-400/15 to-transparent" },
  quad: { icon: Square, gradient: "from-emerald-500/30 via-teal-500/15 to-transparent" },
  back: { icon: ChevronsRight, gradient: "from-fuchsia-500/30 via-pink-500/15 to-transparent" },
  elastic: { icon: Wind, gradient: "from-sky-400/30 via-blue-400/15 to-transparent" },
  linear: { icon: ChevronsRight, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  // Body focuses
  "full body": { icon: Accessibility, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
  "upper body": { icon: User, gradient: "from-sky-500/30 via-blue-500/15 to-transparent" },
  arms: { icon: Hand, gradient: "from-amber-500/30 via-orange-500/15 to-transparent" },
  legs: { icon: Footprints, gradient: "from-cyan-500/30 via-sky-500/15 to-transparent" },
  head: { icon: Smile, gradient: "from-pink-500/30 via-rose-500/15 to-transparent" },
  "tool hand": { icon: Wrench, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  "tail/pet": { icon: Rabbit, gradient: "from-fuchsia-500/30 via-pink-500/15 to-transparent" },
  // Quality
  turbo: { icon: Zap, gradient: "from-yellow-400/30 via-orange-500/15 to-transparent" },
  standard: { icon: Box, gradient: "from-emerald-500/30 via-teal-500/15 to-transparent" },
  detailed: { icon: Gem, gradient: "from-fuchsia-500/30 via-violet-500/15 to-transparent" },
  // Formats
  GLB: { icon: Box, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
  OBJ: { icon: Shapes, gradient: "from-orange-500/30 via-amber-500/15 to-transparent" },
  FBX: { icon: Bone, gradient: "from-sky-500/30 via-blue-500/15 to-transparent" },
  // Text fonts/effects/animations
  GothamBlack: { icon: Type, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  FredokaOne: { icon: Type, gradient: "from-pink-500/30 via-rose-500/15 to-transparent" },
  Bangers: { icon: Type, gradient: "from-amber-500/30 via-orange-500/15 to-transparent" },
  Cartoon: { icon: Type, gradient: "from-fuchsia-500/30 via-pink-500/15 to-transparent" },
  Arcade: { icon: Gamepad2, gradient: "from-emerald-500/30 via-cyan-500/15 to-transparent" },
  SciFi: { icon: Rocket, gradient: "from-cyan-500/30 via-blue-500/15 to-transparent" },
  outline: { icon: Square, gradient: "from-slate-400/30 via-zinc-500/15 to-transparent" },
  gold: { icon: Crown, gradient: "from-yellow-400/30 via-amber-500/15 to-transparent" },
  ice: { icon: Diamond, gradient: "from-cyan-400/30 via-sky-400/15 to-transparent" },
  shadow: { icon: Drama, gradient: "from-slate-500/30 via-zinc-600/15 to-transparent" },
  float: { icon: Feather, gradient: "from-sky-400/30 via-cyan-400/15 to-transparent" },
  pulse: { icon: Heart, gradient: "from-rose-500/30 via-pink-500/15 to-transparent" },
  spin: { icon: Settings2, gradient: "from-violet-500/30 via-purple-500/15 to-transparent" },
  bounce: { icon: Drumstick, gradient: "from-amber-500/30 via-orange-500/15 to-transparent" },
  none: { icon: Leaf, gradient: "from-emerald-500/30 via-green-500/15 to-transparent" },
};

const fallbackOption = { icon: Sparkles, gradient: "from-primary/30 via-primary/10 to-transparent" };

function VisualChips({
  value,
  set,
  items,
  compact = false,
}: {
  value: string;
  set: (v: string) => void;
  items: string[];
  images?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
      {items.map((item) => {
        const meta = OPTION_ICONS[item] ?? fallbackOption;
        const Icon = meta.icon;
        const active = value === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => set(item)}
            aria-pressed={active}
            className={`group relative overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.015] active:scale-[0.98] text-left cursor-pointer ${
              active
                ? "border-primary bg-primary/10 shadow-[0_0_20px_-6px_oklch(0.73_0.17_158_/_0.45)]"
                : "border-border/60 bg-background/40 hover:border-primary/40"
            }`}
          >
            <div className={`${compact ? "h-14" : "h-20"} relative flex items-center justify-between px-3`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-90`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.06),transparent_60%)]" />
              <span className={`relative z-10 truncate text-[11px] font-black tracking-wider uppercase ${active ? "text-foreground" : "text-foreground/90"}`}>
                {item}
              </span>
              <Icon className={`relative z-10 ${compact ? "h-6 w-6" : "h-8 w-8"} ${active ? "text-primary" : "text-foreground/80"} drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110`} strokeWidth={2.25} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/80 bg-background/25 px-3.5 py-2.5 text-xs font-bold hover:border-primary/30 transition duration-200 select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4.5 w-4.5 accent-emerald-500 rounded cursor-pointer" />
      {label}
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-bold flex flex-col gap-1.5 flex-1">
      <span className="text-[10px] tracking-wider uppercase text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border/80 bg-background/25 px-3.5 py-2.5 text-sm focus:border-primary/60 focus:outline-none transition duration-200 text-foreground"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs font-bold flex flex-col gap-1.5 flex-1">
      <span className="text-[10px] tracking-wider uppercase text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-border/80 bg-background/25 px-3.5 py-2.5 text-sm focus:border-primary/60 focus:outline-none transition duration-200 text-foreground"
      />
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-bold flex flex-col gap-1.5 flex-1">
      <span className="text-[10px] tracking-wider uppercase text-muted-foreground">{label}</span>
      <div className="relative h-11 w-full rounded-xl overflow-hidden border border-border/80 bg-background/25 transition focus-within:border-primary/60">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-16 w-full -translate-y-2 cursor-pointer border-0 p-0"
        />
      </div>
    </label>
  );
}
