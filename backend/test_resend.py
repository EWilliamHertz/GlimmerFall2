import resend
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
resend.api_key = os.environ.get("RESEND_API_KEY")

try:
    r = resend.Emails.send({
        "from": "GlimmerFall <onboarding@resend.dev>",
        "to": ["testrandom123@example.com"],
        "subject": "Test",
        "html": "<p>Test</p>"
    })
    print("Success:", r)
except Exception as e:
    print("Error:", str(e))
    print(repr(e))
