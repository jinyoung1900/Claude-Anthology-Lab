'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { DogProfile, HumanAvatar } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { currentSeason, type Season } from '@/lib/trinkets';
import ErrorBoundary from '../ErrorBoundary';
import { Dog3D, type DogAnim } from './Dog3D';
import { Human3D } from './Human3D';
import { Trinket } from './Trinket';
import { Ground, SCENES, Scenery, type SceneId } from './Scenery';
import { FetchDog, type ThrowRequest, type ToyKind } from './Fetch';

/** Drag-to-spin wrapper (no drei, just pointer deltas). */
function Spinner({ children, dragRef, auto }: { children: ReactNode; dragRef: React.MutableRefObject<number>; auto?: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current) return;
    if (auto) dragRef.current += dt * 0.4;
    g.current.rotation.y += (dragRef.current - g.current.rotation.y) * 0.15;
  });
  return <group ref={g}>{children}</group>;
}

function Shadow({ x, r }: { x: number; r: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
      <circleGeometry args={[r, 16]} />
      <meshBasicMaterial color="#000" transparent opacity={0.18} />
    </mesh>
  );
}

const WEATHER: Record<Season, { colors: string[]; size: number; fall: number; sway: number; blink?: boolean }> = {
  winter: { colors: ['#ffffff', '#EAF4FF'], size: 0.07, fall: 0.35, sway: 0.25 },
  spring: { colors: ['#FFC0D6', '#FFE0EC', '#F7A1C4'], size: 0.07, fall: 0.25, sway: 0.5 },
  summer: { colors: ['#FFF59A', '#E9FF8A'], size: 0.06, fall: -0.02, sway: 0.3, blink: true },
  autumn: { colors: ['#E0702E', '#C9442B', '#F2B33D', '#A8552A'], size: 0.08, fall: 0.3, sway: 0.6 },
};

/** Seasonal particles: snow, cherry petals, fireflies, or falling leaves. */
function Weather({ season }: { season: Season }) {
  const N = 70;
  const cfg = WEATHER[season];
  const ref = useRef<THREE.Points>(null);
  const { geo, seeds } = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 1] = Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      c.set(cfg.colors[i % cfg.colors.length]);
      col.set([c.r, c.g, c.b], i * 3);
      seeds[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geo, seeds };
  }, [cfg]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }, dt) => {
    const a = geo.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      let y = a.getY(i) - cfg.fall * dt * (0.6 + (seeds[i] % 1));
      if (y < 0) y = 3.5;
      if (y > 3.6) y = 0.1;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t * 0.8 + seeds[i]) * cfg.sway * dt);
    }
    a.needsUpdate = true;
    if (cfg.blink && ref.current) (ref.current.material as THREE.PointsMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.35;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={cfg.size} vertexColors transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

export interface AvatarSceneProps {
  dog?: DogProfile | null;
  human?: HumanAvatar | null;
  anim?: DogAnim;
  onDogTap?: () => void;
  /** fires every ~90px of rubbing on the dog (drag that starts on the dog) */
  onPet?: () => void;
  /** Camera framing */
  framing?: 'duo' | 'dog' | 'human';
  className?: string;
  autoSpin?: boolean;
  initialYaw?: number;
  transparent?: boolean;
  /** internal resolution scale; defaults to true-PS1 low-res (0.35) for retro dogs, crisp otherwise */
  pixelScale?: number;
  /** keep the WebGL buffer readable so the canvas can be captured (share card) */
  preserveBuffer?: boolean;
  /** seasonal particles (leaves / snow / petals / fireflies) */
  weather?: boolean;
  /** background set (default: park) */
  scene?: SceneId;
  /** throw a ball / frisbee for the dog to fetch */
  throwReq?: ThrowRequest | null;
  onFetched?: () => void;
  /** a toy held in the hand: drag to aim, let go to throw (onRelease gets the swipe) */
  heldToy?: ToyKind | null;
  onRelease?: (swipe: { vx: number; vy: number }) => void;
}

let heartId = 0;

export default function AvatarScene({
  dog,
  human,
  anim = 'idle',
  onDogTap,
  onPet,
  framing = 'duo',
  className = '',
  autoSpin = false,
  initialYaw = 0.45,
  transparent = false,
  pixelScale,
  preserveBuffer = false,
  weather = false,
  scene = 'park',
  throwReq = null,
  onFetched,
  heldToy = null,
  onRelease,
}: AvatarSceneProps) {
  const aim = useRef({ x: 0, y: -0.55 });
  const aiming = useRef<{ x: number; y: number; t: number }[] | null>(null);
  const toNdc = (cx: number, cy: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    aim.current = { x: ((cx - r.left) / r.width) * 2 - 1, y: -(((cy - r.top) / r.height) * 2 - 1) };
  };
  const [fetchAnim, setFetchAnim] = useState<DogAnim | null>(null);
  const S = SCENES[scene];
  const season: Season = S.weather === 'season' || S.weather === 'none' ? currentSeason() : S.weather;
  const { settings } = useStore();
  const { t } = useT();
  const calm = settings.reduceMotion;
  const drag = useRef(initialYaw);
  const last = useRef<number | null>(null);
  const petting = useRef(false);
  const rubbed = useRef(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  // Pixel dogs (and their voxel owner) render low-res with crisp square pixels
  const retro = dog?.model === 'pixel';
  // pixel: chunky low-res; others: crisp on high-density phone screens
  const dpr: number | [number, number] = pixelScale ?? (retro ? 0.6 : [1, 2]);
  const effAnim: DogAnim = calm && anim === 'happy' ? 'idle' : anim;

  const cam =
    framing === 'dog'
      ? { position: [1.8, 1.2, 2.7] as [number, number, number], target: [0, 0.5, 0] }
      : framing === 'human'
        ? { position: [1.4, 1.5, 2.6] as [number, number, number], target: [0, 0.9, 0] }
        : { position: [2.2, 1.6, 3.6] as [number, number, number], target: [0, 0.6, 0] };

  const showDog = dog && framing !== 'human';
  const showHuman = human && framing !== 'dog';
  const duo = showDog && showHuman;

  const addHeart = (clientX: number, clientY: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const id = ++heartId;
    setHearts((h) => [...h.slice(-8), { id, x: clientX - r.left, y: clientY - r.top }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1100);
  };

  const endDrag = () => {
    last.current = null;
    petting.current = false;
  };

  return (
    <div
      ref={wrap}
      className={`relative touch-none select-none overflow-hidden ${className}`}
      onPointerDown={(e) => {
        if (heldToy) {
          toNdc(e.clientX, e.clientY);
          aiming.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
          return;
        }
        last.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (heldToy) {
          if (!aiming.current) return;
          toNdc(e.clientX, e.clientY);
          aiming.current.push({ x: e.clientX, y: e.clientY, t: performance.now() });
          if (aiming.current.length > 12) aiming.current.shift();
          return;
        }
        if (last.current === null) return;
        const dx = e.clientX - last.current;
        last.current = e.clientX;
        if (petting.current) {
          rubbed.current += Math.abs(dx) + Math.abs(e.movementY || 0);
          if (rubbed.current > 90) {
            rubbed.current = 0;
            addHeart(e.clientX, e.clientY);
            onPet?.();
          }
          return;
        }
        drag.current += dx * 0.012;
      }}
      onPointerUp={(e) => {
        if (heldToy && aiming.current) {
          // swipe speed over the last ~90 ms
          const now = performance.now();
          const pts = aiming.current.filter((p) => now - p.t < 90);
          const a = pts[0] ?? { x: e.clientX, y: e.clientY, t: now - 1 };
          const dt = Math.max(16, now - a.t) / 1000;
          aiming.current = null;
          onRelease?.({ vx: (e.clientX - a.x) / dt, vy: (e.clientY - a.y) / dt });
          return;
        }
        endDrag();
      }}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      <ErrorBoundary
        fallback={(retry) => (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-sky/60 p-4 text-center text-sm font-bold text-bark">
            <span className="text-3xl">🐕</span>
            {t('err.scene')}
            <button className="chip bg-white" onClick={retry}>
              {t('err.retry')}
            </button>
          </div>
        )}
      >
        <Canvas
          resize={{ offsetSize: true }}
          dpr={dpr}
          gl={{ antialias: !retro, alpha: transparent, preserveDrawingBuffer: preserveBuffer || retro }}
          style={{ imageRendering: retro ? 'pixelated' : 'auto' }}
          camera={{ position: cam.position, fov: 40 }}
          onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
        >
          {!transparent && <color attach="background" args={[S.sky]} />}
          {!transparent && <fog attach="fog" args={[S.sky, S.fog[0], S.fog[1]]} />}
          <hemisphereLight args={S.hemi} />
          <directionalLight position={[3, 5, 4]} intensity={scene === 'home' ? 1.1 : 1.6} />
          {!transparent && <Ground scene={scene} moving={effAnim === 'walk'} />}
          {!transparent && <Scenery scene={scene} />}
          {weather && !calm && !transparent && S.weather !== 'none' && <Weather season={season} />}
          <Spinner dragRef={drag} auto={autoSpin && !calm}>
            {showHuman && (
              <>
                <Shadow x={duo ? -0.5 : 0} r={0.3} />
                <Human3D human={human!} voxel={retro} anim={effAnim === 'sleepy' ? 'idle' : effAnim} position={[duo ? -0.5 : 0, 0, 0]} />
              </>
            )}
            {showDog && (
              <FetchDog dog={dog!} request={throwReq} held={heldToy} aimRef={aim} home={[duo ? 0.5 : 0, 0, duo ? 0.1 : 0]} scale={duo ? 0.8 : 1} onAnim={setFetchAnim} onFetched={onFetched}>
                <Shadow x={0} r={duo ? 0.36 : 0.45} />
                <Dog3D
                  dog={dog!}
                  anim={fetchAnim ?? effAnim}
                  onTap={heldToy ? undefined : onDogTap}
                  onPetStart={
                    onPet
                      ? () => {
                          petting.current = true;
                          rubbed.current = 0;
                        }
                      : undefined
                  }
                  scale={duo ? 0.8 : 1}
                />
              </FetchDog>
            )}
          </Spinner>
        </Canvas>
      </ErrorBoundary>
      {hearts.map((h) => (
        <span key={h.id} className="pointer-events-none absolute animate-heart text-2xl" style={{ left: h.x - 12, top: h.y - 24 }}>
          💖
        </span>
      ))}
    </div>
  );
}

/** Tiny spinning preview of a single trinket (used in roulette). */
export function TrinketPreview({ id, className = '' }: { id: string; className?: string }) {
  return (
    <div className={className}>
      <Canvas resize={{ offsetSize: true }} dpr={1} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0.6, 2.2], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}>
        <hemisphereLight args={['#ffffff', '#c9a27a', 1.6]} />
        <directionalLight position={[2, 3, 3]} intensity={1.4} />
        <AutoSpin>
          <Trinket id={id} />
        </AutoSpin>
      </Canvas>
    </div>
  );
}

function AutoSpin({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 1.2;
  });
  return <group ref={g}>{children}</group>;
}
