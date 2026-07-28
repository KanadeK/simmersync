# SimmerSync

**让每道菜都在该热的时候上桌。**

SimmerSync 是一个本地运行的多菜品倒排调度引擎。你只需声明目标开饭时间、每个步骤的
时长与依赖，以及厨师、烤箱、灶眼、台面等资源容量，它就会从开饭时间向前倒排，避免
同一时间要求一个人做两件事，或让同一烤箱被超额占用。

[English](README.md)

## 它不是空壳界面

核心调度器会实际完成：

- 菜内顺序与跨菜依赖校验；
- 主动操作和被动等待的并行安排；
- 厨师注意力、烤箱层位、灶眼及自定义资源的容量检查；
- 从目标时间倒排并计算提前完成、保温时间和瓶颈利用率；
- 不可行计划的明确诊断和修复建议。

输出包括终端时间表、JSON、CSV、ICS 日历提醒，以及无需联网即可打开的单文件
`cook-mode.html`。

## 安装与运行

```bash
npm install --global \
  https://github.com/KanadeK/simmersync/releases/download/v0.1.0/simmersync-0.1.0.tgz

simmersync validate sunday-roast.yaml
simmersync plan sunday-roast.yaml \
  --serve-at "2026-07-28T19:00:00+08:00" \
  --out dinner-plan
```

也可以从源码运行：

```bash
git clone https://github.com/KanadeK/simmersync.git
cd simmersync
npm ci
npm run build
node dist/cli.js plan examples/sunday-roast.yaml \
  --serve-at "2026-07-28T19:00:00+08:00"
```

## 最小计划

```yaml
version: 1
title: 四人晚餐
timezone: Asia/Shanghai

resources:
  cook: { capacity: 1, label: 厨师注意力 }
  oven: { capacity: 2, label: 烤箱层位 }
  burner: { capacity: 2, label: 灶眼 }

defaults:
  attentionResource: cook
  horizonMinutes: 240

dishes:
  - id: roast
    name: 烤鸡
    maxHold: 20
    steps:
      - id: season
        name: 调味
        duration: 10
        mode: active
      - id: bake
        name: 烘烤
        duration: 55
        mode: passive
        resources: { oven: 1 }
```

完整字段见[计划格式](docs/plan-format.md)和
[JSON Schema](schema/simmersync.schema.json)。

## 失败后的固定修复流程

```bash
simmersync validate plan.yaml
```

- 退出码 `2`：按输出路径逐项修复重复 ID、未知资源、错误依赖或依赖环。
- 退出码 `3`：先检查被动步骤是否误占 `cook`，再拆分长步骤、核实真实资源容量，最后
  延长 `horizonMinutes`。
- 修改后重复同一命令；相同输入一定得到相同结果。

更完整的处理顺序见[故障排查](docs/troubleshooting.md)。

## 完整验收

```bash
npm ci
npm run check
npm run benchmark
npm run release:build
npm run release:verify
```

这些命令覆盖代码规范、类型、单元测试、CLI 端到端测试、覆盖率、打包、校验和、全新
环境安装与真实命令运行。所有命令通过前不得发布版本。

项目完全本地运行，无账号、无遥测、无上传、无远程字体或脚本。MIT License。
