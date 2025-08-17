// 导入API配置
import { buildApiUrl, API_ENDPOINTS } from '../config/api.js';

/**
 * 初始化知识库
 * @param {string} openaiApiKey - OpenAI API密钥
 * @returns {Promise<Object>} 初始化结果
 */
export async function initKnowledgeBase(openaiApiKey = null) {
  try {
    // 简单知识库不需要初始化，直接返回成功
    return {
      message: "简单知识库已准备就绪",
      type: "simple_kb"
    };
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.info));
    
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.search), {
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.addDocument), {
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.addDocumentsBatch), {
      method: 'POST'
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.clear), {
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
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.health));
    
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
export async function buildRAGContext(userQuery, maxResults = 10) {
  try {
    console.log('构建简单RAG上下文，查询:', userQuery, '最大结果数:', maxResults);
    
    // 搜索相关知识 - 使用简单知识库，确保至少获取10个结果
    const searchResults = await searchKnowledgeBase(userQuery, Math.max(maxResults, 10));
    
    if (!searchResults.results || searchResults.results.length === 0) {
      console.log('简单知识库中没有找到相关文档');
      return '';
    }

    // 构建上下文 - 适配简单知识库格式
    let context = '\n\n=== 简单知识库相关内容 ===\n';
    
    searchResults.results.forEach((result, index) => {
      const document = result.document || {};
      const metadata = result.metadata || document.metadata || {};
      const content = result.content || document.content || '';
      
      const sourceName = metadata.filename || '未知文档';
      const sourceType = metadata.type || 'unknown';
      const score = result.score || 0;
      
      context += `\n**来源 ${index + 1}**: ${sourceName}\n`;
      context += `**类型**: ${sourceType}\n`;
      context += `**相关性**: ${score}\n`;
      context += `**内容**: ${content.substring(0, 300)}${content.length > 300 ? '...' : ''}\n`;
      context += '\n---\n';
    });

    console.log('构建的简单RAG上下文长度:', context.length, '包含结果数:', searchResults.results.length);
    return context;
  } catch (error) {
    console.error('构建简单RAG上下文失败:', error);
    return '';
  }
}

/**
 * 检查知识库状态
 * @returns {Promise<boolean>} 知识库是否可用
 */
export async function checkKnowledgeBaseStatus() {
  try {
    // 使用新的状态接口
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.status));
    
    if (!response.ok) {
      throw new Error(`状态检查失败: ${response.statusText}`);
    }
    
    const status = await response.json();
    return status.status === 'ready' && status.knowledge_base_initialized;
  } catch (error) {
    console.error('检查知识库状态失败:', error);
    return false;
  }
}

/**
 * 获取系统状态（新增）
 * @returns {Promise<Object>} 系统状态信息
 */
export async function getSystemStatus() {
  try {
    console.log('调用 getSystemStatus，API URL:', `${buildApiUrl(API_ENDPOINTS.knowledgeBase.status)}`);
    
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.status));
    
    console.log('API 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`获取状态失败: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API 返回数据:', data);
    
    return data;
  } catch (error) {
    console.error('获取系统状态失败:', error);
    console.error('错误详情:', error.message, error.stack);
    throw error;
  }
}

/**
 * 取消当前正在运行的任务
 * @returns {Promise<Object>} 取消结果
 */
export async function cancelCurrentTask() {
  try {
    console.log('调用 cancelCurrentTask，API URL:', `${buildApiUrl(API_ENDPOINTS.knowledgeBase.cancelTask)}`);
    
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.cancelTask), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('API 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`取消任务失败: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API 返回数据:', data);
    
    return data;
  } catch (error) {
    console.error('取消任务失败:', error);
    console.error('错误详情:', error.message, error.stack);
    throw error;
  }
}

/**
 * 获取当前任务状态
 * @returns {Promise<Object>} 任务状态信息
 */
export async function getTaskStatus() {
  try {
    console.log('调用 getTaskStatus，API URL:', `${buildApiUrl(API_ENDPOINTS.knowledgeBase.taskStatus)}`);
    
    const response = await fetch(buildApiUrl(API_ENDPOINTS.knowledgeBase.taskStatus));
    
    console.log('API 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`获取任务状态失败: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API 返回数据:', data);
    
    return data;
  } catch (error) {
    console.error('获取任务状态失败:', error);
    console.error('错误详情:', error.message, error.stack);
    throw error;
  }
} 