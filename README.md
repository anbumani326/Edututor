# EduTutor AI — Personalized Multimodal AI Tutoring & Adaptive Learning

A multimodal, source-grounded educational intelligence platform. Students learn any subject (Computer Science, Biology, Mathematics, Physics, Medicine, etc.) from their own textbooks, lecture slide decks, and video recordings. Answers, adaptive assessments, concept maps, and recommendations are grounded strictly in uploaded material with verified citations.

---

## 🏛️ System Architecture

```text
[ Students / Web Browser ]
           │
           ▼
[ Next.js 14 Frontend ] (App Router, Tailwind/Vanilla CSS, Interactive SVG Graph)
           │ HTTP / REST API (Port 8000)
           ▼
[ FastAPI Backend ] ──────────────────────────┐
   ├── Auth & JWT Security                    │
   ├── Multimodal Ingestion Pipeline          │
   │    ├── PyMuPDF (PDF pages)              ├──► [ PostgreSQL / Neon DB ]
   │    ├── python-pptx (Slide decks)         │    (Courses, Chunks, Quizzes,
   │    ├── YouTube Transcript API            │     Mastery, Evaluations)
   │    └── OpenCV + Faster-Whisper + OCR     │
   │                                          ├──► [ Qdrant Vector DB ]
   ├── Multimodal RAG Engine (Local Embeddings)│    (MiniLM-L6-v2, 384-dim,
   ├── Grounding Guard & Refusal Logic        │     Page/Slide/Time metadata)
   ├── Adaptive Assessment Engine (BKT)       │
   ├── AI Misconception Diagnosis Engine      └──► [ Local Ollama ]
   └── System Benchmarking & Simulation            (Qwen3 8B / Qwen2.5)
```

---

## 🌟 Key Features

1. **Multimodal Knowledge Ingestion**:
   - Ingests **PDF textbooks**, **PPTX slide decks**, **MP4 / MOV local video lectures**, and **YouTube video streams**.
   - Video processing extracts audio (Faster-Whisper transcription) and video keyframes (OpenCV + Tesseract OCR).
   - Embedded using `sentence-transformers/all-MiniLM-L6-v2` into **Qdrant** vector store with full slide, page, and timestamp provenance.

2. **Grounded AI Tutor (Qwen3 8B via Ollama)**:
   - Synthesizes answers using strict course grounding.
   - Clickable citations link directly to exact **PDF pages** (`#page=N`), **PPTX slides** (`Slide N`), and **video timestamps** (`#t=S`).
   - Built-in **Grounding Guard / Refusal Logic** politely flags and refuses ungrounded, off-topic queries without fabricating citations.
   - Persistent chat session memory stored in PostgreSQL.

3. **Adaptive Assessment & Misconception Diagnosis**:
   - Dynamically selects chunks targeting the student's **weakest concepts ($P(L) < 0.60$)** identified by **Bayesian Knowledge Tracing (BKT)**.
   - Dynamic difficulty calibration (Easy, Medium, Hard) tailored to learner proficiency.
   - Diagnoses mental model misconceptions upon submission with targeted remediation.

4. **Progress & Concept Graph**:
   - Live dashboard showing overall mastery, weak vs mastered concepts, and quiz history.
   - Interactive SVG Concept & Prerequisite Map showing curriculum dependencies colored by real-time mastery.

5. **Empirical System Evaluation & Multi-Student Simulation**:
   - Measures **LLM Judge Faithfulness**, **Retrieval Hit Rate (R@5)**, **Top-1 Citation Accuracy**, and **Unsupported Refusal Rate**.
   - Live **Multi-Student Personalization Simulation** comparing Adaptive BKT vs Random Selection across 3 student personas.

---

## ⚙️ Environment & Installation

### 1. Prerequisites
- **Ollama**: Installed with `qwen3:8b`
  ```bash
  ollama serve
  ollama pull qwen3:8b
  ```
- **Python**: 3.11+
- **Node.js**: 18+
- **System Tools** (optional for local video audio & OCR): `ffmpeg`, `tesseract`

### 2. Environment Configuration
Copy `.env.example` to `backend/.env` (and root `.env` if desired):
```env
# Database (PostgreSQL recommended; SQLite fallback supported)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/edututor

# Qdrant Vector Store (empty for embedded local storage at ./qdrant_data)
QDRANT_URL=

# Ollama Local LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b

# Embedding Model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# JWT Secret
JWT_SECRET=change-me-to-a-secure-secret-minimum-32-chars

# Media Storage
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=52428800
```

---

## 🚀 Running Locally

### Option A: Local Development (Fastest)

1. **Start Ollama**:
   ```bash
   ollama serve
   ```

2. **Backend**:
   ```bash
   cd backend
   # Windows:
   .\.venv\Scripts\activate
   # Linux/macOS:
   # python -m venv .venv && source .venv/bin/activate

   pip install -r requirements.txt
   python -m alembic upgrade head
   python seed.py               # Seeds demo Biology course with real indexed PDF & evaluation cases
   uvicorn app.main:app --reload --port 8000
   ```
   Backend API documentation: `http://localhost:8000/docs`

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

### Option B: Docker Compose

```bash
docker compose build
docker compose up
```

Services started:
- `frontend`: Next.js web application (`http://localhost:3000`)
- `backend`: FastAPI application (`http://localhost:8000`)
- `postgres`: PostgreSQL 16 database (`localhost:5432`)
- `qdrant`: Qdrant vector database (`localhost:6333`)
- Note: Ollama runs on host machine (`http://host.docker.internal:11434`) to leverage host GPU acceleration.

---

## 🧪 Test & Verification Commands

```bash
# 1. Run Backend Pytest Suite (9 tests: BKT, misconceptions, JWT, chunking, eval, PPTX)
cd backend && .\.venv\Scripts\python.exe -m pytest tests

# 2. Run Live 12-Step Pipeline Verification (Auth, DB, RAG, Ollama, Refusal, BKT, Eval)
cd backend && .\.venv\Scripts\python.exe verify_pipeline.py

# 3. Frontend Production Build Check
cd frontend && npm run build
```

---

## 📊 Evaluation & Benchmark Suite

EduTutor AI features a built-in empirical evaluation benchmark:
1. Navigate to **Evaluation** in the web interface.
2. Click **⚡ Auto-Seed Test Cases** to populate benchmark ground-truth test cases from your indexed course material chunks.
3. Click **Run Evaluation Suite** to measure RAG retrieval hit rate, top-1 citation accuracy, refusal rate, and LLM judge faithfulness.
4. Click **Run Personalization Simulation** to benchmark the 3-student learner simulation (Adaptive BKT targeting weak concepts vs Random question baseline).

---



---

## ⚠️ Known Limitations & Design Notes

1. **Local LLM Inference Speed**: Qwen3 8B is an 8.2B parameter local model. Response latency depends on host hardware (GPU VRAM vs CPU).
2. **Video Audio & OCR Tools**: Full local MP4 audio extraction and OCR require `ffmpeg` and `tesseract` installed on the host system. If not present, video transcript upload or YouTube ingestion serves as the recommended workflow.
3. **Deterministic Simulation Parameters**: The 3-student personalization benchmark utilizes standard Bayesian Knowledge Tracing parameters ($P(L_0), P(T)=0.15, P(S)=0.10, P(G)=0.25$) over 5 discrete quiz steps to contrast weak-concept targeting against random uniform question selection.
