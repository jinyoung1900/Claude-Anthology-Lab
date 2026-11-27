'use client';

/**
 * Renders body-shaped costumes (see costume.ts) on any dog model.
 *  - rigid models (round / retro): layers + extras go into the body or head group
 *  - sculpted model: layers become skinned meshes on the dog's own skeleton
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TRINKET_MAP } from '@/lib/trinkets';
import type { Equipped } from '@/lib/types';
import { buildCostume, SHELL_KINDS, type Costume, type CostumeExtra, type DogFrame, type FrameName } from './costume';
import type { V3 } from './sculpt/surfaceNets';

const cache = new Map<string, Costume>();

/** costumes for the dog's equipped neck + body items, cached per shape */
export function useCostumes(frame: DogFrame | null, shapeKey: string, equipped: Equipped): Costume[] {
  const ids = [equipped.body, equipped.neck].filter((id): id is string => !!id && !!TRINKET_MAP[id] && SHELL_KINDS.has(TRINKET_MAP[id].kind));
  const idKey = ids.join(',');
  return useMemo(() => {
    if (!frame) return [];
    return ids.map((id) => {
      const k = `${shapeKey}|${id}`;
      let c = cache.get(k);
      if (!c) {
        c = buildCostume(frame, TRINKET_MAP[id]);
        cache.set(k, c);
        if (cache.size > 24) cache.delete(cache.keys().next().value!);
      }
      return c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, shapeKey, idKey]);
}

export function useClothMaterial(flat: boolean, _look: 'sculpt' | 'pixel' = 'sculpt') {
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat }), [flat]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

/** orientation whose +z faces out of the surface but stays upright (for hanging things) */
function facing(n: V3): [number, number, number] {
  const yaw = Math.atan2(n[0], n[2]);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, n[1]))) * 0.6;
  return [pitch, yaw, 0];
}

function Mat({ c, e = 0 }: { c: string; e?: number }) {
  return <meshLambertMaterial color={c} flatShading emissive={c} emissiveIntensity={e} />;
}

function Extra({ e }: { e: CostumeExtra }) {
  const s = e.size;
  const quatUp = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(...e.n)), [e.n]);
  const quatOut = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(...e.n)), [e.n]);
  switch (e.kind) {
    case 'spike':
      return (
        <mesh position={e.pos} quaternion={quatUp}>
          <coneGeometry args={[s * 0.55, s * 1.6, 4]} />
          <Mat c={e.color} />
        </mesh>
      );
    case 'knot':
      return (
        <mesh position={e.pos}>
          <icosahedronGeometry args={[s, 0]} />
          <Mat c={e.color} />
        </mesh>
      );
    case 'button':
      return (
        <mesh position={e.pos} quaternion={quatOut} scale={[1, 1, 0.45]}>
          <sphereGeometry args={[s, 6, 4]} />
          <Mat c={e.color} />
        </mesh>
      );
    case 'eye':
      return (
        <group position={e.pos} quaternion={quatOut}>
          <mesh scale={[1, 1.25, 0.4]}>
            <sphereGeometry args={[s, 6, 4]} />
            <Mat c={e.color} />
          </mesh>
          <mesh position={[s * 0.3, s * 0.4, s * 0.35]}>
            <boxGeometry args={[s * 0.35, s * 0.35, s * 0.1]} />
            <Mat c="#ffffff" e={0.3} />
          </mesh>
        </group>
      );
    case 'bow':
      return (
        <group position={e.pos} rotation={facing(e.n)}>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * s * 0.55, 0, s * 0.15]} rotation={[0, 0, (k * Math.PI) / 2]}>
              <coneGeometry args={[s * 0.48, s * 1.0, 4]} />
              <Mat c={e.color} />
            </mesh>
          ))}
          <mesh position={[0, 0, s * 0.18]}>
            <boxGeometry args={[s * 0.34, s * 0.4, s * 0.3]} />
            <Mat c={e.color} />
          </mesh>
        </group>
      );
    case 'tag':
      return (
        <group position={e.pos} rotation={facing(e.n)}>
          <mesh position={[0, -s * 0.15, s * 0.1]}>
            <torusGeometry args={[s * 0.18, s * 0.06, 4, 6]} />
            <Mat c={e.color} e={0.2} />
          </mesh>
          <mesh position={[0, -s * 0.62, s * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.42, s * 0.42, s * 0.1, 6]} />
            <Mat c={e.color} e={0.25} />
          </mesh>
        </group>
      );
    case 'medal':
      return (
        <group position={e.pos} rotation={facing(e.n)}>
          <mesh position={[0, 0, s * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s, s, s * 0.2, 8]} />
            <Mat c={e.color} e={0.3} />
          </mesh>
          <mesh position={[0, 0, s * 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[s * 0.5, s * 0.5, s * 0.08, 5]} />
            <Mat c="#ffffff" e={0.2} />
          </mesh>
        </group>
      );
    case 'antenna':
      return (
        <group position={e.pos} quaternion={quatUp}>
          <mesh position={[0, s * 0.5, 0]}>
            <cylinderGeometry args={[s * 0.05, s * 0.06, s, 5]} />
            <Mat c={e.color} />
          </mesh>
          <mesh position={[0, s, 0]}>
            <icosahedronGeometry args={[s * 0.16, 1]} />
            <Mat c={e.color} />
          </mesh>
        </group>
      );
    case 'wing':
      return (
        <group position={e.pos} quaternion={quatUp}>
          <mesh position={[0, s * 0.55, 0]} scale={[0.12, 0.6, 0.38]}>
            <sphereGeometry args={[s, 10, 6]} />
            <meshLambertMaterial color={e.color} transparent opacity={0.75} />
          </mesh>
        </group>
      );
    case 'bulbeye':
      return (
        <group position={e.pos} quaternion={quatUp}>
          <mesh position={[0, s * 0.45, 0]}>
            <sphereGeometry args={[s, 10, 8]} />
            <Mat c={e.color} />
          </mesh>
          <mesh position={[0, s * 0.6, s * 0.72]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[s * 0.42, 8, 6]} />
            <Mat c="#2a1a10" />
          </mesh>
          <mesh position={[s * 0.14, s * 0.8, s * 0.88]}>
            <sphereGeometry args={[s * 0.12, 6, 4]} />
            <Mat c="#ffffff" e={0.4} />
          </mesh>
        </group>
      );
    case 'roundear':
      return (
        <group position={e.pos} rotation={facing([e.n[0] * 0.6, 0, 0.8])}>
          <mesh scale={[1, 1, 0.55]}>
            <sphereGeometry args={[s, 10, 8]} />
            <Mat c={e.color} />
          </mesh>
          <mesh position={[0, 0, s * 0.35]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[s * 0.6, 8, 6]} />
            <Mat c={e.accent ?? e.color} />
          </mesh>
        </group>
      );
    case 'horn':
      return (
        <group position={e.pos} quaternion={quatUp}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, s * (0.17 + i * 0.3), 0]}>
              <cylinderGeometry args={[s * (0.2 - i * 0.06), s * (0.24 - i * 0.06), s * 0.32, 8]} />
              <Mat c={i % 2 ? '#FFF3C4' : e.color} e={0.15} />
            </mesh>
          ))}
          <mesh position={[0, s * 0.98, 0]}>
            <coneGeometry args={[s * 0.08, s * 0.2, 8]} />
            <Mat c={e.color} e={0.15} />
          </mesh>
        </group>
      );
    case 'dring':
      return (
        <group position={e.pos} rotation={facing(e.n)}>
          <mesh position={[0, s * 0.35, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[s * 0.5, s * 0.12, 5, 12, Math.PI]} />
            <Mat c={e.color} e={0.25} />
          </mesh>
        </group>
      );
    case 'buckle':
      return (
        <mesh position={e.pos} quaternion={quatOut}>
          <boxGeometry args={[s * 1.1, s * 0.9, s * 0.35]} />
          <Mat c={e.color} />
        </mesh>
      );
    case 'tail':
      // scarf tails hanging over the chest
      return (
        <group position={e.pos} rotation={facing(e.n)}>
          {[0, 1].map((i) => (
            <mesh key={i} position={[(i ? 0.42 : 0.12) * s, -0.55 * s, (0.08 + i * 0.05) * s]} rotation={[0.15, 0, 0.1 - i * 0.22]}>
              <boxGeometry args={[0.32 * s, 1.1 * s, 0.12 * s]} />
              <Mat c={i ? e.accent ?? e.color : e.color} />
            </mesh>
          ))}
        </group>
      );
  }
}

/** extras of one frame, drawn in model space inside a group that is offset to that frame */
export function CostumeExtras({ costumes, frame, origin }: { costumes: Costume[]; frame: FrameName; origin: V3 }) {
  return (
    <group position={[-origin[0], -origin[1], -origin[2]]}>
      {costumes.flatMap((c, ci) => c.extras.filter((e) => e.frame === frame).map((e, i) => <Extra key={`${ci}-${i}`} e={e} />))}
    </group>
  );
}

/** rigid cloth layers of one frame (round / retro models) */
export function RigidCostume({ costumes, frame, origin, material }: { costumes: Costume[]; frame: FrameName; origin: V3; material: THREE.Material }) {
  return (
    <group position={[-origin[0], -origin[1], -origin[2]]}>
      {costumes.flatMap((c, ci) =>
        c.layers.filter((l) => l.frame === frame).map((l, i) => <mesh key={`${ci}-${i}`} geometry={l.geometry} material={material} />),
      )}
      {costumes.flatMap((c, ci) => c.extras.filter((e) => e.frame === frame).map((e, i) => <Extra key={`x${ci}-${i}`} e={e} />))}
    </group>
  );
}
