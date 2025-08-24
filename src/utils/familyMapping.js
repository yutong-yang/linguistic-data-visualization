// 语系ID到友好名称的动态映射工具

// 从WALS数据集加载语系映射
export const loadFamilyMapping = async () => {
  try {
    const response = await fetch('/cldf-datasets-wals-014143f/cldf/languages.csv');
    const csvText = await response.text();
    
    // 解析CSV
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const familyIndex = headers.indexOf('Family');
    const glottocodeIndex = headers.indexOf('Glottocode');
    
    if (familyIndex === -1 || glottocodeIndex === -1) {
      console.error('CSV文件中未找到Family或Glottocode列');
      return {};
    }
    
    const familyMap = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = line.split(',');
      const family = values[familyIndex];
      const glottocode = values[glottocodeIndex];
      
      if (family && glottocode && family !== '') {
        // 从Glottocode中提取语系ID（通常是前8个字符）
        const familyId = glottocode.substring(0, 8);
        if (familyId && !familyMap[familyId]) {
          familyMap[familyId] = family;
        }
      }
    }
    
    console.log('语系映射加载成功:', Object.keys(familyMap).length, '个映射');
    return familyMap;
  } catch (error) {
    console.error('加载语系映射失败:', error);
    return {};
  }
};

// 从Grambank数据集加载语系映射
export const loadGrambankFamilyMapping = async () => {
  try {
    const response = await fetch('/grambank-grambank-7ae000c/cldf/languages.csv');
    const csvText = await response.text();
    
    // 解析CSV
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const familyNameIndex = headers.indexOf('Family_name');
    const familyIdIndex = headers.indexOf('Family_level_ID');
    
    if (familyNameIndex === -1 || familyIdIndex === -1) {
      console.error('CSV文件中未找到Family_name或Family_level_ID列');
      return {};
    }
    
    const familyMap = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = line.split(',');
      const familyName = values[familyNameIndex];
      const familyId = values[familyIdIndex];
      
      if (familyName && familyId && familyName !== '' && familyId !== '') {
        familyMap[familyId] = familyName;
      }
    }
    
    console.log('Grambank语系映射加载成功:', Object.keys(familyMap).length, '个映射');
    return familyMap;
  } catch (error) {
    console.error('加载Grambank语系映射失败:', error);
    return {};
  }
};

// 合并多个数据源的语系映射
export const loadCombinedFamilyMapping = async () => {
  try {
    const [walsMapping, grambankMapping] = await Promise.all([
      loadFamilyMapping(),
      loadGrambankFamilyMapping()
    ]);
    
    // 合并映射，Grambank的映射优先级更高
    const combinedMapping = { ...walsMapping, ...grambankMapping };
    
    console.log('合并后的语系映射:', Object.keys(combinedMapping).length, '个映射');
    return combinedMapping;
  } catch (error) {
    console.error('加载合并语系映射失败:', error);
    return {};
  }
};

// 获取语系友好名称
export const getFamilyName = (familyId, familyMapping = {}) => {
  if (!familyId) return 'Unknown';
  
  // 首先尝试从动态映射中获取
  if (familyMapping[familyId]) {
    return familyMapping[familyId];
  }
  
  // 如果没有找到，返回ID本身
  return familyId;
};
