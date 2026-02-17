.PHONY: backend frontend streamlit

backend:
	uvicorn backend.app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

streamlit:
	streamlit run app.py
