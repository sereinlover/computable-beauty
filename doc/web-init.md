# Web 初始化执行指南

> Stage 0 · Part 5（`apps/web` 骨架）的落地文档。
> 技术栈已定：Next.js 16.2.10（App Router）+ Tailwind + shadcn/ui + Recharts，具体讨论过程见对话历史，不重复展开。

---

## 怎么用这份文档

你不熟悉前端，所以这份文档不是让你一次性从头跑到尾，而是拆成一个个「关卡」：

- 每个关卡只做一件事：给命令、说明为什么要做这一步、给一个能自己判断"做完了"的验证方法
- **做完一个关卡就停下来**，把终端输出（报错也一样）贴给我，我确认没问题、解释清楚发生了什么，再解锁下一关
- 不要连续跑好几个关卡的命令再来问——出问题时不好定位是哪一步的锅
- 所有命令由你自己在终端执行，我不会替你跑

当前进度：还没开始，从关卡 0 开始。

---

## 关卡 0：环境检查

```bash
node -v
v24.16.0

npm --version
11.18.0
```

---

## 关卡 1：Next.js 脚手架

```bash
cd "apps/web"
mv mock ../web-mock-backup       # 已有的 mock/fixtures.ts 先挪开，脚手架要求目录基本为空

npx create-next-app@16.2.10 . \
  --typescript \
  --app \
  --eslint \
  --tailwind \
  --no-src-dir \
  --import-alias "@/*" \
  --use-npm \
  --skip-install

npm install                      # 单独手动装依赖

mv ../web-mock-backup mock       # 挪回来
```

---

## 关卡 2：跑起来看一眼

**做什么**

```bash
npm run dev
```

**为什么**：确认脚手架本身没问题，能启动开发服务器。

**验证**：浏览器打开 `http://localhost:3000`，应该是 Next.js 默认欢迎页（不是我们的产品界面，这是正常的，产品界面还没开始写）。截图或者告诉我"看到欢迎页了"，然后 `Ctrl+C` 停掉服务器。

---

## 关卡 3：接通 `contracts/types.ts`

**做什么**：打开 `apps/web/tsconfig.json`，找到 `compilerOptions.paths`，改成：

```json
"paths": {
  "@/*": ["./*"],
  "@contracts/*": ["../../contracts/*"]
}
```

**为什么**：`contracts/types.ts` 是三个服务共用的类型定义（在仓库根目录，不在 `apps/web` 里）。这个别名让 Next.js 能直接 `import type { FeatureSummary } from "@contracts/types"`，不用手写一长串 `../../` 相对路径，也不用把类型文件复制一份到 `apps/web` 里（复制会导致两边不同步）。`apps/web/mock/fixtures.ts` 文件顶部本来就留了这条 TODO。

**验证**：改完贴一下 `tsconfig.json` 里 `paths` 那几行给我看，我确认格式没问题。这一步先不验证能不能真的 import 成功，等关卡 5 一起测。

---

## 关卡 4：初始化 shadcn/ui

**做什么**

```bash
npx shadcn@latest init
```

会有几个交互式问题，建议这样选：

| 问题 | 选择 | 为什么 |
|------|------|--------|
| Style | New York | 更紧凑、卡片感强，贴近产品原型里卡片 + pill 标签的视觉 |
| Base color | Neutral | 中性灰底，紫色 accent 后面单独在 Tailwind 里配 |
| CSS variables | Yes | 方便后面统一改主题色，不用满项目改类名 |

**为什么**：shadcn/ui 不是装一个 npm 包，而是这条命令会在 `apps/web` 里生成一个 `components.json` 配置文件，记录组件要生成到哪个目录、用什么别名。后面 `add` 组件时，源码会直接复制进你的项目，你可以打开来读、改。

**验证**

```bash
cat components.json
```

贴给我看一下生成的内容。

---

## 关卡 5：装第一批基础组件 + 验证全链路

**做什么**

```bash
npx shadcn@latest add button badge tabs progress card
```

**为什么**：这五个是产品原型里反复出现的最小单元——按钮（"选择文件" "使用 Demo 曲目"）、pill 标签（`symphonic rock` `melancholic` 这种）、Tab 切换（5 个结果 Tab）、进度条（美学四维的横条）、卡片（BPM/AROUSAL 这些 MetricCard）。

装完之后我会给你一段临时测试代码，贴到 `app/page.tsx` 里，同时验证三件事：Tailwind 生效、shadcn 组件能渲染、`@contracts/*` 别名能 import 成功。跑起来看没问题后这段测试代码就删掉，换成真正的首页。

**验证**：贴出 `npx shadcn@latest add ...` 命令执行完的输出（应该会列出新增了哪些文件，一般在 `components/ui/` 下）。

---

## 完成之后

关卡 5 走完，`apps/web` 的骨架就搭好了，下一步是按 `doc/roadmap.md` Part 5 开始写首页和结果页的真实组件（先用 `mock/fixtures.ts` 的静态数据）。那部分工作量大，会另外拆步骤，不在这份文档里。
