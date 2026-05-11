# 点菜系统 Constitution

## Core Principles

### I. 功能模块化（Module-First）
系统按业务模块拆分：菜单管理、点菜下单、订单管理、支付结算、后台管理；每个模块必须独立开发、独立测试、独立部署；模块间通过清晰的接口协议通信，禁止跨模块直接访问内部实现。

### II. 前后端分离
前端（Web/H5/小程序）与后端 API 严格分离；后端提供 RESTful JSON API；前端通过接口层统一调用，禁止在前端硬编码业务逻辑。

### III. 测试优先（Test-First，NON-NEGOTIABLE）
TDD 强制执行：先编写测试用例并经用户确认 → 测试失败（Red）→ 实现功能（Green）→ 重构（Refactor）；核心业务逻辑（下单、库存、支付）单元测试覆盖率 ≥ 80%；接口变更必须同步更新契约测试。

### IV. 数据完整性
菜品库存、订单状态、支付记录等关键数据必须在数据库层做约束（唯一键、外键、非空）；并发下单场景必须使用乐观锁或事务保护，禁止超卖；所有写操作需记录操作日志。

### V. 简洁优先（Simplicity，YAGNI）
从最小可行功能开始实现，不预先引入未明确需求的复杂性；新增依赖必须有明确理由；代码可读性优先于过度抽象。

## 技术约束

- **语言/运行时**：待定（NEEDS CLARIFICATION：前端技术栈 React/Vue/小程序？后端 Node.js/Python/Java？）
- **数据库**：待定（推荐 MySQL 或 PostgreSQL，NoSQL 需充分理由）
- **部署目标**：Web 应用（支持 PC 端及移动端浏览器）
- **接口规范**：RESTful API，JSON 格式，HTTP 状态码语义化使用
- **认证方式**：JWT Token（顾客端）+ Session（管理后台）

## 开发流程

1. 需求通过 `/speckit.specify` 编写功能规格说明（`specs/` 目录）
2. 通过 `/speckit.plan` 生成实现计划（技术选型、项目结构、数据模型）
3. 通过 `/speckit.tasks` 拆解可执行任务
4. 通过 `/speckit.implement` 驱动代码实现
5. 通过 `/speckit.checklist` 验收功能

## Governance

本章程优先级高于所有其他开发约定；对章程的修订需说明变更原因、影响范围，并更新版本号；所有 PR 在合并前需验证章程合规性；复杂性引入必须在 `plan.md` 的 Complexity Tracking 章节中正当化。

**Version**: 1.0.0 | **Ratified**: 2026-05-11 | **Last Amended**: 2026-05-11
