'use client';

/**
 * Fetch: throw a ball or frisbee and the dog runs after it, picks it up and brings it back.
 *
 * Small hand-rolled physics (no engine): the ball flies with gravity, bounces with energy
 * loss, then rolls with friction; the frisbee glides (lift that fades as it slows, air drag,
 * wobble) and slides to a stop. The toy is thrown from the viewer's side, past the dog.
 * Everything runs in the spin group's local space, so dragging the scene keeps working.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import type { DogProfile } from '@/lib/types';
import type { DogAnim } from './Dog3D';
import { buildSculptDog } from './sculpt/buildDog';

export type ToyKind = 'ball' | 'frisbee';
export interface ThrowRequest {
  kind: ToyKind;
  /** bump to throw again */
  id: number;
  /** finger swipe at release (px / s, screen space, +y = down) – throw from the hand */
  swipe?: { vx: number; vy: number };
}

type Phase = 'idle' | 'held' | 'flying' | 'chase' | 'carry' | 'drop';

const G = 9.8;
const PLAY_R = 1.25; // keep the toy inside the visible play area
const FENCE = PLAY_R + 0.15;
const RUN = 2.1; // dog speed (units / s)

/** mouth position in the dog's own frame */
function mouthOf(dog: DogProfile): THREE.Vector3 {
  if (dog.model === 'pixel') return new THREE.Vector3(0, 0.42, 0.5);
  const b = buildSculptDog(dog);
  return new THREE.Vector3(0, b.headC[1] - b.R * 0.5, b.headC[2] + b.R * 1.25);
}

function Toy({ kind }: { kind: ToyKind }) {
  if (kind === 'ball')
    return (
      <group>
        <mesh>
          <icosahedronGeometry args={[0.065, 1]} />
          <meshLambertMaterial color="#D7F04A" flatShading />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.064, 0.007, 4, 16]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      </group>
    );
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.15, 0.14, 0.025, 18]} />
        <meshLambertMaterial color="#FF6B8B" flatShading />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.145, 0.014, 4, 18]} />
        <meshLambertMaterial color="#E0457A" />
      </mesh>
      <mesh position={[0, 0.014, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.004, 14]} />
        <meshLambertMaterial color="#FFE3EC" />
      </mesh>
    </group>
  );
}

export function FetchDog({
  dog,
  request,
  held = null,
  aimRef,
  home,
  scale = 1,
  onAnim,
  onFetched,
  children,
}: {
  dog: DogProfile;
  request: ThrowRequest | null;
  /** a toy in the player's hand, following the finger (aimRef: NDC) */
  held?: ToyKind | null;
  aimRef?: MutableRefObject<{ x: number; y: number }>;
  /** where the dog normally stands */
  home: [number, number, number];
  /** the dog's scale (duo framing shrinks it) */
  scale?: number;
  /** override the dog's animation while playing (null = back to normal) */
  onAnim: (a: DogAnim | null) => void;
  onFetched?: () => void;
  /** the dog (and its shadow), moved and turned by this component */
  children: ReactNode;
}) {
  const { camera } = useThree();
  const mover = useRef<THREE.Group>(null);
  const toyRef = useRef<THREE.Group>(null);
  const mouth = useMemo(() => mouthOf(dog).multiplyScalar(scale), [dog, scale]);
  const s = useRef({
    phase: 'idle' as Phase,
    kind: 'ball' as ToyKind,
    pos: new THREE.Vector3(0, -10, 0),
    vel: new THREE.Vector3(),
    spin: 0,
    roll: new THREE.Quaternion(),
    wait: 0,
    dog: new THREE.Vector3(home[0], 0, home[2]),
    yaw: 0,
    shown: false,
    inside: false,
  });
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const animRef = useRef<DogAnim | null>(null);
  const setAnim = (a: DogAnim | null) => {
    if (animRef.current !== a) {
      animRef.current = a;
      onAnim(a);
    }
  };

  // a new throw
  useEffect(() => {
    if (!request || !mover.current?.parent) return;
    const st = s.current;
    const parent = mover.current.parent;
    parent.updateWorldMatrix(true, false);
    // from the viewer's side, a bit low, towards a spot past the dog
    const camFlat = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    const away = camFlat.clone().multiplyScalar(-1).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const originW = camFlat.clone().multiplyScalar(0.45).setY(0.75);
    const targetW = away
      .clone()
      .multiplyScalar(0.5 + Math.random() * 0.9)
      .addScaledVector(side, (Math.random() - 0.5) * 1.8);
    const o = parent.worldToLocal(originW.clone());
    const tgt = parent.worldToLocal(targetW.clone());
    tgt.y = 0;
    if (Math.hypot(tgt.x, tgt.z) > PLAY_R) tgt.setLength(PLAY_R);
    if (request.swipe && st.phase === 'held') {
      // from the hand: swipe up = throw far, sideways = curve off to that side, a tap = drop
      const fwd = away.clone();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const up = Math.max(0, -request.swipe.vy);
      const f = Math.min(1, up / 1400);
      const ball = request.kind === 'ball';
      const vW = new THREE.Vector3();
      if (up < 120) vW.copy(fwd).multiplyScalar(0.6).setY(0.4);
      else
        vW.copy(fwd)
          .multiplyScalar(1.2 + 3.6 * f)
          .addScaledVector(right, Math.max(-1, Math.min(1, request.swipe.vx / 1400)) * 2.2)
          .setY(ball ? 1.4 + 2.4 * f : 0.6 + 0.9 * f);
      const q = new THREE.Quaternion();
      parent.getWorldQuaternion(q);
      st.vel.copy(vW.applyQuaternion(q.invert()));
      st.kind = request.kind;
      st.spin = ball ? 0 : 20;
      st.phase = 'flying';
      st.inside = false;
      st.wait = 0.4; // the dog waits a moment, watching, then sets off
      st.shown = true;
      setAnim(null);
      return;
    }
    const T = request.kind === 'ball' ? 0.9 : 1.25;
    const g = request.kind === 'ball' ? G : G * 0.45; // frisbee: lift carries it
    st.kind = request.kind;
    st.pos.copy(o);
    st.vel.set((tgt.x - o.x) / T, (0.06 - o.y + 0.5 * g * T * T) / T, (tgt.z - o.z) / T);
    st.spin = request.kind === 'frisbee' ? 18 : 0;
    st.phase = 'flying';
    st.inside = false;
    st.wait = 0.4; // the dog waits a moment, watching, then sets off
    st.shown = true;
    setAnim('happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(0.04, delta);
    const st = s.current;
    const t = clock.elapsedTime;
    const toy = toyRef.current, m = mover.current;
    if (!toy || !m) return;
    if (held && aimRef && m.parent) {
      if (st.phase !== 'held') {
        st.phase = 'held';
        st.kind = held;
        st.vel.set(0, 0, 0);
        setAnim(null);
      }
      st.shown = true;
      ray.setFromCamera(new THREE.Vector2(aimRef.current.x, aimRef.current.y), camera);
      const pW = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 1.25);
      st.pos.copy(m.parent.worldToLocal(pW));
      toy.position.copy(st.pos);
      if (held === 'frisbee') toy.rotation.set(0.5, t * 0.5, 0);
      else toy.rotation.set(0, t * 0.8, 0);
    } else if (st.phase === 'held') {
      // let go without a throw request (cancelled)
      st.phase = 'idle';
      st.shown = false;
    }
    const r = st.kind === 'ball' ? 0.065 : 0.014;
    // play-area centre: a bit past the dog, away from the camera (in the spin group's space)
    const fc = m.parent
      ? m.parent.worldToLocal(new THREE.Vector3(-camera.position.x, 0, -camera.position.z).setLength(0.45))
      : new THREE.Vector3();

    // ---- toy physics ----
    if (st.phase === 'flying' || st.phase === 'chase' || st.phase === 'drop') {
      const v = st.vel;
      const onGround = st.pos.y <= r + 0.001 && Math.abs(v.y) < 0.4;
      if (!onGround) {
        if (st.kind === 'frisbee') {
          const vh = Math.hypot(v.x, v.z);
          const lift = Math.min(0.75, 0.06 * vh * vh); // glides while fast
          v.y -= G * (1 - lift) * dt;
          const drag = Math.exp(-0.35 * dt);
          v.x *= drag;
          v.z *= drag;
        } else v.y -= G * dt;
        st.pos.addScaledVector(v, dt);
        if (st.pos.y < r) {
          st.pos.y = r;
          if (st.kind === 'ball' && v.y < -0.6) {
            v.y = -v.y * 0.5; // bounce
            v.x *= 0.6;
            v.z *= 0.6;
          } else {
            v.y = 0;
            if (st.kind === 'frisbee') {
              v.x *= 0.6;
              v.z *= 0.6;
            }
          }
        }
      } else {
        // rolling / sliding with friction
        st.pos.y = r;
        v.y = 0;
        const sp = Math.hypot(v.x, v.z);
        const dec = (st.kind === 'ball' ? 2.6 : 4.5) * dt;
        const k = sp > dec ? (sp - dec) / sp : 0;
        v.x *= k;
        v.z *= k;
        st.pos.addScaledVector(v, dt);
      }
      // soft invisible fence round the play area (a circle a little behind the dog, so the
      // dog never ends up right in front of the camera); a toy that lands outside rolls in
      const cx = st.pos.x - fc.x, cz = st.pos.z - fc.z;
      const d = Math.hypot(cx, cz);
      const grounded = st.pos.y <= r + 0.001;
      if (d < FENCE) st.inside = true;
      if (d > FENCE && (st.inside || grounded)) {
        const nx = cx / d, nz = cz / d;
        const dot = v.x * nx + v.z * nz;
        if (dot > 0) {
          v.x -= 1.6 * dot * nx;
          v.z -= 1.6 * dot * nz;
        }
        st.pos.x = fc.x + nx * FENCE;
        st.pos.z = fc.z + nz * FENCE;
        st.inside = true;
      }
      // ball rolls, frisbee spins and wobbles
      if (st.kind === 'ball') {
        const sp = Math.hypot(v.x, v.z);
        if (sp > 0.01) {
          const axis = new THREE.Vector3(v.z, 0, -v.x).normalize();
          st.roll.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, (sp * dt) / r));
        }
        toy.quaternion.copy(st.roll);
      } else {
        st.spin *= Math.exp(-(st.pos.y <= r + 0.001 ? 3 : 0.3) * dt);
        toy.rotation.set(Math.sin(t * 7) * 0.08 * Math.min(1, st.spin / 10), toy.rotation.y + st.spin * dt, Math.cos(t * 7) * 0.08 * Math.min(1, st.spin / 10));
      }
      toy.position.copy(st.pos);
    }

    // ---- the dog ----
    const runTo = (tx: number, tz: number, stopAt: number) => {
      const dx = tx - st.dog.x, dz = tz - st.dog.z;
      const dist = Math.hypot(dx, dz);
      if (dist > stopAt) {
        const want = Math.atan2(dx, dz);
        let dy = want - st.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        st.yaw = Math.atan2(Math.sin(st.yaw + dy * Math.min(1, dt * 9)), Math.cos(st.yaw + dy * Math.min(1, dt * 9)));
        // slow down while turning hard, speed up when lined up
        const step = Math.min(dist - stopAt, RUN * dt * (0.35 + 0.65 * Math.max(0, Math.cos(dy))));
        st.dog.x += Math.sin(st.yaw) * step;
        st.dog.z += Math.cos(st.yaw) * step;
      }
      return dist;
    };
    const mouthLocal = () => {
      const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
      return new THREE.Vector3(st.dog.x + mouth.z * sn + mouth.x * c, mouth.y, st.dog.z + mouth.z * c - mouth.x * sn);
    };

    if (st.phase === 'flying') {
      st.wait -= dt;
      if (st.wait <= 0) {
        st.phase = 'chase';
        setAnim('walk');
      }
    } else if (st.phase === 'chase') {
      // run to where the toy will be
      const lead = 0.35;
      let tx = st.pos.x + st.vel.x * lead, tz = st.pos.z + st.vel.z * lead;
      const td = Math.hypot(tx - fc.x, tz - fc.z);
      if (td > FENCE) {
        tx = fc.x + ((tx - fc.x) * FENCE) / td;
        tz = fc.z + ((tz - fc.z) * FENCE) / td;
      }
      // stop with the mouth (not the body) over the toy, and always end up facing it
      const md = Math.hypot(mouth.x, mouth.z) * 0.9;
      const dist = runTo(tx, tz, md);
      if (dist <= md) {
        let dy = Math.atan2(st.pos.x - st.dog.x, st.pos.z - st.dog.z) - st.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        st.yaw += dy * Math.min(1, dt * 8);
        if (dist < md * 0.75) {
          // too close to reach it with the mouth: shuffle back a little
          st.dog.x -= Math.sin(st.yaw) * RUN * 0.3 * dt;
          st.dog.z -= Math.cos(st.yaw) * RUN * 0.3 * dt;
        }
      }
      const ml = mouthLocal();
      const reach = Math.hypot(ml.x - st.pos.x, ml.z - st.pos.z);
      // grab it off the ground, or snatch it out of the air when it's low enough
      if (reach < 0.24 && st.pos.y < ml.y + 0.1) {
        st.phase = 'carry';
        st.vel.set(0, 0, 0);
      }
    } else if (st.phase === 'carry') {
      const dist = runTo(home[0], home[2], 0.04);
      const ml = mouthLocal();
      st.pos.copy(ml);
      toy.position.copy(ml);
      if (st.kind === 'frisbee') toy.rotation.set(Math.PI / 2, st.yaw, 0);
      if (dist <= 0.06) {
        // turn back to the viewer, then drop it
        let dy = -st.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        st.yaw += dy * Math.min(1, dt * 6);
        if (Math.abs(dy) < 0.08) {
          st.phase = 'drop';
          st.vel.set(Math.sin(st.yaw) * 0.6, 0.4, Math.cos(st.yaw) * 0.6);
          st.wait = 1.4;
          setAnim('happy');
          onFetched?.();
        }
      }
    } else if (st.phase === 'drop') {
      st.wait -= dt;
      if (st.wait <= 0) {
        st.phase = 'idle';
        setAnim(null);
      }
    }
    // walk cycle is in place: the mover carries the dog
    m.position.set(st.dog.x, 0, st.dog.z);
    m.rotation.y = st.yaw;
    toy.visible = st.shown;
  });

  // the dog's home spot follows framing changes when idle
  useEffect(() => {
    const st = s.current;
    if (st.phase === 'idle') st.dog.set(home[0], 0, home[2]);
  }, [home[0], home[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <group ref={mover}>{children}</group>
      <group ref={toyRef} visible={false}>
        <Toy kind={held ?? request?.kind ?? 'ball'} />
      </group>
    </>
  );
}
