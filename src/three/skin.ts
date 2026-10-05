import * as THREE from "three";
import { PIVOT_ANKLE, PIVOT_HIP, PIVOT_KNEE, type Rig } from "./bodyRig";

/**
 * 程序化体表（皮肤层）。
 *
 * BodyParts3D 肌骨数据包不含皮肤网格，这里按模型的实测骨性标志
 * （米制、Y 向上、面朝 +Z）生成与骨骼对位的体表人偶。人偶与骨骼共用
 * 同一套刚体分组，因此体位切换时皮肤会跟随肢体折叠。
 */

export const SKIN_COLOR = 0xf0c9a8;

const ORIGIN_UPPER = new THREE.Vector3(0, 0, 0);
const ORIGIN_THIGH = PIVOT_HIP;
const ORIGIN_SHANK = PIVOT_KNEE;
const ORIGIN_FOOT = PIVOT_ANKLE;

function skinMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: SKIN_COLOR,
    roughness: 0.74,
    metalness: 0,
    transparent: true,
    opacity: 1,
  });
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function limb(from: THREE.Vector3, to: THREE.Vector3, rFrom: number, rTo: number, mat: THREE.Material): THREE.Mesh {
  const dir = to.clone().sub(from);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry((rFrom + rTo) / 2, Math.max(len - rFrom - rTo, 0.001), 6, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function blob(c: THREE.Vector3, rx: number, ry: number, rz: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), mat);
  mesh.position.copy(c);
  mesh.scale.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(c: THREE.Vector3, hx: number, hy: number, hz: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2, 3, 3, 3), mat);
  mesh.position.copy(c);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export interface SkinParts {
  meshes: THREE.Mesh[];
  setOpacity(opacity: number): void;
  setVisible(v: boolean): void;
}

interface Builder {
  limb(from: THREE.Vector3, to: THREE.Vector3, r1: number, r2: number): void;
  blob(c: THREE.Vector3, rx: number, ry: number, rz: number): void;
  box(c: THREE.Vector3, hx: number, hy: number, hz: number): void;
}

function makeBuilder(parent: THREE.Group, origin: THREE.Vector3, mat: THREE.Material, sink: THREE.Mesh[]): Builder {
  const toLocal = (p: THREE.Vector3) => p.clone().sub(origin);
  const push = (m: THREE.Mesh) => {
    parent.add(m);
    sink.push(m);
  };
  return {
    limb: (a, b, r1, r2) => push(limb(toLocal(a), toLocal(b), r1, r2, mat)),
    blob: (c, rx, ry, rz) => push(blob(toLocal(c), rx, ry, rz, mat)),
    box: (c, hx, hy, hz) => push(box(toLocal(c), hx, hy, hz, mat)),
  };
}

/** 把体表人偶挂载到刚体分组，返回可整体控制的句柄。 */
export function buildSkin(rig: Rig): SkinParts {
  const mat = skinMaterial();
  const meshes: THREE.Mesh[] = [];

  const upper = makeBuilder(rig.upper, ORIGIN_UPPER, mat, meshes);
  upper.blob(V(0, 1.53, 0.078), 0.093, 0.113, 0.105);
  upper.blob(V(0, 1.462, 0.122), 0.062, 0.05, 0.075);
  upper.limb(V(0, 1.375, 0.07), V(0, 1.455, 0.072), 0.056, 0.05);
  upper.blob(V(0, 1.2, 0.085), 0.157, 0.175, 0.1);
  upper.blob(V(0, 1.03, 0.088), 0.128, 0.115, 0.088);
  upper.blob(V(0, 0.875, 0.085), 0.148, 0.105, 0.095);

  for (const s of [1, -1]) {
    upper.blob(V(0.168 * s, 1.325, 0.072), 0.062, 0.058, 0.062);
    upper.limb(V(0.17 * s, 1.315, 0.072), V(0.163 * s, 1.05, 0.078), 0.052, 0.044);
    upper.limb(V(0.163 * s, 1.04, 0.078), V(0.148 * s, 0.822, 0.102), 0.045, 0.034);
    upper.box(V(0.147 * s, 0.755, 0.118), 0.033, 0.066, 0.019);
    upper.limb(V(0.147 * s, 0.7, 0.125), V(0.147 * s, 0.66, 0.142), 0.019, 0.013);
  }

  const thigh = makeBuilder(rig.thigh, ORIGIN_THIGH, mat, meshes);
  for (const s of [1, -1]) {
    thigh.limb(V(0.087 * s, 0.85, 0.078), V(0.08 * s, 0.4, 0.078), 0.086, 0.06);
    thigh.blob(V(0.08 * s, 0.4, 0.078), 0.062, 0.05, 0.06);
  }

  const shank = makeBuilder(rig.shank, ORIGIN_SHANK, mat, meshes);
  for (const s of [1, -1]) {
    shank.limb(V(0.08 * s, 0.372, 0.078), V(0.075 * s, 0.03, 0.078), 0.058, 0.036);
    shank.limb(V(0.075 * s, 0.04, 0.055), V(0.075 * s, 0.03, 0.1), 0.03, 0.03);
  }

  const foot = makeBuilder(rig.foot, ORIGIN_FOOT, mat, meshes);
  for (const s of [1, -1]) {
    foot.box(V(0.075 * s, -0.03, 0.045), 0.04, 0.042, 0.05);
    foot.blob(V(0.075 * s, -0.045, 0.14), 0.04, 0.026, 0.058);
  }

  return {
    meshes,
    setOpacity(opacity: number) {
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      mat.depthWrite = opacity >= 0.999;
      mat.needsUpdate = true;
    },
    setVisible(v: boolean) {
      for (const m of meshes) m.visible = v;
    },
  };
}
