import httpx, os, time, subprocess, sys

BASE = "http://localhost:8000"

def get_test_video():
    if not os.path.exists("test_video.mp4"):
        print("Downloading a tiny test video...")
        subprocess.run([
            sys.executable, "-m", "yt_dlp",
            "-f", "best[ext=mp4]",
            "--download-sections", "*00:00:00-00:00:15",
            "-o", "test_video.mp4",
            "https://www.youtube.com/watch?v=BaW_22QEXNc" # Example educational video
        ], check=False)
        if not os.path.exists("test_video.mp4"):
            print("Fallback: creating a dummy MP4 video with sine wave audio so processing doesn't crash.")
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=5:size=640x480:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=1000:duration=5",
                "-c:v", "libx264", "-c:a", "aac", "test_video.mp4"
            ])

def test():
    get_test_video()
    
    c = httpx.Client(base_url=BASE, timeout=300)
    
    # 1. Register
    email = f"test_vid_{int(time.time())}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "password123"})
    if r.status_code != 200:
        if r.status_code == 409:
            # Login instead
            r = c.post("/auth/login", json={"email": email, "password": "password123"})
        else:
            assert r.status_code == 200, r.text
    token = r.json()["token"]
    c.headers["Authorization"] = f"Bearer {token}"
    
    # 2. Create Course
    r = c.post("/courses", json={"name": "Video E2E Test Course"})
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    print(f"Course created: {cid}")
    
    # 3. Upload MP4
    print("Uploading video...")
    r = c.post(f"/courses/{cid}/sources", files={"file": ("test_video.mp4", open("test_video.mp4", "rb"), "video/mp4")})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    print(f"Source uploaded: {sid}")
    
    # Wait for processing
    print("Waiting for processing (this might take a minute)...")
    while True:
        r = c.get(f"/courses/{cid}/sources")
        s = next((x for x in r.json() if x["id"] == sid), None)
        if not s:
            print("Source not found!")
            break
        print(f"Status: {s['status']}")
        if s["status"] == "COMPLETED": 
            print("Metadata:", s.get("metadata"))
            break
        if s["status"] == "FAILED": 
            raise Exception("Processing failed: " + s.get("error", ""))
        time.sleep(3)
        
    # 4. Chat Session
    print("Testing chat...")
    r = c.post(f"/courses/{cid}/chat", json={"question": "What is discussed in this video?"})
    assert r.status_code == 200, r.text
    data = r.json()
    print("A:", data["answer"])
    print("Citations:", len(data["citations"]))
    
    if len(data["citations"]) > 0:
        print("First citation:", data["citations"][0])
    
    print("End-to-end video test passed!")

if __name__ == '__main__':
    test()
