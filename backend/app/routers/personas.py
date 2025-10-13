"""
Personas API - Apollo-style contact filters
Define and reuse persona profiles for targeting
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

personas_db = [
    {
        "id": 1,
        "name": "Senior PM - B2B SaaS",
        "titles": ["Senior Product Manager", "Product Manager", "Associate Product Manager"],
        "departments": ["Product", "Product Management"],
        "managementLevel": ["IC", "Manager"],
        "locations": ["United States", "Remote"],
        "employeeCount": ["51-200", "201-500", "501-1000"],
        "industries": ["SaaS", "Software Development"],
        "createdAt": "2025-01-01T00:00:00Z",
        "active": True
    },
    {
        "id": 2,
        "name": "VP/Head of Product",
        "titles": ["VP Product", "Head of Product", "Director of Product"],
        "departments": ["Product", "Executive"],
        "managementLevel": ["VP", "Head", "Director"],
        "locations": ["United States"],
        "employeeCount": ["201-500", "501-1000", "1001-5000"],
        "industries": ["SaaS", "Fintech", "HealthTech"],
        "createdAt": "2025-01-01T00:00:00Z",
        "active": True
    }
]
next_id = 3


class PersonaCreate(BaseModel):
    name: str
    titles: List[str]
    departments: Optional[List[str]] = None
    managementLevel: Optional[List[str]] = None
    locations: Optional[List[str]] = None
    employeeCount: Optional[List[str]] = None
    industries: Optional[List[str]] = None


@router.get("/api/personas")
async def list_personas():
    """Get all saved personas"""
    return {"personas": personas_db}


@router.post("/api/personas")
async def create_persona(payload: PersonaCreate):
    """Create new persona filter"""
    global next_id
    
    persona = {
        "id": next_id,
        **payload.dict(),
        "createdAt": datetime.utcnow().isoformat(),
        "active": True
    }
    
    personas_db.append(persona)
    next_id += 1
    
    return {"persona": persona}


@router.get("/api/personas/{persona_id}")
async def get_persona(persona_id: int):
    """Get specific persona"""
    persona = next((p for p in personas_db if p['id'] == persona_id), None)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"persona": persona}


@router.put("/api/personas/{persona_id}")
async def update_persona(persona_id: int, payload: PersonaCreate):
    """Update existing persona"""
    persona = next((p for p in personas_db if p['id'] == persona_id), None)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    persona.update(payload.dict())
    persona['updatedAt'] = datetime.utcnow().isoformat()
    
    return {"persona": persona}


@router.delete("/api/personas/{persona_id}")
async def delete_persona(persona_id: int):
    """Delete persona"""
    global personas_db
    personas_db = [p for p in personas_db if p['id'] != persona_id]
    return {"success": True}

