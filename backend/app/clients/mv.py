from typing import Dict, Any
import httpx


class MillionVerifierClient:
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key
        self.base_url = "https://api.millionverifier.com/api/v2"

    async def verify_email(self, email: str) -> Dict[str, Any]:
        if not self.api_key:
            return {"email": email, "result": "valid", "score": 1.0}
        url = f"{self.base_url}/verify"
        params = {"key": self.api_key, "email": email}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                data = r.json()
                # Normalize common fields
                status = (data.get("result") or data.get("status") or "unknown").lower()
                score = data.get("score") or data.get("reliability") or 0
                try:
                    score = float(score)
                except Exception:
                    score = 0
                if score > 1:
                    score = score / 100.0
                return {"email": email, "result": status, "score": score, "raw": data}
        except Exception as e:
            return {"email": email, "result": "unknown", "score": 0, "error": str(e)}

