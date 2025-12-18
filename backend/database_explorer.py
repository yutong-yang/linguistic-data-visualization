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
_cached_languages: Optional[List[Dict[str, Any]]] = None

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
PUBLIC_DIR = PROJECT_ROOT / "public"

def get_csv_path(relative_path: str) -> Path:
    """获取 CSV 文件的完整路径"""
    # 尝试多个可能的路径
    paths = [
        PUBLIC_DIR / relative_path,
        PROJECT_ROOT / relative_path,
        Path(relative_path)  # 绝对路径
    ]
    
    for path in paths:
        if path.exists():
            return path
    
    raise FileNotFoundError(f"找不到文件: {relative_path}，尝试过的路径: {[str(p) for p in paths]}")

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

def search_feature_descriptions(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """搜索特征描述"""
    query_lower = query.lower()
    results = []
    
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
        '人称': ['person', 'first', 'second', 'third']
    }
    
    # 扩展查询词
    expanded_query = query_lower
    for chinese, english in synonyms.items():
        if chinese in query_lower:
            expanded_query += ' ' + ' '.join(english)
    
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
            
            query_words = query_lower.split()
            expanded_words = expanded_query.split()
            
            original_match = any(
                word in search_text for word in query_words
                if len(word) > 2
            )
            expanded_match = any(
                word in search_text for word in expanded_words
                if len(word) > 2
            )
            
            # 特殊处理：如果查询包含"性别"或"gender"，也匹配分类为"Gender_or_Noun_Class"的特征
            is_gender_query = '性别' in query_lower or 'gender' in query_lower
            category = param.get('category', '').lower()
            is_gender_category = (
                'gender' in category or 
                'noun class' in category or
                category == '1'  # Gender_or_Noun_Class分类标记为1
            )
            
            if original_match or expanded_match or (is_gender_query and is_gender_category):
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
            
            query_words = query_lower.split()
            expanded_words = expanded_query.split()
            
            original_match = any(
                word in search_text for word in query_words
                if len(word) > 2
            )
            expanded_match = any(
                word in search_text for word in expanded_words
                if len(word) > 2
            )
            
            if original_match or expanded_match:
                ea_matches.append(var)
        
        ea_matches = ea_matches[:limit]
        
        results.extend([
            {**var, 'source': 'D-PLACE', 'type': 'EA'}
            for var in ea_matches
        ])
        
        # 排序：名称匹配优先
        results.sort(key=lambda x: (
            query_lower not in x.get('name', '').lower(),
            x.get('name', '')
        ))
        
        return results
        
    except Exception as e:
        logger.error(f"搜索特征描述失败: {e}")
        return []

def get_feature_statistics() -> Dict[str, Any]:
    """获取特征统计信息"""
    try:
        parameters = load_grambank_parameters()
        variables = load_dplace_variables()
        
        return {
            'totalGrambankFeatures': len(parameters),
            'totalDplaceFeatures': len(variables),
            'grambankCategories': list(set(p.get('category', 'Other') for p in parameters)),
            'dplaceCategories': list(set(v.get('category', 'Other') for v in variables)),
            'sampleFeatures': {
                'grambank': [
                    {'id': p['id'], 'name': p['name'], 'category': p.get('category', 'Other')}
                    for p in parameters[:10]
                ],
                'dplace': [
                    {'id': v['id'], 'name': v['name'], 'category': v.get('category', 'Other')}
                    for v in variables[:10]
                ]
            }
        }
    except Exception as e:
        logger.error(f"获取特征统计失败: {e}")
        return {
            'totalGrambankFeatures': 0,
            'totalDplaceFeatures': 0,
            'grambankCategories': [],
            'dplaceCategories': [],
            'sampleFeatures': {'grambank': [], 'dplace': []}
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
        
        return {
            'grambank': [p['id'] for p in parameters if p.get('id')],
            'dplace': [v['id'] for v in variables if v.get('id')]
        }
    except Exception as e:
        logger.error(f"获取所有特征 ID 失败: {e}")
        return {'grambank': [], 'dplace': []}

