// API配置文件
const CONFIG = {
    // GEMINI_API_KEY: '',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent'
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 