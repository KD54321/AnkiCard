import requests

ANKICONNECT_URL = "http://localhost:8765"
DECK_NAME = "Optometry Notes"
MODEL = "Basic"  # or "Cloze"

def add_note(front, back, deck=DECK_NAME, model=MODEL, tags=["optometry"]):
    payload = {
        "action": "addNote",
        "version": 6,
        "params": {
            "note": {
                "deckName": deck,
                "modelName": model,
                "fields": {"Front": front, "Back": back},
                "options": {"allowDuplicate": False},
                "tags": tags
            }
        }
    }
    return requests.post(ANKICONNECT_URL, json=payload).json()
