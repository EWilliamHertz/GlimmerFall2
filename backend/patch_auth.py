import os
import re

with open('backend/server.py', 'r') as f:
    content = f.read()

# Add JWT_SECRET helper function at the top of the file before the routes
auth_helper = """
def get_user_from_request(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None
"""
if "def get_user_from_request" not in content:
    content = content.replace('CARDBACK_URL = os.environ.get("CARDBACK_URL", "")', 'CARDBACK_URL = os.environ.get("CARDBACK_URL", "")\n' + auth_helper)

# Replace get_admin_users
content = content.replace(
    'user = getattr(request.state, "user", None)\n    if not user or not user.get("isAdmin"):',
    'user = get_user_from_request(request)\n    if not user or not user.get("isAdmin"):'
)

# Replace toggle_admin
content = content.replace(
    'user = getattr(request.state, "user", None)\n    if not user:',
    'user = get_user_from_request(request)\n    if not user:'
)

# Ensure JWT_SECRET is available globally if needed, it is at line 375 currently, but the helper uses it. 
# Wait, if get_user_from_request is defined at the top, it will use the global JWT_SECRET which is defined at line 375. 
# In Python, globals are looked up at runtime, so as long as it's defined before the function is CALLED, it's fine. 

with open('backend/server.py', 'w') as f:
    f.write(content)

print("Auth patched")
