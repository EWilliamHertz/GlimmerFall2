import requests

print("Testing Telemetry Endpoint:")
res = requests.get("http://127.0.0.1:8000/api/admin/telemetry")
print(res.status_code)
print(res.text)
