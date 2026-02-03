#!/bin/bash
# 简单集成测试

set -e

MEMORY_DB_PATH="${MEMORY_DB_PATH:-./data/test-memory.db}"
export MEMORY_DB_PATH

echo "🧪 ChatMemory MCP Server - 集成测试"
echo ""
echo "环境配置:"
echo "  数据库: $MEMORY_DB_PATH"
echo "  API Key: ${ANTHROPIC_API_KEY:+已设置}"
echo ""

# 确保编译
if [ ! -f "build/index.js" ]; then
    echo "正在编译项目..."
    npm run build
fi

# 清理旧数据
rm -f "$MEMORY_DB_PATH" "${MEMORY_DB_PATH}-shm" "${MEMORY_DB_PATH}-wal"
mkdir -p "$(dirname "$MEMORY_DB_PATH")"

echo "═══════════════════════════════════════════════════════════"
echo "测试 1: 验证服务器启动和工具列表"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test1.jsonl <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
EOF

OUTPUT=$(cat /tmp/test1.jsonl | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | tail -1)

if echo "$RESULT" | grep -q "memory_save_session"; then
    echo "✅ 服务器启动成功"
    TOOL_COUNT=$(echo "$RESULT" | grep -o '"name":"memory_' | wc -l | tr -d ' ')
    echo "   发现 $TOOL_COUNT 个 MCP 工具"
else
    echo "❌ 服务器启动失败"
    echo "$OUTPUT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "测试 2: 创建会话"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test2.jsonl <<'EOF'
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_save_session","arguments":{"title":"测试会话：TCU 六统一架构","tags":["TCU","测试","架构"]}}}
EOF

OUTPUT=$(cat /tmp/test2.jsonl | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | grep -o '{.*}' | tail -1)

if echo "$RESULT" | grep -q "session_id"; then
    echo "✅ 会话创建成功"
    SESSION_ID=$(echo "$RESULT" | sed 's/.*"session_id":"\([^"]*\)".*/\1/')
    echo "   Session ID: $SESSION_ID"
else
    echo "❌ 会话创建失败"
    echo "$RESULT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "测试 3: 保存消息"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test3.json <<EOF
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "memory_save_messages",
    "arguments": {
      "session_id": "$SESSION_ID",
      "messages": [
        {
          "role": "user",
          "content": "请介绍 TCU 六统一架构的核心理念"
        },
        {
          "role": "assistant",
          "content": "TCU 六统一架构包括：1. 统一接入 2. 统一认证 3. 统一授权 4. 统一审计 5. 统一配置 6. 统一监控"
        },
        {
          "role": "user",
          "content": "如何实施六统一架构"
        }
      ]
    }
  }
}
EOF

OUTPUT=$(cat /tmp/test3.json | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | grep -o '{.*}' | tail -1)

if echo "$RESULT" | grep -q "saved_count"; then
    echo "✅ 消息保存成功"
    COUNT=$(echo "$RESULT" | sed 's/.*"saved_count":\([0-9]*\).*/\1/')
    echo "   保存消息数: $COUNT"
else
    echo "❌ 消息保存失败"
    echo "$RESULT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "测试 4: 全文搜索"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test4.json <<'EOF'
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "memory_search",
    "arguments": {
      "query": "TCU 六统一",
      "top_k": 10
    }
  }
}
EOF

OUTPUT=$(cat /tmp/test4.json | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | grep -o '{.*}' | tail -1)

if echo "$RESULT" | grep -q "total_hits"; then
    echo "✅ 搜索功能正常"
    HITS=$(echo "$RESULT" | sed 's/.*"total_hits":\([0-9]*\).*/\1/')
    echo "   搜索结果: $HITS 条"
else
    echo "❌ 搜索功能失败"
    echo "$RESULT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "测试 5: 查询会话列表"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test5.json <<'EOF'
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "memory_list_sessions",
    "arguments": {
      "limit": 10
    }
  }
}
EOF

OUTPUT=$(cat /tmp/test5.json | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | grep -o '{.*}' | tail -1)

if echo "$RESULT" | grep -q "sessions"; then
    echo "✅ 会话列表查询成功"
    TOTAL=$(echo "$RESULT" | sed 's/.*"total":\([0-9]*\).*/\1/')
    echo "   会话总数: $TOTAL"
else
    echo "❌ 会话列表查询失败"
    echo "$RESULT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "测试 6: 获取会话详情"
echo "═══════════════════════════════════════════════════════════"

cat > /tmp/test6.json <<EOF
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "memory_get_session",
    "arguments": {
      "session_id": "$SESSION_ID",
      "include_messages": true
    }
  }
}
EOF

OUTPUT=$(cat /tmp/test6.json | node build/index.js 2>&1)
RESULT=$(echo "$OUTPUT" | grep -o '{.*}' | tail -1)

if echo "$RESULT" | grep -q "message_count"; then
    echo "✅ 获取会话详情成功"
    MSG_COUNT=$(echo "$RESULT" | sed 's/.*"message_count":\([0-9]*\).*/\1/')
    echo "   消息数量: $MSG_COUNT"
else
    echo "❌ 获取会话详情失败"
    echo "$RESULT"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "数据库验证"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Sessions 表:"
sqlite3 "$MEMORY_DB_PATH" "SELECT id, title, tags FROM sessions;" | head -5

echo ""
echo "Messages 表:"
sqlite3 "$MEMORY_DB_PATH" "SELECT role, substr(content, 1, 40) FROM messages;" | head -5

echo ""
echo "FTS5 检索测试:"
sqlite3 "$MEMORY_DB_PATH" "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH 'TCU';"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ 所有基础功能测试通过！"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "测试数据库: $MEMORY_DB_PATH"
echo ""
echo "可以执行以下命令查看详细数据:"
echo "  sqlite3 $MEMORY_DB_PATH"
echo "  sqlite3 $MEMORY_DB_PATH '.schema'"
echo "  sqlite3 $MEMORY_DB_PATH 'SELECT * FROM sessions;'"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "💡 提示: 设置 ANTHROPIC_API_KEY 后可测试总结和注入功能"
else
    echo "💡 API Key 已配置，可以测试总结和注入功能"
fi

# 清理临时文件
rm -f /tmp/test*.json /tmp/test*.jsonl

echo ""
echo "测试完成！"
