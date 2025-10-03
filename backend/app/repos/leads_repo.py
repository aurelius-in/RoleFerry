from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text


class LeadsRepo:
    def __init__(self, engine: AsyncEngine) -> None:
        self.engine = engine

    async def upsert_domain(self, domain: str, source: str) -> str:
        sql = text(
            """
            INSERT INTO lead_domain (domain, source)
            VALUES (:domain, :source)
            ON CONFLICT (domain) DO UPDATE SET source = EXCLUDED.source
            RETURNING id
            """
        )
        async with self.engine.begin() as conn:
            row = (await conn.execute(sql, {"domain": domain, "source": source})).first()
            return str(row[0])

    async def create_prospect(self, lead_domain_id: str, data: Dict[str, Any]) -> str:
        sql = text(
            """
            INSERT INTO prospect (lead_domain_id, name, title, linkedin_url, company, confidence, raw_preview_json)
            VALUES (:lead_domain_id, :name, :title, :linkedin_url, :company, :confidence, :raw)
            RETURNING id
            """
        )
        params = {
            "lead_domain_id": lead_domain_id,
            "name": data.get("name"),
            "title": data.get("title"),
            "linkedin_url": data.get("linkedin_url"),
            "company": data.get("company"),
            "confidence": data.get("confidence"),
            "raw": data,
        }
        async with self.engine.begin() as conn:
            row = (await conn.execute(sql, params)).first()
            return str(row[0])

    async def add_qualification(self, prospect_id: str, decision: str, reason: str, model: str, latency_ms: int) -> None:
        sql = text(
            """
            INSERT INTO prospect_qualification (prospect_id, decision, reason, model, latency_ms)
            VALUES (:pid, :decision, :reason, :model, :latency)
            """
        )
        async with self.engine.begin() as conn:
            await conn.execute(sql, {"pid": prospect_id, "decision": decision, "reason": reason, "model": model, "latency": latency_ms})

    async def add_contact(self, prospect_id: str, email: Optional[str], phone: Optional[str], provider: str) -> str:
        sql = text(
            """
            INSERT INTO prospect_contact (prospect_id, email, phone, provider)
            VALUES (:pid, :email, :phone, :provider)
            RETURNING id
            """
        )
        async with self.engine.begin() as conn:
            row = (await conn.execute(sql, {"pid": prospect_id, "email": email, "phone": phone, "provider": provider})).first()
            return str(row[0])

    async def update_contact_verification(self, contact_id: str, status: str, score: Optional[int], verified_by: str) -> None:
        sql = text(
            """
            UPDATE prospect_contact
            SET verification_status = :status,
                verification_score = :score,
                verified_by = :vb,
                verified_at = now()
            WHERE id = :cid
            """
        )
        async with self.engine.begin() as conn:
            await conn.execute(sql, {"status": status, "score": score, "vb": verified_by, "cid": contact_id})

    async def add_cost(self, prospect_id: str, step: str, units: float, unit_type: str, est_cost_usd: float, meta: Dict[str, Any] | None) -> None:
        sql = text(
            """
            INSERT INTO pipeline_cost_ledger (prospect_id, step, units, unit_type, est_cost_usd, meta)
            VALUES (:pid, :step, :units, :utype, :cost, :meta)
            """
        )
        async with self.engine.begin() as conn:
            await conn.execute(sql, {"pid": prospect_id, "step": step, "units": units, "utype": unit_type, "cost": est_cost_usd, "meta": meta or {}})


