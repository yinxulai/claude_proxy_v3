#!/bin/bash

# 域名白名单功能演示脚本

echo "=================================="
echo "域名白名单功能演示"
echo "=================================="
echo ""
echo "白名单域名: qiniu.com, sufy.com, qnaigc.com"
echo ""

# 假设代理服务器运行在 localhost:8788
PROXY_URL="http://localhost:8788"

echo "1. 测试允许的域名 (api.qnaigc.com) - 应该成功"
echo "   curl -X POST $PROXY_URL/https/api.qnaigc.com/v1/models"
echo ""

echo "2. 测试允许的域名 (api.qiniu.com) - 应该成功"
echo "   curl -X POST $PROXY_URL/https/api.qiniu.com/v1/models"
echo ""

echo "3. 测试允许的域名 (api.sufy.com) - 应该成功"
echo "   curl -X POST $PROXY_URL/https/api.sufy.com/v1/models"
echo ""

echo "4. 测试不允许的域名 (api.openai.com) - 应该被拒绝 403"
echo "   curl -X POST $PROXY_URL/https/api.openai.com/v1/models"
echo ""

echo "5. 测试恶意域名 (qiniu.com.evil.com) - 应该被拒绝 403"
echo "   curl -X POST $PROXY_URL/https/qiniu.com.evil.com/v1/models"
echo ""

echo "=================================="
echo "运行实际测试"
echo "=================================="
echo ""

# 只在服务器运行时执行实际测试
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8788/favicon.ico 2>/dev/null | grep -q "204"; then
    echo "✓ 代理服务器正在运行"
    echo ""
    
    echo "测试 1: 允许的域名 (api.qnaigc.com)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$PROXY_URL/https/api.qnaigc.com/v1/models")
    if [ "$HTTP_CODE" != "403" ]; then
        echo "✓ 通过 (HTTP $HTTP_CODE)"
    else
        echo "✗ 失败 (HTTP $HTTP_CODE - 不应该被拒绝)"
    fi
    echo ""
    
    echo "测试 2: 不允许的域名 (api.openai.com)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$PROXY_URL/https/api.openai.com/v1/models")
    if [ "$HTTP_CODE" = "403" ]; then
        echo "✓ 正确拒绝 (HTTP $HTTP_CODE)"
    else
        echo "✗ 失败 (HTTP $HTTP_CODE - 应该被拒绝)"
    fi
    echo ""
    
    echo "测试 3: 恶意域名 (qiniu.com.evil.com)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$PROXY_URL/https/qiniu.com.evil.com/v1/models")
    if [ "$HTTP_CODE" = "403" ]; then
        echo "✓ 正确拒绝 (HTTP $HTTP_CODE)"
    else
        echo "✗ 失败 (HTTP $HTTP_CODE - 应该被拒绝)"
    fi
else
    echo "✗ 代理服务器未运行在 localhost:8788"
    echo "   请先启动服务器: npm run dev 或 npm run server"
fi

echo ""
echo "=================================="
echo "测试完成"
echo "=================================="
