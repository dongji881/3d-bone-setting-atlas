import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { AnatomyStage, type StageSelection, preloadBoneAssets } from "../three/AnatomyStage";

export interface StageHooks {
  onSelect?: (sel: StageSelection | null) => void;
  onHover?: (sel: StageSelection | null) => void;
  onFrame?: () => void;
}

let preloaded = false;

/**
 * 创建并销毁 AnatomyStage（一个容器一个 WebGL 上下文）。
 * 容器可能晚于组件挂载才渲染（如教程详情的分步阶段），因此用回调 ref
 * 跟随元素挂载/卸载，而不是只在首次 render 跑一次。
 */
export function useAnatomyStage(hooks: StageHooks) {
  const node = useRef<HTMLDivElement | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<AnatomyStage | null>(null);
  const box = useRef(hooks);
  box.current = hooks;

  useEffect(() => {
    if (!el) return;
    if (!preloaded) {
      preloaded = true;
      void preloadBoneAssets();
    }
    const s = new AnatomyStage({
      container: el,
      background: null,
      onSelect: (sel) => box.current.onSelect?.(sel),
      onHover: (sel) => box.current.onHover?.(sel),
      onFrame: () => box.current.onFrame?.(),
    });
    setStage(s);
    return () => {
      s.dispose();
      setStage(null);
    };
  }, [el]);

  const ref = useCallback((instance: HTMLDivElement | null) => {
    node.current = instance;
    setEl((prev) => (prev === instance ? prev : instance));
  }, []);

  return { ref, boxRef: node, stage };
}

/** 3D 舞台外框：负责容器尺寸与覆盖层插槽 */
export function StageFrame({
  boxRef,
  height,
  children,
  overlays,
}: {
  boxRef: Ref<HTMLDivElement>;
  height?: number;
  children?: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <div className="stage-frame" style={height ? { height } : { height: "clamp(360px, 62vh, 720px)" }}>
      <div className="stage-hit" ref={boxRef} />
      {overlays}
      {children}
    </div>
  );
}
