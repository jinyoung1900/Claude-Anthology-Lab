/** Shared bits for the cartoon (Toon) look. */
import * as THREE from 'three';

/** 3-step light ramp for the cartoon look */
let toonRamp: THREE.DataTexture | null = null;
export function getToonRamp() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.generateMipmaps = false;
    toonRamp.needsUpdate = true;
  }
  return toonRamp;
}

/** ink outline: the same skinned shape drawn back-faced and pushed out along its normals */
export function makeOutlineMaterial(width = 0.014) {
  const m = new THREE.MeshBasicMaterial({ color: '#2a1a10', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>
#ifdef USE_SKINNING
  vec3 oN = normalize((skinMatrix * vec4(normal, 0.0)).xyz);
#else
  vec3 oN = normalize(normal);
#endif
transformed += oN * ${width.toFixed(4)};`,
    );
  };
  return m;
}

