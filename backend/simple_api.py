from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
from pathlib import Path
import logging

from simple_knowledge_base import init_knowledge_base, get_knowledge_base, SimpleKnowledgeBase

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Simple Linguistic Knowledge Base API", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_found: int

class KnowledgeBaseInfo(BaseModel):
    total_documents: int
    collection_name: str
    database_path: str

class InitRequest(BaseModel):
    openai_api_key: Optional[str] = None

class DocumentRequest(BaseModel):
    file_path: str
    file_type: str  # "pdf" or "csv"

# 全局变量
knowledge_base: Optional[SimpleKnowledgeBase] = None

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化知识库"""
    global knowledge_base
    try:
        knowledge_base = init_knowledge_base()
        logger.info("简化知识库初始化完成")
    except Exception as e:
        logger.error(f"知识库初始化失败: {e}")

@app.post("/api/init", response_model=Dict[str, str])
async def initialize_knowledge_base(request: InitRequest):
    """初始化知识库"""
    global knowledge_base
    try:
        knowledge_base = init_knowledge_base(request.openai_api_key)
        return {"message": "知识库初始化成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"初始化失败: {str(e)}")

@app.get("/api/info", response_model=KnowledgeBaseInfo)
async def get_knowledge_base_info():
    """获取知识库信息"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        info = knowledge_base.get_collection_info()
        return KnowledgeBaseInfo(**info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取信息失败: {str(e)}")

@app.post("/api/search", response_model=SearchResponse)
async def search_knowledge_base(request: SearchRequest):
    """搜索知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        results = knowledge_base.search(request.query, request.n_results)
        return SearchResponse(
            results=results,
            total_found=len(results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@app.post("/api/add-document")
async def add_document(request: DocumentRequest):
    """添加文档到知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        file_path = Path(request.file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
        
        documents = []
        
        if request.file_type.lower() == "pdf":
            # 处理PDF文件
            text = knowledge_base.extract_text_from_pdf(str(file_path))
            if text:
                documents.append({
                    "content": text,
                    "metadata": {
                        "source": str(file_path),
                        "type": "pdf",
                        "filename": file_path.name
                    }
                })
        
        elif request.file_type.lower() == "csv":
            # 处理CSV文件
            documents = knowledge_base.process_csv_data(str(file_path))
        
        else:
            raise HTTPException(status_code=400, detail="不支持的文件类型")
        
        if documents:
            knowledge_base.add_documents(documents)
            return {"message": f"成功添加 {len(documents)} 个文档"}
        else:
            return {"message": "没有找到可处理的文档"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加文档失败: {str(e)}")

@app.post("/api/add-documents-batch")
async def add_documents_batch(background_tasks: BackgroundTasks):
    """批量添加文档（后台任务）"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    def process_documents():
        """后台处理文档的函数"""
        try:
            # 处理public目录下的所有文档
            public_dir = Path("../public")
            
            # 处理PDF文件
            pdf_files = list(public_dir.rglob("*.pdf"))
            for pdf_file in pdf_files:
                try:
                    text = knowledge_base.extract_text_from_pdf(str(pdf_file))
                    if text:
                        documents = [{
                            "content": text,
                            "metadata": {
                                "source": str(pdf_file),
                                "type": "pdf",
                                "filename": pdf_file.name
                            }
                        }]
                        knowledge_base.add_documents(documents)
                        logger.info(f"成功处理PDF文件: {pdf_file.name}")
                except Exception as e:
                    logger.error(f"处理PDF文件失败 {pdf_file}: {e}")
            
            # 处理CSV文件
            csv_files = list(public_dir.rglob("*.csv"))
            for csv_file in csv_files:
                try:
                    documents = knowledge_base.process_csv_data(str(csv_file))
                    if documents:
                        knowledge_base.add_documents(documents)
                        logger.info(f"成功处理CSV文件: {csv_file.name}")
                except Exception as e:
                    logger.error(f"处理CSV文件失败 {csv_file}: {e}")
            
            logger.info("批量文档处理完成")
            
        except Exception as e:
            logger.error(f"批量处理文档失败: {e}")
    
    # 启动后台任务
    background_tasks.add_task(process_documents)
    return {"message": "批量文档处理已启动，请稍后查看结果"}

@app.delete("/api/clear")
async def clear_knowledge_base():
    """清空知识库"""
    global knowledge_base
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="知识库未初始化")
    
    try:
        knowledge_base.clear_collection()
        return {"message": "知识库已清空"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清空失败: {str(e)}")

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "knowledge_base_initialized": knowledge_base is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 