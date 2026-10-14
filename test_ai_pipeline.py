from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance
import httpx
import uuid

def main():
    print("Loading embedding model...")
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    text = "Deadlock is a state in which a set of processes are blocked because each process is waiting for a resource held by another process."
    embedding = model.encode(text).tolist()

    dim = len(embedding)
    print(f"Embedding dimension: {dim}")

    print("Connecting to Qdrant...")
    client = QdrantClient(url="http://localhost:6333")
    collection_name = "test_collection_ai"

    try:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
    except Exception as e:
        print(f"Collection creation info: {e}")

    point_id = str(uuid.uuid4())
    client.upsert(
        collection_name=collection_name,
        points=[
            PointStruct(id=point_id, vector=embedding, payload={"text": text})
        ]
    )
    print("Vector stored in Qdrant.")

    results = client.query_points(
        collection_name=collection_name,
        query=embedding,
        limit=1
    ).points
    retrieved_text = results[0].payload["text"]
    print(f"Retrieved from Qdrant: {retrieved_text}")

    print("Querying Ollama...")
    prompt = f"Use this context to answer: '{retrieved_text}'. What is deadlock?"
    response = httpx.post(
        "http://localhost:11434/api/generate",
        json={"model": "qwen3:8b", "prompt": prompt, "stream": False},
        timeout=60.0
    ).json()
    print("Ollama Response:", response.get("response", "No response key"))

    print("Cleaning up...")
    client.delete_collection(collection_name)
    print("Pipeline test successful.")

if __name__ == "__main__":
    main()
