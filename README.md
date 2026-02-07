# sb3-diff

> Semantic diff tool for Scratch/TurboWarp .sb3 projects

[![GitHub Package](https://img.shields.io/badge/GitHub-Package-blue?logo=github)](https://github.com/BlockCommit/sb3-diff/pkgs/npm/@blockcommit%2Fsb3-diff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

一个功能强大的 Scratch/TurboWarp .sb3 项目语义差异工具，可以帮助你比较两个 Scratch 项目之间的差异，包括脚本、积木、变量、列表、造型和声音的变化。

## ✨ 特性

- 📊 **智能比较** - 比较两个 Scratch/TurboWarp .sb3 项目
- 🔍 **语义分析** - 生成语义差异，识别代码的实际变化
- 🎨 **全面检测** - 检测脚本、积木、变量、列表、造型和声音的变化
- 📦 **JSON 导出** - 将差异结果导出为 JSON 格式
- 🖼️ **资源提取** - 提取变化的资源（造型和声音）
- 🎯 **双重支持** - 同时支持 CLI 命令行和程序化调用
- 🎨 **彩色输出** - 支持彩色终端输出，易于阅读
- 🔧 **项目重构** - 支持从差异文件重构项目

## 📦 安装

### 通过 GitHub Packages 安装

此包发布在 GitHub Packages，需要先配置认证：

```bash
# 配置 GitHub Packages 注册表
echo "@blockcommit:registry=https://npm.pkg.github.com" >> ~/.npmrc

# 配置认证（使用你的 GitHub Personal Access Token）
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc

# 安装包
npm install @blockcommit/sb3-diff
```

### 全局安装（CLI 使用）

```bash
# 配置注册表和认证（如果还没有配置）
echo "@blockcommit:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc

# 全局安装
npm install -g @blockcommit/sb3-diff
```

> 💡 **注意**：将 `YOUR_GITHUB_TOKEN` 替换为你的 GitHub Personal Access Token。需要 `read:packages` 权限。

## 🚀 使用方法

### CLI 命令行使用

#### 比较两个项目

```bash
sb3-diff diff <old-project.sb3> <new-project.sb3>
```

#### 使用选项

```bash
sb3-diff diff old.sb3 new.sb3 \
  --output-diff diff.json \
  --output-resources resources/ \
  --preview \
  --color
```

#### 可用选项

- `--output-diff <file>` - 将差异 JSON 输出到指定文件
- `--output-resources <dir>` - 将新资源输出到指定目录
- `-p, --preview` - 显示 ScratchBlocks 语法预览
- `--color` - 强制彩色输出
- `--no-color` - 禁用彩色输出
- `--detailed` - 显示详细信息
- `--no-detailed` - 简化输出

#### 从差异重构项目

```bash
sb3-diff reconstruct <base-sb3> <diff-json> <resources-dir> <output-sb3>
```

#### 帮助信息

```bash
sb3-diff --help
sb3-diff diff --help
```

### 程序化使用

#### 使用主 API 函数

```javascript
import { compareSb3Projects } from '@blockcommit/sb3-diff';

const result = await compareSb3Projects('old.sb3', 'new.sb3', {
  outputDiff: 'diff.json',
  outputResources: 'resources/',
  detailed: true
});

console.log('Summary:', result.summary);
console.log('Changes:', result.changes);
console.log('Raw diff:', result.raw);
```

#### 使用独立模块

```javascript
import {
  ProjectExtractor,
  ProjectParser,
  BlockNormalizer,
  BlockIRBuilder,
  FingerprintGenerator,
  BlockDiffEngine
} from '@blockcommit/sb3-diff';

// 提取项目
const oldRaw = await ProjectExtractor.extractProject('old.sb3');
const newRaw = await ProjectExtractor.extractProject('new.sb3');

// 解析项目
const oldParsed = ProjectParser.parse(oldRaw);
const newParsed = ProjectParser.parse(newRaw);

// 标准化积木
const oldNormalized = BlockNormalizer.normalize(oldParsed);
const newNormalized = BlockNormalizer.normalize(newParsed);

// 构建积木中间表示
const oldIR = BlockIRBuilder.buildIR(oldNormalized);
const newIR = BlockIRBuilder.buildIR(newNormalized);

// 附加原始目标用于差异生成
oldIR._rawTargets = oldRaw.targets;
newIR._rawTargets = newRaw.targets;

// 生成指纹
FingerprintGenerator.generateFingerprints(oldIR);
FingerprintGenerator.generateFingerprints(newIR);

// 生成差异
const diff = BlockDiffEngine.generateEnhancedDiff(oldIR, newIR);

console.log(diff.summary);
console.log(diff.changes);
```

## 📊 差异结果结构

`compareSb3Projects` 函数返回一个 `EnhancedDiffResult` 对象：

```typescript
{
  summary: {
    targetsAdded: number;      // 添加的目标数
    targetsDeleted: number;    // 删除的目标数
    scriptsAdded: number;      // 添加的脚本数
    scriptsDeleted: number;    // 删除的脚本数
    scriptsModified: number;   // 修改的脚本数
    blocksAdded: number;       // 添加的积木数
    blocksDeleted: number;     // 删除的积木数
    blocksModified: number;    // 修改的积木数
    variablesAdded: number;    // 添加的变量数
    variablesDeleted: number;  // 删除的变量数
    variablesModified: number; // 修改的变量数
    listsAdded: number;        // 添加的列表数
    listsDeleted: number;      // 删除的列表数
    listsModified: number;     // 修改的列表数
    costumesAdded: number;     // 添加的造型数
    costumesDeleted: number;   // 删除的造型数
    costumesModified: number;  // 修改的造型数
    soundsAdded: number;       // 添加的声音数
    soundsDeleted: number;     // 删除的声音数
    soundsModified: number;    // 修改的声音数
  };
  changes: {
    targets: TargetChange[];   // 目标变化
    scripts: DiffItem[];       // 脚本变化
    variables: DiffItem[];     // 变量变化
    lists: DiffItem[];         // 列表变化
    assets: AssetChange[];     // 资源变化
  };
  raw: Diff;                   // 原始差异数据
  formatted: {
    summary: string;           // 格式化的摘要
    detailed: string;          // 格式化的详细信息
  };
}
```

## 🔧 开发

### 克隆仓库

```bash
git clone https://github.com/BlockCommit/sb3-diff.git
cd sb3-diff
```

### 安装依赖

```bash
npm install
```

> 💡 **注意**：此包发布在 GitHub Packages，不是 npm。如需在本地开发测试，请先配置 GitHub Packages 认证（见上方安装说明）。

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 监听模式构建

```bash
npm run dev
```

## 📁 项目结构

```
sb3-diff/
├── src/                    # 源代码目录
│   ├── index.ts           # 主入口文件
│   ├── types.ts           # TypeScript 类型定义
│   ├── extractor.ts       # 项目提取器
│   ├── parser.ts          # 项目解析器
│   ├── normalizer.ts      # 积木标准化器
│   ├── ir.ts              # 中间表示构建器
│   ├── fingerprint.ts     # 指纹生成器
│   ├── diff.ts            # 差异引擎
│   ├── matcher.ts         # 匹配器
│   ├── colorize.ts        # CLI 颜色化
│   ├── scratchblocks.ts   # ScratchBlocks 转换器
│   ├── script-parser.ts   # 脚本解析器
│   └── text-diff.ts       # 文本差异
├── dist/                   # 构建输出目录
├── test-project/          # 测试项目
├── exampleSb3/            # 示例 SB3 文件
├── package.json           # npm 包配置
├── tsconfig.json          # TypeScript 配置
└── README.md             # 项目说明文档
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT © NeuronPulse

## 🔗 相关链接

- [GitHub Packages](https://github.com/BlockCommit/sb3-diff/pkgs/npm/@blockcommit%2Fsb3-diff)
- [GitHub Repository](https://github.com/BlockCommit/sb3-diff)
- [Scratch](https://scratch.mit.edu/)
- [TurboWarp](https://turbowarp.org/)
- [ScratchBlocks](https://scratchblocks.github.io/)