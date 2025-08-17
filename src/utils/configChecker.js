// 配置检查工具
import { getEnvironmentInfo, getApiConfig } from '../config/api.js';

/**
 * 检查前端配置状态
 * @returns {Object} 配置状态信息
 */
export function checkFrontendConfig() {
  const envInfo = getEnvironmentInfo();
  const apiConfig = getApiConfig();
  
  const config = {
    environment: envInfo.mode,
    isDevelopment: envInfo.isDev,
    isProduction: envInfo.isProd,
    apiBaseURL: envInfo.apiBaseURL,
    resolvedBaseURL: apiConfig.baseURL,
    hasApiBaseURL: !!envInfo.apiBaseURL,
    configStatus: 'unknown'
  };
  
  // 评估配置状态
  if (envInfo.isDev) {
    if (envInfo.apiBaseURL) {
      config.configStatus = 'explicit_dev';
      config.message = '开发环境：使用显式配置的API地址';
    } else {
      config.configStatus = 'proxy_dev';
      config.message = '开发环境：使用代理模式（推荐）';
    }
  } else {
    if (envInfo.apiBaseURL) {
      config.configStatus = 'explicit_prod';
      config.message = '生产环境：使用显式配置的API地址';
    } else {
      config.configStatus = 'fallback_prod';
      config.message = '生产环境：使用默认回退地址（不推荐）';
    }
  }
  
  return config;
}

/**
 * 检查后端连接状态
 * @returns {Promise<Object>} 连接状态信息
 */
export async function checkBackendConnection() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    
    return {
      status: 'connected',
      response: data,
      message: '后端连接正常'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      message: '后端连接失败'
    };
  }
}

/**
 * 获取配置建议
 * @returns {Object} 配置建议
 */
export function getConfigSuggestions() {
  const envInfo = getEnvironmentInfo();
  
  const suggestions = {
    development: [
      '建议使用代理模式，在 .env.local 中设置 VITE_API_BASE_URL=/api',
      '或者设置 VITE_API_BASE_URL=http://localhost:8000 进行直接访问'
    ],
    production: [
      '必须设置 VITE_API_BASE_URL 为生产环境的API地址',
      '确保后端CORS配置允许前端域名访问',
      '建议使用HTTPS协议'
    ]
  };
  
  return {
    current: envInfo.isDev ? 'development' : 'production',
    suggestions: suggestions[envInfo.isDev ? 'development' : 'production']
  };
}

/**
 * 验证配置完整性
 * @returns {Object} 验证结果
 */
export function validateConfiguration() {
  const config = checkFrontendConfig();
  const suggestions = getConfigSuggestions();
  
  const validation = {
    isValid: false,
    issues: [],
    warnings: [],
    recommendations: []
  };
  
  // 检查开发环境配置
  if (config.isDevelopment) {
    if (config.configStatus === 'proxy_dev') {
      validation.isValid = true;
      validation.recommendations.push('开发环境配置良好，使用代理模式');
    } else if (config.configStatus === 'explicit_dev') {
      validation.isValid = true;
      validation.warnings.push('开发环境使用显式配置，确保后端端口正确');
    }
  }
  
  // 检查生产环境配置
  if (config.isProduction) {
    if (config.configStatus === 'explicit_prod') {
      validation.isValid = true;
      validation.recommendations.push('生产环境配置正确');
    } else {
      validation.isValid = false;
      validation.issues.push('生产环境缺少必要的API配置');
      validation.recommendations.push(...suggestions.suggestions);
    }
  }
  
  return validation;
}

/**
 * 生成配置报告
 * @returns {Promise<Object>} 完整的配置报告
 */
export async function generateConfigReport() {
  const frontendConfig = checkFrontendConfig();
  const backendConnection = await checkBackendConnection();
  const validation = validateConfiguration();
  const suggestions = getConfigSuggestions();
  
  return {
    timestamp: new Date().toISOString(),
    frontend: frontendConfig,
    backend: backendConnection,
    validation: validation,
    suggestions: suggestions,
    summary: {
      overallStatus: validation.isValid ? 'good' : 'needs_attention',
      hasIssues: validation.issues.length > 0,
      hasWarnings: validation.warnings.length > 0,
      recommendations: validation.recommendations.length
    }
  };
}
