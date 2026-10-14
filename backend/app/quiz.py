import json, random, re
from fastapi import HTTPException, Depends
from pydantic import BaseModel
from .models import Chunk, Source, Quiz, Mastery, now
from .providers import OllamaLLMProvider

SLIP, GUESS, LEARN, INIT = 0.10, 0.25, 0.15, 0.30  # transparent BKT parameters

def bkt(p: float, correct: bool) -> float:
    """P(known) after one answer: Bayes posterior on the evidence, then the learning transition."""
    post = p * (1 - SLIP) / (p * (1 - SLIP) + (1 - p) * GUESS) if correct else p * SLIP / (p * SLIP + (1 - p) * (1 - GUESS))
    return post + (1 - post) * LEARN

PROMPT = ("Write ONE multiple-choice question answerable ONLY from the excerpt. Difficulty: {d}. Return ONLY JSON: "
          '{{"question":str,"options":[4 distinct strings],"correct_index":0-3,"concept":"2-4 word concept name","explanation":str}}\n\nExcerpt:\n{t}')

def valid(q: dict) -> bool:
    o = q.get("options")
    return (isinstance(o, list) and len(o) == 4 and len({str(x).strip().lower() for x in o}) == 4
            and isinstance(q.get("correct_index"), int) and 0 <= q["correct_index"] < 4
            and all(isinstance(q.get(k), str) and q[k].strip() for k in ("question", "concept", "explanation")))

def make_question(llm, chunk, diff):
    for _ in range(2):
        try:
            raw = llm.chat("You are a careful exam writer. Output JSON only.", PROMPT.format(d=diff, t=chunk.text))
            q = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
            if valid(q): return q
        except Exception:
            pass
    return None

def diagnose_misconception(llm, question: str, options: list, correct_idx: int, student_idx: int, explanation: str) -> str:
    prompt = (f"A student took a quiz. Question: {question}\n"
              f"Correct answer: {options[correct_idx]}\n"
              f"Student's chosen wrong answer: {options[student_idx]}\n"
              f"Concept explanation: {explanation}\n"
              "In 1 or 2 concise sentences, identify the student's likely misconception and how to correct it. Be direct and helpful.")
    try:
        diag = llm.chat("You are an expert diagnostic tutor. Output 1-2 helpful sentences only.", prompt)
        return diag.strip()
    except Exception:
        return f"Selected '{options[student_idx]}' instead of '{options[correct_idx]}'. Review: {explanation}"

norm = lambda s: re.sub(r"\W+", " ", s.lower()).strip()

class GenIn(BaseModel):
    count: int = 5

class SubmitIn(BaseModel):
    answers: list[int | None]

def register(app, get_db, current_user, own_course):
    @app.post("/courses/{cid}/quiz/generate")
    def generate(cid: str, b: GenIn, u=Depends(current_user), db=Depends(get_db)):
        own_course(cid, u, db)
        chunks = db.query(Chunk).filter_by(course_id=cid).all()
        if not chunks: raise HTTPException(400, "Upload and process course materials first.")
        
        # 1. Inspect learner model
        ms = db.query(Mastery).filter_by(user_id=u.id, course_id=cid).all()
        mastery_map = {m.concept.lower().strip(): m for m in ms}
        weak_concepts = [m for m in ms if m.p < 0.6]
        weak_concepts.sort(key=lambda m: m.p)
        
        avg_mastery = sum(m.p for m in ms) / len(ms) if ms else INIT
        
        # 2. Adaptive chunk prioritization:
        prioritized_chunks = []
        remaining_chunks = list(chunks)
        
        for wm in weak_concepts:
            c_name = wm.concept.lower().strip()
            matched = [c for c in remaining_chunks if c_name in c.text.lower()]
            for m in matched:
                if m not in prioritized_chunks:
                    prioritized_chunks.append(m)
                    remaining_chunks.remove(m)
                    
        random.shuffle(remaining_chunks)
        target_chunks = prioritized_chunks + remaining_chunks
        
        seen = {norm(q["question"]) for z in db.query(Quiz).filter_by(user_id=u.id, course_id=cid) for q in z.questions}
        names = {s.id: s.name for s in db.query(Source).filter_by(course_id=cid)}
        
        qs = []
        llm = OllamaLLMProvider()
        
        for ch in target_chunks[: max(4, b.count) * 4]:
            if len(qs) >= min(max(b.count, 1), 10): break
            
            ch_concept_match = next((m for m in ms if m.concept.lower().strip() in ch.text.lower()), None)
            concept_p = ch_concept_match.p if ch_concept_match else avg_mastery
            diff = "easy" if concept_p < 0.4 else "medium" if concept_p < 0.7 else "hard"
            
            q = make_question(llm, ch, diff)
            if not q or norm(q["question"]) in seen: continue
            seen.add(norm(q["question"]))
            
            reason = (f"Targeted practice for '{ch_concept_match.concept}' (current mastery: {int(ch_concept_match.p * 100)}%)" 
                      if ch_concept_match else f"Course mastery calibration ({diff} level)")
            
            source_payload = {
                "source_id": ch.source_id,
                "source_name": names.get(ch.source_id, "Course Material"),
                "page": ch.page,
                "slide": ch.slide,
                "timestamp_start": ch.timestamp_start,
                "timestamp_end": ch.timestamp_end
            }
            
            qs.append({
                **q,
                "difficulty": diff,
                "reason": reason,
                "source": source_payload
            })
            
        if not qs: raise HTTPException(503, "Couldn't generate valid questions. Make sure Ollama is running.")
        z = Quiz(user_id=u.id, course_id=cid, questions=qs)
        db.add(z)
        db.commit()
        return {"id": z.id, "questions": qs}

    @app.post("/quiz/{qid}/submit")
    def submit(qid: str, b: SubmitIn, u=Depends(current_user), db=Depends(get_db)):
        z = db.get(Quiz, qid)
        if not z or z.user_id != u.id: raise HTTPException(404, "Quiz not found")
        if z.answers is not None: raise HTTPException(409, "Already submitted")
        if len(b.answers) != len(z.questions): raise HTTPException(422, "Answer every question")
        
        topics: dict = {}
        flags = []
        misconceptions = []
        llm = OllamaLLMProvider()
        
        for q, a in zip(z.questions, b.answers):
            ok = a == q["correct_index"]
            flags.append(ok)
            
            m = db.query(Mastery).filter_by(user_id=u.id, course_id=z.course_id, concept=q["concept"]).first()
            if not m:
                m = Mastery(user_id=u.id, course_id=z.course_id, concept=q["concept"], p=INIT, attempts=0, correct=0)
                db.add(m)
                
            t = topics.setdefault(q["concept"], {"concept": q["concept"], "p_before": m.p, "correct": 0, "total": 0})
            
            m.p = bkt(m.p, ok)
            m.attempts += 1
            m.correct += int(ok)
            m.updated_at = now()
            m.source_id = q["source"].get("source_id", "")
            m.source_name = q["source"].get("source_name", "")
            m.page = q["source"].get("page") or 0
            
            t["p_after"] = m.p
            t["total"] += 1
            t["correct"] += int(ok)
            
            if not ok and a is not None:
                diag = diagnose_misconception(llm, q["question"], q["options"], q["correct_index"], a, q["explanation"])
                misconceptions.append({
                    "concept": q["concept"],
                    "question": q["question"],
                    "chosen_answer": q["options"][a],
                    "correct_answer": q["options"][q["correct_index"]],
                    "diagnosis": diag,
                    "source": q["source"]
                })
                
        z.answers = b.answers
        z.score = sum(flags) / len(flags)
        db.commit()
        return {
            "score": z.score,
            "correct": sum(flags),
            "total": len(flags),
            "topics": list(topics.values()),
            "misconceptions": misconceptions
        }

    @app.get("/courses/{cid}/mastery")
    def mastery(cid: str, u=Depends(current_user), db=Depends(get_db)):
        own_course(cid, u, db)
        ms = db.query(Mastery).filter_by(user_id=u.id, course_id=cid).order_by(Mastery.p).all()
        c = [{"concept": m.concept, "p": m.p, "attempts": m.attempts, "correct": m.correct,
              "source_id": m.source_id, "source_name": m.source_name, "page": m.page} for m in ms]
        return {"overall": sum(m.p for m in ms) / len(ms) if ms else None, "concepts": c}

    @app.get("/courses/{cid}/quizzes")
    def quizzes(cid: str, u=Depends(current_user), db=Depends(get_db)):
        own_course(cid, u, db)
        qs = db.query(Quiz).filter(Quiz.user_id == u.id, Quiz.course_id == cid, Quiz.score.isnot(None)).order_by(Quiz.created_at.desc()).limit(10)
        return [{"id": z.id, "score": z.score, "total": len(z.questions), "created_at": z.created_at.isoformat()} for z in qs]

    @app.get("/courses/{cid}/concept-map")
    def concept_map(cid: str, u=Depends(current_user), db=Depends(get_db)):
        """Nodes = concepts the learner has been quizzed on (real mastery). Edges link concepts in document and prerequisite order."""
        own_course(cid, u, db)
        ms = db.query(Mastery).filter_by(user_id=u.id, course_id=cid).order_by(Mastery.source_id, Mastery.page).all()
        nodes = [{"concept": m.concept, "p": m.p, "attempts": m.attempts, "correct": m.correct,
                  "source_id": m.source_id, "source_name": m.source_name, "page": m.page} for m in ms]
        edges = [{"from": a["concept"], "to": b["concept"]} for a, b in zip(nodes, nodes[1:]) if a["source_id"] == b["source_id"]]
        return {"nodes": nodes, "edges": edges}

    @app.get("/courses/{cid}/recommendations")
    def recommendations(cid: str, u=Depends(current_user), db=Depends(get_db)):
        own_course(cid, u, db)
        ms = db.query(Mastery).filter_by(user_id=u.id, course_id=cid).order_by(Mastery.p.asc()).all()
        recs = []
        for m in ms:
            if m.p < 0.65:
                chunk = db.query(Chunk).filter(Chunk.course_id == cid, Chunk.text.ilike(f"%{m.concept}%")).first()
                if chunk and chunk.timestamp_start is not None:
                    loc = f"Timestamp {int(chunk.timestamp_start // 60)}m {int(chunk.timestamp_start % 60)}s"
                    action_text = f"Watch video lecture at {loc} to review '{m.concept}'"
                elif chunk and chunk.slide is not None:
                    loc = f"Slide {chunk.slide}"
                    action_text = f"Review lecture presentation at {loc} on '{m.concept}'"
                elif m.page:
                    loc = f"Page {m.page}"
                    action_text = f"Review textbook reading at {loc} on '{m.concept}'"
                else:
                    loc = "Course Material"
                    action_text = f"Review core material for '{m.concept}'"
                    
                recs.append({
                    "concept": m.concept,
                    "mastery": m.p,
                    "action": action_text,
                    "source_id": chunk.source_id if chunk else m.source_id,
                    "source_name": m.source_name or "Course Material",
                    "location": loc,
                    "page": chunk.page if chunk else m.page,
                    "timestamp_start": chunk.timestamp_start if chunk else None
                })
        return {"recommendations": recs}
