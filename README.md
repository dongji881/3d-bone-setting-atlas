# 3D 交互式正骨（关节复位）教学程序

基于 Somakine + BodyParts3D 4.0 二次开发的 Web 教学工具：用可旋转、可拆解的人体模型演示关节复位手法，并配套禁忌症筛查、免责声明与真实教学视频。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run preview  # 预览构建产物
npm run lint     # oxlint（当前 0 错误）
```

浏览器需支持 WebGL2；首次加载约 30 MB 解剖资源（23 个 GLB）。

## 功能

- **3D 交互**：8 个解剖区域、255 个可选结构，缩放/旋转/体位切换（站立、仰卧、坐位、侧卧、俯卧）。
- **教学内容体系**：10 套教程（肩、肘、桡骨小头、髋、腰椎、指间/掌指/拇指、颞下颌），每套含自查、术前准备、分步操作、成功标志、术后注意、禁忌警示六段。
- **分步操作 3D 动画**：步骤状态从第 0 步累积回放，含位移/旋转/支点动画、关节层标记、力度箭头与「正常 / 脱位对比」。
- **教学呈现**：每套教程内嵌哔哩哔哩教学视频 + 3D 多机位演示（正面/侧面/背面机位切换）。
- **合规安全**：进站免责声明门禁、逐条禁忌症筛查（勾选任一条即禁止操作）、专业级内容在大众模式下默认隐藏。
- **辅助功能**：长辈模式、深色/浅色主题、收藏、离线可用（Service Worker）。

## 教学视频

视频通过 `src/content/tutorials/*.ts` 中的 `videoSrc` 字段配置，`src/content/video.ts` 的 `videoEmbed()` 将地址转为嵌入播放器：

- `https://www.bilibili.com/video/BVxxxx` → `https://player.bilibili.com/player.html?bvid=...`
- 本地 mp4 → `/video/xxx.mp4`（放入 `public/video/`）
- 其余地址按原样嵌入

**播放需要联网**，且依赖第三方播放器；视频区右上角提供「在哔哩哔哩打开」外链。更换片源只需改 `videoSrc`，无需改代码。

检索与校验片源的辅助脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bili-search.ps1 -Q "肩关节脱位 复位"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bili-info.ps1 -Bv BV18s4y177Uf
```

## 目录结构

```
src/
  content/   教程文案、视频地址、结构/关节元数据（纯数据，可直接改）
  three/     AnatomyStage：模型加载、体位、关节动画、箭头与标注
  pages/     首页、教程库、教程详情、解剖浏览、设置等页面
  ui/        顶栏、免责声明门禁、提示条等外壳组件
  core/      状态（设置、收藏、离线）
  styles/    global.css
public/      解剖资源、许可文件、图标、Service Worker
scripts/     内容校验与调试脚本
```

## 校验与调试脚本

```bash
node scripts/validate-content.mjs  # 骨骼引用是否全部可解析
node scripts/validate-refs.mjs     # 教程引用的结构/关节是否存在于资源包
```

`scripts/shot.ps1 -Url <url> -Out <png> -W 1400 -H 3600 -B 30000`：用本机 Edge 无头截图；`scripts/dump.ps1` 输出 DOM。

## 许可

解剖资源来自 BodyParts3D 4.0（数据集许可见 `public/LICENSE.bodyparts3d.txt` 及补充许可），代码遵循项目自身许可。本工具仅供教学演示，不构成医疗建议、诊断或治疗方案。
