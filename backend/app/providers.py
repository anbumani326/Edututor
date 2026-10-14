import re, httpx
from abc import ABC, abstractmethod
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from . import core

class LLMProvider(ABC):
    @abstractmethod
    def chat(self, system: str, user: str, history: list = None) -> str: ...

class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...

class OllamaLLMProvider(LLMProvider):
    def chat(self, system, user, history=None):
        msgs = [{"role": "system", "content": system}]
        if history: msgs.extend(history)
        msgs.append({"role": "user", "content": user})
        r = httpx.post(f"{core.OLLAMA_BASE_URL}/api/chat", timeout=300, json={
            "model": core.OLLAMA_MODEL, "stream": False,
            "messages": msgs})
        r.raise_for_status()
        return re.sub(r"<think>.*?</think>", "", r.json()["message"]["content"], flags=re.S).strip()

class LocalEmbeddingProvider(EmbeddingProvider):
    _m = None
    def embed(self, texts):
        if LocalEmbeddingProvider._m is None:
            from sentence_transformers import SentenceTransformer
            LocalEmbeddingProvider._m = SentenceTransformer(core.EMBEDDING_MODEL)
        return LocalEmbeddingProvider._m.encode(texts, normalize_embeddings=True).tolist()

COLLECTION = "knowledge"
_qc = None
def qdrant() -> QdrantClient:
    global _qc
    if _qc is None:
        _qc = QdrantClient(url=core.QDRANT_URL) if core.QDRANT_URL else QdrantClient(path="./qdrant_data")
    return _qc

def ensure_collection(dim: int):
    if not qdrant().collection_exists(COLLECTION):
        qdrant().create_collection(COLLECTION, vectors_config=VectorParams(size=dim, distance=Distance.COSINE))

def upsert(points: list[PointStruct]):
    qdrant().upsert(COLLECTION, points)

def search(vec, course_id: str, limit=5, source_id: str = None):
    if not qdrant().collection_exists(COLLECTION):
        return []
    must = [FieldCondition(key="course_id", match=MatchValue(value=course_id))]
    if source_id:
        must.append(FieldCondition(key="source_id", match=MatchValue(value=source_id)))
    f = Filter(must=must)
    return qdrant().query_points(COLLECTION, query=vec, query_filter=f, limit=limit).points
