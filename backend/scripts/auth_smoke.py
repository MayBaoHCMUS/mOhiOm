import os
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app


def run():
    email = f"smoke-{datetime.utcnow().timestamp()}@example.com"
    payload = {
        "first_name": "Smoke",
        "last_name": "Test",
        "email": email,
        "password": "StrongPass123",
    }

    with TestClient(app) as client:
        register = client.post("/api/auth/register", json=payload)
        login = client.post("/api/auth/login", json={"email": email, "password": payload["password"]})
        me = client.get("/api/auth/me")
        logout = client.post("/api/auth/logout")

    return {
        "register_status": register.status_code,
        "login_status": login.status_code,
        "me_status": me.status_code,
        "logout_status": logout.status_code,
        "register_body": register.json(),
        "login_body": login.json(),
        "me_body": me.json(),
    }


if __name__ == "__main__":
    os.environ.setdefault("JWT_SECRET_KEY", "local-dev-secret")
    try:
        result = run()
        for key, value in result.items():
            print(f"{key}=", value)
    except Exception as exc:
        print("auth_smoke_failed=", str(exc))

