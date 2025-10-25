"""
Conditional Logic Service for RoleFerry
Handles missing fields, reports-to inference, and conditional rule logic
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import re


@dataclass
class ConditionalRule:
    """Represents a conditional rule for field inference"""
    field: str
    condition: str
    inference: str
    confidence: float
    source_fields: List[str]


@dataclass
class FieldInference:
    """Represents an inferred field value"""
    field: str
    value: str
    confidence: float
    reasoning: str
    source_fields: List[str]


class ConditionalLogicService:
    """Service for handling conditional logic and field inference"""
    
    def __init__(self):
        self.rules = self._initialize_rules()
    
    def _initialize_rules(self) -> List[ConditionalRule]:
        """Initialize conditional rules for field inference"""
        return [
            # Reports-to inference rules
            ConditionalRule(
                field="reports_to",
                condition="title_contains_manager",
                inference="infer_from_title_hierarchy",
                confidence=0.85,
                source_fields=["title", "department"]
            ),
            ConditionalRule(
                field="reports_to",
                condition="title_contains_director",
                inference="infer_from_title_hierarchy",
                confidence=0.90,
                source_fields=["title", "department"]
            ),
            ConditionalRule(
                field="reports_to",
                condition="title_contains_vp",
                inference="infer_from_title_hierarchy",
                confidence=0.95,
                source_fields=["title", "department"]
            ),
            ConditionalRule(
                field="reports_to",
                condition="title_contains_ceo",
                inference="infer_from_title_hierarchy",
                confidence=0.98,
                source_fields=["title", "department"]
            ),
            
            # Company size inference rules
            ConditionalRule(
                field="company_size",
                condition="employee_count_available",
                inference="infer_from_employee_count",
                confidence=0.95,
                source_fields=["employee_count"]
            ),
            ConditionalRule(
                field="company_size",
                condition="revenue_available",
                inference="infer_from_revenue",
                confidence=0.80,
                source_fields=["revenue"]
            ),
            
            # Industry inference rules
            ConditionalRule(
                field="industry",
                condition="company_description_available",
                inference="infer_from_description",
                confidence=0.75,
                source_fields=["company_description", "products"]
            ),
            
            # Location inference rules
            ConditionalRule(
                field="location",
                condition="office_address_available",
                inference="infer_from_address",
                confidence=0.90,
                source_fields=["office_address", "headquarters"]
            ),
            
            # Experience level inference rules
            ConditionalRule(
                field="experience_level",
                condition="years_experience_available",
                inference="infer_from_years",
                confidence=0.85,
                source_fields=["years_experience", "positions"]
            ),
            
            # Salary range inference rules
            ConditionalRule(
                field="salary_range",
                condition="current_salary_available",
                inference="infer_from_current_salary",
                confidence=0.80,
                source_fields=["current_salary", "experience_level"]
            )
        ]
    
    def infer_missing_fields(self, data: Dict[str, Any]) -> List[FieldInference]:
        """Infer missing fields based on available data"""
        inferences = []
        
        for rule in self.rules:
            if self._evaluate_condition(rule.condition, data):
                inference = self._apply_inference(rule, data)
                if inference:
                    inferences.append(inference)
        
        return inferences
    
    def _evaluate_condition(self, condition: str, data: Dict[str, Any]) -> bool:
        """Evaluate a condition against the data"""
        if condition == "title_contains_manager":
            title = data.get("title", "").lower()
            return "manager" in title or "lead" in title
        
        elif condition == "title_contains_director":
            title = data.get("title", "").lower()
            return "director" in title
        
        elif condition == "title_contains_vp":
            title = data.get("title", "").lower()
            return "vp" in title or "vice president" in title
        
        elif condition == "title_contains_ceo":
            title = data.get("title", "").lower()
            return "ceo" in title or "chief executive" in title
        
        elif condition == "employee_count_available":
            return "employee_count" in data and data["employee_count"] is not None
        
        elif condition == "revenue_available":
            return "revenue" in data and data["revenue"] is not None
        
        elif condition == "company_description_available":
            return "company_description" in data and data["company_description"] is not None
        
        elif condition == "office_address_available":
            return "office_address" in data and data["office_address"] is not None
        
        elif condition == "years_experience_available":
            return "years_experience" in data and data["years_experience"] is not None
        
        elif condition == "current_salary_available":
            return "current_salary" in data and data["current_salary"] is not None
        
        return False
    
    def _apply_inference(self, rule: ConditionalRule, data: Dict[str, Any]) -> Optional[FieldInference]:
        """Apply an inference rule to generate a field value"""
        if rule.inference == "infer_from_title_hierarchy":
            return self._infer_reports_to_from_title(data, rule)
        
        elif rule.inference == "infer_from_employee_count":
            return self._infer_company_size_from_employees(data, rule)
        
        elif rule.inference == "infer_from_revenue":
            return self._infer_company_size_from_revenue(data, rule)
        
        elif rule.inference == "infer_from_description":
            return self._infer_industry_from_description(data, rule)
        
        elif rule.inference == "infer_from_address":
            return self._infer_location_from_address(data, rule)
        
        elif rule.inference == "infer_from_years":
            return self._infer_experience_level_from_years(data, rule)
        
        elif rule.inference == "infer_from_current_salary":
            return self._infer_salary_range_from_current(data, rule)
        
        return None
    
    def _infer_reports_to_from_title(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer reports-to from title hierarchy"""
        title = data.get("title", "").lower()
        department = data.get("department", "")
        
        if "ceo" in title or "chief executive" in title:
            reports_to = "Board of Directors"
        elif "vp" in title or "vice president" in title:
            reports_to = "CEO"
        elif "director" in title:
            reports_to = "VP" if department else "Senior Management"
        elif "manager" in title or "lead" in title:
            reports_to = "Director" if department else "Management"
        else:
            reports_to = "Manager"
        
        reasoning = f"Inferred from title '{title}' and department '{department}'"
        
        return FieldInference(
            field="reports_to",
            value=reports_to,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_company_size_from_employees(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer company size from employee count"""
        employee_count = data.get("employee_count", 0)
        
        if employee_count <= 50:
            size = "Startup (1-50 employees)"
        elif employee_count <= 200:
            size = "Small (51-200 employees)"
        elif employee_count <= 1000:
            size = "Medium (201-1000 employees)"
        else:
            size = "Large (1000+ employees)"
        
        reasoning = f"Inferred from employee count: {employee_count}"
        
        return FieldInference(
            field="company_size",
            value=size,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_company_size_from_revenue(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer company size from revenue"""
        revenue = data.get("revenue", 0)
        
        if revenue < 1000000:  # < $1M
            size = "Startup (1-50 employees)"
        elif revenue < 10000000:  # < $10M
            size = "Small (51-200 employees)"
        elif revenue < 100000000:  # < $100M
            size = "Medium (201-1000 employees)"
        else:
            size = "Large (1000+ employees)"
        
        reasoning = f"Inferred from revenue: ${revenue:,}"
        
        return FieldInference(
            field="company_size",
            value=size,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_industry_from_description(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer industry from company description"""
        description = data.get("company_description", "").lower()
        products = data.get("products", "").lower()
        
        # Simple keyword matching for industry inference
        if any(word in description for word in ["software", "technology", "saas", "platform"]):
            industry = "Software & Technology"
        elif any(word in description for word in ["finance", "banking", "fintech", "payment"]):
            industry = "Finance & Banking"
        elif any(word in description for word in ["healthcare", "medical", "pharmaceutical", "health"]):
            industry = "Healthcare & Medical"
        elif any(word in description for word in ["retail", "ecommerce", "shopping", "consumer"]):
            industry = "Retail & E-commerce"
        elif any(word in description for word in ["manufacturing", "production", "industrial"]):
            industry = "Manufacturing"
        else:
            industry = "Other"
        
        reasoning = f"Inferred from company description and products"
        
        return FieldInference(
            field="industry",
            value=industry,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_location_from_address(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer location from office address"""
        address = data.get("office_address", "")
        headquarters = data.get("headquarters", "")
        
        # Simple extraction of city from address
        location = address if address else headquarters
        
        reasoning = f"Inferred from address: {location}"
        
        return FieldInference(
            field="location",
            value=location,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_experience_level_from_years(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer experience level from years of experience"""
        years = data.get("years_experience", 0)
        
        if years <= 2:
            level = "Entry Level (0-2 years)"
        elif years <= 5:
            level = "Mid Level (3-5 years)"
        elif years <= 10:
            level = "Senior Level (6-10 years)"
        else:
            level = "Executive Level (10+ years)"
        
        reasoning = f"Inferred from {years} years of experience"
        
        return FieldInference(
            field="experience_level",
            value=level,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def _infer_salary_range_from_current(self, data: Dict[str, Any], rule: ConditionalRule) -> FieldInference:
        """Infer salary range from current salary"""
        current_salary = data.get("current_salary", 0)
        experience_level = data.get("experience_level", "")
        
        # Adjust salary based on experience level
        if "entry" in experience_level.lower():
            multiplier = 0.8
        elif "mid" in experience_level.lower():
            multiplier = 1.0
        elif "senior" in experience_level.lower():
            multiplier = 1.2
        else:
            multiplier = 1.5
        
        target_salary = current_salary * multiplier
        
        if target_salary < 75000:
            range_str = "$50,000 - $75,000"
        elif target_salary < 100000:
            range_str = "$75,000 - $100,000"
        elif target_salary < 150000:
            range_str = "$100,000 - $150,000"
        else:
            range_str = "$150,000+"
        
        reasoning = f"Inferred from current salary ${current_salary:,} and experience level"
        
        return FieldInference(
            field="salary_range",
            value=range_str,
            confidence=rule.confidence,
            reasoning=reasoning,
            source_fields=rule.source_fields
        )
    
    def validate_inferences(self, inferences: List[FieldInference]) -> List[FieldInference]:
        """Validate and filter inferences based on confidence thresholds"""
        validated = []
        
        for inference in inferences:
            # Only include high-confidence inferences
            if inference.confidence >= 0.75:
                validated.append(inference)
        
        return validated
    
    def get_missing_fields(self, data: Dict[str, Any], required_fields: List[str]) -> List[str]:
        """Get list of missing required fields"""
        missing = []
        
        for field in required_fields:
            if field not in data or data[field] is None or data[field] == "":
                missing.append(field)
        
        return missing
    
    def suggest_field_values(self, data: Dict[str, Any], missing_fields: List[str]) -> Dict[str, List[FieldInference]]:
        """Suggest values for missing fields"""
        suggestions = {}
        
        # Get all inferences
        all_inferences = self.infer_missing_fields(data)
        validated_inferences = self.validate_inferences(all_inferences)
        
        # Group by field
        for inference in validated_inferences:
            if inference.field in missing_fields:
                if inference.field not in suggestions:
                    suggestions[inference.field] = []
                suggestions[inference.field].append(inference)
        
        return suggestions


# Global instance
conditional_logic_service = ConditionalLogicService()
