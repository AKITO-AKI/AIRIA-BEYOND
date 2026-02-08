import * as THREE from 'three';

export function createToonGradientTexture(steps: number = 4): THREE.DataTexture {
  const s = Math.max(2, Math.min(8, Math.round(steps)));
  const data = new Uint8Array(s);
  for (let i = 0; i < s; i += 1) {
    // Evenly spaced bands (0..255). This produces crisp posterized shading with MeshToonMaterial.
    data[i] = Math.round((i / (s - 1)) * 255);
  }

  const tex = new THREE.DataTexture(data, s, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createNoiseTexture(size: number = 64): THREE.DataTexture {
  const s = Math.max(8, Math.min(256, Math.round(size)));
  const data = new Uint8Array(s * s);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.floor(Math.random() * 256);
  }

  const tex = new THREE.DataTexture(data, s, s, THREE.RedFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export type GrainOptions = {
  strength?: number;
  scale?: number;
  speed?: number;
};

export function patchMaterialWithGrain(
  material: THREE.Material | null | undefined,
  noiseTex: THREE.Texture,
  options: GrainOptions = {}
): void {
  if (!material) return;
  const strength = Math.max(0, Math.min(0.35, Number(options.strength ?? 0.08)));
  const scale = Math.max(1, Math.min(64, Number(options.scale ?? 10)));
  const speed = Math.max(0, Math.min(2, Number(options.speed ?? 0.35)));

  (material as any).onBeforeCompile = (shader: any) => {
    shader.uniforms.uNoiseTex = { value: noiseTex };
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uGrainStrength = { value: strength };
    shader.uniforms.uGrainScale = { value: scale };
    shader.uniforms.uGrainSpeed = { value: speed };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n\nuniform sampler2D uNoiseTex;\nuniform float uTime;\nuniform float uGrainStrength;\nuniform float uGrainScale;\nuniform float uGrainSpeed;\n`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n\n// Subtle paper-grain (illustration vibe)\n// Guard UV usage: vUv only exists when USE_UV is enabled.\nvec2 grainBaseUv = vec2(0.0);\n#ifdef USE_UV\n  grainBaseUv = vUv;\n#else\n  // Stable fallback on materials without UVs.\n  grainBaseUv = gl_FragCoord.xy * 0.001;\n#endif\n\nvec2 grainUv = grainBaseUv * uGrainScale + vec2(uTime * uGrainSpeed * 0.13, uTime * uGrainSpeed * 0.07);\nfloat g = texture2D(uNoiseTex, fract(grainUv)).r;\nfloat grain = (g - 0.5) * 0.28;\nvec3 grained = gl_FragColor.rgb * (1.0 + grain);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, grained, uGrainStrength);\n`
      );

    (material as any).userData.__grainShader = shader;
  };

  (material as any).userData.__grain = { strength, scale, speed };
  material.needsUpdate = true;
}

export function updateMaterialGrainTime(material: THREE.Material | null | undefined, timeSec: number): void {
  if (!material) return;
  const shader = (material as any).userData?.__grainShader;
  if (shader?.uniforms?.uTime) {
    shader.uniforms.uTime.value = Number(timeSec) || 0;
  }
}
