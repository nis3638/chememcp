# ChatMemory MCP Server - 测试指南

## 测试方法总览

本项目提供 4 种测试方法，从简单到复杂：

## 方法 1: 使用 MCP Inspector（推荐）⭐

最简单、最直观的测试方法，可视化界面：

```bash
# 1. 设置环境变量
export MEMORY_DB_PATH="./data/test-memory.db"
export ANTHROPIC_API_KEY="sk-ant-..."  # 可选

# 2. 编译项目
npm run build

# 3. 启动 Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

Inspector 会在浏览器中打开，可以：
- 查看所有 7 个工具
- 直接调用工具并查看响应
- 测试各种参数组合
- 查看详细的请求/响应日志

## 方法 2: 使用 SQLite 直接测试

最快速验证数据库功能：

```bash
# 1. 编译并启动数据库测试
npm run test:db

# 输出应该显示:
# ✓ Session inserted successfully
# ✓ Messages inserted successfully
# ✓ FTS5 search successful
# ✓ FTS5 triggers working
# ✓ All tests passed!
```

## 方法 3: 手动 JSON-RPC 测试

使用标准输入测试（适合调试）：

### 测试 1: 列出工具

```bash
export MEMORY_DB_PATH="./data/test-memory.db"

echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  node build/index.js 2>/dev/null | tail -1 | python3 -m json.tool
```

应该返回所有 7 个工具的列表。

### 测试 2: 创建会话

```bash
cat <<'EOF' | node build/index.js 2>/dev/null | tail -1
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_save_session","arguments":{"title":"测试会话","tags":["test"]}}}
EOF
```

应该返回包含 `session_id` 的响应。

### 测试 3: 保存消息

```bash
# 将上一步的 session_id 替换到这里
SESSION_ID="your-session-id-here"

cat <<EOF | node build/index.js 2>/dev/null | tail -1
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"memory_save_messages","arguments":{"session_id":"$SESSION_ID","messages":[{"role":"user","content":"测试消息"},{"role":"assistant","content":"收到"}]}}}
EOF
```

### 测试 4: 搜索

```bash
cat <<'EOF' | node build/index.js 2>/dev/null | tail -1
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"memory_search","arguments":{"query":"测试","top_k":5}}}
EOF
```

## 方法 4: 在 CherryStudio 中测试

### 步骤 1: 配置 MCP Server

在 CherryStudio 的设置中添加：

```json
{
  "mcpServers": {
    "chatmemory": {
      "command": "node",
      "args": ["/path/to/chememcp/build/index.js"],
      "env": {
        "MEMORY_DB_PATH": "/Users/username/.chememcp/memory.db",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### 步骤 2: 重启 CherryStudio

### 步骤 3: 验证工具可用

在对话中，模型应该能看到 7 个 memory_* 工具。

### 步骤 4: 测试场景

**场景 A: 保存当前对话**

用户说：
```
请把我们的对话保存到记忆库，标题叫"测试对话"
```

模型会调用 `memory_save_session` 和 `memory_save_messages`。

**场景 B: 搜索历史**

用户说：
```
搜索我之前问过的关于 TCU 的问题
```

模型会调用 `memory_search`。

**场景 C: 使用 @语法引用**

用户说：
```
@topic: TCU 六统一
基于之前的讨论，请继续深入
```

模型会调用 `memory_inject` 获取注入块。

## 验证测试成功

### 检查数据库

```bash
# 查看 sessions
sqlite3 $MEMORY_DB_PATH "SELECT * FROM sessions;"

# 查看 messages
sqlite3 $MEMORY_DB_PATH "SELECT * FROM messages;"

# 测试 FTS5 搜索
sqlite3 $MEMORY_DB_PATH "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '测试';"
```

### 检查日志

所有日志输出到 stderr（JSON 格式）：

```bash
node build/index.js 2>&1 | grep -v "^{" | less
```

## 常见问题排查

### 问题 1: 启动失败 - Missing MEMORY_DB_PATH

**原因**: 环境变量未设置

**解决**:
```bash
export MEMORY_DB_PATH="./data/memory.db"
mkdir -p ./data
```

### 问题 2: 总结功能失败

**原因**: ANTHROPIC_API_KEY 未设置

**解决**:
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-xxx..."
```

或者跳过总结功能的测试（其他功能不受影响）。

### 问题 3: FTS5 搜索无结果

**原因**: 数据库中没有数据

**解决**: 先使用 `memory_save_session` 和 `memory_save_messages` 保存一些数据。

### 问题 4: CherryStudio 看不到工具

**原因**:
- 路径配置错误
- 服务器启动失败
- 环境变量未传递

**解决**:
1. 检查 args 路径是否正确（绝对路径）
2. 查看 CherryStudio 的日志
3. 手动测试 MCP Server 是否能启动

## 性能测试

测试大量数据的性能：

```bash
# 生成测试数据
for i in {1..100}; do
  echo "{\"jsonrpc\":\"2.0\",\"id\":$i,\"method\":\"tools/call\",\"params\":{\"name\":\"memory_save_session\",\"arguments\":{\"title\":\"Session $i\"}}}" | \
    node build/index.js 2>/dev/null | tail -1
done

# 测试搜索性能
time echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memory_search","arguments":{"query":"Session","top_k":50}}}' | \
  node build/index.js 2>/dev/null
```

搜索应该在 100ms 以内完成。

## 自动化测试（未来）

可以添加的测试：
- [ ] 单元测试（Jest/Vitest）
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能基准测试
- [ ] 并发测试

## 测试清单

开发完成后，确保以下测试通过：

- [ ] `npm run test:db` 通过
- [ ] MCP Inspector 能看到 7 个工具
- [ ] 能创建 session 并保存 messages
- [ ] FTS5 搜索返回正确结果
- [ ] 列表和详情查询正常
- [ ] （可选）总结功能正常
- [ ] （可选）注入功能生成正确格式
- [ ] CherryStudio 集成正常

---

**提示**: 建议从方法 1（MCP Inspector）开始测试，这是最直观的方式！
