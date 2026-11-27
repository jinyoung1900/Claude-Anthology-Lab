'use client';

/**
 * Backgrounds for the dog's scene: park, home, snow, river, beach and autumn.
 * Everything is a handful of low-poly primitives. Scenery lives outside the drag-spin group,
 * so "behind the dog" is fixed: the whole set is turned so its local -z points away from the
 * camera, and rivers / the sea / walls sit back there. Props stay at least ~2.6 from the centre,
 * which keeps the fetch play area (radius 1.6) clear.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Season } from '@/lib/trinkets';

export type SceneId = 'park' | 'home' | 'snow' | 'river' | 'beach' | 'autumn';
export const SCENE_IDS: SceneId[] = ['park', 'home', 'snow', 'river', 'beach', 'autumn'];
export const SCENE_ICON: Record<SceneId, string> = { park: '🌳', home: '🏠', snow: '❄️', river: '🏞️', beach: '🏖️', autumn: '🍂' };

interface SceneCfg {
  sky: string;
  fog: [number, number];
  /** ground checker colours and sprinkled detail colours */
  ground: [string, string];
  speckle?: string[];
  hemi: [string, string, number];
  /** particles: a season's, none, or the current season */
  weather: Season | 'none' | 'season';
}

export const SCENES: Record<SceneId, SceneCfg> = {
  park: { sky: '#BFE3F2', fog: [8, 22], ground: ['#6CAA64', '#78B66E'], hemi: ['#ffffff', '#6BA368', 1.4], weather: 'season' },
  home: { sky: '#F3E3CF', fog: [9, 30], ground: ['#C89464', '#BE8858'], hemi: ['#fff6ea', '#b98a5e', 1.5], weather: 'none' },
  snow: { sky: '#DCEAF4', fog: [7, 20], ground: ['#F4F8FC', '#E6EEF6'], speckle: ['#D5E2EE'], hemi: ['#ffffff', '#c9d8e6', 1.5], weather: 'winter' },
  river: { sky: '#C4E6F2', fog: [8, 22], ground: ['#74B068', '#82BC72'], speckle: ['#F2E27A', '#ffffff'], hemi: ['#ffffff', '#6BA368', 1.4], weather: 'season' },
  beach: { sky: '#BDEBFA', fog: [9, 26], ground: ['#F1DDA8', '#EAD39A'], speckle: ['#F7EAC6', '#D9C08A'], hemi: ['#ffffff', '#e8cf9a', 1.5], weather: 'none' },
  autumn: { sky: '#F2DCC0', fog: [7, 20], ground: ['#9C9A56', '#A8A35E'], speckle: ['#E0702E', '#C9442B', '#F2B33D', '#A8552A'], hemi: ['#fff2e0', '#a8925a', 1.4], weather: 'autumn' },
};

/** checkered pixel ground, optionally sprinkled with leaves / flowers / shells */
export function Ground({ scene, moving }: { scene: SceneId; moving: boolean }) {
  const cfg = SCENES[scene];
  const tex = useMemo(() => {
    const N = scene === 'home' ? 32 : 16;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    const a = new THREE.Color(cfg.ground[0]), b = new THREE.Color(cfg.ground[1]);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        // home: wooden planks; outdoors: soft checker
        const chk = scene === 'home' ? Math.floor(y / 4) % 2 : (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
        const col = (chk ? a : b).clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
        if (scene === 'home' && ((x + Math.floor(y / 4) * 11) % 16 === 0 || y % 4 === 0)) col.offsetHSL(0, 0, -0.06);
        if (cfg.speckle && Math.random() < (scene === 'autumn' ? 0.16 : 0.05)) col.set(cfg.speckle[Math.floor(Math.random() * cfg.speckle.length)]);
        ctx.fillStyle = `#${col.getHexString()}`;
        ctx.fillRect(x, y, 1, 1);
      }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(scene === 'home' ? 8 : 20, scene === 'home' ? 8 : 20);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [scene, cfg]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((_, dt) => {
    if (moving) tex.offset.y += dt * 0.35;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[30, 24]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  );
}

const L = ({ c, e = 0, o }: { c: string; e?: number; o?: number }) => (
  <meshLambertMaterial color={c} flatShading emissive={c} emissiveIntensity={e} transparent={o !== undefined} opacity={o ?? 1} />
);

/** deterministic pseudo-random so props don't jump around between renders */
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function RoundTree({ p, s = 1, leaf = '#5E9E57', trunk = '#8A5A3A' }: { p: [number, number]; s?: number; leaf?: string; trunk?: string }) {
  return (
    <group position={[p[0], 0, p[1]]} scale={s}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.9, 6]} />
        <L c={trunk} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <icosahedronGeometry args={[0.6, 0]} />
        <L c={leaf} />
      </mesh>
      <mesh position={[0.28, 0.95, 0.12]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <L c={leaf} />
      </mesh>
    </group>
  );
}

function Pine({ p, s = 1, snow = false }: { p: [number, number]; s?: number; snow?: boolean }) {
  return (
    <group position={[p[0], 0, p[1]]} scale={s}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.4, 5]} />
        <L c="#7A5034" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <mesh position={[0, 0.55 + i * 0.38, 0]}>
            <coneGeometry args={[0.55 - i * 0.14, 0.6, 7]} />
            <L c="#3F7A4E" />
          </mesh>
          {snow && (
            <mesh position={[0, 0.7 + i * 0.38, 0]}>
              <coneGeometry args={[0.34 - i * 0.09, 0.3, 7]} />
              <L c="#FFFFFF" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function Bush({ p, c = '#5E9E57', s = 1 }: { p: [number, number]; c?: string; s?: number }) {
  return (
    <mesh position={[p[0], 0.15 * s, p[1]]} scale={[s, s * 0.75, s]}>
      <icosahedronGeometry args={[0.3, 0]} />
      <L c={c} />
    </mesh>
  );
}

/** places n props in a back arc (local -z side), radius r0..r1 */
function arc(n: number, r0: number, r1: number, seed: number, spread = 2.4): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / (n - 1 || 1) - 0.5) * spread * 2 + (rnd(seed + i) - 0.5) * 0.3;
    const r = r0 + rnd(seed + i * 7) * (r1 - r0);
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

function Water({ z0, z1, color, foam }: { z0: number; z1: number; color: string; foam?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const foamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) (ref.current.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.12 + Math.sin(t * 1.6) * 0.05;
    if (foamRef.current) foamRef.current.position.z = z1 + 0.05 + Math.sin(t * 1.2) * 0.12;
  });
  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, (z0 + z1) / 2]}>
        <planeGeometry args={[40, Math.abs(z1 - z0)]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      {foam && (
        <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z1]}>
          <planeGeometry args={[40, 0.18]} />
          <meshLambertMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

function Room() {
  return (
    <group>
      {/* walls (inside of a box) */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[9, 4.2, 9]} />
        <meshLambertMaterial color="#F6E9D6" side={THREE.BackSide} />
      </mesh>
      {/* skirting */}
      <mesh position={[0, 0.08, -4.45]}>
        <boxGeometry args={[9, 0.16, 0.06]} />
        <L c="#E2CBAE" />
      </mesh>
      {/* window with sky */}
      <group position={[-1.2, 1.9, -4.46]}>
        <mesh>
          <boxGeometry args={[1.7, 1.25, 0.06]} />
          <L c="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[1.5, 1.05]} />
          <meshBasicMaterial color="#BFE3F2" />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.05, 1.05, 0.02]} />
          <L c="#FFFFFF" />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[1.5, 0.05, 0.02]} />
          <L c="#FFFFFF" />
        </mesh>
      </group>
      {/* couch */}
      <group position={[1.6, 0, -3.6]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[2.2, 0.4, 0.9]} />
          <L c="#E0607E" />
        </mesh>
        <mesh position={[0, 0.7, -0.35]}>
          <boxGeometry args={[2.2, 0.6, 0.25]} />
          <L c="#D4506F" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.05, 0.55, 0]}>
            <boxGeometry args={[0.25, 0.5, 0.9]} />
            <L c="#D4506F" />
          </mesh>
        ))}
        <mesh position={[-0.5, 0.6, 0.05]} rotation={[0, 0.2, 0.15]}>
          <boxGeometry args={[0.45, 0.35, 0.15]} />
          <L c="#F2C14E" />
        </mesh>
      </group>
      {/* round rug under the dog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[1.25, 24]} />
        <L c="#7FB3D5" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[1.0, 1.1, 24]} />
        <L c="#FFFFFF" />
      </mesh>
      {/* plant + lamp */}
      <group position={[-3.4, 0, -3.3]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.22, 0.17, 0.5, 8]} />
          <L c="#C9773B" />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.16, 0.75 + (i % 2) * 0.15, Math.sin(i * 1.3) * 0.16]} rotation={[Math.cos(i) * 0.5, 0, Math.sin(i) * 0.5]}>
            <coneGeometry args={[0.12, 0.6, 4]} />
            <L c="#4F8A4A" />
          </mesh>
        ))}
      </group>
      <group position={[3.3, 0, -1.6]}>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
          <L c="#5B3A29" />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <coneGeometry args={[0.32, 0.4, 8, 1, true]} />
          <L c="#FFE8B0" e={0.5} />
        </mesh>
      </group>
      {/* a dog bed */}
      <group position={[-2.2, 0, -1.9]}>
        <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.13, 6, 14]} />
          <L c="#A55EEA" />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.08, 14]} />
          <L c="#F4E3CF" />
        </mesh>
      </group>
    </group>
  );
}

/** the props of one scene (ground and sky are separate) */
export function Scenery({ scene }: { scene: SceneId }) {
  const content = useMemo(() => {
    switch (scene) {
      case 'park':
        return (
          <>
            {arc(7, 5.5, 8.5, 1).map((p, i) => <RoundTree key={i} p={p} s={0.9 + rnd(i) * 0.5} />)}
            {arc(6, 3.4, 4.2, 20, 2.0).map((p, i) => <Bush key={i} p={p} s={0.8 + rnd(i + 3) * 0.6} />)}
          </>
        );
      case 'home':
        return <Room />;
      case 'snow':
        return (
          <>
            {arc(11, 3.2, 7.5, 40, 2.8).map((p, i) => <Pine key={i} p={p} s={0.9 + rnd(i + 5) * 0.8} snow />)}
            {arc(5, 2.7, 3.2, 60, 2.2).map((p, i) => <Bush key={i} p={p} c="#FFFFFF" s={0.7 + rnd(i) * 0.5} />)}
            {/* a little snowman */}
            <group position={[2.3, 0, -2.0]}>
              {[0.28, 0.2, 0.14].map((r, i) => (
                <mesh key={i} position={[0, [0.26, 0.66, 0.95][i], 0]}>
                  <icosahedronGeometry args={[r, 1]} />
                  <L c="#FFFFFF" />
                </mesh>
              ))}
              <mesh position={[0, 0.95, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.03, 0.14, 5]} />
                <L c="#F08A24" />
              </mesh>
            </group>
          </>
        );
      case 'river':
        return (
          <>
            <Water z0={-2.7} z1={-4.1} color="#5BB4E0" />
            {/* banks of stones */}
            {Array.from({ length: 16 }, (_, i) => (
              <mesh key={i} position={[(i - 8) * 0.7 + rnd(i) * 0.3, 0.05, -2.65 - rnd(i + 9) * 0.1]} scale={[1, 0.6, 0.8]}>
                <icosahedronGeometry args={[0.1 + rnd(i + 2) * 0.08, 0]} />
                <L c={i % 3 ? '#A7A8A2' : '#8E8F89'} />
              </mesh>
            ))}
            {/* reeds */}
            {Array.from({ length: 10 }, (_, i) => (
              <mesh key={i} position={[(i - 5) * 1.1 + rnd(i + 30), 0.22, -2.5 + rnd(i + 31) * 0.15]}>
                <cylinderGeometry args={[0.012, 0.02, 0.45, 4]} />
                <L c="#4E7F3E" />
              </mesh>
            ))}
            {arc(6, 5.2, 7.5, 80, 2.4).map((p, i) => <RoundTree key={i} p={p} s={1 + rnd(i) * 0.5} />)}
            {arc(4, 2.8, 3.3, 90, 1.6).map((p, i) => <Bush key={i} p={[p[0] * 1.3, Math.max(p[1], -2.3)]} c="#6BAF5C" s={0.7} />)}
          </>
        );
      case 'beach':
        return (
          <>
            <Water z0={-2.6} z1={-14} color="#3FA9D6" />
            <Water z0={-2.45} z1={-2.62} color="#8FD6EE" foam />
            {/* palm */}
            <group position={[2.6, 0, -1.8]}>
              {Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} position={[i * 0.04, 0.2 + i * 0.32, 0]} rotation={[0, 0, -0.06 * i]}>
                  <cylinderGeometry args={[0.07, 0.09, 0.34, 6]} />
                  <L c={i % 2 ? '#A87A4E' : '#94683F'} />
                </mesh>
              ))}
              {Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} position={[0.24, 2.05, 0]} rotation={[Math.cos((i / 6) * Math.PI * 2) * 0.9, (i / 6) * Math.PI * 2, 0.6]}>
                  <boxGeometry args={[0.18, 0.04, 0.9]} />
                  <L c="#4FA35A" />
                </mesh>
              ))}
            </group>
            {/* umbrella + towel */}
            <group position={[-2.4, 0, -1.6]}>
              <mesh position={[0, 0.75, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 1.5, 6]} />
                <L c="#FFFFFF" />
              </mesh>
              <mesh position={[0, 1.45, 0]}>
                <coneGeometry args={[0.85, 0.35, 8]} />
                <L c="#E0607E" />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0.4]} position={[0.4, 0.015, 0.4]}>
                <planeGeometry args={[0.6, 1.1]} />
                <L c="#F2C14E" />
              </mesh>
            </group>
            {/* shells & starfish */}
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} position={[(rnd(i) - 0.5) * 6, 0.02, -2.2 + rnd(i + 4) * 0.4]} rotation={[-Math.PI / 2, 0, rnd(i) * 6]}>
                <circleGeometry args={[0.06, i % 2 ? 5 : 3]} />
                <L c={i % 2 ? '#FF9B85' : '#FFF3E0'} />
              </mesh>
            ))}
          </>
        );
      case 'autumn':
        return (
          <>
            {arc(8, 3.6, 7, 100, 2.6).map((p, i) => (
              <RoundTree key={i} p={p} s={0.9 + rnd(i) * 0.6} leaf={['#E0702E', '#C9442B', '#F2B33D', '#D9852F'][i % 4]} />
            ))}
            {/* leaf piles */}
            {arc(4, 2.7, 3.2, 120, 2.0).map((p, i) => (
              <mesh key={i} position={[p[0], 0.05, p[1]]} scale={[1, 0.35, 1]}>
                <icosahedronGeometry args={[0.32, 0]} />
                <L c={['#E0702E', '#C9442B', '#F2B33D', '#A8552A'][i % 4]} />
              </mesh>
            ))}
            {/* a pumpkin */}
            <mesh position={[2.2, 0.14, -1.9]} scale={[1, 0.8, 1]}>
              <icosahedronGeometry args={[0.18, 1]} />
              <L c="#F08A24" />
            </mesh>
          </>
        );
    }
  }, [scene]);
  // local -z of the set points away from the camera
  return <group rotation={[0, Math.atan2(1.8, 2.7), 0]}>{content}</group>;
}
