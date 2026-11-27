'use client';

/**
 * Blocky voxel owner, used when the active dog is in the Pixel style.
 * Same avatar options as the round person: skin, hair colour + style, shirt / hoodie / dress,
 * pants, eyes, mouth, specs, and the head / face / neck / back trinkets.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { HumanAvatar } from '@/lib/types';
import type { DogAnim } from './Dog3D';
import { Trinket } from './Trinket';
import { shadeCss, VoxelSet, voxelGeometry } from './voxel';

const V = 0.06;
const LEG = 7; // cubes
const HIP_Y = LEG * V;
const TORSO = 7;
const SHOULDER_Y = HIP_Y + TORSO * V;
const HEAD = 8;

export function HumanVoxel({ human, anim = 'idle', ...props }: { human: HumanAvatar; anim?: DogAnim } & ThreeElements['group']) {
  const outfit = human.outfit ?? 'tee';
  const geo = useMemo(() => {
    const skin = human.skin, shirt = human.shirt, pants = human.pants, hair = human.hair;
    // legs (3 × LEG × 3), shoes on the bottom row; dresses show skin legs
    const leg = new VoxelSet();
    leg.box(-1, 2, -LEG, 0, -1, 2, (_i, j) => (j === -LEG ? '#4a3426' : outfit === 'dress' ? skin : pants));
    // torso
    const torso = new VoxelSet();
    torso.box(-4, 4, 0, TORSO, -2, 2, (_i, j) => (outfit === 'tee' && j === 0 ? shadeCss(pants, -0.1) : shirt));
    if (outfit === 'hoodie') {
      torso.box(-3, 3, TORSO - 1, TORSO + 1, -3, -2, () => shadeCss(shirt, -0.08)); // hood on the back
      torso.box(-2, 2, 1, 3, 2, 3, () => shadeCss(shirt, -0.12)); // pocket
    }
    if (outfit === 'dress') torso.box(-5, 5, -3, 1, -3, 3, (_i, j) => (j === -3 ? shadeCss(shirt, -0.12) : shirt));
    // arms: sleeve then skin hands
    const arm = new VoxelSet();
    arm.box(-1, 2, -TORSO, 0, -1, 2, (_i, j) => (j < -TORSO + 2 ? skin : j > -3 || outfit === 'hoodie' ? shirt : skin));
    // head with hair
    const head = new VoxelSet();
    const h0 = -HEAD / 2, h1 = HEAD / 2;
    head.box(h0, h1, 0, HEAD, h0, h1, () => skin);
    const hs = human.hairStyle;
    if (hs !== 'bald') {
      head.box(h0, h1, HEAD, HEAD + 1, h0, h1, () => hair); // top
      head.box(h0, h1, HEAD - 2, HEAD, h0, h1 - 5, () => hair); // back / crown
      head.box(h0, h1, HEAD - 2, HEAD, h1 - 1, h1, (i) => (Math.abs(i + 0.5) < 3 ? hair : skin)); // fringe
      head.box(h0, h0 + 1, HEAD - 3, HEAD, h0, h1 - 2, () => hair); // sides
      head.box(h1 - 1, h1, HEAD - 3, HEAD, h0, h1 - 2, () => hair);
      if (hs === 'long') {
        head.box(h0, h1, 1, HEAD - 2, h0 - 1, h0, () => hair);
        head.box(h0 - 1, h0, 0, HEAD, h0, h1 - 3, () => hair);
        head.box(h1, h1 + 1, 0, HEAD, h0, h1 - 3, () => hair);
      }
      if (hs === 'bun') head.box(-1, 2, HEAD + 1, HEAD + 4, -2, 1, () => hair);
    }
    // face on the front layer
    const fz = h1; // just in front of the head
    const eyes = human.eyes ?? 'oval';
    const eye = '#2a1a10';
    for (const x of [-2, 1]) {
      if (eyes === 'happy') head.set(x, 4, fz, eye);
      else if (eyes === 'dot') head.set(x, 4, fz, eye);
      else {
        head.set(x, 4, fz, eye);
        head.set(x, 3, fz, eye);
        if (eyes === 'lashes') head.set(x + (x < 0 ? -1 : 1), 5, fz, eye);
      }
    }
    const mouth = human.mouth ?? 'smile';
    if (mouth === 'o') head.set(-1, 1, fz, '#7a2a2a');
    else {
      head.box(-1, 1, 1, 2, fz, fz + 1, () => (mouth === 'grin' ? '#ffffff' : '#7a2a2a'));
      if (mouth === 'smile' || mouth === 'cat') {
        head.set(-2, 2, fz, '#7a2a2a');
        head.set(1, 2, fz, '#7a2a2a');
      }
    }
    for (const x of [-3, 2]) head.set(x, 2, fz, shadeCss('#F08A9A', 0.1)); // blush
    if (human.specs && !human.equipped.face)
      for (const x of [-3, -2, -1, 0, 1, 2]) head.set(x, 4, fz + 1, '#3A2A20');
    return {
      leg: voxelGeometry(leg, V, [-0.5 * V, 0, -0.5 * V]),
      torso: voxelGeometry(torso, V),
      arm: voxelGeometry(arm, V, [-0.5 * V, 0, -0.5 * V]),
      head: voxelGeometry(head, V),
    };
  }, [human, outfit]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), []);
  useEffect(() => () => mat.dispose(), [mat]);

  const legs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const upper = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const walk = anim === 'walk';
    const happy = anim === 'happy';
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = walk ? Math.sin(t * 9 + (i ? Math.PI : 0)) * 0.6 : 0;
    });
    arms.current.forEach((a, i) => {
      if (!a) return;
      const s = i ? -1 : 1;
      a.rotation.x = walk ? Math.sin(t * 9 + (i ? 0 : Math.PI)) * 0.7 : 0;
      a.rotation.z = happy ? s * (2.6 + Math.sin(t * 16) * 0.3) : s * 0.06;
    });
    if (upper.current) upper.current.position.y = walk ? Math.round(Math.abs(Math.sin(t * 9)) * 2) * V * 0.25 : happy ? Math.abs(Math.sin(t * 8)) * 0.06 : 0;
    if (headRef.current) headRef.current.rotation.y = anim === 'idle' ? Math.sin(t * 0.6) * 0.25 : 0;
  });

  return (
    <group {...props}>
      {[1, -1].map((s, i) => (
        <group key={s} position={[s * 2 * V, HIP_Y, 0]} ref={(g) => { legs.current[i] = g; }}>
          <mesh geometry={geo.leg} material={mat} />
        </group>
      ))}
      <group ref={upper}>
        <group position={[0, HIP_Y, 0]}>
          <mesh geometry={geo.torso} material={mat} />
        </group>
        {[1, -1].map((s, i) => (
          <group key={s} position={[s * 5.5 * V, SHOULDER_Y, 0]} ref={(g) => { arms.current[i] = g; }}>
            <mesh geometry={geo.arm} material={mat} />
          </group>
        ))}
        {/* slots */}
        <group position={[0, SHOULDER_Y - 0.1, -2 * V]} rotation={[-Math.PI / 2, 0, 0]} scale={0.4}>
          <Trinket id={human.equipped.back} />
        </group>
        <group position={[0, SHOULDER_Y + 0.02, 0]} scale={0.32}>
          <Trinket id={human.equipped.neck} />
        </group>
        <group ref={headRef} position={[0, SHOULDER_Y, 0]}>
          <mesh geometry={geo.head} material={mat} />
          <group position={[0, (HEAD + (human.hairStyle === 'bald' ? 0 : 1)) * V, 0]} scale={HEAD * V * 1.05}>
            <Trinket id={human.equipped.head} />
          </group>
          <group position={[0, 4 * V, (HEAD / 2 + 1) * V]} scale={HEAD * V}>
            <Trinket id={human.equipped.face} />
          </group>
        </group>
      </group>
    </group>
  );
}
