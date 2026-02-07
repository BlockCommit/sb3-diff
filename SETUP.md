# sb3-diff 项目设置说明

> 作者：NeuronPulse

## 项目概述

`sb3-diff` 是一个功能强大的 Scratch/TurboWarp .sb3 项目语义差异工具。它可以智能地比较两个 Scratch 项目，识别脚本、积木、变量、列表、造型和声音的变化，并以多种格式输出结果。

## 项目结构

```
sb3-diff/
├── src/                    # 源代码目录
│   ├── index.ts           # 主入口文件（包含 CLI 和库导出）
│   ├── types.ts           # TypeScript 类型定义
│   ├── extractor.ts       # 项目提取器（解析 .sb3 文件）
│   ├── parser.ts          # 项目解析器（解析 project.json）
│   ├── normalizer.ts      # 积木标准化器
│   ├── ir.ts              # 中间表示构建器
│   ├── fingerprint.ts     # 指纹生成器（语义哈希）
│   ├── diff.ts            # 差异引擎（核心算法）
│   ├── matcher.ts         # 匹配器（智能匹配算法）
│   ├── colorize.ts        # CLI 颜色化输出
│   ├── scratchblocks.ts   # ScratchBlocks 转换器
│   ├── script-parser.ts   # 脚本解析器
│   └── text-diff.ts       # 文本差异算法
├── dist/                   # 构建输出目录
├── test-project/          # 测试项目（验证包功能）
├── exampleSb3/            # 示例 SB3 文件
├── package.json           # npm 包配置
├── tsconfig.json          # TypeScript 配置
├── .npmignore            # npm 发布忽略文件
├── README.md             # 项目说明文档
└── SETUP.md              # 本文档
```

## 技术栈

- **语言**: TypeScript 5.3+
- **运行时**: Node.js 18+
- **模块系统**: ES Modules (ESM)
- **依赖管理**: npm
- **构建工具**: TypeScript Compiler (tsc)

## 已完成的配置

### 1. package.json 配置

- ✅ **包信息**
  - 名称: `sb3-diff`
  - 版本: `1.0.0`
  - 作者: NeuronPulse
  - 许可证: MIT

- ✅ **入口点配置**
  - `main`: `dist/index.js` - CommonJS 入口
  - `types`: `dist/index.d.ts` - TypeScript 类型声明
  - `bin`: `dist/index.js` - CLI 命令入口

- ✅ **模块导出**
  - `exports` 字段支持 ES 模块导入
  - 同时提供 `.js` 和 `.d.ts` 类型支持

- ✅ **发布配置**
  - `files`: 指定发布包含的文件（dist, README.md, LICENSE）
  - `engines`: 指定 Node.js 版本要求（>= 18.0.0）
  - `prepublishOnly`: 发布前自动构建

- ✅ **脚本命令**
  - `build`: 构建项目
  - `dev`: 监听模式构建
  - `start`: 运行构建后的 CLI
  - `test`: 运行测试
  - `test:watch`: 监听模式测试
  - `test:coverage`: 生成测试覆盖率报告

### 2. TypeScript 配置 (tsconfig.json)

- ✅ **编译选项**
  - `target`: ES2022
  - `module`: NodeNext
  - `moduleResolution`: NodeNext
  - `outDir`: ./dist
  - `rootDir`: ./src

- ✅ **类型支持**
  - `declaration`: true - 生成 .d.ts 声明文件
  - `declarationMap`: true - 生成声明映射
  - `sourceMap`: true - 生成源映射

- ✅ **严格模式**
  - `strict`: true
  - `esModuleInterop`: true
  - `forceConsistentCasingInFileNames`: true

- ✅ **其他选项**
  - `skipLibCheck`: true
  - `resolveJsonModule`: true

### 3. 模块导出设计

`src/index.ts` 提供了完整的模块导出：

- ✅ **类型导出**
  - `export * from './types.js'` - 导出所有类型定义

- ✅ **核心模块导出**
  - `ProjectExtractor` - 项目提取器
  - `ProjectParser` - 项目解析器
  - `BlockNormalizer` - 积木标准化器
  - `BlockIRBuilder` - 中间表示构建器
  - `FingerprintGenerator` - 指纹生成器
  - `BlockDiffEngine` - 差异引擎
  - `ScratchBlocksConverter` - ScratchBlocks 转换器
  - `colorizeCli` - CLI 颜色化工具

- ✅ **便捷 API**
  - `compareSb3Projects()` - 一站式比较函数
  - 支持配置输出选项
  - 返回完整的差异结果

- ✅ **双模式支持**
  - CLI 模式：作为命令行工具使用
  - 库模式：作为 npm 包被其他项目引用

### 4. .npmignore 配置

排除不需要发布的文件：

```
# 源代码
src/
*.ts
!*.d.ts

# 开发文件
*.log
debug-*.json
debug-*.txt

# 测试文件
test/
tests/
*.test.ts
*.spec.ts
jest.config.js
coverage/

# 示例文件
exampleSb3/
examples/

# 其他
docs/
.vscode/
.idea/
.DS_Store
node_modules/
```

## 使用指南

### 作为 npm 包发布

1. **准备发布**
```bash
# 确保所有依赖已安装
npm install

# 构建项目
npm run build

# 运行测试
npm test
```

2. **发布到 npm**
```bash
npm publish
```

3. **发布带标签的版本**
```bash
npm publish --tag beta
```

### 在其他项目中使用

#### 安装

```bash
npm install sb3-diff
```

#### 程序化使用

```javascript
import { compareSb3Projects } from 'sb3-diff';

// 基本使用
const result = await compareSb3Projects('old.sb3', 'new.sb3');

// 带选项使用
const result = await compareSb3Projects('old.sb3', 'new.sb3', {
  outputDiff: 'diff.json',
  outputResources: 'resources/',
  showPreview: true,
  color: true,
  detailed: true
});

// 访问结果
console.log(result.summary);      // 变化摘要
console.log(result.changes);      // 详细变化
console.log(result.raw);          // 原始差异数据
```

#### CLI 使用

```bash
# 全局安装
npm install -g sb3-diff

# 基本比较
sb3-diff diff old.sb3 new.sb3

# 带选项比较
sb3-diff diff old.sb3 new.sb3 \
  --output-diff diff.json \
  --output-resources resources/ \
  --preview \
  --color

# 重构项目
sb3-diff reconstruct base.sb3 diff.json resources/ output.sb3
```

## 测试验证

项目包含了一个完整的测试项目 (`test-project/`) 用于验证包的功能：

### 运行测试

```bash
cd test-project
npm install
npm test
```

### 测试内容

1. **API 函数测试**
   - 测试 `compareSb3Projects` API
   - 验证参数处理
   - 验证输出格式

2. **模块导出测试**
   - 测试所有核心模块的导出
   - 验证模块类型
   - 验证模块可用性

3. **程序化使用测试**
   - 测试独立模块的使用
   - 验证完整的处理流程
   - 验证结果正确性

## 构建输出说明

构建后的 `dist/` 目录包含：

- **.js 文件**: 编译后的 JavaScript 代码（ESM 格式）
- **.d.ts 文件**: TypeScript 类型声明文件
- **.js.map 文件**: JavaScript 源映射
- **.d.ts.map 文件**: 类型声明源映射

这些文件构成了一个完整的 npm 包，可以被其他项目直接引用，同时提供完整的 TypeScript 类型支持。

## 开发工作流

### 1. 开发新功能

```bash
# 启动监听模式
npm run dev

# 修改源代码
# TypeScript 会自动重新编译
```

### 2. 测试

```bash
# 运行测试
npm test

# 监听模式测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 3. 构建

```bash
# 构建项目
npm run build

# 清理并重新构建
rm -rf dist && npm run build
```

### 4. 本地测试

```bash
# 创建本地链接
npm link

# 在测试项目中使用
cd test-project
npm link sb3-diff
npm test
```

## 注意事项

1. **ES 模块要求**
   - 此包使用 ES 模块 (`type: "module"`)
   - 导入时必须使用 `.js` 扩展名
   - 不支持 CommonJS 的 `require()`

2. **Node.js 版本**
   - 最低要求: Node.js 18.0.0
   - 推荐使用: Node.js 20+ LTS

3. **构建前准备**
   - 确保安装了所有依赖 (`npm install`)
   - 确保没有类型错误 (`npm run build`)
   - 确保所有测试通过 (`npm test`)

4. **发布前检查**
   - 更新版本号 (`npm version patch/minor/major`)
   - 更新 CHANGELOG.md
   - 运行 `npm run build`
   - 运行测试验证
   - 执行 `npm publish`

## 核心模块说明

### ProjectExtractor
- 功能：从 .sb3 文件中提取项目数据
- 方法：
  - `extractProject(path)` - 提取 project.json
  - `extractAllResources(path)` - 提取所有资源
  - `saveResources(resources, dir)` - 保存资源到目录

### ProjectParser
- 功能：解析原始项目数据为结构化格式
- 方法：
  - `parse(rawProject)` - 解析项目

### BlockNormalizer
- 功能：标准化积木数据格式
- 方法：
  - `normalize(parsedProject)` - 标准化项目

### BlockIRBuilder
- 功能：构建积木中间表示（IR）
- 方法：
  - `buildIR(normalizedProject)` - 构建 IR

### FingerprintGenerator
- 功能：生成语义指纹
- 方法：
  - `generateFingerprints(projectIR)` - 生成指纹

### BlockDiffEngine
- 功能：生成语义差异
- 方法：
  - `generateEnhancedDiff(oldIR, newIR)` - 生成增强差异

## 发布检查清单

发布到 npm 前请确认：

- [ ] 版本号已更新
- [ ] CHANGELOG.md 已更新
- [ ] package.json 中的 repository 和 homepage 已填写
- [ ] author 字段已填写为 NeuronPulse
- [ ] 所有测试通过 (`npm test`)
- [ ] 构建成功 (`npm run build`)
- [ ] 测试项目验证通过
- [ ] README.md 文档完整
- [ ] LICENSE 文件存在

## 常见问题

### Q: 如何处理 .sb3 文件？
A: 工具会自动处理 .sb3 文件，无需手动解压。

### Q: 支持哪些 Scratch 版本？
A: 支持 Scratch 3.0 及 TurboWarp 格式的 .sb3 文件。

### Q: 如何提高性能？
A: 对于大型项目，可以考虑使用 `detailed: false` 选项简化输出。

### Q: 差异结果如何解读？
A: 参考 README.md 中的"差异结果结构"部分。

## 联系方式

- 作者: NeuronPulse
- 许可证: MIT
- 项目主页: [待添加]