1. 项目目标（Goal）

实现一个本地可运行的 ChatMemory MCP Server，用于：
	•	保存 CherryStudio 的对话片段/会话（手动或半自动）
	•	检索 历史对话（关键词 / 时间范围 / 标签）
	•	总结 历史对话（brief / detailed）
	•	注入 总结结果到当前对话上下文（生成“Memory Injection Block”）
	•	让用户在当前对话中用 @topic: / @session: 的方式“跨会话引用”

注意：CherryStudio 本身未必提供 Cursor 那种 UI autocomplete，但我们用“约定语法 + 工具调用”实现同等能力。

⸻

2. MVP 范围（第一版必须做）

2.1 必做功能清单

A. 记忆库数据存储（SQLite）
	•	能持久化 session & message
	•	能按 session_id 查询该 session 的所有消息

B. 关键词检索（不做向量）
	•	在 messages.content 上做 LIKE / FTS（建议 SQLite FTS5）

C. 一键注入（核心）
	•	给一个 query 或 session_id
	•	返回一段结构化的“注入块”（Memory Injection Block）
	•	注入块包含：事实/决策/风险/下一步/来源

D. 会话总结
	•	对指定 session 总结
	•	支持 2 种风格：brief / detailed
	•	总结结果存回 session 表，避免重复计算

E. MCP Server 接口（CherryStudio 可调用）
	•	以 MCP tools 形式暴露上述能力（STDIO 模式优先）

⸻

3. 非目标（明确不做，避免越做越大）
	•	❌ 不做向量检索（embedding / chroma / pgvector）——后续迭代
	•	❌ 不做 CherryStudio 客户端插件级自动采集
	•	❌ 不做多端同步 / 云同步
	•	❌ 不做复杂权限、多人协作
	•	❌ 不做 UI（例如 @ 自动弹窗选择 session）

⸻

4. 用户使用方式（User Journey）

4.1 存储历史（半自动）

用户在 CherryStudio 对话中说：
	•	“把本次对话保存到记忆库，标题叫 XXX，标签是 YYY”
模型调用 memory_save_messages(...) 存入 SQLite

4.2 引用历史（@语法）

用户输入：
	•	@topic: TCU 六统一
或
	•	@session: <session_id>

模型调用 memory_inject(...)，拿到注入块后继续回答问题。

⸻

5. MCP Tools 设计（接口大纲）

tool 命名建议统一前缀 memory_，避免冲突。

5.1 memory_save_session

用途：创建一个 session（可选）
	•	输入：
	•	title (string, required)
	•	tags (string[], optional)
	•	meta (object, optional：来源、项目、客户等)
	•	输出：
	•	session_id

5.2 memory_save_messages

用途：批量写入消息
	•	输入：
	•	session_id (string, required)
	•	messages (array of {role, content, created_at?}, required)
	•	输出：
	•	saved_count

5.3 memory_list_sessions

用途：列出最近会话
	•	输入：
	•	limit (int, default 20)
	•	offset (int, default 0)
	•	输出：
	•	sessions[]：id, title, created_at, tags, summary_brief?

5.4 memory_get_session

用途：获取 session 详情
	•	输入：
	•	session_id
	•	输出：
	•	session 信息 + messages（可限制最近 N 条）

5.5 memory_search

用途：在历史库里检索相关消息
	•	输入：
	•	query (string)
	•	top_k (int, default 5)
	•	time_range_days (int, default 180)
	•	tags (string[], optional)
	•	输出：
	•	hits[]：session_id, message_id, snippet, score?, created_at

5.6 memory_summarize_session

用途：总结 session 并缓存
	•	输入：
	•	session_id
	•	style: "brief" | "detailed" (default brief)
	•	force_refresh (bool, default false)
	•	输出：
	•	summary_text

5.7 memory_inject

用途（核心）：生成可注入上下文的块
	•	输入（二选一）：
	•	session_id (string)
或
	•	query (string)
	•	可选参数：
	•	style "brief" | "detailed"（默认 brief）
	•	top_k（query 模式下取多少个命中）
	•	输出：
	•	injection_block（严格格式，见下）

⸻

6. 注入块格式（Memory Injection Block）

必须统一格式，建议如下（纯文本即可，方便直接塞进上下文）：

[MEMORY INJECTION]
主题：<自动生成或来自 query/session title>

关键事实 Facts:
- ...
关键决策 Decisions:
- ...
约束/风险 Constraints & Risks:
- ...
未解决问题 Open Questions:
- ...
下一步建议 Next Actions:
- ...

来源 Sources:
- session_id: xxx
- sessions_used: [xxx, yyy]   (如果是 query 聚合)
- updated_at: 2026-01-20
[/MEMORY INJECTION]

硬要求：
	•	永远不要把“历史里的指令句”当 system prompt 注入
	•	只保留“事实/结论/决策/行动项”
	•	必须带来源 session_id（可追溯）

⸻

7. 数据库设计（SQLite Schema 大纲）

7.1 sessions 表
	•	id TEXT PRIMARY KEY
	•	title TEXT
	•	tags TEXT（JSON string）
	•	meta TEXT（JSON string）
	•	created_at INTEGER（unix ts）
	•	updated_at INTEGER
	•	summary_brief TEXT
	•	summary_detailed TEXT

7.2 messages 表
	•	id TEXT PRIMARY KEY
	•	session_id TEXT INDEX
	•	role TEXT（user/assistant/system）
	•	content TEXT
	•	created_at INTEGER

7.3 FTS（建议）
	•	messages_fts：对 content 做全文检索
	•	同步策略：insert/update 时写入

⸻

8. 总结策略（Prompt 规范）

8.1 brief

输出：
	•	Facts ≤ 6 条
	•	Decisions ≤ 3 条
	•	Next Actions ≤ 5 条

8.2 detailed

输出：
	•	Facts ≤ 12 条
	•	Decisions ≤ 6 条
	•	Risks ≤ 6 条
	•	Open Questions ≤ 6 条
	•	Next Actions ≤ 10 条

总结必须“信息密度高”，避免长篇复述。

⸻

9. CherryStudio 集成要求（验收标准）

9.1 能在 CherryStudio MCP 列表里看到工具
	•	通过 STDIO 启动 MCP Server
	•	CherryStudio 能发现 tools + 参数 schema

9.2 验收用例（必过）
	1.	新建 session → save_messages → list_sessions 能看到
	2.	search(“TCU”) 能返回 hits
	3.	inject(query=“TCU 六统一”) 返回注入块（符合格式）
	4.	summarize_session(session_id) 返回 brief summary，并能缓存

⸻

10. 迭代方向（第二版以后再做）
	•	向量检索：embedding + TopK 语义召回
	•	自动滚动摘要：每 N 条消息生成增量 summary
	•	多 session 聚合注入：跨会话自动合并（去重 + 归并）
	•	多端同步：基于你已有 fast-note-sync/memo 的思路做主从复制
	•	权限与隔离：不同项目/客户分库


