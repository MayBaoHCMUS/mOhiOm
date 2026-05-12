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

    return register.status_code, login.status_code, register.json(), login.json()


if __name__ == "__main__":
    os.environ.setdefault("JWT_SECRET_KEY", "local-dev-secret")
    try:
        reg_status, login_status, reg_body, login_body = run()
        print("register_status=", reg_status)
        print("login_status=", login_status)
        print("register_body=", reg_body)
        print("login_body=", login_body)
    except Exception as exc:
        print("auth_smoke_failed=", str(exc))

