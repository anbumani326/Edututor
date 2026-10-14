import httpx, os, time, subprocess, sys

BASE = "http://localhost:8000"

def get_real_video():
    if not os.path.exists("real_test_video.mp4"):
        print("Downloading a 2-minute section of a real lecture video...")
        print("Downloading MIT 18.06 Lecture using ffmpeg...")
        subprocess.run([
            "ffmpeg", "-y", "-i", "https://archive.org/download/MIT18.06S05_MP4/01.mp4",
            "-t", "120", "-c", "copy", "real_test_video.mp4"
        ], check=True)

    return "real_test_video.mp4"

def test():
    vid_path = get_real_video()
    c = httpx.Client(base_url=BASE, timeout=600)
    
    # 1. Register & Login
    email = f"real_test_{int(time.time())}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "password123"})
    if r.status_code == 409:
        r = c.post("/auth/login", json={"email": email, "password": "password123"})
    token = r.json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    
    # 2. Create Course
    r = c.post("/courses", json={"name": "Real Video Validation Course"})
    cid = r.json()["id"]
    print(f"Course created: {cid}")
    
    # 3. Upload MP4
    print("Uploading real video...")
    r = c.post(f"/courses/{cid}/sources", files={"file": ("real_test_video.mp4", open(vid_path, "rb"), "video/mp4")})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    print(f"Source uploaded: {sid}")
    
    # 4. Wait for processing & processing pipeline check
    start_time = time.time()
    print("Waiting for processing (this will take a while for 2 mins of video with Whisper & OCR)...")
    while True:
        r = c.get(f"/courses/{cid}/sources")
        s = next(x for x in r.json() if x["id"] == sid)
        if s["status"] == "COMPLETED": break
        if s["status"] == "FAILED": raise Exception("Processing failed: " + s.get("error", ""))
        time.sleep(5)
        print("Status:", s["status"])
    process_duration = time.time() - start_time
    print(f"Video processed in {process_duration:.2f} seconds.")
    
    # Check metadata
    print("Checking metadata...")
    r = c.get(f"/sources/{sid}/meta")
    meta = r.json()["metadata"]
    print("Metadata:", meta)
    assert meta["duration"] > 0
    assert meta["width"] > 0
    
    # 5. Video RAG & Timestamp Citation Test
    print("Asking grounded question...")
    r = c.post(f"/courses/{cid}/chat", json={"question": "What is the subject of this lecture?"})
    chat_resp = r.json()
    print("Answer:", chat_resp["answer"])
    print("Citations:", chat_resp["citations"])
    assert len(chat_resp["citations"]) > 0
    cit = chat_resp["citations"][0]
    assert cit["timestamp_start"] is not None
    print(f"Citation valid! Points to {cit['timestamp_start']}s")
    
    import sqlite3
    conn = sqlite3.connect("backend/edututor.db")
    c_db = conn.cursor()
    c_db.execute("SELECT count(*) FROM knowledge_chunks WHERE source_id=?", (sid,))
    chunk_count = c_db.fetchone()[0]
    
    c_db.execute("SELECT count(*) FROM knowledge_chunks WHERE source_id=? AND ocr_text IS NOT NULL", (sid,))
    ocr_count = c_db.fetchone()[0]
    
    c_db.execute("SELECT count(*) FROM knowledge_chunks WHERE source_id=? AND ocr_text IS NULL", (sid,))
    transcript_count = c_db.fetchone()[0]
    
    print(f"\n--- PHASE 1 METRICS ---")
    print(f"Processing time: {process_duration:.2f} seconds")
    print(f"Video duration: {meta['duration']}s")
    print(f"Transcript segment count: {transcript_count}")
    print(f"OCR frame count: {ocr_count}")
    print(f"Total indexed chunk count: {chunk_count}")
    print(f"Retrieval Results: {chat_resp['citations']}")
    
    conn.close()

    # 6. Video Quiz Test
    print("Generating quiz...")
    r = c.post(f"/courses/{cid}/quiz/generate", json={"count": 1})
    quiz = r.json()
    print("Quiz generation successful!")
    
    # Quiz Submission
    q_id = quiz["id"]
    ans = [0] * len(quiz["questions"])
    r = c.post(f"/quiz/{q_id}/submit", json={"answers": ans})
    print("Quiz submission:", r.json())
    
    print("PHASE A tests completely passed!")

if __name__ == '__main__':
    test()
