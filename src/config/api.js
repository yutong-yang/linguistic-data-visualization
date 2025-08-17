// API配置文件
export const API_CONFIG = {
  // 从环境变量获取API基础URL，如果没有设置则使用默认值
  // 开发环境下支持代理，生产环境使用完整URL
  baseURL: import.meta.env.DEV 
    ? (import.meta.env.VITE_API_BASE_URL || '/api') 
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'),
  
  // API超时时间（毫秒）
  timeout: 30000,
  
  // 默认请求头
  headers: {
    'Content-Type': 'application/json'
  },
  
  // 文件上传配置
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['pdf', 'docx', 'txt'],
    chunkSize: 1024 * 1024 // 1MB分块上传
  },
  
  // 重试配置
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryStatusCodes: [408, 429, 500, 502, 503, 504]
  }
};

// API端点配置
export const API_ENDPOINTS = {
  // 知识库相关
  knowledgeBase: {
    init: '/api/init',
    info: '/api/info',
    status: '/api/status',
    search: '/api/search',
    addDocument: '/api/add-document',
    uploadPaper: '/api/upload-paper',
    addDocumentsBatch: '/api/add-documents-batch',
    clear: '/api/clear',
    health: '/api/health',
    progress: '/api/progress',
    taskStatus: '/api/task-status',
    cancelTask: '/api/cancel-task'
  },
  
  // 其他API端点可以在这里添加
};

// 构建完整的API URL
export function buildApiUrl(endpoint) {
  // 开发环境下，如果使用代理，直接返回相对路径
  if (import.meta.env.DEV && API_CONFIG.baseURL.startsWith('/')) {
    return endpoint;
  }
  
  // 生产环境或直接访问，构建完整URL
  return `${API_CONFIG.baseURL}${endpoint}`;
}

// 获取API配置
export function getApiConfig() {
  return API_CONFIG;
}

// 获取API端点
export function getApiEndpoints() {
  return API_ENDPOINTS;
}

// 检查是否为开发环境
export function isDevelopment() {
  return import.meta.env.DEV;
}

// 获取当前环境信息
export function getEnvironmentInfo() {
  return {
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    baseURL: API_CONFIG.baseURL,
    apiBaseURL: import.meta.env.VITE_API_BASE_URL
  };
}
