import React, { useState, useEffect } from 'react';

const LinguisticKnowledgeBase = ({ lang = 'zh' }) => {
  const [isLoading, setIsLoading] = useState(true);



  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // 暂时不加载数据，等待后续功能实现
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [lang]);

  if (isLoading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
        {lang === 'zh' ? '加载中...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>


    </div>
  );
};

export default LinguisticKnowledgeBase; 