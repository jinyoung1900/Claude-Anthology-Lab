'use client';

/**
 * Round, Mii-style human: big sphere head, capsule body & limbs, soft cel shading.
 * Faces +Z. Feet at y=0. Total height ≈ 1.5.
 */
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { EyeStyle, HumanAvatar, MouthStyle } from '@/lib/types';
import { Trinket } from './Trinket';
import { HumanVoxel } from './HumanVoxel';
import type { DogAnim } from './Dog3D';

const HIP_Y = 0.46;
const LEG_LEN = 0.26;
const TORSO_Y = 0.74;
const SHOULDER_Y = 0.9;
const HEAD_R = 0.27;
const HEAD_Y = 1.2;

/** 3-step toon ramp shared by every human material. */
let toonRamp: THREE.DataTexture | null = null;
function getToonRamp() {
  if (toonRamp) return toonRamp;
  const data = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  toonRamp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  toonRamp.magFilter = toonRamp.minFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

function Toon({ c }: { c: string }) {
  const ramp = useMemo(getToonRamp, []);
  return <meshToonMaterial color={c} gradientMap={ramp} />;
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

function Eye({ style, side }: { style: EyeStyle; side: number }) {
  if (style === 'happy')
    // closed, smiling ^ ^ eyes
    return (
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.03, 0.009, 6, 12, Math.PI]} />
        <meshBasicMaterial color="#2a1d17" />
      </mesh>
    );
  const dot = style === 'dot';
  return (
    <group>
      <mesh scale={dot ? [0.022, 0.026, 0.015] : [0.032, 0.05, 0.02]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#2a1d17" />
      </mesh>
      {!dot && (
        <mesh position={[side * -0.008, 0.018, 0.016]} scale={0.012}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      {style === 'lashes' &&
        [-1, 0, 1].map((k) => (
          <mesh key={k} position={[side * 0.02 + k * 0.012, 0.05, 0.005]} rotation={[0, 0, side * 0.6 + k * 0.3]} scale={[0.004, 0.016, 0.004]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#2a1d17" />
          </mesh>
        ))}
    </group>
  );
}

function Mouth({ style }: { style: MouthStyle }) {
  const z = HEAD_R * 0.9;
  if (style === 'o')
    return (
      <mesh position={[0, -0.09, z]} scale={[0.02, 0.026, 0.01]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#8a3b3b" />
      </mesh>
    );
  if (style === 'cat')
    return (
      <group position={[0, -0.08, z]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.02, 0, 0]} rotation={[0.25, 0, Math.PI]}>
            <torusGeometry args={[0.02, 0.007, 6, 10, Math.PI]} />
            <meshBasicMaterial color="#8a3b3b" />
          </mesh>
        ))}
      </group>
    );
  if (style === 'grin')
    return (
      <mesh position={[0, -0.075, z]} rotation={[0.25, 0, 0]} scale={[1, 0.8, 0.4]}>
        <sphereGeometry args={[0.045, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshBasicMaterial color="#8a3b3b" side={THREE.DoubleSide} />
      </mesh>
    );
  return (
    <mesh position={[0, -0.085, z]} rotation={[0.25, 0, Math.PI]}>
      <torusGeometry args={[0.04, 0.008, 6, 14, Math.PI]} />
      <meshBasicMaterial color="#8a3b3b" />
    </mesh>
  );
}

function Face({ skin, eyes, mouth, specs }: { skin: string; eyes: EyeStyle; mouth: MouthStyle; specs: boolean }) {
  const z = HEAD_R * 0.93;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.085, 0.02, z]}>
          <Eye style={eyes} side={s} />
        </group>
      ))}
      {specs && (
        <group position={[0, 0.02, HEAD_R * 0.98]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.085, 0, 0]}>
              <torusGeometry args={[0.055, 0.008, 6, 16]} />
              <meshBasicMaterial color="#3a2a20" />
            </mesh>
          ))}
          <mesh scale={[0.06, 0.008, 0.008]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#3a2a20" />
          </mesh>
        </group>
      )}
      {/* eyebrows */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.088, 0.1, HEAD_R * 0.9]} rotation={[0, 0, s * -0.15]} scale={[0.04, 0.009, 0.01]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#3a2a20" />
        </mesh>
      ))}
      {/* button nose */}
      <mesh position={[0, -0.04, HEAD_R * 0.98]} scale={[0.026, 0.02, 0.02]}>
        <sphereGeometry args={[1, 10, 8]} />
        <Toon c={shade(skin, -0.06)} />
      </mesh>
      <Mouth style={mouth} />
      {/* blush */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.15, -0.045, HEAD_R * 0.82]} rotation={[0, s * 0.5, 0]} scale={[0.04, 0.022, 0.01]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#F48FA3" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Hair({ style, color }: { style: HumanAvatar['hairStyle']; color: string }) {
  if (style === 'bald') return null;
  return (
    <group>
      {/* cap covering top & back of the head */}
      <mesh rotation={[-0.45, 0, 0]} scale={1.06}>
        <sphereGeometry args={[HEAD_R, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <Toon c={color} />
      </mesh>
      {/* side-swept bangs: a thin layer that follows the head's curve (no lump on top) */}
      <mesh rotation={[0.5, 0, 0.3]} scale={1.065}>
        <sphereGeometry args={[HEAD_R, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.19]} />
        <Toon c={color} />
      </mesh>
      {style === 'long' && (
        <mesh position={[0, -0.12, -0.1]} scale={[1, 1, 0.75]}>
          <capsuleGeometry args={[0.24, 0.22, 6, 14]} />
          <Toon c={color} />
        </mesh>
      )}
      {style === 'bun' && (
        <mesh position={[0, 0.25, -0.12]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <Toon c={color} />
        </mesh>
      )}
    </group>
  );
}

export function Human3D({ human, anim = 'idle', voxel = false, ...props }: { human: HumanAvatar; anim?: DogAnim; voxel?: boolean } & ThreeElements['group']) {
  if (voxel) return <HumanVoxel human={human} anim={anim} {...props} />;
  return <HumanRound human={human} anim={anim} {...props} />;
}

function HumanRound({ human, anim = 'idle', ...props }: { human: HumanAvatar; anim?: DogAnim } & ThreeElements['group']) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const upper = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const walk = anim === 'walk';
    const happy = anim === 'happy';
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = walk ? Math.sin(t * 9 + (i ? Math.PI : 0)) * 0.55 : 0;
    });
    arms.current.forEach((a, i) => {
      if (!a) return;
      const s = i ? -1 : 1;
      a.rotation.x = walk ? Math.sin(t * 9 + (i ? 0 : Math.PI)) * 0.6 : 0;
      a.rotation.z = happy ? s * (2.5 + Math.sin(t * 16) * 0.35) : s * (0.12 + Math.sin(t * 2) * 0.03);
    });
    if (upper.current) {
      upper.current.position.y = walk ? Math.abs(Math.sin(t * 9)) * 0.03 : happy ? Math.abs(Math.sin(t * 8)) * 0.06 : Math.sin(t * 2) * 0.006;
      upper.current.rotation.z = walk ? Math.sin(t * 9) * 0.04 : 0;
    }
    if (headRef.current) {
      headRef.current.rotation.y = anim === 'idle' ? Math.sin(t * 0.6) * 0.25 : 0;
      headRef.current.rotation.z = happy ? Math.sin(t * 10) * 0.15 : anim === 'idle' ? Math.sin(t * 0.9) * 0.05 : 0;
    }
  });

  const outfit = human.outfit ?? 'tee';
  const legColor = outfit === 'dress' ? human.skin : human.pants;

  return (
    <group {...props}>
      {/* legs (pivot at hip) */}
      {[1, -1].map((s, i) => (
        <group key={s} position={[s * 0.085, HIP_Y, 0]} ref={(g) => { legs.current[i] = g; }}>
          <mesh position={[0, -LEG_LEN / 2 - 0.05, 0]}>
            <capsuleGeometry args={[0.07, LEG_LEN, 6, 12]} />
            <Toon c={legColor} />
          </mesh>
          {/* shoe */}
          <mesh position={[0, -HIP_Y + 0.05, 0.035]} scale={[0.085, 0.06, 0.12]}>
            <sphereGeometry args={[1, 12, 10]} />
            <Toon c="#4a3426" />
          </mesh>
        </group>
      ))}

      <group ref={upper}>
        {outfit === 'dress' ? (
          /* flared skirt */
          <mesh position={[0, HIP_Y + 0.04, 0]} scale={[1, 1, 0.85]}>
            <cylinderGeometry args={[0.17, 0.29, 0.3, 16]} />
            <Toon c={human.shirt} />
          </mesh>
        ) : (
          /* hips (pants) */
          <mesh position={[0, HIP_Y + 0.04, 0]} scale={[1, 0.62, 0.85]}>
            <sphereGeometry args={[0.19, 16, 12]} />
            <Toon c={human.pants} />
          </mesh>
        )}
        {outfit === 'hoodie' && (
          <>
            {/* hood resting behind the neck */}
            <mesh position={[0, SHOULDER_Y + 0.04, -0.12]} rotation={[0.5, 0, 0]} scale={[1, 0.7, 0.8]}>
              <sphereGeometry args={[0.17, 14, 10]} />
              <Toon c={shade(human.shirt, -0.08)} />
            </mesh>
            {/* front pocket */}
            <mesh position={[0, TORSO_Y - 0.08, 0.15]} scale={[0.13, 0.06, 0.02]}>
              <sphereGeometry args={[1, 12, 8]} />
              <Toon c={shade(human.shirt, -0.08)} />
            </mesh>
            {/* drawstrings */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.04, SHOULDER_Y - 0.06, 0.155]} scale={[0.008, 0.06, 0.008]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
          </>
        )}
        {/* round torso (shirt) */}
        <mesh position={[0, TORSO_Y, 0]} scale={[1, 1, 0.82]}>
          <capsuleGeometry args={[0.18, 0.2, 8, 16]} />
          <Toon c={human.shirt} />
        </mesh>

        {/* arms (pivot at shoulder) */}
        {[1, -1].map((s, i) => (
          <group key={s} position={[s * 0.2, SHOULDER_Y, 0]} ref={(g) => { arms.current[i] = g; }}>
            <mesh position={[0, -0.15, 0]}>
              <capsuleGeometry args={[0.055, 0.2, 6, 12]} />
              <Toon c={human.shirt} />
            </mesh>
            <mesh position={[0, -0.31, 0]}>
              <sphereGeometry args={[0.058, 12, 10]} />
              <Toon c={human.skin} />
            </mesh>
          </group>
        ))}

        {/* back slot (pack stands up on the back) */}
        <group position={[0, TORSO_Y + 0.05, -0.14]} rotation={[-Math.PI / 2, 0, 0]} scale={0.38}>
          <Trinket id={human.equipped.back} />
        </group>
        {/* neck slot */}
        <group position={[0, SHOULDER_Y + 0.03, 0]} scale={0.3}>
          <Trinket id={human.equipped.neck} />
        </group>

        {/* big round head */}
        <group ref={headRef} position={[0, HEAD_Y, 0]}>
          <mesh scale={[1.04, 1, 0.96]}>
            <sphereGeometry args={[HEAD_R, 24, 18]} />
            <Toon c={human.skin} />
          </mesh>
          {/* ears */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * HEAD_R * 1.02, -0.01, 0]} scale={[0.035, 0.06, 0.045]}>
              <sphereGeometry args={[1, 10, 8]} />
              <Toon c={human.skin} />
            </mesh>
          ))}
          <Face skin={human.skin} eyes={human.eyes ?? 'oval'} mouth={human.mouth ?? 'smile'} specs={!!human.specs && !human.equipped.face} />
          <Hair style={human.hairStyle} color={human.hair} />

          <group position={[0, HEAD_R * 0.78, 0]} scale={HEAD_R * 2.05}>
            <Trinket id={human.equipped.head} />
          </group>
          <group position={[0, 0.02, HEAD_R * 0.9]} scale={HEAD_R * 2}>
            <Trinket id={human.equipped.face} />
          </group>
        </group>
      </group>
    </group>
  );
}
