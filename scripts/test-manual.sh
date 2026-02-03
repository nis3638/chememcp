#!/bin/bash
# 手动测试脚本 - 完整的测试场景

set -e

MEMORY_DB_PATH="${MEMORY_DB_PATH:-./data/test-memory.db}"
SERVER_PID=""

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理函数
cleanup() {
    if [ -n "$SERVER_PID" ]; then
        log_info "停止 MCP Server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

# 启动服务器
start_server() {
    log_info "启动 MCP Server..."
    mkdir -p "$(dirname "$MEMORY_DB_PATH")"
    node build/index.js > /tmp/mcp-server-stdout.log 2> /tmp/mcp-server-stderr.log &
    SERVER_PID=$!
    sleep 2

    if ps -p $SERVER_PID > /dev/null; then
        log_success "MCP Server 启动成功 (PID: $SERVER_PID)"
    else
        log_error "MCP Server 启动失败"
        cat /tmp/mcp-server-stderr.log
        exit 1
    fi
}

# 发送 JSON-RPC 请求
send_request() {
    local method="$1"
    local params="$2"
    local id="${3:-1}"

    local request="{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"$method\""
    if [ -n "$params" ]; then
        request="$request,\"params\":$params"
    fi
    request="$request}"

    echo "$request" | nc -q 1 localhost 3000 2>/dev/null || echo "$request"
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          ChatMemory MCP Server - 手动测试脚本              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

log_info "环境配置："
log_info "  MEMORY_DB_PATH: $MEMORY_DB_PATH"
log_info "  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+已设置}"
echo ""

# 检查编译
if [ ! -f "build/index.js" ]; then
    log_warning "项目未编译，正在编译..."
    npm run build
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 1: 验证服务器启动和工具注册"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_info "测试 tools/list..."
result=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "memory_save_session"; then
    log_success "✓ tools/list 测试通过"
    tool_count=$(echo "$result" | grep -o "memory_" | wc -l)
    log_info "  发现 $tool_count 个工具"
else
    log_error "✗ tools/list 测试失败"
    echo "$result"
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 2: 创建会话并保存消息"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_info "测试 memory_save_session..."
cat > /tmp/test_save_session.json <<'EOF'
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_save_session","arguments":{"title":"测试会话：TCU 六统一","tags":["TCU","测试"],"meta":{"project":"test"}}}}
EOF

result=$(cat /tmp/test_save_session.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "session_id"; then
    log_success "✓ memory_save_session 测试通过"
    SESSION_ID=$(echo "$result" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
    log_info "  会话 ID: $SESSION_ID"
else
    log_error "✗ memory_save_session 测试失败"
    echo "$result"
    exit 1
fi

echo ""
log_info "测试 memory_save_messages..."
cat > /tmp/test_save_messages.json <<EOF
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"memory_save_messages","arguments":{"session_id":"$SESSION_ID","messages":[{"role":"user","content":"请介绍一下 TCU 六统一架构"},{"role":"assistant","content":"TCU 六统一是指统一接入、统一认证、统一授权、统一审计、统一配置、统一监控的企业级架构设计理念"}]}}}
EOF

result=$(cat /tmp/test_save_messages.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "saved_count"; then
    log_success "✓ memory_save_messages 测试通过"
    saved_count=$(echo "$result" | grep -o '"saved_count":[0-9]*' | cut -d':' -f2)
    log_info "  保存消息数: $saved_count"
else
    log_error "✗ memory_save_messages 测试失败"
    echo "$result"
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 3: 全文搜索"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_info "测试 memory_search..."
cat > /tmp/test_search.json <<'EOF'
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"memory_search","arguments":{"query":"TCU","top_k":5}}}
EOF

result=$(cat /tmp/test_search.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "hits"; then
    log_success "✓ memory_search 测试通过"
    hit_count=$(echo "$result" | grep -o '"total_hits":[0-9]*' | cut -d':' -f2)
    log_info "  搜索结果: $hit_count 条"
else
    log_error "✗ memory_search 测试失败"
    echo "$result"
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 4: 查询会话列表"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_info "测试 memory_list_sessions..."
cat > /tmp/test_list.json <<'EOF'
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"memory_list_sessions","arguments":{"limit":10}}}
EOF

result=$(cat /tmp/test_list.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "sessions"; then
    log_success "✓ memory_list_sessions 测试通过"
    session_count=$(echo "$result" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    log_info "  会话总数: $session_count"
else
    log_error "✗ memory_list_sessions 测试失败"
    echo "$result"
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 5: 获取会话详情"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_info "测试 memory_get_session..."
cat > /tmp/test_get.json <<EOF
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"memory_get_session","arguments":{"session_id":"$SESSION_ID","include_messages":true}}}
EOF

result=$(cat /tmp/test_get.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

if echo "$result" | grep -q "message_count"; then
    log_success "✓ memory_get_session 测试通过"
    msg_count=$(echo "$result" | grep -o '"message_count":[0-9]*' | cut -d':' -f2)
    log_info "  消息数量: $msg_count"
else
    log_error "✗ memory_get_session 测试失败"
    echo "$result"
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 6: 会话总结（需要 API Key）"
echo "══════════════════════════════════════════════════════════════"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
    log_warning "⊘ ANTHROPIC_API_KEY 未设置，跳过总结测试"
else
    log_info "测试 memory_summarize_session..."
    cat > /tmp/test_summarize.json <<EOF
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"memory_summarize_session","arguments":{"session_id":"$SESSION_ID","style":"brief"}}}
EOF

    result=$(cat /tmp/test_summarize.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

    if echo "$result" | grep -q "summary"; then
        log_success "✓ memory_summarize_session 测试通过"
    else
        log_error "✗ memory_summarize_session 测试失败"
        echo "$result"
    fi
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试场景 7: 生成注入块（需要 API Key）"
echo "══════════════════════════════════════════════════════════════"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
    log_warning "⊘ ANTHROPIC_API_KEY 未设置，跳过注入测试"
else
    log_info "测试 memory_inject (session_id 模式)..."
    cat > /tmp/test_inject.json <<EOF
{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"memory_inject","arguments":{"session_id":"$SESSION_ID","style":"brief"}}}
EOF

    result=$(cat /tmp/test_inject.json | MEMORY_DB_PATH="$MEMORY_DB_PATH" node build/index.js 2>/dev/null | tail -1)

    if echo "$result" | grep -q "injection_block"; then
        log_success "✓ memory_inject 测试通过"

        # 提取注入块内容
        injection_block=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['content'][0]['text'])" 2>/dev/null | grep -A 20 "\[MEMORY INJECTION\]" || echo "无法提取")

        if [ "$injection_block" != "无法提取" ]; then
            log_info "  注入块预览："
            echo "$injection_block" | head -10
        fi
    else
        log_error "✗ memory_inject 测试失败"
        echo "$result"
    fi
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  测试总结"
echo "══════════════════════════════════════════════════════════════"
echo ""

log_success "✅ 所有基础测试通过！"
echo ""
log_info "测试数据库位置: $MEMORY_DB_PATH"
log_info "可以使用 sqlite3 查看数据库内容："
echo "  sqlite3 $MEMORY_DB_PATH 'SELECT * FROM sessions;'"
echo "  sqlite3 $MEMORY_DB_PATH 'SELECT * FROM messages;'"
echo ""

# 清理测试文件
rm -f /tmp/test_*.json

log_info "测试完成！"
