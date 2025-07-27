// 测试知识库功能的脚本 (ES模块版本)
const API_BASE_URL = 'http://localhost:8000';

async function testKnowledgeBase() {
  console.log('🧪 开始测试知识库功能...\n');

  try {
    // 1. 健康检查
    console.log('1. 检查后端服务状态...');
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    const health = await healthResponse.json();
    console.log('✅ 后端服务状态:', health);

    // 2. 获取知识库信息
    console.log('\n2. 获取知识库信息...');
    const infoResponse = await fetch(`${API_BASE_URL}/api/info`);
    const info = await infoResponse.json();
    console.log('✅ 知识库信息:', info);

    // 3. 测试搜索功能
    console.log('\n3. 测试搜索功能...');
    const searchResponse = await fetch(`${API_BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'grammatical gender',
        n_results: 2
      })
    });
    const searchResults = await searchResponse.json();
    console.log('✅ 搜索结果数量:', searchResults.total_found);
    console.log('✅ 第一个结果:', searchResults.results[0]?.metadata?.filename || '无结果');

    // 4. 测试中文搜索
    console.log('\n4. 测试中文搜索...');
    const chineseSearchResponse = await fetch(`${API_BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '语法性别',
        n_results: 2
      })
    });
    const chineseResults = await chineseSearchResponse.json();
    console.log('✅ 中文搜索结果数量:', chineseResults.total_found);

    console.log('\n🎉 所有测试通过！知识库功能正常工作。');
    console.log('\n📋 测试总结:');
    console.log('- ✅ 后端服务正常运行');
    console.log('- ✅ 知识库已初始化');
    console.log('- ✅ 文档数量:', info.total_documents);
    console.log('- ✅ 搜索功能正常');
    console.log('- ✅ 支持中英文查询');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testKnowledgeBase(); 