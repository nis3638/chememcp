#!/bin/bash
# 测试脚本 - 使用 MCP Inspector

echo "正在启动 MCP Inspector..."
echo ""
echo "环境变量配置："
echo "  MEMORY_DB_PATH: ${MEMORY_DB_PATH:-未设置}"
echo "  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+已设置}"
echo ""

# 检查环境变量
if [ -z "$MEMORY_DB_PATH" ]; then
    echo "⚠️  警告：MEMORY_DB_PATH 未设置"
    echo "使用默认路径：./data/test-memory.db"
    export MEMORY_DB_PATH="./data/test-memory.db"
fi

# 确保数据库目录存在
mkdir -p "$(dirname "$MEMORY_DB_PATH")"

# 启动 MCP Inspector
echo "启动 MCP Inspector..."
npx @modelcontextprotocol/inspector node build/index.js
