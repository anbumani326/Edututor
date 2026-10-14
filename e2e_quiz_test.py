import httpx, os, time

BASE = "http://localhost:8000"

def test():
    c = httpx.Client(base_url=BASE, timeout=300)
    
    # 1. Register
    email = f"test_quiz_{int(time.time())}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "password123"})
    if r.status_code == 409:
        r = c.post("/auth/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    
    # 2. Create Course
    r = c.post("/courses", json={"name": "End to End Quiz Course"})
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    print(f"Course created: {cid}")
    
    # 3. Create dummy PDF
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(The powerhouse of the cell is the mitochondria.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000220 00000 n \n0000000324 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n412\n%%EOF\n"
    with open("test.pdf", "wb") as f:
        f.write(pdf_content)
        
    # 4. Upload PDF
    r = c.post(f"/courses/{cid}/sources", files={"file": ("test.pdf", open("test.pdf", "rb"), "application/pdf")})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    print(f"Source uploaded: {sid}")
    
    # Wait for processing
    while True:
        r = c.get(f"/courses/{cid}/sources")
        s = next(x for x in r.json() if x["id"] == sid)
        if s["status"] == "COMPLETED": break
        if s["status"] == "FAILED": raise Exception("Processing failed: " + s.get("error", ""))
        time.sleep(2)
        
    # 5. Unsupported-query refusal
    print("Testing unsupported-query refusal...")
    r = c.post(f"/courses/{cid}/chat", json={"question": "What is the capital of France?"})
    data = r.json()
    print("Refusal response:", data["answer"])
    assert "not" in data["answer"].lower() or "couldn't find" in data["answer"].lower()
    
    # 6. Quiz generation
    print("Generating quiz...")
    r = c.post(f"/courses/{cid}/quiz/generate", json={"count": 1})
    assert r.status_code == 200, r.text
    quiz_data = r.json()
    print(f"Quiz generated: {quiz_data['id']} with {len(quiz_data['questions'])} questions")
    assert len(quiz_data["questions"]) > 0
    qid = quiz_data["id"]
    
    # 7. Quiz Evaluation & Mastery Update
    # Let's submit an answer
    # the correct index is in the question definition
    correct_idx = quiz_data["questions"][0]["correct_index"]
    print(f"Submitting correct answer (index {correct_idx})...")
    r = c.post(f"/quiz/{qid}/submit", json={"answers": [correct_idx]})
    assert r.status_code == 200, r.text
    submit_data = r.json()
    print(f"Quiz submitted. Score: {submit_data['score']}, Correct: {submit_data['correct']}/{submit_data['total']}")
    assert submit_data["correct"] == 1
    
    # Check mastery
    print("Checking mastery...")
    r = c.get(f"/courses/{cid}/mastery")
    assert r.status_code == 200, r.text
    mastery_data = r.json()
    print("Mastery:", mastery_data)
    assert mastery_data["overall"] is not None
    assert len(mastery_data["concepts"]) > 0

    print("End-to-end Quiz/Mastery test passed!")

if __name__ == '__main__':
    test()
