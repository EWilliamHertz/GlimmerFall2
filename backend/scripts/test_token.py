import jwt
import requests
import json

JWT_SECRET = "glimmerfall_super_secret_key"
token = jwt.encode({
    "id": 1,
    "email": "swagyser9@gmail.com",
    "nickname": "Swagyser",
    "is_admin": True
}, JWT_SECRET, algorithm="HS256")

headers = {"Authorization": f"Bearer {token}"}
print("Telemetry:")
print(requests.get("http://127.0.0.1:8000/api/admin/telemetry", headers=headers).status_code)
print("Users:")
print(requests.get("http://127.0.0.1:8000/api/admin/users", headers=headers).status_code)
