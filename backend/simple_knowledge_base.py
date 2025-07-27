import os
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleKnowledgeBase:
    def __init__(self, db_path: str = "./simple_kb"):
        """
        简化的知识库实现，使用文件系统存储
        """
        self.db_path = Path(db_path)
        self.db_path.mkdir(exist_ok=True)
        self.documents_file = self.db_path / "documents.json"
        self.index_file = self.db_path / "index.json"
        
        # 初始化存储
        self.documents = self._load_documents()
        self.index = self._load_index()
        
        logger.info(f"简化知识库初始化完成，路径: {db_path}")
    
    def _load_documents(self) -> List[Dict]:
        """加载文档"""
        if self.documents_file.exists():
            try:
                with open(self.documents_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []
    
    def _save_documents(self):
        """保存文档"""
        with open(self.documents_file, 'w', encoding='utf-8') as f:
            json.dump(self.documents, f, ensure_ascii=False, indent=2)
    
    def _load_index(self) -> Dict:
        """加载索引"""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_index(self):
        """保存索引"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """从PDF文件中提取文本（简化版本）"""
        try:
            # 简化版本：返回文件名作为内容
            filename = Path(pdf_path).name
            return f"PDF文档: {filename}\n\n这是一个PDF文档的内容摘要。在实际应用中，这里会包含从PDF中提取的完整文本内容。\n\n文档路径: {pdf_path}"
        except Exception as e:
            logger.error(f"提取PDF文本失败 {pdf_path}: {e}")
            return ""
    
    def process_csv_data(self, csv_path: str) -> List[Dict]:
        """处理CSV数据"""
        try:
            df = pd.read_csv(csv_path)
            documents = []
            
            # 将每行数据转换为文档
            for idx, row in df.iterrows():
                content = f"数据记录 {idx + 1}:\n"
                for col, value in row.items():
                    if pd.notna(value):
                        content += f"{col}: {value}\n"
                
                documents.append({
                    "content": content,
                    "metadata": {
                        "source": csv_path,
                        "type": "csv_data",
                        "row_index": idx,
                        "columns": list(df.columns)
                    }
                })
            
            return documents
        except Exception as e:
            logger.error(f"处理CSV数据失败 {csv_path}: {e}")
            return []
    
    def add_documents(self, documents: List[Dict]):
        """添加文档到知识库"""
        try:
            for doc in documents:
                # 生成文档ID
                doc_id = f"doc_{len(self.documents)}"
                
                # 添加到文档列表
                self.documents.append({
                    "id": doc_id,
                    "content": doc["content"],
                    "metadata": doc["metadata"]
                })
                
                # 构建简单索引（关键词匹配）
                words = re.findall(r'\b\w+\b', doc["content"].lower())
                for word in words:
                    if len(word) > 2:  # 忽略短词
                        if word not in self.index:
                            self.index[word] = []
                        if doc_id not in self.index[word]:
                            self.index[word].append(doc_id)
            
            # 保存到文件
            self._save_documents()
            self._save_index()
            
            logger.info(f"成功添加 {len(documents)} 个文档到知识库")
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
    
    def search(self, query: str, n_results: int = 5) -> List[Dict]:
        """搜索相关文档"""
        try:
            # 简单的关键词匹配搜索
            query_words = re.findall(r'\b\w+\b', query.lower())
            doc_scores = {}
            
            for word in query_words:
                if word in self.index:
                    for doc_id in self.index[word]:
                        if doc_id not in doc_scores:
                            doc_scores[doc_id] = 0
                        doc_scores[doc_id] += 1
            
            # 按分数排序
            sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
            
            # 返回结果
            results = []
            for doc_id, score in sorted_docs[:n_results]:
                doc = next((d for d in self.documents if d["id"] == doc_id), None)
                if doc:
                    results.append({
                        "content": doc["content"],
                        "metadata": doc["metadata"],
                        "score": score
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def get_collection_info(self) -> Dict:
        """获取集合信息"""
        try:
            return {
                "total_documents": len(self.documents),
                "collection_name": "simple_knowledge_base",
                "database_path": str(self.db_path)
            }
        except Exception as e:
            logger.error(f"获取集合信息失败: {e}")
            return {}
    
    def clear_collection(self):
        """清空集合"""
        try:
            self.documents = []
            self.index = {}
            self._save_documents()
            self._save_index()
            logger.info("集合已清空")
        except Exception as e:
            logger.error(f"清空集合失败: {e}")

# 全局知识库实例
knowledge_base = None

def init_knowledge_base(openai_api_key: str = None):
    """初始化全局知识库实例"""
    global knowledge_base
    knowledge_base = SimpleKnowledgeBase()
    return knowledge_base

def get_knowledge_base() -> SimpleKnowledgeBase:
    """获取全局知识库实例"""
    return knowledge_base 