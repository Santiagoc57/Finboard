from backend.app.services.settings_store import get_runtime_gemini_key
import google.generativeai as genai

key = get_runtime_gemini_key()
if not key:
    print("No key found")
else:
    genai.configure(api_key=key)
    print("Available models:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
