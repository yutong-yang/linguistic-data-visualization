import os
import json
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import chromadb
from chromadb.config import Settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import PyPDF2
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LinguisticKnowledgeBase:
    def __init__(self, db_path: str = "./chroma_db", openai_api_key: str = None):
        """
        初始化语言学知识库
        
        Args:
            db_path: ChromaDB数据库路径
            openai_api_key: OpenAI API密钥
        """
        self.db_path = db_path
        self.openai_api_key = openai_api_key
        
        # 初始化ChromaDB客户端
        self.client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False)
        )
        
        # 初始化embedding模型
        if openai_api_key:
            os.environ["OPENAI_API_KEY"] = openai_api_key
            self.embeddings = OpenAIEmbeddings()
        else:
            # 使用默认的sentence-transformers
            self.embeddings = None
        
        # 文本分割器
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        
        # 创建集合
        self.collection = self.client.get_or_create_collection(
            name="linguistic_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        
        logger.info(f"知识库初始化完成，数据库路径: {db_path}")
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """从PDF文件中提取文本"""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            logger.error(f"提取PDF文本失败 {pdf_path}: {e}")
            return ""
    
    def process_csv_data(self, csv_path: str, collection_name: str = None) -> List[Dict]:
        """处理CSV数据，转换为文档格式"""
        try:
            df = pd.read_csv(csv_path)
            documents = []
            
            # 将每行数据转换为文档
            for idx, row in df.iterrows():
                # 创建文档内容
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
    
    def add_documents(self, documents: List[Dict], collection_name: str = None):
        """添加文档到向量数据库"""
        try:
            # 分割文档
            all_chunks = []
            for doc in documents:
                chunks = self.text_splitter.split_text(doc["content"])
                for i, chunk in enumerate(chunks):
                    all_chunks.append({
                        "content": chunk,
                        "metadata": {
                            **doc["metadata"],
                            "chunk_index": i,
                            "total_chunks": len(chunks)
                        }
                    })
            
            # 添加到向量数据库
            if all_chunks:
                self.collection.add(
                    documents=[chunk["content"] for chunk in all_chunks],
                    metadatas=[chunk["metadata"] for chunk in all_chunks],
                    ids=[f"doc_{i}" for i in range(len(all_chunks))]
                )
                
                logger.info(f"成功添加 {len(all_chunks)} 个文档块到知识库")
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
    
    def search(self, query: str, n_results: int = 5) -> List[Dict]:
        """搜索相关文档"""
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            # 格式化结果
            formatted_results = []
            if results["documents"]:
                for i, doc in enumerate(results["documents"][0]):
                    formatted_results.append({
                        "content": doc,
                        "metadata": results["metadatas"][0][i],
                        "distance": results["distances"][0][i] if "distances" in results else None
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    def get_collection_info(self) -> Dict:
        """获取集合信息"""
        try:
            count = self.collection.count()
            return {
                "total_documents": count,
                "collection_name": self.collection.name,
                "database_path": self.db_path
            }
        except Exception as e:
            logger.error(f"获取集合信息失败: {e}")
            return {}
    
    def clear_collection(self):
        """清空集合"""
        try:
            self.client.delete_collection(self.collection.name)
            self.collection = self.client.create_collection(
                name="linguistic_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("集合已清空")
        except Exception as e:
            logger.error(f"清空集合失败: {e}")

# 全局知识库实例
knowledge_base = None

def init_knowledge_base(openai_api_key: str = None):
    """初始化全局知识库实例"""
    global knowledge_base
    knowledge_base = LinguisticKnowledgeBase(openai_api_key=openai_api_key)
    return knowledge_base

def get_knowledge_base() -> LinguisticKnowledgeBase:
    """获取全局知识库实例"""
    return knowledge_base 