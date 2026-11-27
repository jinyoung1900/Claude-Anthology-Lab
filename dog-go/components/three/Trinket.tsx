'use client';

/**
 * Low-poly wearable trinkets, modelled in a normalized local space per slot:
 *  head : origin = top-centre of head, unit = head width
 *  face : origin = front face at eye level, +z out of the face, unit = head width
 *  neck : origin = neck centre, ring lies in XZ plane, unit = neck diameter
 *  back : origin = top of the back, +y up, -z = rear, unit = body width
 * Avatars place an anchor <group> per slot with the right position/rotation/scale.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRINKET_MAP, type TrinketDef } from '@/lib/trinkets';
import type { SlotAnchor } from './anchors';
import { SHELL_KINDS } from './costume';

/** five-pointed star, point up, facing +z, ~0.2 outer radius */
const STAR_GEO = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.095 : 0.21;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
  g.translate(0, 0, -0.02);
  return g;
})();

const M = ({ c, e = 0 }: { c: string; e?: number }) => (
  <meshLambertMaterial color={c} flatShading emissive={c} emissiveIntensity={e} />
);

function Flame({ x }: { x: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.y = 0.8 + Math.sin(clock.elapsedTime * 30 + x * 10) * 0.25;
  });
  return (
    <mesh ref={ref} position={[x, 0.15, -0.55]} rotation={[-Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.1, 0.35, 5]} />
      <M c="#FF7A1A" e={0.8} />
    </mesh>
  );
}

function Body({ t, front = 0, tilt = 0, chestZ }: { t: TrinketDef; front?: number; tilt?: number; chestZ?: number }) {
  /** hanging pieces point straight down in the world whatever the neck tilt */
  const hangX = Math.PI / 2 - tilt - 0.12;
  const a = t.accent ?? '#ffffff';
  /** push front-hanging neck pieces out past the throat / chest surface */
  const push = Math.max(0, front + 0.05 - 0.58);
  /** bandana triangle drapes from the knot down onto the chest surface */
  const drape = (() => {
    const z0 = Math.max(0.56, front + 0.05);
    const tipZ = Math.min(z0 + 0.1, Math.max(z0 - 0.5, (chestZ ?? z0) + 0.06));
    const beta = Math.atan2(tipZ - z0, 0.6); // + leans forward, - leans back onto the chest
    const dy = -Math.cos(beta), dz = Math.sin(beta);
    return { rx: Math.PI / 2 - beta, cy: -0.1 + dy * 0.2, cz: z0 + dz * 0.2 };
  })();
  switch (t.kind) {
    case 'beanie':
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.56, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.14, 8]} />
            <M c={a} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <icosahedronGeometry args={[0.12, 0]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'partyhat':
      return (
        <group position={[0.05, 0, 0]} rotation={[0, 0, -0.15]}>
          <mesh position={[0, 0.36, 0]}>
            <coneGeometry args={[0.3, 0.72, 6]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.76, 0]}>
            <icosahedronGeometry args={[0.09, 0]} />
            <M c={a} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.24, 0.27, 0.06, 6]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'tophat':
      return (
        <group>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.06, 10]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.33, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.56, 10]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.1, 10]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'crown':
      return (
        <group>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.2, 10, 1, true]} />
            <meshLambertMaterial color={t.color} side={THREE.DoubleSide} flatShading emissive={t.color} emissiveIntensity={0.2} />
          </mesh>
          {Array.from({ length: 5 }).map((_, i) => {
            const ang = (i / 5) * Math.PI * 2;
            return (
              <group key={i}>
                <mesh position={[Math.sin(ang) * 0.36, 0.28, Math.cos(ang) * 0.36]}>
                  <coneGeometry args={[0.08, 0.18, 4]} />
                  <M c={t.color} e={0.2} />
                </mesh>
                <mesh position={[Math.sin(ang) * 0.39, 0.1, Math.cos(ang) * 0.39]}>
                  <octahedronGeometry args={[0.05, 0]} />
                  <M c={a} e={0.3} />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case 'halo':
      return <Halo color={t.color} />;
    case 'flowercrown':
      return (
        <group position={[0, 0.03, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.46, 0.045, 4, 12]} />
            <M c={t.color} />
          </mesh>
          {Array.from({ length: 7 }).map((_, i) => {
            const ang = (i / 7) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(ang) * 0.46, 0.04, Math.cos(ang) * 0.46]} rotation={[ang, ang, 0]}>
                <octahedronGeometry args={[0.09, 0]} />
                <M c={i % 2 ? a : '#FFF3A0'} />
              </mesh>
            );
          })}
        </group>
      );
    case 'glasses':
      return (
        <group position={[0, 0, 0.03]}>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <torusGeometry args={[0.13, 0.025, 4, 8]} />
              <M c={t.color} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.14, 0.03, 0.03]} />
            <M c={t.color} />
          </mesh>
        </group>
      );
    case 'sunglasses':
      return (
        <group position={[0, 0, 0.03]}>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.3, 0.17, 0.04]} />
              <M c={t.color} />
            </mesh>
          ))}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.7, 0.04, 0.04]} />
            <M c={t.color} />
          </mesh>
        </group>
      );
    case 'starshades':
      return (
        <group position={[0, 0, 0.04]}>
          {[-0.22, 0.22].map((x) => (
            <group key={x} position={[x, 0.01, 0]}>
              <mesh geometry={STAR_GEO}>
                <M c={t.color} e={0.25} />
              </mesh>
              {/* darker lens inset on the front */}
              <mesh geometry={STAR_GEO} position={[0, -0.005, 0.03]} scale={[0.62, 0.62, 0.5]}>
                <M c="#E07A10" e={0.1} />
              </mesh>
            </group>
          ))}
          <mesh>
            <boxGeometry args={[0.12, 0.04, 0.04]} />
            <M c={t.color} />
          </mesh>
        </group>
      );
    case 'bandana':
      return (
        <group>
          {/* folded band, thick and seated outside the fur */}
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.7]}>
            <torusGeometry args={[0.48, 0.075, 4, 12]} />
            <M c={t.color} />
          </mesh>
          <group position={[0, 0, push]}>
          {/* knot */}
          <mesh position={[0, 0.02, 0.6]}>
            <icosahedronGeometry args={[0.1, 0]} />
            <M c={t.color} />
          </mesh>
          {/* big triangle hanging in front, tilted out over the chest */}
          <group position={[0, drape.cy, drape.cz]} rotation={[drape.rx, 0, 0]}>
            <mesh scale={[1, 1, 0.9]}>
              <cylinderGeometry args={[0.4, 0.4, 0.06, 3]} />
              <M c={t.color} />
            </mesh>
            {/* little stripe on the front face */}
            <mesh position={[0, 0.04, 0.06]} scale={[0.5, 1, 0.45]}>
              <cylinderGeometry args={[0.4, 0.4, 0.02, 3]} />
              <M c={t.accent ?? '#FFF7EC'} />
            </mesh>
          </group>
          </group>
        </group>
      );
    case 'collar':
      return (
        <group>
          {/* wide flat band */}
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 2]}>
            <torusGeometry args={[0.47, 0.065, 4, 12]} />
            <M c={t.color} />
          </mesh>
          {/* buckle ring + tag in front */}
          <group position={[0, 0, push]}>
          <mesh position={[0, -0.06, 0.58]}>
            <torusGeometry args={[0.07, 0.025, 4, 6]} />
            <M c={a} e={0.2} />
          </mesh>
          <mesh position={[0, -0.2, 0.6]} rotation={[hangX, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.035, 6]} />
            <M c={a} e={0.2} />
          </mesh>
          </group>
        </group>
      );
    case 'bowtie':
      return (
        <group position={[0, -0.04, 0.6 + push]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
              <coneGeometry args={[0.14, 0.3, 4]} />
              <M c={t.color} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.1, 0.12, 0.08]} />
            <M c={t.color} />
          </mesh>
        </group>
      );
    case 'backpack':
      return (
        <group>
          <mesh position={[0, 0.2, -0.05]}>
            <boxGeometry args={[0.85, 0.4, 0.62]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.45, -0.05]}>
            <boxGeometry args={[0.87, 0.1, 0.64]} />
            <M c={a} />
          </mesh>
          <mesh position={[0, 0.15, -0.4]}>
            <boxGeometry args={[0.5, 0.25, 0.1]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'santahat':
      return (
        <group rotation={[0, 0, -0.25]}>
          <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.1, 6, 14]} />
            <M c={a} />
          </mesh>
          <mesh position={[0.06, 0.38, 0]} rotation={[0, 0, -0.3]}>
            <coneGeometry args={[0.4, 0.7, 10]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0.27, 0.68, 0]}>
            <icosahedronGeometry args={[0.11, 1]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'scarf':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.3]}>
            <torusGeometry args={[0.5, 0.1, 6, 14]} />
            <M c={t.color} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} position={[0.22 + i * 0.12, -0.3, 0.6 + push]} rotation={[0.2, 0, 0.1 - i * 0.2]}>
              <boxGeometry args={[0.16, 0.45, 0.08]} />
              <M c={i ? a : t.color} />
            </mesh>
          ))}
        </group>
      );
    case 'pumpkin':
      return (
        <group position={[0, 0.18, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 4, 0]} scale={[1, 0.75, 0.6]}>
              <sphereGeometry args={[0.36, 10, 8]} />
              <M c={t.color} />
            </mesh>
          ))}
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.16, 6]} />
            <M c={a} />
          </mesh>
          <mesh position={[0.1, 0.34, 0]} rotation={[0, 0, -0.9]} scale={[0.14, 0.04, 0.09]}>
            <sphereGeometry args={[1, 8, 6]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'strawhat':
      return (
        <group>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.04, 16]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.365, 0.365, 0.08, 16]} />
            <M c={a} />
          </mesh>
        </group>
      );
    case 'medal':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.46, 0.06, 4, 12]} />
            <M c={a} />
          </mesh>
          <mesh position={[0, -0.28, 0.56 + push]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.05, 8]} />
            <M c={t.color} e={0.3} />
          </mesh>
          <mesh position={[0, -0.28, 0.59 + push]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 5]} />
            <M c="#ffffff" e={0.2} />
          </mesh>
        </group>
      );
    case 'sweater':
    case 'raincoat':
    case 'tuxedo':
    case 'dino':
    case 'cape':
    case 'bee':
    case 'frog':
    case 'bear':
    case 'unicorn':
    case 'harness':
      // little tunic for previews (on a dog it's built from the dog's shape)
      return (
        <group position={[0, 0.25, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.75, 8]} />
            <M c={t.color} />
          </mesh>
          <mesh position={[0, 0, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.27, 0.05, 4, 8]} />
            <M c={t.kind === 'tuxedo' ? '#ffffff' : a} />
          </mesh>
          {t.kind === 'dino' &&
            [-0.2, 0.05, 0.3].map((z) => (
              <mesh key={z} position={[0, 0.34, z]}>
                <coneGeometry args={[0.07, 0.16, 4]} />
                <M c="#F08A24" />
              </mesh>
            ))}
        </group>
      );
    case 'jetpack':
      return (
        <group>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.22, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.7, 6]} />
              <M c={t.color} />
            </mesh>
          ))}
          <mesh position={[0, 0.22, -0.1]}>
            <boxGeometry args={[0.2, 0.15, 0.5]} />
            <M c={a} />
          </mesh>
          <Flame x={-0.2} />
          <Flame x={0.2} />
        </group>
      );
  }
}

function Halo({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.38 + Math.sin(clock.elapsedTime * 2) * 0.04;
      ref.current.rotation.y = clock.elapsedTime * 0.8;
    }
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.05, 4, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function Trinket({ id, front, tilt, chestZ }: { id?: string; front?: number; tilt?: number; chestZ?: number }) {
  if (!id) return null;
  const t = TRINKET_MAP[id];
  if (!t) return null;
  return <Body t={t} front={front} tilt={tilt} chestZ={chestZ} />;
}

/**
 * A trinket placed at a computed slot anchor on a dog. Cloth (collars, bandanas, scarves,
 * outfits…) is built from the dog's own shape by <DogCostume>, so it's skipped here.
 */
export function TrinketAt({ id, a }: { id?: string; a: SlotAnchor }) {
  if (!id) return null;
  const t = TRINKET_MAP[id];
  if (!t || SHELL_KINDS.has(t.kind)) return null;
  return (
    <group position={a.pos} rotation={a.rot} scale={a.scale}>
      <Trinket id={id} />
    </group>
  );
}
