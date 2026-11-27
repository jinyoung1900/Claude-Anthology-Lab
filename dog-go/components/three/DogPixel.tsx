'use client';

/**
 * Pixel style: a chunky voxel dog. Faces +Z, feet at y = 0.
 * - Body, head, muzzle, legs, ears and tail are stacks of cubes on one grid (size U).
 * - Box 2 (fur swatch) colours the cubes; markings colour the chest / socks / tail tip.
 * - Box 1 (face crop) is shown as a low-res, NearestFilter pixel picture on the front of the
 *   head and muzzle.
 * - Hats & glasses sit on anchors measured from the box shape; cloth (collars, outfits) is
 *   built from cubes one layer outside the body (see costume.ts).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { DogProfile } from '@/lib/types';
import { EYE_LINE, NOSE_DOT } from '@/components/TwoBoxCropper';
import type { DogAnim } from './Dog3D';
import { newPose, stepPose } from './dogPose';
import { localTo, solveAnchors } from './anchors';
import type { V3 } from './sculpt/surfaceNets';
import { wearsHood, type DogFrame } from './costume';
import { RigidCostume, useClothMaterial, useCostumes } from './DogCostume';
import { mixCss, samplePx, shadeCss, usePixels, VoxelSet, voxelGeometry, type Pixels } from './voxel';
import { voxelBackItem, voxelHeadItem } from './voxelTrinkets';
import { TRINKET_MAP } from '@/lib/trinkets';

export const U = 0.045;

function sdBox(x: number, y: number, z: number, lo: V3, hi: V3) {
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
  const qx = Math.abs(x - cx) - (hi[0] - lo[0]) / 2, qy = Math.abs(y - cy) - (hi[1] - lo[1]) / 2, qz = Math.abs(z - cz) - (hi[2] - lo[2]) / 2;
  const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return out + Math.min(Math.max(qx, qy, qz), 0);
}

const hash = (i: number, j: number, k: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** pixelated face texture (low res, NearestFilter) + its pixels */
function usePixelFace(url: string) {
  const px = usePixels(url, 20);
  const tex = useMemo(() => {
    if (!px) return null;
    const c = document.createElement('canvas');
    c.width = c.height = px.w;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(px.w, px.h);
    img.data.set(px.data);
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return t;
  }, [px]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return { tex, px };
}

/** a flat rectangle facing +z whose UVs are the front projection of the face crop */
function facePlane(x0: number, x1: number, y0: number, y1: number, z: number, proj: (x: number, y: number) => [number, number]) {
  const g = new THREE.BufferGeometry();
  const P = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(([x, y]) => [x, y, z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(P.flatMap(() => [0, 0, 1]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(P.flatMap(([x, y]) => proj(x, y)), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export function DogPixel({
  dog,
  anim = 'idle',
  onTap,
  onPetStart,
  ...props
}: { dog: DogProfile; anim?: DogAnim; onTap?: () => void; onPetStart?: () => void } & ThreeElements['group']) {
  const p = dog.proportions;
  const fluff = dog.fluff ?? 0.2;
  const tailStyle = dog.tailStyle ?? 'straight';
  const marks = dog.markings ?? { chest: false, socks: false, tailTip: false };
  const floppy = dog.earStyle !== 'pointy';
  const furPx = usePixels(dog.furImg, 8);
  const { tex: faceTex, px: facePx } = usePixelFace(dog.faceImg);

  // ---- grid measurements (in cubes) ----
  const bh = fluff > 0.5 ? 8 : 7;
  const bl = Math.max(8, Math.round(13 * p.bodyLength));
  const lh = Math.max(4, Math.round(9 * p.legLength));
  const jb0 = -Math.floor(bh / 2), jb1 = bh + jb0; // body rows
  const zb0 = -Math.floor(bl / 2), zb1 = bl + zb0; // body depth
  const legH = lh * U;
  const bodyY = legH + (Math.floor(bh / 2) - 1) * U;
  const headPos: V3 = [0, (jb1 + 1) * U, (zb1 + 1) * U];
  const eh = Math.max(2, Math.round(4 * p.earSize));
  const tl = tailStyle === 'stub' ? 2 : Math.max(3, Math.round(7 * p.tailLength));
  const legZf = (zb1 - 2.5) * U, legZb = (zb0 + 2.5) * U;
  const legZ = (legZf - legZb) / 2;
  const tailBase: V3 = [0, (jb1 - 2) * U, zb0 * U];

  // face projection (head-local): eye line on row 1, nose on the muzzle top-front
  const eyeY = 1.5 * U, noseY = -0.5 * U;
  const s = ((1 - EYE_LINE) - (1 - NOSE_DOT)) / (eyeY - noseY);
  const proj = (x: number, y: number): [number, number] => [0.5 + x * s, 1 - EYE_LINE + (y - eyeY) * s];

  const geo = useMemo(() => {
    const furBase = dog.furColor;
    const accent = dog.accentColor ?? '#F4E3CF';
    const fur = (i: number, j: number, k: number) => {
      let c = furBase;
      if (furPx) c = mixCss(furBase, samplePx(furPx as Pixels, ((i * 3 + k * 5) & 7) / 8 + 0.06, ((j * 3 + k) & 7) / 8 + 0.06), 0.55);
      return shadeCss(c, (hash(i, j, k) - 0.5) * 0.12);
    };

    // body
    const body = new VoxelSet();
    body.box(-4, 4, jb0, jb1, zb0, zb1, (i, j, k) => {
      const chest = marks.chest && k >= zb1 - 1 && Math.abs(i + 0.5) < 2.6 && j <= jb0 + 4;
      return chest ? shadeCss(accent, (hash(i, j, k) - 0.5) * 0.08) : fur(i, j, k);
    });
    if (fluff > 0.3) body.box(-4, 4, jb1 - 2, jb1 + 1, zb1 - 3, zb1, (i, j, k) => fur(i, j, k)); // ruff
    // head (8 × 7 × 7) + muzzle (4 × 3 × 3)
    const head = new VoxelSet();
    head.box(-4, 4, -3, 4, -4, 3, (i, j, k) => fur(i, j + 20, k));
    if (fluff > 0.45) {
      head.box(-5, -4, -3, 0, -2, 2, (i, j, k) => fur(i, j + 20, k));
      head.box(4, 5, -3, 0, -2, 2, (i, j, k) => fur(i, j + 20, k));
    }
    // muzzle: its sides / top take the photo's colours at that spot so it blends with the pixel face
    head.box(-2, 2, -3, 0, 3, 6, (i, j, k) => {
      if (!facePx) return fur(i, j + 40, k);
      const [uu, vv] = proj((i + 0.5) * U, (j + 0.5) * U);
      return shadeCss(samplePx(facePx, uu, vv), (hash(i, j, k) - 0.5) * 0.06);
    });
    // ears
    const ear = new VoxelSet();
    if (floppy) ear.box(0, 1, -eh, 1, -1, 2, (i, j, k) => shadeCss(fur(i, j + 60, k), -0.12));
    else
      for (let r = 0; r < eh; r++) {
        const w = Math.max(1, 3 - Math.floor((r * 3) / eh));
        ear.box(0, w, r, r + 1, 0, 1, (i, j, k) => fur(i, j + 60, k));
      }
    // legs (3 × 3), paw sticks out forward
    // split at the knee: the lower half hangs from its own pivot so the leg can bend
    const kneeJ = -Math.ceil(lh / 2);
    const legSet = (back: boolean, lower: boolean) => {
      const v = new VoxelSet();
      const col = (i: number, j: number, k: number) => (marks.socks && j < -lh + 3 ? accent : fur(i + (back ? 9 : 0), j, k));
      if (!lower) v.box(-1, 2, kneeJ, 1, -1, 2, col);
      else {
        // stored relative to the knee pivot
        v.box(-1, 2, -lh - kneeJ, 0, -1, 2, (i, j, k) => col(i, j + kneeJ, k));
        v.box(-1, 2, -lh - kneeJ, -lh - kneeJ + 1, 2, 3, () => (marks.socks ? accent : shadeCss(fur(0, -lh, 2), -0.05)));
      }
      return v;
    };
    // tail
    const tail = new VoxelSet();
    const tailVox: [number, number][] = []; // (j, k) steps
    if (tailStyle === 'stub') tailVox.push([0, -1], [0, -2]);
    else if (tailStyle === 'curled') {
      const r = Math.max(2, Math.round(tl / 3));
      for (let a = 0; a <= 12; a++) {
        const t = -Math.PI / 2 + (a / 12) * Math.PI * 1.5;
        tailVox.push([Math.round(r + Math.sin(t) * r), Math.round(-Math.cos(t) * r) - 1]);
      }
    } else {
      for (let n = 1; n <= tl; n++) {
        const f = n / tl;
        const dj = tailStyle === 'plume' ? Math.round(-2.2 * Math.sin(Math.PI * f * 0.9) + 2 * f * f) : Math.round(n * 0.8);
        tailVox.push([dj, -n]);
      }
    }
    const rows = tailStyle === 'plume' ? 3 : 2; // plume: deeper, feathered
    tailVox.forEach(([j, k], n) => {
      const tip = marks.tailTip && n >= tailVox.length - 2;
      for (let i = -1; i < 1; i++) for (let dj = 0; dj < rows; dj++) tail.set(i, j + dj - (rows === 3 ? 1 : 0), k, tip ? accent : fur(i, j + dj + 80, k));
    });

    return {
      body,
      head,
      bodyGeo: voxelGeometry(body, U, [0, 0, 0]),
      headGeo: voxelGeometry(head, U, [0, 0, 0]),
      earGeo: voxelGeometry(ear, U, [0, 0, 0]),
      legFront: voxelGeometry(legSet(false, false), U, [-0.5 * U, 0, -0.5 * U]),
      legBack: voxelGeometry(legSet(true, false), U, [-0.5 * U, 0, -0.5 * U]),
      lowFront: voxelGeometry(legSet(false, true), U, [-0.5 * U, 0, -0.5 * U]),
      lowBack: voxelGeometry(legSet(true, true), U, [-0.5 * U, 0, -0.5 * U]),
      kneeY: kneeJ * U,
      tailGeo: voxelGeometry(tail, U, [0, 0, 0]),
      // pixel face on the front of the head (around the muzzle) and the muzzle tip
      faceGeo: facePlane(-4 * U, 4 * U, -3 * U, 4 * U, 3 * U + 0.0008, proj),
      noseGeo: facePlane(-2 * U, 2 * U, -3 * U, 0, 6 * U + 0.0008, proj),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [furPx, facePx, dog.furColor, dog.accentColor, bh, bl, lh, eh, tl, tailStyle, floppy, fluff, marks.chest, marks.socks, marks.tailTip]);
  useEffect(
    () => () => [geo.bodyGeo, geo.headGeo, geo.earGeo, geo.legFront, geo.legBack, geo.lowFront, geo.lowBack, geo.tailGeo, geo.faceGeo, geo.noseGeo].forEach((g) => g.dispose()),
    [geo],
  );

  // ---- shape field for anchors & cloth (boxes, model space) ----
  const anchors = useMemo(() => {
    const B = (v: V3): V3 => [v[0], v[1] + bodyY, v[2]];
    const headW = B(headPos);
    const bodyLo = B([-4 * U, jb0 * U, zb0 * U]), bodyHi = B([4 * U, jb1 * U, zb1 * U]);
    const ruff = fluff > 0.3;
    const field = (x: number, y: number, z: number) => {
      let d = sdBox(x, y, z, bodyLo, bodyHi);
      if (ruff) d = Math.min(d, sdBox(x, y, z, B([-4 * U, (jb1 - 2) * U, (zb1 - 3) * U]), B([4 * U, (jb1 + 1) * U, zb1 * U])));
      d = Math.min(d, sdBox(x, y, z, [headW[0] - 4 * U, headW[1] - 3 * U, headW[2] - 4 * U], [headW[0] + 4 * U, headW[1] + 4 * U, headW[2] + 3 * U]));
      d = Math.min(d, sdBox(x, y, z, [headW[0] - 2 * U, headW[1] - 3 * U, headW[2] + 3 * U], [headW[0] + 2 * U, headW[1], headW[2] + 6 * U]));
      if (fluff > 0.45) d = Math.min(d, sdBox(x, y, z, [headW[0] - 5 * U, headW[1] - 3 * U, headW[2] - 2 * U], [headW[0] + 5 * U, headW[1], headW[2] + 2 * U]));
      return d;
    };
    const neckA = B([0, (jb1 - 1) * U, (zb1 - 1.5) * U]);
    const neckB: V3 = [0, headW[1] - 2.5 * U, headW[2] - 1 * U];
    const a = solveAnchors(field, { headC: headW, eyeY: headW[1] + eyeY, neckA, neckB, backC: B([0, 0, -0.02]) });
    const bodyO: V3 = [0, bodyY, 0];
    // box dog: the 'neck' is the level seam where the head sits on the body, only under the head
    // ear blocks (head grid) so hoods puff out over them
    const hb = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => (x: number, y: number, z: number) =>
      sdBox(x, y, z, [headW[0] + x0 * U, headW[1] + y0 * U, headW[2] + z0 * U], [headW[0] + x1 * U, headW[1] + y1 * U, headW[2] + z1 * U]);
    const earBoxes = floppy ? [hb(4, 5, 3 - eh, 4, -2, 1), hb(-5, -4, 3 - eh, 4, -2, 1)] : [hb(1, 4, 4, 4 + eh, -2, -1), hb(-4, -1, 4, 4 + eh, -2, -1)];
    const ears = (x: number, y: number, z: number) => Math.min(...earBoxes.map((f) => f(x, y, z)));
    const frame: DogFrame = {
      field,
      ears,
      girthZ: legZf - 2.5 * U,
      neckP: [0, bodyY + (jb1 - 2.5) * U, (zb1 - 1) * U],
      neckD: [0, 1, 0],
      neckR: 4 * U,
      // only round the body just under the head – not along the head's overhang past the chest
      neckClip: (q) => Math.max(headW[2] - 4.6 * U - q[2], q[2] - (zb1 + 1) * U),
      neckZone: (q) => headW[2] - 4.6 * U - q[2],
      headC: headW,
      R: 4 * U,
      bodyY,
      legH,
      rumpZ: zb0 * U,
      skinnedTail: false,
      skinnedLegs: false,
      min: [-6 * U, legH - 2 * U, zb0 * U - 2 * U],
      max: [6 * U, headW[1] + 6 * U, headW[2] + 8 * U],
      voxel: { u: U, origins: { body: bodyO, head: headW }, hidden: { body: geo.body, head: geo.head } },
    };
    return { head: localTo(a.head, headW), face: localTo(a.face, headW), back: localTo(a.back, bodyO), frame, headW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bh, bl, lh, fluff, bodyY, geo, floppy, eh]);
  // cube-built hats / glasses / packs on the same grid
  const items = useMemo(() => {
    const ears = new VoxelSet();
    if (floppy) for (const x of [4, -5]) ears.box(x, x + 1, 3 - eh, 4, -2, 1, () => '#000');
    else
      for (let r = 0; r < eh; r++) {
        const w = Math.max(1, 3 - Math.floor((r * 3) / eh));
        ears.box(1, 1 + w, 4 + r, 5 + r, -2, -1, () => '#000');
        ears.box(-4, -4 + w, 4 + r, 5 + r, -2, -1, () => '#000');
      }
    const head = new VoxelSet();
    for (const id of [wearsHood(dog.equipped.body) ? undefined : dog.equipped.head, dog.equipped.face]) {
      const t = id ? TRINKET_MAP[id] : undefined;
      if (t) voxelHeadItem(t, { ears }).map.forEach((c, k) => head.map.set(k, c));
    }
    const backT = dog.equipped.back ? TRINKET_MAP[dog.equipped.back] : undefined;
    const back = backT ? voxelBackItem(backT, { jb1, zb0, zb1 }) : new VoxelSet();
    return {
      head: head.map.size ? voxelGeometry(head, U, [0, 0, 0], geo.head) : null,
      back: back.map.size ? voxelGeometry(back, U, [0, 0, 0], geo.body) : null,
    };
  }, [dog.equipped.head, dog.equipped.face, dog.equipped.back, dog.equipped.body, floppy, eh, jb1, zb0, zb1, geo]);
  useEffect(() => () => [items.head, items.back].forEach((g) => g?.dispose()), [items]);

  const costumes = useCostumes(anchors.frame, ['pixel', bh, bl, lh, eh, tl, floppy, fluff > 0.3, fluff > 0.45, dog.furColor].join(','), dog.equipped);
  // a hood swallows the ears
  const hooded = costumes.some((c) => c.layers.some((l) => l.frame === 'head'));
  const clothMat = useClothMaterial(true, 'pixel');

  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), []);
  const faceMat = useMemo(() => new THREE.MeshLambertMaterial({ transparent: false }), []);
  useEffect(() => () => [mat, faceMat].forEach((m) => m.dispose()), [mat, faceMat]);
  faceMat.map = faceTex;
  faceMat.visible = !!faceTex;
  faceMat.needsUpdate = true;

  // ---- animation (same poses as the other styles) ----
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const ears = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const pose = useRef(newPose());
  const earSpring = useRef([
    { a: 0, v: 0 },
    { a: 0, v: 0 },
  ]);
  const prevY = useRef<{ y: number; vy: number } | null>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, Math.max(0.001, delta));
    const b = body.current, h = headRef.current, tlg = tail.current, r = root.current;
    if (!b || !h || !tlg || !r) return;
    const walk = anim === 'walk';
    const happy = anim === 'happy';
    const sleepy = anim === 'sleepy';
    const P = stepPose(pose.current, anim, t, legZ, legH);
    const posed = Math.abs(P.rootRotX) > 0.02;
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      const kn = knees.current[i];
      let k = 0;
      if (sleepy) leg.rotation.x = i < 2 ? -1.35 : 1.35;
      else if (posed) {
        leg.rotation.x = i < 2 ? P.front + (happy ? (i ? 0.25 : 0) : 0) : P.back;
        if (happy && i < 2) k = 0.7 + Math.sin(t * 16 + i) * 0.35;
      } else if (walk) {
        const ph = t * 9 + (i === 0 || i === 3 ? 0 : Math.PI);
        leg.rotation.x = Math.sin(ph) * 0.5;
        k = Math.max(0, -Math.cos(ph)) * 0.9; // knee folds while the foot is in the air
      } else leg.rotation.x = 0;
      if (kn) kn.rotation.x = k;
    });
    const drop = sleepy ? -legH * 0.88 : 0;
    // bob in whole cubes-ish steps for a crunchy feel
    b.position.y = bodyY + drop + (walk ? Math.round(Math.abs(Math.sin(t * 9)) * 2) * U * 0.5 : 0);
    tlg.rotation.y = sleepy ? Math.sin(t * 0.8) * 0.12 : Math.sin(t * (walk ? 10 : P.tailSpeed)) * (walk ? 0.45 : P.tailAmp);
    h.rotation.z = happy ? Math.sin(t * 9) * 0.12 : anim === 'idle' || anim === 'sit' ? Math.sin(t * 0.8) * 0.06 : 0;
    h.rotation.x = walk ? Math.sin(t * 9) * 0.05 : sleepy ? 0.38 : P.headX;
    r.rotation.set(P.rootRotX, 0, 0);
    r.position.set(0, P.rootY, P.rootZ);
    // ears: damped springs kicked by the body's up/down acceleration – they bounce and settle
    const hy = b.position.y + r.position.y;
    const pv = prevY.current;
    const vy = pv ? (hy - pv.y) / dt : 0;
    const ay = pv ? (vy - pv.vy) / dt : 0;
    prevY.current = { y: hy, vy };
    const K = floppy ? 140 : 260, C = floppy ? 7 : 14, G = floppy ? 0.03 : 0.012;
    ears.current.forEach((e, i) => {
      if (!e) return;
      const sgn = i ? -1 : 1;
      const sp = earSpring.current[i];
      const rest = floppy ? 0 : sleepy ? 0.35 : 0;
      const kick = Math.max(-40, Math.min(40, ay)) * G + (happy ? Math.sin(t * 18 + i) * 1.5 : 0);
      sp.v += (-K * (sp.a - rest) - C * sp.v + kick * K * 0.1) * dt;
      sp.a = Math.max(-0.6, Math.min(0.9, sp.a + sp.v * dt));
      e.rotation.z = sgn * sp.a;
    });
  });

  const tap = (e: ThreeEvent<MouseEvent>) => {
    if (!onTap) return;
    e.stopPropagation();
    onTap();
  };

  const legPos: [number, number, boolean][] = [
    [2.5 * U, legZf, false],
    [-2.5 * U, legZf, false],
    [2.5 * U, legZb, true],
    [-2.5 * U, legZb, true],
  ];

  return (
    <group {...props}>
      <group
        ref={root}
        onClick={tap}
        onPointerDown={(e) => {
          if (onPetStart) {
            e.stopPropagation();
            onPetStart();
          }
        }}
      >
        {legPos.map(([x, z, back], i) => (
          <group key={i} position={[x, legH, z]} ref={(g) => { legs.current[i] = g; }}>
            <mesh geometry={back ? geo.legBack : geo.legFront} material={mat} />
            <group position={[0, geo.kneeY, 0]} ref={(g) => { knees.current[i] = g; }}>
              <mesh geometry={back ? geo.lowBack : geo.lowFront} material={mat} />
            </group>
          </group>
        ))}
        <group ref={body} position={[0, bodyY, 0]}>
          <mesh geometry={geo.bodyGeo} material={mat} />
          {items.back && <mesh geometry={items.back} material={mat} />}
          <RigidCostume costumes={costumes} frame="body" origin={[0, bodyY, 0]} material={clothMat} />
          <group ref={tail} position={tailBase}>
            <mesh geometry={geo.tailGeo} material={mat} />
          </group>
          <group ref={headRef} position={headPos}>
            <mesh geometry={geo.headGeo} material={mat} />
            <mesh geometry={geo.faceGeo} material={faceMat} />
            <mesh geometry={geo.noseGeo} material={faceMat} />
            {!hooded && [1, -1].map((sx, i) => (
              <group
                key={sx}
                ref={(g) => { ears.current[i] = g; }}
                position={floppy ? [sx > 0 ? 4 * U : -5 * U, 3 * U, -1 * U] : [sx > 0 ? 1 * U : -4 * U, 4 * U, -2 * U]}
              >
                <mesh geometry={geo.earGeo} material={mat} />
              </group>
            ))}
            {items.head && <mesh geometry={items.head} material={mat} />}
            <RigidCostume costumes={costumes} frame="head" origin={anchors.headW} material={clothMat} />
          </group>
        </group>
      </group>
    </group>
  );
}
