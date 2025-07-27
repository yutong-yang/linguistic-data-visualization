#!/usr/bin/env python3
"""
文档处理脚本
用于批量处理public目录下的所有PDF和CSV文件，并添加到知识库
"""

import os
import sys
from pathlib import Path
import logging
from typing import List, Dict
import json

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from knowledge_base import LinguisticKnowledgeBase

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_document_files(public_dir: Path) -> Dict[str, List[Path]]:
    """获取所有文档文件"""
    files = {
        "pdf": [],
        "csv": [],
        "txt": [],
        "md": []
    }
    
    # 查找PDF文件
    pdf_files = list(public_dir.rglob("*.pdf"))
    files["pdf"] = pdf_files
    logger.info(f"找到 {len(pdf_files)} 个PDF文件")
    
    # 查找CSV文件
    csv_files = list(public_dir.rglob("*.csv"))
    files["csv"] = csv_files
    logger.info(f"找到 {len(csv_files)} 个CSV文件")
    
    # 查找TXT文件
    txt_files = list(public_dir.rglob("*.txt"))
    files["txt"] = txt_files
    logger.info(f"找到 {len(txt_files)} 个TXT文件")
    
    # 查找MD文件
    md_files = list(public_dir.rglob("*.md"))
    files["md"] = md_files
    logger.info(f"找到 {len(md_files)} 个MD文件")
    
    return files

def process_pdf_file(kb: LinguisticKnowledgeBase, pdf_path: Path) -> bool:
    """处理单个PDF文件"""
    try:
        logger.info(f"正在处理PDF文件: {pdf_path.name}")
        
        # 提取文本
        text = kb.extract_text_from_pdf(str(pdf_path))
        if not text.strip():
            logger.warning(f"PDF文件 {pdf_path.name} 没有提取到文本")
            return False
        
        # 创建文档
        documents = [{
            "content": text,
            "metadata": {
                "source": str(pdf_path),
                "type": "pdf",
                "filename": pdf_path.name,
                "category": "academic_paper" if "repository" in str(pdf_path) else "documentation"
            }
        }]
        
        # 添加到知识库
        kb.add_documents(documents)
        logger.info(f"成功处理PDF文件: {pdf_path.name}")
        return True
        
    except Exception as e:
        logger.error(f"处理PDF文件失败 {pdf_path.name}: {e}")
        return False

def process_csv_file(kb: LinguisticKnowledgeBase, csv_path: Path) -> bool:
    """处理单个CSV文件"""
    try:
        logger.info(f"正在处理CSV文件: {csv_path.name}")
        
        # 处理CSV数据
        documents = kb.process_csv_data(str(csv_path))
        if not documents:
            logger.warning(f"CSV文件 {csv_path.name} 没有生成文档")
            return False
        
        # 添加到知识库
        kb.add_documents(documents)
        logger.info(f"成功处理CSV文件: {csv_path.name}，生成了 {len(documents)} 个文档")
        return True
        
    except Exception as e:
        logger.error(f"处理CSV文件失败 {csv_path.name}: {e}")
        return False

def process_text_file(kb: LinguisticKnowledgeBase, text_path: Path) -> bool:
    """处理单个文本文件"""
    try:
        logger.info(f"正在处理文本文件: {text_path.name}")
        
        # 读取文本内容
        with open(text_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if not content.strip():
            logger.warning(f"文本文件 {text_path.name} 为空")
            return False
        
        # 创建文档
        documents = [{
            "content": content,
            "metadata": {
                "source": str(text_path),
                "type": "text",
                "filename": text_path.name,
                "category": "documentation"
            }
        }]
        
        # 添加到知识库
        kb.add_documents(documents)
        logger.info(f"成功处理文本文件: {text_path.name}")
        return True
        
    except Exception as e:
        logger.error(f"处理文本文件失败 {text_path.name}: {e}")
        return False

def main():
    """主函数"""
    # 获取public目录路径
    current_dir = Path(__file__).parent
    public_dir = current_dir.parent / "public"
    
    if not public_dir.exists():
        logger.error(f"Public目录不存在: {public_dir}")
        return
    
    # 初始化知识库
    openai_api_key = os.getenv("OPENAI_API_KEY")
    kb = LinguisticKnowledgeBase(openai_api_key=openai_api_key)
    
    # 获取所有文档文件
    files = get_document_files(public_dir)
    
    # 统计信息
    stats = {
        "total_files": 0,
        "processed_files": 0,
        "failed_files": 0,
        "by_type": {}
    }
    
    # 处理PDF文件
    for pdf_file in files["pdf"]:
        stats["total_files"] += 1
        if process_pdf_file(kb, pdf_file):
            stats["processed_files"] += 1
            stats["by_type"]["pdf"] = stats["by_type"].get("pdf", 0) + 1
        else:
            stats["failed_files"] += 1
    
    # 处理CSV文件
    for csv_file in files["csv"]:
        stats["total_files"] += 1
        if process_csv_file(kb, csv_file):
            stats["processed_files"] += 1
            stats["by_type"]["csv"] = stats["by_type"].get("csv", 0) + 1
        else:
            stats["failed_files"] += 1
    
    # 处理文本文件
    for text_file in files["txt"] + files["md"]:
        stats["total_files"] += 1
        if process_text_file(kb, text_file):
            stats["processed_files"] += 1
            stats["by_type"]["text"] = stats["by_type"].get("text", 0) + 1
        else:
            stats["failed_files"] += 1
    
    # 获取知识库信息
    info = kb.get_collection_info()
    
    # 输出统计信息
    logger.info("=" * 50)
    logger.info("文档处理完成！")
    logger.info(f"总文件数: {stats['total_files']}")
    logger.info(f"成功处理: {stats['processed_files']}")
    logger.info(f"处理失败: {stats['failed_files']}")
    logger.info(f"按类型统计: {stats['by_type']}")
    logger.info(f"知识库总文档数: {info.get('total_documents', 0)}")
    logger.info("=" * 50)
    
    # 保存统计信息到文件
    stats_file = current_dir / "processing_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump({
            "stats": stats,
            "knowledge_base_info": info
        }, f, indent=2, ensure_ascii=False)
    
    logger.info(f"统计信息已保存到: {stats_file}")

if __name__ == "__main__":
    main() 