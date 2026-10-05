import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  calculateViewFit,
  defaultAssetResolver,
  findGltfNode,
  assertSelfContainedGlb,
  verifyAssetBytes,
} from "@somakine/viewer";
import type { StructureType } from "@somakine/core";
import { LAYER_COLOR, LOCALE, catalog, pack, sid, structureOf } from "../anatomy/pack";
import { JOINTS } from "../anatomy/atlas";
import { createRig, limbNodeOf, limbOriginOf, type PoseDef, type Rig } from "./bodyRig";
import { buildSkin, type SkinParts } from "./skin";

/* ------------------------------------------------------------------ */
/* 资源缓存：解析后的 GLB 场景在多个 Stage 实例之间共享 */
/* ------------------------------------------------------------------ */

const sceneCache = new Map<string, Promise<THREE.Group>>();
const loader = new GLTFLoader();

function loadGltf(uri: string): Promise<THREE.Group> {
  let p = sceneCache.get(uri);
  if (!p) {
    p = (async () => {
      const asset = pack.assets.find((a) => a.kind === "gltf" && a.uri === uri);
      if (!asset || asset.kind !== "gltf") throw new Error(`未知资产: ${uri}`);
      const bytes = await defaultAssetResolver(asset, new AbortController().signal);
      assertSelfContainedGlb(bytes);
      await verifyAssetBytes(asset, bytes);
      const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) =>
        loader.parse(bytes, "", res, rej as (e: unknown) => void),
      );
      gltf.scene.updateMatrixWorld(true);
      return gltf.scene;
    })();
    sceneCache.set(uri, p);
  }
  return p;
}

export function preloadBoneAssets(onProgress?: (done: number, total: number) => void): Promise<void> {
  const uris = new Set<string>();
  for (const rep of pack.representations) {
    const st = structureOf(rep.structureId);
    if (!st || st.type !== "bone" || rep.mode === "unavailable") continue;
    for (const iid of rep.instanceIds) {
      const inst = pack.meshInstances.find((m) => m.id === iid);
      const asset = inst && pack.assets.find((a) => a.id === inst.assetId);
      if (asset && asset.kind === "gltf") uris.add(asset.uri);
    }
  }
  const list = [...uris];
  let done = 0;
  return Promise.all(
    list.map((uri) =>
      loadGltf(uri).then((r) => {
        done++;
        onProgress?.(done, list.length);
        return r;
      }),
    ),
  ).then(() => undefined);
}

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export interface ViewportSpec {
  /** 归一化矩形 [0..1]，左上为原点 */
  rect: [number, number, number, number];
  /** 相机注视的世界坐标（内容坐标系） */
  target: THREE.Vector3;
  distance: number;
  interactive?: boolean;
}

export interface ArrowSpec {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color?: string;
  radius?: number;
  headLength?: number;
}

export interface StageSelection {
  structureId: string;
  label: string;
  type: StructureType;
  side: "none" | "left" | "right" | "bilateral";
  point: THREE.Vector3;
}

export interface PickResult {
  structureId?: string;
  point: THREE.Vector3;
  /** 命中体表（皮肤层）而非具体结构 */
  onSkin: boolean;
  distance: number;
}

export interface StageOptions {
  container: HTMLElement;
  background?: string | null;
  onSelect?: (sel: StageSelection | null) => void;
  onHover?: (sel: StageSelection | null) => void;
  onFrame?: () => void;
  onAssetProgress?: (loaded: number, total: number) => void;
  singleViewport?: boolean;
}

const BASE_DIR = new THREE.Vector3(0, 0.2, 1).normalize();
const MIN_DIST = 0.12;

function materialFor(type: StructureType): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(LAYER_COLOR[type] ?? "#cccccc"),
    roughness: type === "bone" ? 0.62 : 0.7,
    metalness: 0.02,
    emissive: new THREE.Color("#000000"),
    emissiveIntensity: 0.6,
    transparent: false,
    opacity: 1,
    side: THREE.FrontSide,
  });
}

export class AnatomyStage {
  readonly container: HTMLElement;
  readonly rig: Rig;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private animationId = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  private contentGroup = new THREE.Group();
  private structureRoot = new THREE.Group();
  private annotationRoot = new THREE.Group();
  private skin: SkinParts;

  /** 结构短 ID → 已加载的场景分组 */
  private groups = new Map<string, THREE.Group>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  /** 结构短 ID → 内容坐标系下的包围盒（加载后计算一次） */
  private boxes = new Map<string, THREE.Box3>();
  private hiddenTypes = new Set<StructureType>();
  private visibleStructures: Set<string> | null = null;
  private selectionId: string | null = null;
  private hoveredId: string | null = null;
  private offsetBase = new Map<string, THREE.Vector3>();
  /** 正在加载的结构：并发 show() 复用同一次加载，避免重复建组 */
  private pendingGroups = new Map<string, Promise<THREE.Group | null>>();
  /** 结构 → 各侧实例容器，用于只移动单侧配对结构 */
  private holders = new Map<string, { side: string; group: THREE.Group }[]>();
  /** 当前已施加的位形（动画用），结构短 ID → 位形 */
  private currentTf = new Map<
    string,
    {
      offset: THREE.Vector3;
      rotation: THREE.Quaternion;
      pivot?: THREE.Vector3;
      side?: "left" | "right";
    }
  >();
  private tweens: {
    id: string;
    from: { offset: THREE.Vector3; rotation: THREE.Quaternion; side?: "left" | "right" };
    to: {
      offset: THREE.Vector3;
      rotation: THREE.Quaternion;
      pivot?: THREE.Vector3;
      side?: "left" | "right";
    };
    pivotFrom?: THREE.Vector3;
    pivotTo?: THREE.Vector3;
    start: number;
    dur: number;
  }[] = [];
  private arrows: THREE.Group | null = null;

  private viewports: { spec: ViewportSpec; camera: THREE.PerspectiveCamera; controls: OrbitControls | null }[] = [];
  private pointerDown: { x: number; y: number; id: number; vp: number } | null = null;

  private opts: StageOptions;
  private loadToken = 0;

  constructor(options: StageOptions) {
    this.opts = options;
    this.container = options.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setScissorTest(true);
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    if (options.background !== null) this.scene.background = new THREE.Color(options.background ?? "#0a1119");

    const hemi = new THREE.HemisphereLight(0xdcefff, 0x24303c, 1.15);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.4, 4.2, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -2.2;
    key.shadow.camera.right = 2.2;
    key.shadow.camera.top = 2.6;
    key.shadow.camera.bottom = -1.4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86c8ff, 0.85);
    rim.position.set(-3, 1.6, -2.6);
    this.scene.add(rim);

    this.rig = createRig();
    this.scene.add(this.rig.root);
    // 支撑物（床 / 椅 / 地面）位于世界坐标系，不随体位旋转
    this.scene.add(this.rig.support);

    this.contentGroup = new THREE.Group();
    this.rig.upper.add(this.contentGroup);
    this.contentGroup.add(this.structureRoot);
    this.contentGroup.add(this.annotationRoot);

    this.skin = buildSkin(this.rig);
    this.skin.setVisible(false);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.02, 60);
    this.camera.position.copy(BASE_DIR).multiplyScalar(3.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = MIN_DIST;
    this.controls.maxDistance = 12;
    this.controls.target.set(0, 0, 0);

    this.viewports.push({
      spec: { rect: [0, 0, 1, 1], target: new THREE.Vector3(0, 0.86, 0), distance: 2.7, interactive: true },
      camera: this.camera,
      controls: this.controls,
    });
    this.applyView(this.camera, this.viewports[0].spec);
    this.controls.target.copy(this.viewports[0].spec.target);
    this.controls.update();

    canvas.addEventListener("pointerdown", this.onPointerDown, { capture: true });
    canvas.addEventListener("pointerup", this.onPointerUp, { capture: true });
    canvas.addEventListener("pointermove", this.onPointerMove, { capture: true });
    canvas.addEventListener("pointerleave", this.onPointerLeave, { capture: true });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    const loop = () => {
      if (this.disposed) return;
      this.animationId = requestAnimationFrame(loop);
      for (const vp of this.viewports) vp.controls?.update();
      this.stepTweens();
      this.render();
      this.opts.onFrame?.();
    };
    loop();
  }

  /* ---------------------------------------------------------------- */
  /* 视口                                                             */
  /* ---------------------------------------------------------------- */

  setViewports(specs: ViewportSpec[]): void {
    for (const vp of this.viewports) {
      if (vp.controls && vp.controls !== this.controls) vp.controls.dispose();
    }
    this.viewports = specs.map((spec, i) => {
      const camera = i === 0 ? this.camera : new THREE.PerspectiveCamera(38, 1, 0.02, 60);
      let controls: OrbitControls | null = null;
      if (spec.interactive !== false) {
        if (i === 0) {
          controls = this.controls;
        } else {
          controls = new OrbitControls(camera, this.renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.09;
          controls.minDistance = MIN_DIST;
          controls.maxDistance = 12;
        }
      }
      this.applyView(camera, spec);
      if (controls) controls.target.copy(spec.target);
      return { spec, camera, controls };
    });
  }

  private applyView(camera: THREE.PerspectiveCamera, spec: ViewportSpec): void {
    camera.position.copy(spec.target).add(BASE_DIR.clone().multiplyScalar(spec.distance));
    camera.up.set(0, 1, 0);
    camera.lookAt(spec.target);
  }

  private resize(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    for (const vp of this.viewports) {
      const [, , vw, vh] = vp.spec.rect;
      vp.camera.aspect = (w * vw) / (h * vh);
      vp.camera.updateProjectionMatrix();
    }
  }

  private render(): void {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const w = size.x;
    const h = size.y;
    this.renderer.setScissorTest(this.viewports.length > 1);
    for (const vp of this.viewports) {
      const [x, y, vw, vh] = vp.spec.rect;
      const px = Math.round(x * w);
      const py = Math.round(y * h);
      const pw = Math.round(vw * w);
      const ph = Math.round(vh * h);
      this.renderer.setViewport(px, py, pw, ph);
      if (this.viewports.length > 1) this.renderer.setScissor(px, py, pw, ph);
      vp.camera.aspect = pw / Math.max(ph, 1);
      vp.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, vp.camera);
    }
    this.renderer.setScissorTest(false);
  }

  /* ---------------------------------------------------------------- */
  /* 结构加载与可见性                                                  */
  /* ---------------------------------------------------------------- */

  private ensureGroup(shortId: string): Promise<THREE.Group | null> {
    const existing = this.groups.get(shortId);
    if (existing) return Promise.resolve(existing);
    const pending = this.pendingGroups.get(shortId);
    if (pending) return pending;
    const task = this.loadGroup(shortId).then((g) => {
      this.pendingGroups.delete(shortId);
      return g;
    });
    this.pendingGroups.set(shortId, task);
    return task;
  }

  private loadGroup(shortId: string): Promise<THREE.Group | null> {
    const structureId = sid(shortId);
    const st = structureOf(structureId);
    if (!st) {
      if (import.meta.env.DEV) console.warn(`[stage] no structure: ${shortId}`);
      return Promise.resolve(null);
    }
    const rep = catalog.representation(structureId);
    if (!rep || rep.mode === "unavailable") {
      if (import.meta.env.DEV) console.warn(`[stage] no representation: ${shortId}`);
      return Promise.resolve(null);
    }

    const instances = pack.meshInstances.filter((m) => rep.instanceIds.includes(m.id));
    if (!instances.length) {
      if (import.meta.env.DEV) console.warn(`[stage] no instances: ${shortId}`);
      return Promise.resolve(null);
    }

    const material = materialFor(st.type);
    const group = new THREE.Group();
    group.name = `struct:${shortId}`;
    group.userData.structureId = shortId;
    group.userData.type = st.type;

    const token = ++this.loadToken;
    void token;

    return Promise.all(
      instances.map(async (inst) => {
        const asset = pack.assets.find((a) => a.id === inst.assetId);
        if (!asset || asset.kind !== "gltf") return null;
        const source = await loadGltf(asset.uri);
        const node =
          inst.selector.kind === "scene" ? source : findGltfNode(source, inst.selector.value ?? "");
        if (!node) return null;
        source.updateMatrixWorld(true);

        // 静态承载节点：把 GLB 内的节点世界矩阵原样搬到结构坐标系下
        const anchor = new THREE.Group();
        anchor.matrixAutoUpdate = false;
        anchor.matrix.copy(node.matrixWorld);
        anchor.matrixWorldNeedsUpdate = true;

        const content = (node === source ? source : node).clone(true);
        content.position.set(0, 0, 0);
        content.quaternion.identity();
        content.scale.set(1, 1, 1);
        anchor.add(content);

        // 可动画的侧别容器：脱位演示只移动单侧
        const sideGroup = new THREE.Group();
        sideGroup.userData.laterality = inst.laterality;
        sideGroup.add(anchor);
        sideGroup.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.material = material;
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.structureId = shortId;
          m.userData.structureType = st.type;
        });
        return sideGroup;
      }),
    ).then((sideGroups) => {
      const parts = sideGroups.filter((h): h is THREE.Group => h !== null);
      if (!parts.length) return null;
      const recorded: { side: string; group: THREE.Group }[] = [];
      sideGroups.forEach((holder, i) => {
        if (holder) recorded.push({ side: instances[i].laterality, group: holder });
      });
      this.holders.set(shortId, recorded);
      for (const p of parts) group.add(p);
      if (import.meta.env.DEV && this.groups.has(shortId)) {
        console.warn(`[stage] duplicate group: ${shortId}`);
      }
      this.materials.set(shortId, material);
      this.groups.set(shortId, group);
      // 下肢结构挂到对应的肢体节点，坐位时才能折叠；其余结构留在躯干坐标系
      const limb = limbNodeOf(shortId, this.rig);
      if (limb.node === this.rig.upper) {
        this.structureRoot.add(group);
        group.position.set(0, 0, 0);
      } else {
        limb.node.add(group);
        group.position.copy(limbOriginOf(limb.name)).negate();
      }
      this.refreshVisibility();
      this.boxes.set(shortId, this.localBoxOf(group));
      this.offsetBase.set(shortId, group.position.clone());
      return group;
    });
  }

  /** 内容坐标系（模型原始米制坐标）下的包围盒 */
  private localBoxOf(group: THREE.Group): THREE.Box3 {
    const box = new THREE.Box3();
    group.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(this.contentGroup.matrixWorld).invert();
    const tmp = new THREE.Box3().setFromObject(group);
    if (tmp.isEmpty()) return box;
    box.copy(tmp).applyMatrix4(inv);
    return box;
  }

  async show(structureShortIds: string[]): Promise<void> {
    this.visibleStructures = new Set(structureShortIds);
    await Promise.all(structureShortIds.map((id) => this.ensureGroup(id)));
    this.refreshVisibility();
    if (import.meta.env.DEV) {
      let visible = 0;
      let meshes = 0;
      const union = new THREE.Box3();
      for (const [id, g] of this.groups) {
        if (g.visible) visible++;
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes++;
        });
        const b = this.boxes.get(id);
        if (b) union.union(b);
      }
      const vp = this.viewports[0];
      console.log(
        "[stage]",
        JSON.stringify({
          requested: structureShortIds.length,
          groups: this.groups.size,
          visible,
          meshes,
          box: union.isEmpty() ? null : [+union.min.x.toFixed(2), +union.min.y.toFixed(2), +union.min.z.toFixed(2), +union.max.x.toFixed(2), +union.max.y.toFixed(2), +union.max.z.toFixed(2)],
          cam: this.camera.position.toArray().map((n) => +n.toFixed(2)),
          target: vp?.spec.target.toArray().map((n) => +n.toFixed(2)),
          buf: [this.renderer.domElement.width, this.renderer.domElement.height],
        }),
      );
    }
  }

  setLayerVisible(type: StructureType, visible: boolean): void {
    if (visible) this.hiddenTypes.delete(type);
    else this.hiddenTypes.add(type);
    this.refreshVisibility();
  }

  isLayerVisible(type: StructureType): boolean {
    return !this.hiddenTypes.has(type);
  }

  private skinOn(): boolean {
    return !this.hiddenTypes.has("skin");
  }

  /** 依据分层开关 + 显式可见集合，刷新每个结构分组的可见性 */
  refreshVisibility(): void {
    for (const [id, group] of this.groups) {
      const st = structureOf(sid(id));
      const type = st?.type ?? "bone";
      let visible = !this.hiddenTypes.has(type);
      if (visible && this.visibleStructures) visible = this.visibleStructures.has(id);
      group.visible = visible;
    }
    this.skin.setVisible(this.skinOn());
    this.updateSkinOpacity();
  }

  private updateSkinOpacity(): void {
    const boneOn = !this.hiddenTypes.has("bone");
    const muscleOn = !this.hiddenTypes.has("muscle");
    const opacity = this.skinOn() && (boneOn || muscleOn) ? 0.16 : 1;
    this.skin.setOpacity(opacity);
  }

  /** 加载某一层的全部结构（按需加载） */
  async loadLayer(type: StructureType): Promise<void> {
    if (type === "skin") {
      this.refreshVisibility();
      return;
    }
    const ids = pack.structures
      .filter((s) => s.type === type)
      .map((s) => s.id.replace("somakine:structure:", ""));
    await Promise.all(ids.map((id) => this.ensureGroup(id)));
    this.boxes.clear();
    for (const [id, g] of this.groups) this.boxes.set(id, this.localBoxOf(g));
    this.refreshVisibility();
    this.rebuildJointLayer();
  }

  /* ---------------------------------------------------------------- */
  /* 关节间隙标记（“关节”分层）                                         */
  /* ---------------------------------------------------------------- */

  private jointLayerOn = false;
  private jointLayerGroup: THREE.Group | null = null;

  private rebuildJointLayer(): void {
    if (this.jointLayerGroup) {
      this.annotationRoot.remove(this.jointLayerGroup);
      this.jointLayerGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose();
      });
      this.jointLayerGroup = null;
    }
    if (!this.jointLayerOn) return;
    const group = new THREE.Group();
    group.name = "joint-layer";
    for (const joint of JOINTS) {
      if (!this.boxes.has(joint.bones[0]) || !this.boxes.has(joint.bones[1])) continue;
      const anchor = this.jointAnchor(joint.bones[0], joint.bones[1], joint.side);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.0035, 8, 28),
        new THREE.MeshBasicMaterial({ color: LAYER_COLOR.joint, transparent: true, opacity: 0.85 }),
      );
      ring.position.copy(anchor);
      ring.rotation.x = Math.PI / 2;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 14, 10),
        new THREE.MeshBasicMaterial({ color: LAYER_COLOR.joint }),
      );
      dot.position.copy(anchor);
      group.add(ring, dot);
    }
    this.jointLayerGroup = group;
    this.annotationRoot.add(group);
  }

  setJointLayerVisible(visible: boolean): void {
    this.jointLayerOn = visible;
    this.rebuildJointLayer();
  }

  /** 载入某个关节的骨性锚点（供教程与对比视图使用） */
  jointAnchorOf(a: string, b: string, side: "left" | "right" = "right"): THREE.Vector3 {
    return this.jointAnchor(a, b, side);
  }

  /* ---------------------------------------------------------------- */
  /* 选择与拾取                                                        */
  /* ---------------------------------------------------------------- */

  select(shortId: string | null): void {
    this.selectionId = shortId;
    this.applyStyles();
    if (!shortId) {
      this.opts.onSelect?.(null);
      return;
    }
    const st = structureOf(sid(shortId));
    this.opts.onSelect?.({
      structureId: shortId,
      label: catalog.label(sid(shortId), LOCALE),
      type: st?.type ?? "bone",
      side: st?.laterality === "paired" ? "bilateral" : "none",
      point: this.boxes.get(shortId)?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3(),
    });
  }

  private applyStyles(): void {
    for (const [id, mat] of this.materials) {
      const selected = id === this.selectionId;
      const hovered = id === this.hoveredId;
      const base = new THREE.Color(LAYER_COLOR[structureOf(sid(id))?.type ?? "bone"]);
      mat.color.copy(base);
      if (selected) {
        mat.emissive.set("#00d9cf");
        mat.emissiveIntensity = 0.9;
      } else if (hovered) {
        mat.emissive.set("#3d7ea6");
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0.6;
      }
    }
  }

  pick(clientX: number, clientY: number): PickResult[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const targets: THREE.Object3D[] = [];
    for (const g of this.groups.values()) if (g.visible) targets.push(g);
    if (this.skin.meshes.some((m) => m.visible)) targets.push(...this.skin.meshes);
    const hits = this.raycaster.intersectObjects(targets, true);
    const out: PickResult[] = [];
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const shortId = hit.object.userData.structureId as string | undefined;
      if (shortId && !this.groups.get(shortId)?.visible) continue;
      out.push({
        structureId: shortId,
        point: hit.point.clone(),
        onSkin: !shortId,
        distance: hit.distance,
      });
      if (out.length >= 6) break;
    }
    return out;
  }

  private hitStructure(clientX: number, clientY: number): StageSelection | null {
    const picks = this.pick(clientX, clientY);
    const p = picks.find((q) => q.structureId);
    if (!p?.structureId) return null;
    const st = structureOf(sid(p.structureId));
    return {
      structureId: p.structureId,
      label: catalog.label(sid(p.structureId), LOCALE),
      type: st?.type ?? "bone",
      side: st?.laterality === "paired" ? "bilateral" : "none",
      point: p.point,
    };
  }

  /** 命中测试用的视口（多视口时按指针位置路由，避免同一 canvas 上的两台控制器互相干扰） */
  private viewportAt(clientX: number, clientY: number): number {
    if (this.viewports.length === 1) return 0;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(rect.width, 1);
    const ny = (clientY - rect.top) / Math.max(rect.height, 1);
    for (let i = 0; i < this.viewports.length; i++) {
      const [x, y, w, h] = this.viewports[i].spec.rect;
      if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) return i;
    }
    return 0;
  }

  private routeControls(clientX: number, clientY: number): void {
    if (this.viewports.length === 1) return;
    const active = this.viewportAt(clientX, clientY);
    this.viewports.forEach((vp, i) => {
      if (vp.controls) vp.controls.enabled = i === active;
    });
  }

  private onPointerDown = (e: PointerEvent) => {
    this.routeControls(e.clientX, e.clientY);
    this.pointerDown = { x: e.clientX, y: e.clientY, id: e.pointerId, vp: this.viewportAt(e.clientX, e.clientY) };
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 6) return;
    if (down.vp !== this.viewportAt(e.clientX, e.clientY)) return;
    const sel = this.hitStructure(e.clientX, e.clientY);
    this.select(sel?.structureId ?? null);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown) this.routeControls(e.clientX, e.clientY);
    if (this.pointerDown) return;
    const sel = this.hitStructure(e.clientX, e.clientY);
    const id = sel?.structureId ?? null;
    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.applyStyles();
      this.opts.onHover?.(sel);
    }
    this.renderer.domElement.style.cursor = sel ? "pointer" : "grab";
  };

  private onPointerLeave = () => {
    if (this.hoveredId) {
      this.hoveredId = null;
      this.applyStyles();
      this.opts.onHover?.(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /* 相机                                                              */
  /* ---------------------------------------------------------------- */

  fitTo(shortIds: string[], padding = 1.65, viewportIndex = 0): void {
    const vp = this.viewports[viewportIndex];
    if (!vp) return;
    const box = new THREE.Box3();
    for (const id of shortIds) {
      const b = this.boxes.get(id);
      if (b && !b.isEmpty()) box.union(b);
    }
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(1, 1.8, 1));
    const center = box.getCenter(new THREE.Vector3());
    this.toWorld(center, center);
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.06);
    const fit = calculateViewFit(radius, vp.camera.fov, vp.camera.aspect, padding);
    const dir = vp.camera.position.clone().sub(vp.controls ? vp.controls.target : center).normalize();
    if (dir.lengthSq() < 0.01) dir.copy(BASE_DIR);
    vp.camera.position.copy(center).add(dir.multiplyScalar(fit.distance));
    vp.camera.near = Math.max(fit.near, 0.01);
    vp.camera.far = fit.far;
    vp.camera.updateProjectionMatrix();
    if (vp.controls) {
      vp.controls.target.copy(center);
      vp.controls.minDistance = Math.max(fit.minDistance, MIN_DIST);
      vp.controls.maxDistance = fit.maxDistance;
      vp.controls.update();
    }
    vp.spec.target.copy(center);
    vp.spec.distance = fit.distance;
  }

  /** 内容坐标 → 世界坐标 */
  private toWorld(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    this.contentGroup.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(this.contentGroup.matrixWorld);
  }

  project(local: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const world = this.toWorld(local, new THREE.Vector3());
    const vp = this.viewports[0];
    const cam = vp?.camera ?? this.camera;
    const projected = world.clone().project(cam);
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return {
      x: (projected.x * 0.5 + 0.5) * size.x,
      y: (-projected.y * 0.5 + 0.5) * size.y,
      visible: projected.z < 1,
    };
  }

  /** 内容坐标 → 世界坐标（力度箭头、关节标记使用） */
  contentToWorld(local: THREE.Vector3): THREE.Vector3 {
    this.contentGroup.updateWorldMatrix(true, false);
    return local.clone().applyMatrix4(this.contentGroup.matrixWorld);
  }

  /** 世界坐标 → 内容坐标（拾取命中点、疼痛点标注使用） */
  worldToContent(world: THREE.Vector3): THREE.Vector3 {
    this.contentGroup.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.contentGroup.matrixWorld).invert();
    return world.clone().applyMatrix4(inv);
  }

  /** 体位或结构移动后重算包围盒，供 fitTo / jointAnchor 使用 */
  refreshBoxes(): void {
    for (const [id, group] of this.groups) {
      group.updateWorldMatrix(true, true);
      this.boxes.set(id, this.localBoxOf(group));
    }
  }

  resetView(viewportIndex = 0): void {
    const vp = this.viewports[viewportIndex];
    if (!vp) return;
    this.applyView(vp.camera, vp.spec);
    if (vp.controls) {
      vp.controls.target.copy(vp.spec.target);
      vp.controls.update();
    }
  }

  setYaw(radians: number, viewportIndex = 0): void {
    const vp = this.viewports[viewportIndex];
    if (!vp) return;
    const offset = vp.camera.position.clone().sub(vp.controls ? vp.controls.target : vp.spec.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta = radians;
    offset.setFromSpherical(spherical);
    vp.camera.position.copy((vp.controls ? vp.controls.target : vp.spec.target)).add(offset);
    vp.camera.lookAt(vp.controls ? vp.controls.target : vp.spec.target);
  }

  /* ---------------------------------------------------------------- */
  /* 体位                                                              */
  /* ---------------------------------------------------------------- */

  setPose(pose: PoseDef): void {
    this.rig.apply(pose);
    this.contentGroup.updateWorldMatrix(true, true);
    this.refreshBoxes();
  }

  /* ---------------------------------------------------------------- */
  /* 脱位位移                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 复位动画变换：平移用于脱位 / 复位位移，旋转用于旋扳动作。
   * 传入 pivot（内容坐标）时，旋转绕该支点进行，视觉上等价于绕关节转动。
   * 传入 side 时只作用于对应侧的实例容器，因此“右侧肩关节脱位”不会带动左臂。
   */
  setTransform(
    shortId: string,
    opts: { offset?: THREE.Vector3; rotation?: THREE.Euler; pivot?: THREE.Vector3 },
    side?: "left" | "right",
  ): void {
    this.cancelTween(shortId);
    const offset = opts.offset ?? new THREE.Vector3();
    const rotation = opts.rotation ?? new THREE.Euler();
    const quat = new THREE.Quaternion().setFromEuler(rotation);
    this.applyTf(shortId, offset, quat, opts.pivot, side);
    this.currentTf.set(shortId, {
      offset: offset.clone(),
      rotation: quat.clone(),
      pivot: opts.pivot ? opts.pivot.clone() : undefined,
      side,
    });
  }

  /**
   * 渐变到目标位形：未列出的结构会平滑回到中立位。
   * 分步教学用它代替 clearOffsets + setTransform，使复位动作连续可见。
   */
  animateTransforms(
    targets: {
      id: string;
      opts?: { offset?: THREE.Vector3; rotation?: THREE.Euler; pivot?: THREE.Vector3 };
      side?: "left" | "right";
    }[],
    duration = 700,
  ): void {
    const list = [...targets];
    const ids = new Set(list.map((t) => t.id));
    for (const id of this.currentTf.keys()) {
      if (!ids.has(id)) list.push({ id });
    }
    for (const t of list) this.animateTo(t.id, t.opts ?? {}, t.side, duration);
  }

  private animateTo(
    shortId: string,
    opts: { offset?: THREE.Vector3; rotation?: THREE.Euler; pivot?: THREE.Vector3 },
    side: "left" | "right" | undefined,
    duration: number,
  ): void {
    if (!this.groups.has(shortId)) return;
    this.cancelTween(shortId);
    const neutral = {
      offset: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      pivot: undefined,
      side: undefined,
    } as {
      offset: THREE.Vector3;
      rotation: THREE.Quaternion;
      pivot?: THREE.Vector3;
      side?: "left" | "right";
    };
    const from = this.currentTf.get(shortId) ?? neutral;
    const to = {
      offset: opts.offset ? opts.offset.clone() : new THREE.Vector3(),
      rotation: opts.rotation
        ? new THREE.Quaternion().setFromEuler(opts.rotation)
        : new THREE.Quaternion(),
      pivot: opts.pivot ? opts.pivot.clone() : undefined,
      side: side ?? from.side,
    };
    const pivotFrom = from.pivot ?? to.pivot;
    const pivotTo = to.pivot ?? from.pivot;
    const same =
      from.offset.distanceTo(to.offset) < 1e-5 &&
      from.rotation.angleTo(to.rotation) < 1e-4 &&
      (!pivotFrom || !pivotTo || pivotFrom.distanceTo(pivotTo) < 1e-5);
    if (same) {
      this.applyTf(shortId, to.offset, to.rotation, to.pivot, to.side);
      this.currentTf.set(shortId, to);
      return;
    }
    this.tweens.push({
      id: shortId,
      from: { offset: from.offset.clone(), rotation: from.rotation.clone(), side: from.side },
      to,
      pivotFrom,
      pivotTo,
      start: performance.now(),
      dur: Math.max(1, duration),
    });
  }

  private cancelTween(shortId: string): void {
    const i = this.tweens.findIndex((t) => t.id === shortId);
    if (i >= 0) this.tweens.splice(i, 1);
  }

  private stepTweens(): void {
    if (!this.tweens.length) return;
    const now = performance.now();
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const raw = Math.min(1, (now - tw.start) / tw.dur);
      const e = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const offset = tw.from.offset.clone().lerp(tw.to.offset, e);
      const rotation = tw.from.rotation.clone().slerp(tw.to.rotation, e);
      const pivot =
        tw.pivotFrom && tw.pivotTo
          ? tw.pivotFrom.clone().lerp(tw.pivotTo, e)
          : (tw.pivotTo ?? tw.pivotFrom);
      this.applyTf(tw.id, offset, rotation, pivot, tw.to.side ?? tw.from.side);
      if (raw >= 1) {
        this.currentTf.set(tw.id, tw.to);
        this.tweens.splice(i, 1);
      }
    }
  }

  private applyTf(
    shortId: string,
    offset: THREE.Vector3,
    quat: THREE.Quaternion,
    pivot?: THREE.Vector3,
    side?: "left" | "right",
  ): void {
    const group = this.groups.get(shortId);
    if (!group) return;
    const holders = this.holders.get(shortId) ?? [];
    const base = this.offsetBase.get(shortId) ?? new THREE.Vector3();
    const rotation = new THREE.Euler().setFromQuaternion(quat);
    const shift = new THREE.Vector3();
    if (pivot) shift.copy(pivot).sub(pivot.clone().applyQuaternion(quat));

    if (!holders.length) {
      group.rotation.copy(rotation);
      group.position.copy(base).add(offset).add(shift);
    } else {
      group.rotation.set(0, 0, 0);
      group.position.copy(base);
      const targets = side
        ? holders.filter((h) => h.side === side || h.side === "bilateral")
        : holders;
      for (const holder of targets.length ? targets : holders) {
        holder.group.rotation.copy(rotation);
        holder.group.position.copy(offset).add(shift);
      }
    }
    group.updateWorldMatrix(true, true);
    this.boxes.set(shortId, this.localBoxOf(group));
  }

  clearOffsets(): void {
    this.tweens.length = 0;
    this.currentTf.clear();
    for (const [id, group] of this.groups) {
      const base = this.offsetBase.get(id);
      if (base) group.position.copy(base);
      group.rotation.set(0, 0, 0);
      for (const holder of this.holders.get(id) ?? []) {
        holder.group.position.set(0, 0, 0);
        holder.group.rotation.set(0, 0, 0);
      }
      this.boxes.set(id, this.localBoxOf(group));
    }
  }

  /** 单侧实例在内容坐标系下的包围盒（脱位后用于显示错位差异） */
  sideBox(shortId: string, side: "left" | "right"): THREE.Box3 | undefined {
    const group = this.groups.get(shortId);
    if (!group) return undefined;
    const holders = (this.holders.get(shortId) ?? []).filter((h) => h.side === side || h.side === "bilateral");
    if (!holders.length) return this.boxes.get(shortId);
    group.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(this.contentGroup.matrixWorld).invert();
    const box = new THREE.Box3();
    for (const holder of holders) {
      holder.group.updateWorldMatrix(true, true);
      box.union(new THREE.Box3().setFromObject(holder.group));
    }
    return box.isEmpty() ? undefined : box.applyMatrix4(inv);
  }

  setStructureColor(shortId: string, color: string | null): void {
    const mat = this.materials.get(shortId);
    if (!mat) return;
    mat.color.set(color ?? LAYER_COLOR[structureOf(sid(shortId))?.type ?? "bone"]);
  }

  /* ---------------------------------------------------------------- */
  /* 标注（力度箭头）                                                   */
  /* ---------------------------------------------------------------- */

  setArrows(specs: ArrowSpec[]): void {
    if (this.arrows) {
      this.annotationRoot.remove(this.arrows);
      this.arrows.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
    const group = new THREE.Group();
    for (const spec of specs) {
      const color = new THREE.Color(spec.color ?? "#2ee6dd");
      const radius = spec.radius ?? 0.006;
      const dir = spec.to.clone().sub(spec.from);
      const len = dir.length();
      if (len < 1e-5) continue;
      const headLen = Math.min(spec.headLength ?? Math.max(len * 0.3, 0.03), len * 0.6);
      const shaftLen = len - headLen;

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, shaftLen, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 3.2, headLen, 14),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
      );
      const mid = dir.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), mid);

      shaft.position.copy(spec.from).add(mid.clone().multiplyScalar(shaftLen / 2));
      shaft.quaternion.copy(quat);
      head.position.copy(spec.from).add(mid.clone().multiplyScalar(shaftLen + headLen / 2));
      head.quaternion.copy(quat);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 3.4, radius * 4.6, 24),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
      );
      ring.position.copy(spec.from);
      ring.lookAt(spec.to);

      group.add(shaft, head, ring);
    }
    this.arrows = group;
    this.annotationRoot.add(group);
  }

  private focusMarkers: THREE.Group | null = null;

  /** 在关节处放置对位标记，用于显示正常位与脱位后的骨性对位差异 */
  setJointMarkers(marks: { point: THREE.Vector3; color?: string; radius?: number }[]): void {
    if (this.focusMarkers) {
      this.annotationRoot.remove(this.focusMarkers);
      this.focusMarkers.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose();
      });
      this.focusMarkers = null;
    }
    if (!marks.length) return;
    const group = new THREE.Group();
    group.name = "focus-markers";
    for (const mark of marks) {
      const color = mark.color ?? "#2ee6dd";
      const radius = mark.radius ?? 0.018;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 20, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34 }),
      );
      sphere.position.copy(mark.point);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.5, radius * 0.11, 8, 32),
        new THREE.MeshBasicMaterial({ color }),
      );
      ring.position.copy(mark.point);
      ring.rotation.x = Math.PI / 2;
      group.add(sphere, ring);
    }
    this.focusMarkers = group;
    this.annotationRoot.add(group);
  }

  /* ---------------------------------------------------------------- */
  /* 关节锚点                                                          */
  /* ---------------------------------------------------------------- */

  rawBox(shortId: string): THREE.Box3 | undefined {
    return this.boxes.get(shortId);
  }

  /** 两骨之间的关节锚点：优先取包围盒交叠区中心，否则取最近点中点 */
  jointAnchor(a: string, b: string, side: "left" | "right" = "right"): THREE.Vector3 {
    const A = this.sideBox(a, side) ?? this.boxes.get(a);
    const B = this.sideBox(b, side) ?? this.boxes.get(b);
    if (!A || !B) return new THREE.Vector3(0, 1, 0.1);
    const overlap = A.clone().intersect(B);
    if (!overlap.isEmpty()) return overlap.getCenter(new THREE.Vector3());

    const closest = closestPoints(A, B);
    return closest[0].add(closest[1]).multiplyScalar(0.5);
  }

  /* ---------------------------------------------------------------- */

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    for (const vp of this.viewports) vp.controls?.dispose();
    this.controls.dispose();
    for (const mat of this.materials.values()) mat.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.renderer.dispose();
    canvas.remove();
  }
}

/* ------------------------------------------------------------------ */
/* 包围盒最近点（用于两骨无交叠时求关节间隙中心）                         */
/* ------------------------------------------------------------------ */

function closestPoints(a: THREE.Box3, b: THREE.Box3): [THREE.Vector3, THREE.Vector3] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (const axis of ["x", "y", "z"] as const) {
    const aMin = a.min[axis];
    const aMax = a.max[axis];
    const bMin = b.min[axis];
    const bMax = b.max[axis];
    let lo: number;
    let hi: number;
    if (aMax < bMin) {
      lo = aMax;
      hi = bMin;
    } else if (bMax < aMin) {
      lo = bMax;
      hi = aMin;
    } else {
      lo = Math.max(aMin, bMin);
      hi = Math.min(aMax, bMax);
    }
    const mid = (lo + hi) / 2;
    pa[axis] = clamp(mid, aMin, aMax);
    pb[axis] = clamp(mid, bMin, bMax);
  }
  return [pa, pb];
}
