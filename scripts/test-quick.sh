#!/bin/bash
# 快速功能测试

MEMORY_DB_PATH="${MEMORY_DB_PATH:-./data/test-memory.db}"

echo "🧪 ChatMemory MCP Server - 快速测试"
echo ""

# 确保已编译
if [ ! -f "build/index.js" ]; then
    echo "正在编译..."
    npm run build
fi

mkdir -p "$(dirname "$MEMORY_DB_PATH")"

echo "测试 1: 列出所有工具"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
    MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | \
    tail -1 | \
    python3 -m json.tool 2>/dev/null | \
    grep '"name"' | \
    head -7

echo ""
echo "测试 2: 创建测试会话"
RESULT=$(echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_save_session","arguments":{"title":"快速测试会话","tags":["test"]}}}' | \
    MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | \
    tail -1)

SESSION_ID=$(echo "$RESULT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
    echo "✓ 会话创建成功: $SESSION_ID"
else
    echo "✗ 会话创建失败"
    exit 1
fi

echo ""
echo "测试 3: 保存测试消息"
echo "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"memory_save_messages\",\"arguments\":{\"session_id\":\"$SESSION_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"这是一条测试消息\"},{\"role\":\"assistant\",\"content\":\"我收到了你的测试消息\"}]}}}" | \
    MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | \
    tail -1 | \
    grep -q "saved_count" && echo "✓ 消息保存成功" || echo "✗ 消息保存失败"

echo ""
echo "测试 4: 搜索测试"
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"memory_search","arguments":{"query":"测试","top_k":5}}}' | \
    MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | \
    tail -1 | \
    grep -q "hits" && echo "✓ 搜索功能正常" || echo "✗ 搜索功能失败"

echo ""
echo "测试 5: 查看数据库内容"
echo "Sessions:"
sqlite3 "$MEMORY_DB_PATH" "SELECT id, title, created_at FROM sessions LIMIT 3;"
echo ""
echo "Messages:"
sqlite3 "$MEMORY_DB_PATH" "SELECT id, role, substr(content, 1, 30) as content FROM messages LIMIT 3;"

echo ""
echo "✅ 快速测试完成！"
echo ""
echo "数据库位置: $MEMORY_DB_PATH"
echo "查看完整数据: sqlite3 $MEMORY_DB_PATH"
