'use client';

/**
 * Sculpted dog (default model): one seamless skinned mesh built from blended soft parts
 * (see sculpt/buildDog.ts). Box 1 (face crop) is projected onto the front of the head and
 * muzzle, Box 2 (fur swatch) is wrapped over the body with triplanar mapping, and bones
 * drive the same idle / walk / happy jump / sit / sleepy poses as the other models.
 */
import { wearsHood } from './costume';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, type ThreeEvent, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { DogProfile } from '@/lib/types';
import { useImageTexture } from './useImageTexture';
import { TrinketAt } from './Trinket';
import { localTo } from './anchors';
import type { DogAnim } from './Dog3D';
import { newPose, stepPose } from './dogPose';
import { buildSculptDog, sculptKey } from './sculpt/buildDog';
import { CostumeExtras, useClothMaterial, useCostumes } from './DogCostume';

function useFaceTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return setTex(null);
    let alive = true;
    const t = new THREE.TextureLoader().load(url, () => alive && setTex(t));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return () => {
      alive = false;
      t.dispose();
    };
  }, [url]);
  return tex;
}

/** Dog material with the face projection, triplanar fur and accent markings (soft Lambert). */
function makeDogMaterial() {
  const uniforms = {
    uFace: { value: null as THREE.Texture | null },
    uHasFace: { value: 0 },
    uFur: { value: null as THREE.Texture | null },
    uHasFur: { value: 0 },
    uFurColor: { value: new THREE.Color('#d9a066') },
    uAccent: { value: new THREE.Color('#f4e3cf') },
    uFurScale: { value: 1.5 },
    uSnap: { value: 0 },
  };
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 faceUv; attribute float faceW; attribute float accentW;
varying vec2 vFaceUv; varying float vFaceW; varying float vAccentW;
varying vec3 vRestPos; varying vec3 vRestN;
uniform float uSnap;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFaceUv = faceUv; vFaceW = faceW; vAccentW = accentW; vRestPos = position; vRestN = normal;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
if (uSnap > 0.0) { vec4 sp = gl_Position; sp.xy = floor(sp.xy / sp.w * uSnap + 0.5) / uSnap * sp.w; gl_Position = sp; }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vFaceUv; varying float vFaceW; varying float vAccentW;
varying vec3 vRestPos; varying vec3 vRestN;
uniform sampler2D uFace; uniform float uHasFace;
uniform sampler2D uFur; uniform float uHasFur; uniform vec3 uFurColor; uniform vec3 uAccent; uniform float uFurScale;`,
      )
      .replace(
        '#include <map_fragment>',
        `vec3 tw = pow(abs(normalize(vRestN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
vec3 fur = uFurColor;
if (uHasFur > 0.5) {
  vec3 q = vRestPos * uFurScale;
  vec3 tx = texture2D(uFur, q.zy).rgb * tw.x + texture2D(uFur, q.xz).rgb * tw.y + texture2D(uFur, q.xy).rgb * tw.z;
  // keep the fur's real colour but calm the swatch pattern so it reads as soft fur, not stripes
  fur = mix(uFurColor, tx, 0.45);
}
// natural fur shading: a touch lighter on top, a touch deeper underneath
fur *= mix(0.9, 1.06, smoothstep(-0.6, 0.8, normalize(vRestN).y));
fur = mix(fur, uAccent, clamp(vAccentW, 0.0, 1.0));
vec3 col = fur;
if (uHasFace > 0.5) {
  vec2 fuv = vFaceUv;
  float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
  float r = length(fuv - 0.5) * 2.0;
  vec2 cuv = clamp(fuv, 0.0, 1.0);
  vec4 fc = texture2D(uFace, cuv);
  // only the photo's strong dark features (eyes, nose, mouth) come through; everything else
  // (light patches, shading, the photo's own fur colour) is replaced by the dog's fur, so there
  // are no squares or colour blocks. Darkness is measured against a blurred copy of the photo.
  vec3 blur = texture2D(uFace, cuv, 5.0).rgb;
  float lumB = max(dot(blur, vec3(0.299, 0.587, 0.114)), 0.05);
  float lumF = dot(fc.rgb, vec3(0.299, 0.587, 0.114));
  // sharp dark features (pupils, nose, mouth lines)
  float dark = smoothstep(0.3, 0.62, (lumB - lumF) / lumB);
  // inside a small dark patch (an eye): keep the photo there and make its sparkle pure white
  float lumE = dot(texture2D(uFace, cuv, 2.8).rgb, vec3(0.299, 0.587, 0.114)); // eye-sized blur
  float inEye = smoothstep(0.12, 0.3, (lumB - lumE) / lumB);
  vec3 photo = mix(fc.rgb, vec3(1.0), inEye * smoothstep(0.3, 0.55, lumF));
  vec3 feat = mix(fur, photo, max(dark, inEye));
  // a slightly lighter muzzle around the nose
  float muz = 1.0 - smoothstep(0.1, 0.24, length((fuv - vec2(0.5, 0.33)) * vec2(1.0, 1.35)));
  feat = mix(feat, mix(feat, vec3(1.0), 0.22), muz);
  float m = clamp(vFaceW, 0.0, 1.0) * inside * fc.a * (1.0 - smoothstep(0.55, 0.95, r));
  col = mix(fur, feat, m);
}
diffuseColor.rgb *= col;`,
      );
  };
  return { mat, uniforms };
}

export function DogSculpt({
  dog,
  anim = 'idle',
  onTap,
  onPetStart,
  ...props
}: { dog: DogProfile; anim?: DogAnim; onTap?: () => void; onPetStart?: () => void } & ThreeElements['group']) {
  const furTex = useImageTexture(dog.furImg, 1, true);
  const faceTex = useFaceTexture(dog.faceImg);
  const build = useMemo(() => buildSculptDog(dog), [dog]);
  const { mat, uniforms } = useMemo(() => makeDogMaterial(), []);
  useEffect(() => () => mat.dispose(), [mat]);

  uniforms.uFace.value = faceTex;
  uniforms.uHasFace.value = faceTex ? 1 : 0;
  uniforms.uFur.value = furTex;
  uniforms.uHasFur.value = furTex ? 1 : 0;
  uniforms.uFurColor.value.set(dog.furColor);
  uniforms.uAccent.value.set(dog.accentColor ?? '#F4E3CF');
  if (furTex && furTex.wrapS !== THREE.RepeatWrapping) {
    furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping;
    furTex.needsUpdate = true;
  }

  // skeleton + skinned mesh for this shape
  const rig = useMemo(() => {
    const bones = build.bones.map((b) => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      return bone;
    });
    build.bones.forEach((b, i) => {
      const parentPos = b.parent >= 0 ? build.bones[b.parent].pos : [0, 0, 0];
      bones[i].position.set(b.pos[0] - parentPos[0], b.pos[1] - parentPos[1], b.pos[2] - parentPos[2]);
      if (b.parent >= 0) bones[b.parent].add(bones[i]);
    });
    const mesh = new THREE.SkinnedMesh(build.geometry, mat);
    mesh.add(bones[0]);
    bones[0].updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.frustumCulled = false;
    // ears: their own mesh on the same skeleton (rigid on the ear bones)
    const ears = new THREE.SkinnedMesh(build.earGeometry, mat);
    ears.bind(mesh.skeleton, mesh.bindMatrix);
    ears.frustumCulled = false;
    return { mesh, ears, bones };
  }, [build, mat]);
  useEffect(() => () => rig.mesh.skeleton.dispose(), [rig]);

  // body-shaped cloth (collars, bandanas, outfits) skinned to the same skeleton
  const costumes = useCostumes(build.frame, sculptKey(dog), dog.equipped);
  const clothMat = useClothMaterial(false);
  const cloth = useMemo(
    () =>
      costumes.flatMap((c) => c.layers).map((l) => {
        const g = l.geometry.clone();
        const { skinIndex, skinWeight } = build.skinFor(g.getAttribute('position').array);
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
        const m = new THREE.SkinnedMesh(g, clothMat);
        m.bind(rig.mesh.skeleton, rig.mesh.bindMatrix);
        m.frustumCulled = false;
        return m;
      }),
    [costumes, build, rig, clothMat],
  );
  useEffect(() => () => cloth.forEach((m) => m.geometry.dispose()), [cloth]);

  const hooded = wearsHood(dog.equipped.body);

  const root = useRef<THREE.Group>(null);
  const pose = useRef(newPose());
  const { legZ, legH, bodyY } = build;
  // ear springs: [flap, swing] angle + velocity per ear, and the body height history
  const earSpring = useRef([
    { a: 0, v: 0, b: 0, w: 0 },
    { a: 0, v: 0, b: 0, w: 0 },
  ]);
  const prevY = useRef<{ y: number; vy: number } | null>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, Math.max(0.001, delta));
    const r = root.current;
    if (!r) return;
    const B = rig.bones;
    const body = B[build.BODY], head = B[build.HEAD];
    const walk = anim === 'walk';
    const happy = anim === 'happy';
    const sleepy = anim === 'sleepy';
    const S = build.sit;
    const P = stepPose(pose.current, anim, t, legZ, legH, S);
    const posed = Math.abs(P.rootRotX + S.a * P.sit) > 0.02;

    build.LEGS.forEach((li, i) => {
      const upper = B[li], knee = B[build.KNEES[i]], paw = B[build.PAWS[i]];
      const front = i < 2;
      let u = 0, k = 0, w = 0;
      if (sleepy) {
        // lying down: front legs reach forward, hind legs tucked
        u = front ? -1.4 : 1.4;
        k = front ? 0.25 : -0.5;
      } else if (posed) {
        u = front ? P.front + (happy ? (i ? 0.25 : 0) : 0) : P.back;
        if (happy && front) k = 0.7 + Math.sin(t * 16 + i) * 0.35; // paws paddling from the elbow
      } else if (walk) {
        // gait: thigh swings, the knee folds while the foot is lifted, the paw flicks and lands flat
        const ph = t * 9 + (i === 0 || i === 3 ? 0 : Math.PI);
        u = Math.sin(ph) * 0.45;
        const lift = Math.max(0, -Math.cos(ph));
        k = front ? lift * 0.95 : lift * 0.75;
        w = -(u + k) * (1 - lift * 0.5);
      }
      // blend into the solved sit
      const s = P.sit;
      const su = front ? S.a : S.bu, sk = front ? 0 : S.bk, sw = front ? 0 : S.bp;
      upper.rotation.x = u * (1 - s) + su * s;
      knee.rotation.x = k * (1 - s) + sk * s;
      paw.rotation.x = w * (1 - s) + sw * s;
    });

    const drop = sleepy ? -legH * 0.85 : 0;
    body.position.y = bodyY + drop + (walk ? Math.abs(Math.sin(t * 9)) * 0.035 : Math.sin(t * 2) * 0.008);
    body.rotation.z = walk ? Math.sin(t * 9) * 0.03 : 0;
    const breathe = anim === 'idle' || anim === 'sit' ? Math.sin(t * 2) * 0.015 : sleepy ? Math.sin(t * 1.3) * 0.03 : 0;
    body.scale.set(1 + breathe * 0.5, 1 + breathe, 1);

    // tail: wag at the base, a lagging wave down the chain
    const tAmp = sleepy ? 0.15 : walk ? 0.5 : P.tailAmp;
    const tSpd = sleepy ? 0.8 : walk ? 10 : P.tailSpeed;
    build.TAILS.forEach((ti, k) => {
      B[ti].rotation.y = Math.sin(t * tSpd - k * 0.7) * tAmp * (k === 0 ? 1 : 0.45);
      // sitting: the tail lies back along the ground instead of following the pitch into it
      B[ti].rotation.x = (sleepy && k === 0 ? 0.5 : 0) + (k === 0 ? S.a * 0.95 * P.sit : 0);
    });

    head.rotation.z = happy ? Math.sin(t * 9) * 0.12 : anim === 'idle' || anim === 'sit' ? Math.sin(t * 0.8) * 0.1 : 0;
    head.rotation.x = walk ? Math.sin(t * 9) * 0.05 : sleepy ? 0.4 : P.headX;
    head.rotation.y = anim === 'idle' ? Math.sin(t * 0.5) * 0.12 : 0;

    r.rotation.set(P.rootRotX, 0, 0);
    r.position.set(0, P.rootY, P.rootZ);

    // ears: damped springs pushed by the head's up/down acceleration, so they bounce and settle
    const hy = body.position.y + r.position.y;
    const pv = prevY.current;
    const vy = pv ? (hy - pv.y) / dt : 0;
    const ay = pv ? (vy - pv.vy) / dt : 0;
    prevY.current = { y: hy, vy };
    const pointy = dog.earStyle === 'pointy';
    const K = pointy ? 260 : 140, C = pointy ? 14 : 7, G = pointy ? 0.012 : 0.03;
    build.EARS.forEach((ei, i) => {
      const s = i ? -1 : 1;
      const sp = earSpring.current[i];
      const rest = sleepy ? (pointy ? -0.35 : 0.1) : 0;
      const kick = Math.max(-40, Math.min(40, ay)) * G + (happy ? Math.sin(t * 18 + i) * 1.5 : 0);
      sp.v += (-K * (sp.a - rest) - C * sp.v + kick * K * 0.1) * dt;
      sp.a = Math.max(-0.6, Math.min(0.9, sp.a + sp.v * dt));
      // swing back a little with forward motion
      const swingRest = walk ? 0.12 + Math.sin(t * 9 + i) * 0.05 : 0;
      sp.w += (-K * (sp.b - swingRest) - C * sp.w) * dt;
      sp.b += sp.w * dt;
      B[ei].rotation.z = s * sp.a;
      B[ei].rotation.x = sp.b;
    });
  });

  const tap = (e: ThreeEvent<MouseEvent>) => {
    if (!onTap) return;
    e.stopPropagation();
    onTap();
  };

  const bodyOrigin: [number, number, number] = [0, build.bodyY, 0];
  const bodyBone = rig.bones[build.BODY];
  const headBone = rig.bones[build.HEAD];

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
        <primitive object={rig.mesh} />
        {/* a hood swallows the ears (they show as bumps on it) */}
        {!hooded && <primitive object={rig.ears} />}
        {cloth.map((m) => (
          <primitive key={m.uuid} object={m} />
        ))}
      </group>
      {/* trinkets ride on the bones, seated on the measured fur surface (anchors.ts) */}
      {createPortal(
        <>
          <TrinketAt id={dog.equipped.back} a={localTo(build.anchors.back, bodyOrigin)} />
          <CostumeExtras costumes={costumes} frame="body" origin={bodyOrigin} />
        </>,
        bodyBone,
      )}
      {createPortal(
        <>
          <TrinketAt id={wearsHood(dog.equipped.body) ? undefined : dog.equipped.head} a={localTo(build.anchors.head, build.headC)} />
          <TrinketAt id={dog.equipped.face} a={localTo(build.anchors.face, build.headC)} />
          <CostumeExtras costumes={costumes} frame="head" origin={build.headC} />
        </>,
        headBone,
      )}
    </group>
  );
}
