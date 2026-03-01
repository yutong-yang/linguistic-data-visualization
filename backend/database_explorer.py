"""
数据库探索工具 - 读取 Grambank 和 D-PLACE CSV 数据库
"""
import csv
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# 缓存
_cached_parameters: Optional[List[Dict[str, Any]]] = None
_cached_variables: Optional[List[Dict[str, Any]]] = None
_cached_wals_parameters: Optional[List[Dict[str, Any]]] = None
_cached_languages: Optional[List[Dict[str, Any]]] = None

# 获取项目根目录
SCRIPT_DIR = Path(__file__).parent          # HF Space 里是 /app
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_DIR = PROJECT_ROOT / "public"

# GitHub Pages 上的前端静态资源 URL（CSV 文件由前端 public/ 目录提供）
GITHUB_PAGES_BASE_URL = "https://yutong-yang.github.io/linguistic-data-visualization"

def get_csv_path(relative_path: str) -> Path:
    """获取 CSV 文件的完整路径，本地找不到时自动从 GitHub Pages 下载并缓存"""
    # 尝试多个可能的本地路径
    paths = [
        SCRIPT_DIR / "data" / relative_path,   # backend/data/（可选本地副本）
        PUBLIC_DIR / relative_path,
        PROJECT_ROOT / relative_path,
        Path(relative_path)
    ]

    for path in paths:
        if path.exists():
            return path

    # 本地找不到，尝试从 GitHub Pages 下载并缓存
    cache_path = SCRIPT_DIR / "data_cache" / relative_path
    if cache_path.exists():
        return cache_path

    url = f"{GITHUB_PAGES_BASE_URL}/{relative_path}"
    try:
        import httpx
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"本地 CSV 不存在，从 GitHub Pages 下载: {url}")
        response = httpx.get(url, timeout=30, follow_redirects=True)
        response.raise_for_status()
        cache_path.write_bytes(response.content)
        logger.info(f"下载成功，已缓存到: {cache_path}")
        return cache_path
    except Exception as e:
        raise FileNotFoundError(
            f"找不到文件: {relative_path}，"
            f"尝试过的路径: {[str(p) for p in paths]}，"
            f"从 GitHub Pages 下载也失败: {e}"
        )

def load_grambank_parameters() -> List[Dict[str, Any]]:
    """加载 Grambank 参数数据库"""
    global _cached_parameters
    
    if _cached_parameters is not None:
        return _cached_parameters
    
    try:
        csv_path = get_csv_path("grambank-grambank-7ae000c/cldf/parameters.csv")
        
        parameters = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 确定分类
                category = (
                    row.get('Gender_or_Noun_Class') or
                    row.get('Boundness') or
                    row.get('Flexivity') or
                    row.get('Locus_of_Marking') or
                    row.get('Word_Order') or
                    row.get('Informativity') or
                    'Other'
                )
                
                parameters.append({
                    'id': row.get('ID', ''),
                    'name': row.get('Name', ''),
                    'description': row.get('Description', ''),
                    'category': category,
                    'patrons': row.get('Patrons', ''),
                    'grambankId': row.get('Grambank_ID_desc', '')
                })
        
        # 过滤掉空行或无效行
        _cached_parameters = [p for p in parameters if p['id'] and p['name']]
        logger.info(f"加载了 {len(_cached_parameters)} 个 Grambank 参数")
        return _cached_parameters
        
    except Exception as e:
        logger.error(f"加载 Grambank 参数失败: {e}")
        return []

def load_dplace_variables() -> List[Dict[str, Any]]:
    """加载 D-PLACE 变量数据库"""
    global _cached_variables
    
    if _cached_variables is not None:
        return _cached_variables
    
    try:
        csv_path = get_csv_path("dplace-cldf/cldf/variables.csv")
        
        variables = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                variables.append({
                    'id': row.get('ID', ''),
                    'name': row.get('Name', ''),
                    'description': row.get('Description', ''),
                    'category': row.get('category', 'Other'),
                    'source': row.get('source', 'D-PLACE')
                })
        
        _cached_variables = variables
        logger.info(f"加载了 {len(_cached_variables)} 个 D-PLACE 变量")
        return _cached_variables
        
    except Exception as e:
        logger.error(f"加载 D-PLACE 变量失败: {e}")
        return []

def load_wals_parameters() -> List[Dict[str, Any]]:
    """加载 WALS 参数数据库"""
    global _cached_wals_parameters
    
    if _cached_wals_parameters is not None:
        return _cached_wals_parameters
    
    try:
        csv_path = get_csv_path("cldf-datasets-wals-014143f/cldf/parameters.csv")
        
        parameters = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                parameters.append({
                    'id': row.get('ID', ''),
                    'name': row.get('Name', ''),
                    'description': row.get('Description', ''),
                    'category': row.get('Area', 'Other'),
                    'chapter': row.get('Chapter', ''),
                    'contributor': row.get('Contributor_ID', '')
                })
        
        _cached_wals_parameters = parameters
        logger.info(f"加载了 {len(_cached_wals_parameters)} 个 WALS 参数")
        return _cached_wals_parameters
        
    except Exception as e:
        logger.error(f"加载 WALS 参数失败: {e}")
        return []

def load_languages() -> List[Dict[str, Any]]:
    """加载语言数据库"""
    global _cached_languages
    
    if _cached_languages is not None:
        return _cached_languages
    
    try:
        csv_path = get_csv_path("grambank-grambank-7ae000c/cldf/languages.csv")
        
        languages = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                languages.append({
                    'id': row.get('ID', ''),
                    'name': row.get('Name', ''),
                    'glottocode': row.get('Glottocode', ''),
                    'family': row.get('Family_level_ID', ''),
                    'genus': row.get('Genus_level_ID', ''),
                    'macroarea': row.get('Macroarea', ''),
                    'latitude': row.get('Latitude', ''),
                    'longitude': row.get('Longitude', '')
                })
        
        _cached_languages = languages
        logger.info(f"加载了 {len(_cached_languages)} 种语言")
        return _cached_languages
        
    except Exception as e:
        logger.error(f"加载语言数据库失败: {e}")
        return []

def search_features_by_keywords(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """简单的关键词匹配：在特征名称、描述、分类中直接搜索关键词"""
    import re
    results = []
    
    # 提取关键词（去除常见的停用词和查询词）
    query_lower = query.lower().strip()
    
    # 移除常见的查询词
    stop_words = {'的', '是', '有', '和', '与', '或', 'the', 'a', 'an', 'is', 'are', 'has', 'have', 'and', 'or', 'what', 'which', 'how', 'can', 'does', 'do', 'there', 'related', 'features', 'feature', '推荐', '相关', '特征'}
    
    # 同义词映射（用于扩展关键词）
    keyword_synonyms = {
        'gender': ['sex', 'masculine', 'feminine', 'noun class', 'class', 'gendered'],
        'sex': ['gender', 'masculine', 'feminine', 'sexual', 'sexuality'],
        '性别': ['gender', 'sex', 'masculine', 'feminine', 'noun class', 'class']
    }
    
    keywords = []
    
    # 检查是否包含中文字符
    has_chinese = bool(re.search(r'[\u4e00-\u9fff]', query))
    
    if has_chinese:
        # 中文查询：直接使用整个查询作为关键词（去除停用词）
        # 如果查询中包含停用词，尝试提取有意义的部分
        cleaned_query = query_lower
        for stop_word in stop_words:
            cleaned_query = cleaned_query.replace(stop_word, ' ')
        cleaned_query = cleaned_query.strip()
        if cleaned_query and len(cleaned_query) >= 2:
            keywords.append(cleaned_query)
        # 也保留原始查询（去除停用词后）
        if query_lower not in stop_words and len(query_lower) >= 2:
            keywords.append(query_lower)
    else:
        # 英文查询：按空格分词
        for word in query_lower.split():
            word = word.strip()
            if len(word) >= 2 and word not in stop_words:
                keywords.append(word)
                # 如果有关键词的同义词，也添加同义词
                if word in keyword_synonyms:
                    keywords.extend(keyword_synonyms[word])
    
    # 如果没有提取到关键词，使用整个查询（去除停用词后）
    if not keywords:
        keywords = [query_lower] if len(query_lower) >= 2 else []
        # 如果整个查询有同义词，也添加
        if query_lower in keyword_synonyms:
            keywords.extend(keyword_synonyms[query_lower])
    
    # 去重
    keywords = list(dict.fromkeys(keywords))  # 保持顺序的去重
    
    if not keywords:
        return []
    
    logger.info(f"🔑 关键词匹配: 提取的关键词: {keywords}")
    
    try:
        # 搜索 Grambank 参数
        parameters = load_grambank_parameters()
        for param in parameters:
            search_text = ' '.join([
                param.get('name', ''),
                param.get('description', ''),
                param.get('category', '')
            ]).lower()
            
            # 检查是否包含任何关键词
            matched = False
            for keyword in keywords:
                if keyword in search_text:
                    matched = True
                    break
            
            if matched:
                results.append({**param, 'source': 'Grambank', 'type': 'GB'})
        
        # 搜索 D-PLACE 变量
        variables = load_dplace_variables()
        for var in variables:
            search_text = ' '.join([
                var.get('name', ''),
                var.get('description', ''),
                var.get('category', '')
            ]).lower()
            
            matched = False
            for keyword in keywords:
                if keyword in search_text:
                    matched = True
                    break
            
            if matched:
                results.append({**var, 'source': 'D-PLACE', 'type': 'EA'})
        
        # 搜索 WALS 参数
        wals_params = load_wals_parameters()
        for param in wals_params:
            search_text = ' '.join([
                param.get('name', ''),
                param.get('description', ''),
                param.get('category', '')
            ]).lower()
            
            matched = False
            for keyword in keywords:
                if keyword in search_text:
                    matched = True
                    break
            
            if matched:
                results.append({**param, 'source': 'WALS', 'type': 'WALS'})
        
        # 限制结果数量
        results = results[:limit]
        logger.info(f"  - 关键词匹配找到 {len(results)} 个特征")
        if len(results) > 0:
            logger.info(f"  - 前10个匹配的特征: {[f.get('id', '') for f in results[:10]]}")
        
        return results
        
    except Exception as e:
        logger.error(f"关键词匹配失败: {e}")
        return []

def search_feature_descriptions(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """搜索特征描述"""
    import re
    query_lower = query.lower()
    results = []
    
    # 辅助函数：检查单词是否作为完整单词出现（使用单词边界）
    def is_whole_word(word, text):
        """检查word是否作为完整单词出现在text中"""
        if len(word) < 3:  # 太短的词不检查单词边界
            return word in text
        pattern = r'\b' + re.escape(word) + r'\b'
        return bool(re.search(pattern, text, re.IGNORECASE))
    
    # 辅助函数：检查是否有任何查询词匹配（优先完整单词，也允许部分匹配但分数会低）
    def has_match(query_words, text):
        """检查查询词是否在文本中匹配（优先完整单词）"""
        for word in query_words:
            if is_whole_word(word, text):
                return True
            # 也允许部分匹配，但会在评分中降低分数
            if word in text:
                return True
        return False
    
    # 同义词映射
    synonyms = {
        '性别': ['gender', 'sex', 'masculine', 'feminine', 'noun class', 'class'],
        '特征': ['feature', 'parameter', 'property', 'trait'],
        '语法': ['grammar', 'grammatical', 'syntax', 'morphology'],
        '名词': ['noun', 'nominal', 'substantive'],
        '分类': ['class', 'classification', 'category', 'grouping'],
        '一致性': ['agreement', 'concord', 'harmony'],
        '形态': ['morphology', 'inflection', 'declension'],
        '音位': ['phonological', 'phonetic', 'sound'],
        '语义': ['semantic', 'meaning', 'sense'],
        '句法': ['syntax', 'syntactic', 'word order'],
        '时态': ['tense', 'temporal', 'time'],
        '语态': ['voice', 'active', 'passive'],
        '语气': ['mood', 'indicative', 'subjunctive'],
        '数': ['number', 'singular', 'plural'],
        '格': ['case', 'nominative', 'accusative'],
        '人称': ['person', 'first', 'second', 'third'],
        '文化': ['culture', 'cultural', 'society', 'social', 'political', 'politics', 'economic', 'economy', 'history', 'historical', 'tradition', 'custom'],
        'culture': ['cultural', 'society', 'social', 'political', 'politics', 'economic', 'economy', 'history', 'historical', 'tradition', 'custom', 'sociocultural'],
        # 英文同义词映射
        'gender': ['sex', 'masculine', 'feminine', 'noun class', 'class', 'gendered'],
        'sex': ['gender', 'masculine', 'feminine', 'sexual', 'sexuality']
    }
    
    # 扩展查询词
    expanded_query = query_lower
    for key, synonyms_list in synonyms.items():
        if key in query_lower:
            expanded_query += ' ' + ' '.join(synonyms_list)
    
    try:
        # 搜索 Grambank 参数
        parameters = load_grambank_parameters()
        
        gb_matches = []
        for param in parameters:
            # 精确匹配 ID
            if param['id'] and param['id'].lower() == query_lower:
                gb_matches.append(param)
                continue
            
            # 扩展搜索
            search_text = ' '.join([
                param.get('name', ''),
                param.get('description', ''),
                param.get('category', '')
            ]).lower()
            
            query_words = [w for w in query_lower.split() if len(w) > 2]
            expanded_words = [w for w in expanded_query.split() if len(w) > 2]
            
            # 优先匹配完整单词，也允许部分匹配（但会在评分中降低分数）
            original_match = has_match(query_words, search_text)
            expanded_match = has_match(expanded_words, search_text)
            
            # 使用统一的匹配逻辑，不进行特殊处理
            if original_match or expanded_match:
                gb_matches.append(param)
        
        # 限制结果数量
        gb_matches = gb_matches[:limit]
        
        results.extend([
            {**param, 'source': 'Grambank', 'type': 'GB'}
            for param in gb_matches
        ])
        
        # 搜索 D-PLACE 变量
        variables = load_dplace_variables()
        
        ea_matches = []
        for var in variables:
            search_text = ' '.join([
                var.get('name', ''),
                var.get('description', ''),
                var.get('category', '')
            ]).lower()
            
            query_words = [w for w in query_lower.split() if len(w) > 2]
            expanded_words = [w for w in expanded_query.split() if len(w) > 2]
            
            # 优先匹配完整单词，也允许部分匹配（但会在评分中降低分数）
            original_match = has_match(query_words, search_text)
            expanded_match = has_match(expanded_words, search_text)
            
            if original_match or expanded_match:
                ea_matches.append(var)
        
        ea_matches = ea_matches[:limit]
        
        results.extend([
            {**var, 'source': 'D-PLACE', 'type': 'EA'}
            for var in ea_matches
        ])
        
        # 搜索 WALS 参数
        wals_params = load_wals_parameters()
        
        wals_matches = []
        for param in wals_params:
            # 精确匹配 ID
            if param['id'] and param['id'].lower() == query_lower:
                wals_matches.append(param)
                continue
            
            # 扩展搜索
            search_text = ' '.join([
                param.get('name', ''),
                param.get('description', ''),
                param.get('category', ''),
                param.get('chapter', '')
            ]).lower()
            
            query_words = [w for w in query_lower.split() if len(w) > 2]
            expanded_words = [w for w in expanded_query.split() if len(w) > 2]
            
            # 优先匹配完整单词，也允许部分匹配（但会在评分中降低分数）
            original_match = has_match(query_words, search_text)
            expanded_match = has_match(expanded_words, search_text)
            
            if original_match or expanded_match:
                wals_matches.append(param)
        
        wals_matches = wals_matches[:limit]
        
        results.extend([
            {**param, 'source': 'WALS', 'type': 'WALS'}
            for param in wals_matches
        ])
        
        # 计算相关性分数并排序
        def calculate_relevance_score(feature, query_lower, expanded_query):
            """计算特征与查询的相关性分数"""
            import re
            score = 0
            name = feature.get('name', '').lower()
            description = feature.get('description', '').lower()
            category = feature.get('category', '').lower()
            feature_id = feature.get('id', '').lower()
            
            query_words = [w for w in query_lower.split() if len(w) > 2]
            expanded_words = [w for w in expanded_query.split() if len(w) > 2]
            all_query_words = list(set(query_words + expanded_words))
            
            # 辅助函数：检查单词是否作为完整单词出现（使用单词边界）
            def is_whole_word(word, text):
                """检查word是否作为完整单词出现在text中"""
                # 使用正则表达式匹配单词边界
                pattern = r'\b' + re.escape(word) + r'\b'
                return bool(re.search(pattern, text, re.IGNORECASE))
            
            # 辅助函数：检查单词是否作为子串出现（部分匹配）
            def is_partial_match(word, text):
                """检查word是否作为子串出现在text中（但不是完整单词）"""
                return word in text and not is_whole_word(word, text)
            
            # 1. ID精确匹配（最高优先级）
            if query_lower == feature_id:
                score += 1000
            
            # 2. 名称完全匹配（高优先级）
            if query_lower == name:
                score += 500
            elif query_lower in name:
                score += 400
            
            # 3. 名称中的完整单词匹配（高优先级）
            whole_word_matches = sum(1 for word in query_words if is_whole_word(word, name))
            if whole_word_matches > 0:
                score += whole_word_matches * 150  # 完整单词匹配给予高分
            
            # 4. 名称中的部分匹配（极低优先级，避免culture匹配到agriculture）
            partial_matches = sum(1 for word in query_words if is_partial_match(word, name))
            if partial_matches > 0:
                # 部分匹配给予极低分，避免误匹配（如culture匹配到agriculture）
                for word in query_words:
                    if is_partial_match(word, name):
                        # 检查匹配到的词是否明显更长（如culture匹配到agriculture）
                        # 如果匹配的词比查询词长很多，给予极低分或负分
                        matched_word = None
                        if word in name:
                            # 找到包含查询词的完整单词
                            words_in_name = re.findall(r'\b\w+\b', name)
                            for w in words_in_name:
                                if word in w.lower() and len(w) > len(word):
                                    matched_word = w
                                    break
                        
                        if matched_word and len(matched_word) > len(word) + 2:
                            # 匹配到的词明显更长（如agriculture比culture长很多），给予极低分
                            score += 0.1
                        elif len(word) < 5:
                            score += 5  # 短词的部分匹配给予稍高分
                        else:
                            score += 1  # 长词的部分匹配给予极低分，几乎忽略
            
            # 5. 描述中的完整单词匹配（中等优先级）
            desc_whole_word_matches = sum(1 for word in query_words if is_whole_word(word, description))
            score += desc_whole_word_matches * 30
            
            # 6. 描述中的部分匹配（极低优先级）
            desc_partial_matches = sum(1 for word in query_words if is_partial_match(word, description))
            # 描述中的部分匹配给予极低分
            for word in query_words:
                if is_partial_match(word, description):
                    if len(word) < 5:
                        score += 2  # 短词的部分匹配给予稍高分
                    else:
                        score += 0.5  # 长词的部分匹配给予极低分
            
            # 7. 分类匹配（低优先级）
            if any(is_whole_word(word, category) for word in query_words):
                score += 30
            elif any(is_partial_match(word, category) for word in query_words):
                score += 5
            
            # 8. 查询词在名称中的位置（越靠前分数越高，仅对完整单词匹配）
            for word in query_words:
                if is_whole_word(word, name):
                    pos = name.find(word)
                    # 位置越靠前，分数越高
                    score += max(0, 20 - pos // 5)
            
            # 9. 特征名称长度（较短的名称通常更相关）
            if len(name) < 100:
                score += 10
            
            return score
        
        # 计算每个结果的相关性分数
        scored_results = []
        for result in results:
            score = calculate_relevance_score(result, query_lower, expanded_query)
            scored_results.append((score, result))
        
        # 按分数降序排序，分数相同时按名称排序
        scored_results.sort(key=lambda x: (-x[0], x[1].get('name', '')))
        
        # 返回排序后的结果（只返回分数，不返回元组）
        results = [result for score, result in scored_results]
        
        # 限制返回数量
        return results[:limit]
        
    except Exception as e:
        logger.error(f"搜索特征描述失败: {e}")
        return []

def get_feature_statistics() -> Dict[str, Any]:
    """获取特征统计信息"""
    try:
        parameters = load_grambank_parameters()
        variables = load_dplace_variables()
        wals_params = load_wals_parameters()
        
        return {
            'totalGrambankFeatures': len(parameters),
            'totalDplaceFeatures': len(variables),
            'totalWalsFeatures': len(wals_params),
            'grambankCategories': list(set(p.get('category', 'Other') for p in parameters)),
            'dplaceCategories': list(set(v.get('category', 'Other') for v in variables)),
            'walsCategories': list(set(p.get('category', 'Other') for p in wals_params)),
            'sampleFeatures': {
                'grambank': [
                    {'id': p['id'], 'name': p['name'], 'category': p.get('category', 'Other')}
                    for p in parameters[:10]
                ],
                'dplace': [
                    {'id': v['id'], 'name': v['name'], 'category': v.get('category', 'Other')}
                    for v in variables[:10]
                ],
                'wals': [
                    {'id': p['id'], 'name': p['name'], 'category': p.get('category', 'Other')}
                    for p in wals_params[:10]
                ]
            }
        }
    except Exception as e:
        logger.error(f"获取特征统计失败: {e}")
        return {
            'totalGrambankFeatures': 0,
            'totalDplaceFeatures': 0,
            'totalWalsFeatures': 0,
            'grambankCategories': [],
            'dplaceCategories': [],
            'walsCategories': [],
            'sampleFeatures': {'grambank': [], 'dplace': [], 'wals': []}
        }

def clean_description(description: str) -> str:
    """清理描述文本"""
    if not description:
        return ''
    # 移除多余的空白字符
    return ' '.join(description.split())

def get_all_feature_ids() -> Dict[str, List[str]]:
    """获取所有特征 ID"""
    try:
        parameters = load_grambank_parameters()
        variables = load_dplace_variables()
        wals_params = load_wals_parameters()
        
        return {
            'grambank': [p['id'] for p in parameters if p.get('id')],
            'dplace': [v['id'] for v in variables if v.get('id')],
            'wals': [p['id'] for p in wals_params if p.get('id')]
        }
    except Exception as e:
        logger.error(f"获取所有特征 ID 失败: {e}")
        return {'grambank': [], 'dplace': [], 'wals': []}

