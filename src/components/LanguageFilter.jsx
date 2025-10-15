import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';

const LanguageFilter = () => {
  const { lang, langs, languageFilter, setLanguageFilter, languageData, setDorecoHighlightedLanguages } = useContext(DataContext);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [dorecoLanguages, setDorecoLanguages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 加载DoReCo语言数据
  useEffect(() => {
    const loadDorecoLanguages = async () => {
      try {
        const response = await fetch('/doreco.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').slice(1); // 跳过标题行
        const languages = lines
          .filter(line => line.trim())
          .map(line => {
            const [id, name, macroarea, lat, lng, glottocode] = line.split(',');
            return {
              id: id.trim(),
              name: name.trim(),
              glottocode: glottocode.trim(),
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
              macroarea: macroarea.trim()
            };
          });
        setDorecoLanguages(languages);
      } catch (error) {
        console.error('Failed to load DoReCo languages:', error);
      }
    };

    loadDorecoLanguages();
  }, []);

  // 点击外部区域关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchResults && !event.target.closest('.language-search-container')) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // 语言搜索功能
  const searchLanguages = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      // 从当前数据集搜索语言
      const results = languageData.filter(lang => {
        const name = (lang.Name || lang.name || '').toLowerCase();
        const glottocode = (lang.Glottocode || lang.glottocode || lang.Language_ID || '').toLowerCase();
        const queryLower = query.toLowerCase();
        
        return name.includes(queryLower) || glottocode.includes(queryLower);
      }).slice(0, 10); // 限制结果数量

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching languages:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchLanguages(query);
  };

  const selectLanguage = (language) => {
    const glottocode = language.Glottocode || language.glottocode || language.Language_ID;
    if (glottocode) {
      setLanguageFilter([glottocode]);
      setSelectedFilter('custom');
      setSearchQuery(language.Name || language.name);
      setShowSearchResults(false);
    }
  };

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
    
    if (filter === 'all') {
      setLanguageFilter(null); // null表示不过滤
      setSearchQuery('');
      setDorecoHighlightedLanguages([]); // 清除doreco高亮
    } else if (filter === 'doreco') {
      const dorecoGlottocodes = dorecoLanguages.map(lang => lang.glottocode);
      setLanguageFilter(dorecoGlottocodes);
      setSearchQuery('');
      
      // 设置doreco高亮语言 - 使用glottocode匹配数据集中的语言
      const dorecoLanguageNames = [];
      dorecoGlottocodes.forEach(glottocode => {
        const matchingLang = languageData.find(lang => {
          const langGlottocode = lang.Glottocode || lang.glottocode || lang.Language_ID;
          return langGlottocode === glottocode;
        });
        if (matchingLang && matchingLang.Name) {
          dorecoLanguageNames.push(matchingLang.Name);
        }
      });
      setDorecoHighlightedLanguages(dorecoLanguageNames);
      
      // 打印调试信息
      
      // 这里需要等待DataContext更新filteredLanguageData后再打印
      setTimeout(() => {
        // 通过DataContext获取当前的语言数据进行比较
      }, 100);
    } else if (filter === 'custom') {
      setDorecoHighlightedLanguages([]); // 清除doreco高亮
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c7c6c', whiteSpace: 'nowrap' }}>
        {lang === 'zh' ? '语言筛选' : 'Language Filter'}:
      </label>
      
      {/* 语言搜索输入框 */}
      <div className="language-search-container" style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={lang === 'zh' ? '搜索语言...' : 'Search language...'}
          value={searchQuery}
          onChange={handleSearchChange}
          style={{
            padding: '6px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            minWidth: 150,
            outline: 'none'
          }}
        />
        
        {/* 搜索结果下拉列表 */}
        {showSearchResults && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: 200,
            overflowY: 'auto'
          }}>
            {searchResults.map((lang, index) => (
              <div
                key={index}
                onClick={() => selectLanguage(lang)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {lang.Name || lang.name}
                </div>
                <div style={{ color: '#666', fontSize: '10px' }}>
                  {lang.Glottocode || lang.glottocode || lang.Language_ID}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 筛选选项 */}
      <select 
        value={selectedFilter}
        onChange={(e) => handleFilterChange(e.target.value)}
        style={{ 
          padding: '6px', 
          border: '1px solid #ddd', 
          borderRadius: '4px', 
          fontSize: '12px',
          minWidth: 120
        }}
      >
        <option value="all">{lang === 'zh' ? '全选' : 'All Languages'}</option>
        <option value="doreco">DoReCo ({dorecoLanguages.length})</option>
        {selectedFilter === 'custom' && (
          <option value="custom">{lang === 'zh' ? '自定义' : 'Custom'}</option>
        )}
      </select>
    </div>
  );
};

export default LanguageFilter;
