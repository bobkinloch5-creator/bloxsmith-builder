import { useEffect, useState, useRef } from "react";
import { Loader2, Maximize2, Minimize2, RotateCw, RefreshCcw } from "lucide-react";

type Kind =
  | "classic_shirt"
  | "classic_pants"
  | "tshirt"
  | "layered_or_accessory"
  | "layered_top"
  | "layered_bottom"
  | "hat"
  | "hair"
  | "face"
  | "back"
  | "neck"
  | "waist";

/**
 * Client-only Roblox-style avatar preview of a generated clothing texture.
 * Renders an R6-style blocky humanoid with skin-toned head/arms (or legs for
 * pants) and the generated PNG mapped onto the clothed parts. The flat
 * downloadable PNG is unaffected — this is purely an in-browser preview.
 */
export function ClothingPreview3D({
  imageUrl,
  kind,
}: {
  imageUrl: string;
  kind: Kind;
}) {
  const [mod, setMod] = useState<null | {
    Canvas: any;
    OrbitControls: any;
    ContactShadows: any;
    Environment: any;
    THREE: any;
    useThree: any;
  }>(null);
  const [failed, setFailed] = useState(false);
  const [viewMode, setViewMode] = useState<"torso" | "full">("torso");
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetCounter, setResetCounter] = useState(0);
  const controlsRef = useRef<any>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      import("@react-three/fiber"),
      import("@react-three/drei"),
      import("three"),
    ])
      .then(([fiber, drei, three]) => {
        if (alive)
          setMod({
            Canvas: fiber.Canvas,
            OrbitControls: drei.OrbitControls,
            ContactShadows: drei.ContactShadows,
            Environment: drei.Environment,
            THREE: three,
            useThree: fiber.useThree,
          });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        3D preview couldn't load here — the downloadable PNG is unaffected.
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading 3D preview…
      </div>
    );
  }

  const { Canvas, OrbitControls, ContactShadows, THREE, useThree } = mod;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button,input,select,textarea,a")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    const controls = controlsRef.current;
    if (!controls) return;
    controls.rotateLeft(dx * 0.006);
    controls.rotateUp(dy * 0.006);
    controls.update();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  return (
    <div
      className="relative w-full h-full group/preview rounded-2xl overflow-hidden border border-border/40 cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        dragRef.current.active = false;
      }}
    >
      <Canvas
        camera={{ position: [0, 0.92, 2.6], fov: 32 }}
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true }}
        className="!h-full !w-full"
      >
        {/* Soft gradient backdrop */}
        <color attach="background" args={["#0b0d14"]} />
        <fog attach="fog" args={["#0b0d14", 8, 18]} />

        {/* Key / fill / rim lighting for a clean studio look */}
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 3, -2]} intensity={0.35} color="#7aa2ff" />
        <pointLight position={[0, 2, 5]} intensity={0.4} color="#a0e9ff" />

        <Avatar imageUrl={imageUrl} kind={kind} THREE={THREE} />

        <ContactShadows
          position={[0, -1.55, 0]}
          opacity={0.55}
          scale={6}
          blur={2.4}
          far={3}
          color="#000000"
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={false}
          enableZoom={true}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          minPolarAngle={Math.PI / 2.8}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={1.2}
          maxDistance={8.0}
          target={viewMode === "torso" ? [0, 0.92, 0] : [0, 0.4, 0]}
        />

        <CameraController
          viewMode={viewMode}
          resetCounter={resetCounter}
          controlsRef={controlsRef}
          useThreeHook={useThree}
        />
      </Canvas>

      {/* Floating control toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/80 hover:bg-background/95 backdrop-blur-md border border-border/60 rounded-full px-2 py-1 shadow-lg transition duration-200 pointer-events-auto">
        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === "torso" ? "full" : "torso")}
          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground hover:bg-muted/70 transition"
          title={viewMode === "torso" ? "Switch to Full Body view" : "Switch to Detail/Torso view"}
        >
          {viewMode === "torso" ? (
            <>
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Full View</span>
            </>
          ) : (
            <>
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Torso View</span>
            </>
          )}
        </button>

        <div className="h-4 w-[1px] bg-border/60 mx-1" />

        {/* Auto-rotate toggle */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-1.5 rounded-full hover:bg-muted/70 transition ${autoRotate ? "text-primary-glow bg-primary/10" : "text-muted-foreground"}`}
          title={autoRotate ? "Pause auto-rotation" : "Enable auto-rotation"}
        >
          <RotateCw className="h-4 w-4" />
        </button>

        {/* Reset Camera button */}
        <button
          onClick={() => setResetCounter(c => c + 1)}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition"
          title="Reset Camera View"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>
      
      {/* Scroll to Zoom Hint */}
      <div className="absolute top-3 right-3 text-[10px] font-medium text-muted-foreground/60 bg-background/30 backdrop-blur-sm border border-border/20 rounded-md px-2 py-0.5 pointer-events-none select-none">
        Scroll / Pinch to zoom
      </div>
    </div>
  );
}

function CameraController({
  viewMode,
  resetCounter,
  controlsRef,
  useThreeHook,
}: {
  viewMode: "torso" | "full";
  resetCounter: number;
  controlsRef: React.RefObject<any>;
  useThreeHook: any;
}) {
  const { camera } = useThreeHook();

  useEffect(() => {
    if (!camera) return;
    const isTorso = viewMode === "torso";
    const posY = isTorso ? 0.92 : 0.6;
    const posZ = isTorso ? 2.6 : 4.6;
    const targetY = isTorso ? 0.92 : 0.4;

    camera.position.set(0, posY, posZ);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, targetY, 0);
      controls.update();
    } else {
      camera.lookAt(0, targetY, 0);
    }
    camera.updateProjectionMatrix();
  }, [viewMode, resetCounter, camera, controlsRef]);

  return null;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TORSO_MAP: { [face: string]: Rect } = {
  right:  { x: 89,  y: 64, w: 64,  h: 128 },
  left:   { x: 281, y: 64, w: 64,  h: 128 },
  top:    { x: 153, y: 0,  w: 128, h: 64 },
  bottom: { x: 281, y: 0,  w: 128, h: 64 },
  front:  { x: 153, y: 64, w: 128, h: 128 },
  back:   { x: 345, y: 64, w: 128, h: 128 }
};

// For Right Arm (in shirt) or Right Leg (in pants)
const RIGHT_LIMB_MAP: { [face: string]: Rect } = {
  right:  { x: 89,  y: 264, w: 64, h: 128 }, // Outer Right
  front:  { x: 153, y: 264, w: 64, h: 128 },
  left:   { x: 217, y: 264, w: 64, h: 128 }, // Inner Left
  back:   { x: 281, y: 264, w: 64, h: 128 },
  top:    { x: 153, y: 200, w: 64, h: 64 },
  bottom: { x: 217, y: 200, w: 64, h: 64 }
};

// For Left Arm (in shirt) or Left Leg (in pants)
const LEFT_LIMB_MAP: { [face: string]: Rect } = {
  right:  { x: 329, y: 264, w: 64, h: 128 }, // Inner Right
  front:  { x: 393, y: 264, w: 64, h: 128 },
  left:   { x: 457, y: 264, w: 64, h: 128 }, // Outer Left
  back:   { x: 521, y: 264, w: 64, h: 128 },
  top:    { x: 393, y: 200, w: 64, h: 64 },
  bottom: { x: 457, y: 200, w: 64, h: 64 }
};

const SKIN = "#f0c89a";
const HAIR = "#1f1410";
const DEFAULT_PANTS = "#2b313d";
const DEFAULT_SHIRT = "#3a4150";

function createRobloxFaceTexture(THREE: any) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Fill skin color background
    ctx.fillStyle = SKIN;
    ctx.fillRect(0, 0, 256, 256);

    // Draw classic Roblox smile:
    ctx.fillStyle = "#15171c";
    
    // Left eye (oval)
    ctx.beginPath();
    ctx.ellipse(90, 100, 12, 20, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Right eye (oval)
    ctx.beginPath();
    ctx.ellipse(166, 100, 12, 20, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Mouth smile curve
    ctx.strokeStyle = "#15171c";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(128, 140, 45, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function useSlicedTextures(imageUrl: string, kind: Kind, THREE: any) {
  const [textures, setTextures] = useState<any>(null);

  useEffect(() => {
    if (!THREE || !imageUrl) return;

    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      if (!alive) return;

      const createFaceTexture = (rect: Rect) => {
        const canvas = document.createElement("canvas");
        canvas.width = rect.w;
        canvas.height = rect.h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
      };

      try {
        if (kind === "classic_shirt" || kind === "classic_pants") {
          // Slice Torso
          const torso = [
            createFaceTexture(TORSO_MAP.right),  // +x
            createFaceTexture(TORSO_MAP.left),   // -x
            createFaceTexture(TORSO_MAP.top),    // +y
            createFaceTexture(TORSO_MAP.bottom), // -y
            createFaceTexture(TORSO_MAP.front),  // +z
            createFaceTexture(TORSO_MAP.back),   // -z
          ];

          // Slice Right Limb
          const rightLimb = [
            createFaceTexture(RIGHT_LIMB_MAP.right),
            createFaceTexture(RIGHT_LIMB_MAP.left),
            createFaceTexture(RIGHT_LIMB_MAP.top),
            createFaceTexture(RIGHT_LIMB_MAP.bottom),
            createFaceTexture(RIGHT_LIMB_MAP.front),
            createFaceTexture(RIGHT_LIMB_MAP.back),
          ];

          // Slice Left Limb
          const leftLimb = [
            createFaceTexture(LEFT_LIMB_MAP.right),
            createFaceTexture(LEFT_LIMB_MAP.left),
            createFaceTexture(LEFT_LIMB_MAP.top),
            createFaceTexture(LEFT_LIMB_MAP.bottom),
            createFaceTexture(LEFT_LIMB_MAP.front),
            createFaceTexture(LEFT_LIMB_MAP.back),
          ];

          setTextures({
            torso,
            rightLimb,
            leftLimb,
            single: null,
          });
        } else {
          // For tshirt or layered/accessory, we just load the single texture
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin("anonymous");
          loader.load(imageUrl, (t: any) => {
            if (!alive) return;
            t.colorSpace = THREE.SRGBColorSpace;
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            setTextures({
              torso: null,
              rightLimb: null,
              leftLimb: null,
              single: t,
            });
          });
        }
      } catch (err) {
        console.error("Error slicing textures:", err);
      }
    };

    return () => {
      alive = false;
    };
  }, [imageUrl, kind, THREE]);

  return textures;
}

function Avatar({
  imageUrl,
  kind,
  THREE,
}: {
  imageUrl: string;
  kind: Kind;
  THREE: any;
}) {
  const sliced = useSlicedTextures(imageUrl, kind, THREE);

  const isLayeredTop = kind === "layered_top" || kind === "layered_or_accessory";
  const isLayeredBottom = kind === "layered_bottom";
  const isAccessory = ["hat", "hair", "face", "back", "neck", "waist"].includes(kind);
  const isPants = kind === "classic_pants" || isLayeredBottom;
  const isShirtLike = !isPants && !isAccessory;
  const garmentColor = isLayeredTop ? "#2b1748" : DEFAULT_SHIRT;
  const trimColor = isLayeredTop ? "#8b5cf6" : "#111827";

  // Materials arrays
  // For Head: Face on front, skin on others
  const headMaterials = THREE ? [
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 }), // +x
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 }), // -x
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 }), // +y
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 }), // -y
    new THREE.MeshStandardMaterial({ map: createRobloxFaceTexture(THREE), roughness: 0.85 }), // +z (Face)
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 }), // -z
  ] : null;

  // For Torso:
  let torsoMaterials: any[] | null = null;
  if (THREE) {
    if (sliced) {
      if (sliced.torso) {
        torsoMaterials = sliced.torso.map(
          (tex: any) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.02 })
        );
      } else if (sliced.single && (kind === "tshirt" || isLayeredTop)) {
        // T-shirts stay as a decal; layered tops get the art on a raised garment panel.
        torsoMaterials = [
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.75 }),
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.75 }),
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.75 }),
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.75 }),
          new THREE.MeshStandardMaterial({ map: sliced.single, transparent: true, roughness: 0.75 }), // Front
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.75 }),
        ];
      } else if (isLayeredBottom) {
        torsoMaterials = Array(6).fill(
          new THREE.MeshStandardMaterial({ color: "#202634", roughness: 0.75 })
        );
      }
    }
    if (!torsoMaterials) {
      torsoMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: isPants ? DEFAULT_PANTS : garmentColor, roughness: 0.75 })
      );
    }
  }

  // For Right Arm:
  let rightArmMaterials: any[] | null = null;
  if (THREE) {
    if (sliced && sliced.rightLimb && isShirtLike && !isLayeredTop) {
      rightArmMaterials = sliced.rightLimb.map(
        (tex: any) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })
      );
    } else if (isLayeredTop) {
      rightArmMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.78 })
      );
    } else {
      rightArmMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 })
      );
    }
  }

  // For Left Arm:
  let leftArmMaterials: any[] | null = null;
  if (THREE) {
    if (sliced && sliced.leftLimb && isShirtLike && !isLayeredTop) {
      leftArmMaterials = sliced.leftLimb.map(
        (tex: any) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })
      );
    } else if (isLayeredTop) {
      leftArmMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.78 })
      );
    } else {
      leftArmMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 })
      );
    }
  }

  // For Right Leg:
  let rightLegMaterials: any[] | null = null;
  if (THREE) {
    if (sliced && sliced.rightLimb && isPants && !isLayeredBottom) {
      rightLegMaterials = sliced.rightLimb.map(
        (tex: any) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
      );
    } else if (sliced?.single && isLayeredBottom) {
      rightLegMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ map: sliced.single, roughness: 0.82 })
      );
    } else {
      rightLegMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: DEFAULT_PANTS, roughness: 0.8 })
      );
    }
  }

  // For Left Leg:
  let leftLegMaterials: any[] | null = null;
  if (THREE) {
    if (sliced && sliced.leftLimb && isPants && !isLayeredBottom) {
      leftLegMaterials = sliced.leftLimb.map(
        (tex: any) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
      );
    } else if (sliced?.single && isLayeredBottom) {
      leftLegMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ map: sliced.single, roughness: 0.82 })
      );
    } else {
      leftLegMaterials = Array(6).fill(
        new THREE.MeshStandardMaterial({ color: DEFAULT_PANTS, roughness: 0.8 })
      );
    }
  }

  return (
    <group position={[0, -0.25, 0]}>
      {/* Hair cap */}
      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[0.7, 0.18, 0.7]} />
        <meshStandardMaterial color={HAIR} roughness={0.7} />
      </mesh>

      {/* Head */}
      {headMaterials ? (
        <mesh position={[0, 1.78, 0]} material={headMaterials} castShadow>
          <boxGeometry args={[0.66, 0.66, 0.66]} />
        </mesh>
      ) : (
        <mesh position={[0, 1.78, 0]} castShadow>
          <boxGeometry args={[0.66, 0.66, 0.66]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
      )}

      {/* Torso */}
      {torsoMaterials ? (
        <mesh position={[0, 0.92, 0]} material={torsoMaterials} castShadow receiveShadow>
          <boxGeometry args={isLayeredTop ? [1.08, 1.18, 0.62] : [1.0, 1.1, 0.55]} />
        </mesh>
      ) : (
        <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 1.1, 0.55]} />
          <meshStandardMaterial color={isPants ? DEFAULT_PANTS : DEFAULT_SHIRT} roughness={0.75} />
        </mesh>
      )}

      {isLayeredTop && (
        <>
          <mesh position={[0, 1.42, -0.27]} castShadow>
            <boxGeometry args={[0.82, 0.46, 0.28]} />
            <meshStandardMaterial color={garmentColor} roughness={0.82} />
          </mesh>
          <mesh position={[0, 1.19, 0.33]} castShadow>
            <boxGeometry args={[0.34, 0.12, 0.035]} />
            <meshStandardMaterial color={trimColor} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.56, 0.33]} castShadow>
            <boxGeometry args={[0.48, 0.22, 0.04]} />
            <meshStandardMaterial color="#161123" roughness={0.8} />
          </mesh>
          {[-0.72, 0.72].map((x) => (
            <mesh key={`cuff${x}`} position={[x, 0.27, 0]} castShadow>
              <boxGeometry args={[0.42, 0.12, 0.44]} />
              <meshStandardMaterial color={trimColor} roughness={0.72} />
            </mesh>
          ))}
        </>
      )}

      {/* Right Arm */}
      {rightArmMaterials ? (
        <mesh position={[-0.72, 0.92, 0]} material={rightArmMaterials} castShadow>
          <boxGeometry args={[0.36, 1.1, 0.4]} />
        </mesh>
      ) : (
        <mesh position={[-0.72, 0.92, 0]} castShadow>
          <boxGeometry args={[0.36, 1.1, 0.4]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
      )}

      {/* Left Arm */}
      {leftArmMaterials ? (
        <mesh position={[0.72, 0.92, 0]} material={leftArmMaterials} castShadow>
          <boxGeometry args={[0.36, 1.1, 0.4]} />
        </mesh>
      ) : (
        <mesh position={[0.72, 0.92, 0]} castShadow>
          <boxGeometry args={[0.36, 1.1, 0.4]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
      )}

      {/* Hands */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={`h${x}`} position={[x, 0.27, 0]} castShadow>
          <boxGeometry args={[0.36, 0.18, 0.4]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
      ))}

      {/* Right Leg */}
      {rightLegMaterials ? (
        <mesh position={[-0.26, -0.3, 0]} material={rightLegMaterials} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.3, 0.5]} />
        </mesh>
      ) : (
        <mesh position={[-0.26, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.3, 0.5]} />
          <meshStandardMaterial color={DEFAULT_PANTS} roughness={0.8} />
        </mesh>
      )}

      {/* Left Leg */}
      {leftLegMaterials ? (
        <mesh position={[0.26, -0.3, 0]} material={leftLegMaterials} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.3, 0.5]} />
        </mesh>
      ) : (
        <mesh position={[0.26, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.3, 0.5]} />
          <meshStandardMaterial color={DEFAULT_PANTS} roughness={0.8} />
        </mesh>
      )}

      {/* Shoes */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={`s${x}`} position={[x, -1.05, 0.03]} castShadow>
          <boxGeometry args={[0.5, 0.22, 0.58]} />
          <meshStandardMaterial color="#15171c" roughness={0.6} />
        </mesh>
      ))}

      {isAccessory && <AccessoryPreview kind={kind} texture={sliced?.single} THREE={THREE} />}
    </group>
  );
}

function AccessoryPreview({ kind, texture, THREE }: { kind: Kind; texture: any; THREE: any }) {
  const mapped = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72, metalness: 0.02 })
    : new THREE.MeshStandardMaterial({ color: "#7c3cff", roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.76 });
  const gold = new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.55, metalness: 0.08 });

  if (kind === "hat" || kind === "hair") {
    return (
      <group>
        <mesh position={[0, 2.38, 0]} material={mapped} castShadow>
          <boxGeometry args={[0.88, 0.22, 0.82]} />
        </mesh>
        <mesh position={[0, 2.53, -0.02]} material={kind === "hat" ? gold : mapped} castShadow>
          <boxGeometry args={[0.58, 0.24, 0.58]} />
        </mesh>
      </group>
    );
  }
  if (kind === "face") {
    return (
      <group>
        <mesh position={[0, 1.86, 0.35]} material={mapped} castShadow>
          <boxGeometry args={[0.62, 0.16, 0.045]} />
        </mesh>
        <mesh position={[0, 1.86, 0.39]} material={dark} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.03]} />
        </mesh>
      </group>
    );
  }
  if (kind === "back") {
    return (
      <group>
        <mesh position={[-0.64, 1.0, -0.42]} rotation={[0, 0, -0.42]} material={mapped} castShadow>
          <boxGeometry args={[0.28, 1.28, 0.08]} />
        </mesh>
        <mesh position={[0.64, 1.0, -0.42]} rotation={[0, 0, 0.42]} material={mapped} castShadow>
          <boxGeometry args={[0.28, 1.28, 0.08]} />
        </mesh>
      </group>
    );
  }
  if (kind === "neck") {
    return (
      <mesh position={[0, 1.37, 0.18]} material={mapped} castShadow>
        <boxGeometry args={[0.78, 0.14, 0.12]} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0.22, 0.31]} material={mapped} castShadow>
      <boxGeometry args={[1.1, 0.18, 0.09]} />
    </mesh>
  );
}
