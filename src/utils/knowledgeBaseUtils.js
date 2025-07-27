// 知识库API基础URL
const KNOWLEDGE_BASE_API_URL = 'http://localhost:8000/api';

/**
 * 初始化知识库
 * @param {string} openaiApiKey - OpenAI API密钥
 * @returns {Promise<Object>} 初始化结果
 */
export async function initKnowledgeBase(openaiApiKey = null) {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        openai_api_key: openaiApiKey
      })
    });

    if (!response.ok) {
      throw new Error(`初始化失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('初始化知识库失败:', error);
    throw error;
  }
}

/**
 * 获取知识库信息
 * @returns {Promise<Object>} 知识库信息
 */
export async function getKnowledgeBaseInfo() {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/info`);
    
    if (!response.ok) {
      throw new Error(`获取信息失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取知识库信息失败:', error);
    throw error;
  }
}

/**
 * 搜索知识库
 * @param {string} query - 搜索查询
 * @param {number} nResults - 返回结果数量
 * @returns {Promise<Object>} 搜索结果
 */
export async function searchKnowledgeBase(query, nResults = 5) {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        n_results: nResults
      })
    });

    if (!response.ok) {
      throw new Error(`搜索失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('搜索知识库失败:', error);
    throw error;
  }
}

/**
 * 添加文档到知识库
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型 ('pdf' 或 'csv')
 * @returns {Promise<Object>} 添加结果
 */
export async function addDocumentToKnowledgeBase(filePath, fileType) {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/add-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: filePath,
        file_type: fileType
      })
    });

    if (!response.ok) {
      throw new Error(`添加文档失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('添加文档失败:', error);
    throw error;
  }
}

/**
 * 批量添加文档
 * @returns {Promise<Object>} 批量添加结果
 */
export async function addDocumentsBatch() {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/add-documents-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`批量添加失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('批量添加文档失败:', error);
    throw error;
  }
}

/**
 * 清空知识库
 * @returns {Promise<Object>} 清空结果
 */
export async function clearKnowledgeBase() {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/clear`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`清空失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('清空知识库失败:', error);
    throw error;
  }
}

/**
 * 健康检查
 * @returns {Promise<Object>} 健康状态
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_API_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`健康检查失败: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('健康检查失败:', error);
    throw error;
  }
}

/**
 * 构建RAG上下文
 * @param {string} userQuery - 用户查询
 * @param {number} maxResults - 最大结果数
 * @returns {Promise<string>} 构建的上下文
 */
export async function buildRAGContext(userQuery, maxResults = 3) {
  try {
    // 搜索相关知识
    const searchResults = await searchKnowledgeBase(userQuery, maxResults);
    
    if (!searchResults.results || searchResults.results.length === 0) {
      return '';
    }

    // 构建上下文
    let context = '\n\n=== 相关知识库内容 ===\n';
    
    searchResults.results.forEach((result, index) => {
      const sourceName = result.metadata?.filename || result.metadata?.source || '未知';
      const sourceType = result.metadata?.type || 'unknown';
      const sourcePath = result.metadata?.source || '';
      
      context += `\n**来源 ${index + 1}**: [${sourceName}](source://${sourcePath})\n`;
      context += `**类型**: ${sourceType}\n`;
      context += `**内容**: ${result.content}\n`;
      context += '\n---\n';
    });

    return context;
  } catch (error) {
    console.error('构建RAG上下文失败:', error);
    return '';
  }
}

/**
 * 检查知识库状态
 * @returns {Promise<boolean>} 知识库是否可用
 */
export async function checkKnowledgeBaseStatus() {
  try {
    const health = await healthCheck();
    return health.status === 'healthy' && health.knowledge_base_initialized;
  } catch (error) {
    console.error('检查知识库状态失败:', error);
    return false;
  }
} 