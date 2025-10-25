"""
Company Size Detection and Tone Adaptation Service for RoleFerry
Handles company size detection and tone adaptation based on company characteristics
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re


class CompanySize(Enum):
    """Company size categories"""
    STARTUP = "startup"           # 1-50 employees
    SMALL = "small"              # 51-200 employees
    MEDIUM = "medium"            # 201-1000 employees
    LARGE = "large"              # 1000+ employees
    ENTERPRISE = "enterprise"    # 5000+ employees


class ToneStyle(Enum):
    """Tone styles for different company sizes"""
    CASUAL = "casual"            # Startup: informal, direct
    PROFESSIONAL = "professional"  # Small/Medium: balanced, respectful
    FORMAL = "formal"            # Large: structured, corporate
    EXECUTIVE = "executive"      # Enterprise: high-level, strategic


@dataclass
class CompanyProfile:
    """Represents a company profile with size and characteristics"""
    name: str
    size: CompanySize
    employee_count: Optional[int] = None
    revenue: Optional[float] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    characteristics: List[str] = None
    confidence: float = 0.0


@dataclass
class ToneAdaptation:
    """Represents tone adaptation for a company"""
    company_size: CompanySize
    tone_style: ToneStyle
    language_level: str
    formality: str
    approach: str
    key_phrases: List[str]
    avoid_phrases: List[str]
    email_structure: str
    subject_line_style: str


class CompanySizeAdaptationService:
    """Service for company size detection and tone adaptation"""
    
    def __init__(self):
        self.size_indicators = {
            "startup": {
                "keywords": ["startup", "early stage", "seed", "series a", "founded", "new company"],
                "employee_ranges": [(1, 50)],
                "revenue_ranges": [(0, 1000000)],
                "characteristics": ["agile", "innovative", "fast-paced", "scrappy", "disruptive"]
            },
            "small": {
                "keywords": ["small business", "local", "regional", "growing"],
                "employee_ranges": [(51, 200)],
                "revenue_ranges": [(1000000, 10000000)],
                "characteristics": ["personal", "community-focused", "entrepreneurial", "flexible"]
            },
            "medium": {
                "keywords": ["mid-market", "established", "regional leader", "expanding"],
                "employee_ranges": [(201, 1000)],
                "revenue_ranges": [(10000000, 100000000)],
                "characteristics": ["professional", "structured", "growth-oriented", "process-driven"]
            },
            "large": {
                "keywords": ["corporation", "enterprise", "fortune", "multinational", "global"],
                "employee_ranges": [(1001, 5000)],
                "revenue_ranges": [(100000000, 1000000000)],
                "characteristics": ["corporate", "structured", "process-oriented", "hierarchical"]
            },
            "enterprise": {
                "keywords": ["fortune 500", "global leader", "multinational", "conglomerate"],
                "employee_ranges": [(5001, float('inf'))],
                "revenue_ranges": [(1000000000, float('inf'))],
                "characteristics": ["enterprise", "global", "complex", "bureaucratic", "strategic"]
            }
        }
        
        self.tone_adaptations = {
            CompanySize.STARTUP: ToneAdaptation(
                company_size=CompanySize.STARTUP,
                tone_style=ToneStyle.CASUAL,
                language_level="informal",
                formality="low",
                approach="direct and personal",
                key_phrases=[
                    "Let's talk", "I'd love to connect", "Quick question",
                    "Excited about", "Passionate about", "Game-changing"
                ],
                avoid_phrases=[
                    "At your earliest convenience", "Please find attached",
                    "I hope this email finds you well", "Per our conversation"
                ],
                email_structure="short and punchy",
                subject_line_style="direct and intriguing"
            ),
            CompanySize.SMALL: ToneAdaptation(
                company_size=CompanySize.SMALL,
                tone_style=ToneStyle.PROFESSIONAL,
                language_level="conversational",
                formality="medium",
                approach="respectful but approachable",
                key_phrases=[
                    "I noticed", "I'm reaching out", "I'd appreciate",
                    "Looking forward to", "Happy to discuss", "Worth exploring"
                ],
                avoid_phrases=[
                    "Urgent", "ASAP", "Critical", "Must have",
                    "I hope this email finds you well"
                ],
                email_structure="balanced and clear",
                subject_line_style="professional but engaging"
            ),
            CompanySize.MEDIUM: ToneAdaptation(
                company_size=CompanySize.MEDIUM,
                tone_style=ToneStyle.PROFESSIONAL,
                language_level="professional",
                formality="medium-high",
                approach="structured and respectful",
                key_phrases=[
                    "I'm writing to", "I would like to", "I believe",
                    "I'm confident", "I'm excited to", "I'm pleased to"
                ],
                avoid_phrases=[
                    "Hey", "What's up", "Cool", "Awesome",
                    "I hope this email finds you well"
                ],
                email_structure="structured and professional",
                subject_line_style="clear and professional"
            ),
            CompanySize.LARGE: ToneAdaptation(
                company_size=CompanySize.LARGE,
                tone_style=ToneStyle.FORMAL,
                language_level="formal",
                formality="high",
                approach="corporate and respectful",
                key_phrases=[
                    "I am writing to", "I would like to", "I believe that",
                    "I am confident that", "I am pleased to", "I am excited to"
                ],
                avoid_phrases=[
                    "Hey", "What's up", "Cool", "Awesome", "Let's talk",
                    "I hope this email finds you well"
                ],
                email_structure="formal and structured",
                subject_line_style="formal and descriptive"
            ),
            CompanySize.ENTERPRISE: ToneAdaptation(
                company_size=CompanySize.ENTERPRISE,
                tone_style=ToneStyle.EXECUTIVE,
                language_level="executive",
                formality="very high",
                approach="strategic and high-level",
                key_phrases=[
                    "I am writing to", "I would like to", "I believe that",
                    "I am confident that", "I am pleased to", "I am excited to",
                    "Strategic", "Executive", "Leadership", "Vision"
                ],
                avoid_phrases=[
                    "Hey", "What's up", "Cool", "Awesome", "Let's talk",
                    "Quick question", "I hope this email finds you well"
                ],
                email_structure="executive and strategic",
                subject_line_style="executive and strategic"
            )
        }
    
    def detect_company_size(self, company_data: Dict[str, Any]) -> CompanyProfile:
        """Detect company size based on available data"""
        name = company_data.get("name", "Unknown Company")
        employee_count = company_data.get("employee_count")
        revenue = company_data.get("revenue")
        industry = company_data.get("industry")
        stage = company_data.get("stage")
        description = company_data.get("description", "")
        
        # Calculate confidence scores for each size category
        size_scores = {}
        
        for size_key, indicators in self.size_indicators.items():
            score = 0.0
            factors = []
            
            # Check employee count
            if employee_count is not None:
                for min_emp, max_emp in indicators["employee_ranges"]:
                    if min_emp <= employee_count <= max_emp:
                        score += 0.4
                        factors.append(f"Employee count: {employee_count}")
                        break
            
            # Check revenue
            if revenue is not None:
                for min_rev, max_rev in indicators["revenue_ranges"]:
                    if min_rev <= revenue <= max_rev:
                        score += 0.3
                        factors.append(f"Revenue: ${revenue:,.0f}")
                        break
            
            # Check keywords in description
            description_lower = description.lower()
            keyword_matches = 0
            for keyword in indicators["keywords"]:
                if keyword in description_lower:
                    keyword_matches += 1
            
            if keyword_matches > 0:
                score += 0.2 * (keyword_matches / len(indicators["keywords"]))
                factors.append(f"Keyword matches: {keyword_matches}")
            
            # Check characteristics
            char_matches = 0
            for char in indicators["characteristics"]:
                if char in description_lower:
                    char_matches += 1
            
            if char_matches > 0:
                score += 0.1 * (char_matches / len(indicators["characteristics"]))
                factors.append(f"Characteristic matches: {char_matches}")
            
            size_scores[size_key] = {
                "score": score,
                "factors": factors
            }
        
        # Find the best match
        best_size = max(size_scores.items(), key=lambda x: x[1]["score"])
        size_enum = CompanySize(best_size[0])
        confidence = best_size[1]["score"]
        
        # Get characteristics
        characteristics = self.size_indicators[best_size[0]]["characteristics"]
        
        return CompanyProfile(
            name=name,
            size=size_enum,
            employee_count=employee_count,
            revenue=revenue,
            industry=industry,
            stage=stage,
            characteristics=characteristics,
            confidence=confidence
        )
    
    def get_tone_adaptation(self, company_size: CompanySize) -> ToneAdaptation:
        """Get tone adaptation for a company size"""
        return self.tone_adaptations.get(company_size, self.tone_adaptations[CompanySize.MEDIUM])
    
    def adapt_email_tone(self, email_content: str, company_profile: CompanyProfile) -> str:
        """Adapt email tone based on company size"""
        adaptation = self.get_tone_adaptation(company_profile.size)
        
        # Apply tone adaptations
        adapted_content = email_content
        
        # Replace casual phrases with appropriate ones
        if company_profile.size in [CompanySize.LARGE, CompanySize.ENTERPRISE]:
            # Make more formal
            adapted_content = adapted_content.replace("Hey", "Hello")
            adapted_content = adapted_content.replace("Hi there", "Hello")
            adapted_content = adapted_content.replace("Let's talk", "I would like to discuss")
            adapted_content = adapted_content.replace("Quick question", "I have a question")
        
        # Add appropriate opening based on company size
        if company_profile.size == CompanySize.STARTUP:
            if not adapted_content.startswith(("Hi", "Hello", "Hey")):
                adapted_content = "Hi " + adapted_content
        elif company_profile.size in [CompanySize.LARGE, CompanySize.ENTERPRISE]:
            if not adapted_content.startswith(("Dear", "Hello")):
                adapted_content = "Hello " + adapted_content
        
        return adapted_content
    
    def generate_subject_line(self, base_subject: str, company_profile: CompanyProfile) -> str:
        """Generate appropriate subject line based on company size"""
        adaptation = self.get_tone_adaptation(company_profile.size)
        
        if company_profile.size == CompanySize.STARTUP:
            # Direct and intriguing
            if not any(word in base_subject.lower() for word in ["quick", "question", "idea"]):
                return f"Quick question about {base_subject}"
        elif company_profile.size in [CompanySize.LARGE, CompanySize.ENTERPRISE]:
            # Formal and descriptive
            if not any(word in base_subject.lower() for word in ["regarding", "concerning", "about"]):
                return f"Regarding {base_subject}"
        
        return base_subject
    
    def get_company_insights(self, company_profile: CompanyProfile) -> Dict[str, Any]:
        """Get insights about the company for personalization"""
        adaptation = self.get_tone_adaptation(company_profile.size)
        
        return {
            "size_category": company_profile.size.value,
            "tone_style": adaptation.tone_style.value,
            "formality_level": adaptation.formality,
            "approach": adaptation.approach,
            "key_phrases": adaptation.key_phrases,
            "avoid_phrases": adaptation.avoid_phrases,
            "email_structure": adaptation.email_structure,
            "subject_line_style": adaptation.subject_line_style,
            "characteristics": company_profile.characteristics,
            "confidence": company_profile.confidence
        }
    
    def batch_detect_company_sizes(self, companies: List[Dict[str, Any]]) -> List[CompanyProfile]:
        """Batch detect company sizes for multiple companies"""
        profiles = []
        for company in companies:
            profile = self.detect_company_size(company)
            profiles.append(profile)
        return profiles
    
    def get_size_recommendations(self, company_profile: CompanyProfile) -> List[str]:
        """Get recommendations for improving company size detection"""
        recommendations = []
        
        if company_profile.confidence < 0.7:
            recommendations.append("Add more company information to improve size detection")
        
        if not company_profile.employee_count:
            recommendations.append("Include employee count for better size classification")
        
        if not company_profile.revenue:
            recommendations.append("Include revenue information for better size classification")
        
        if not company_profile.industry:
            recommendations.append("Include industry information for better size classification")
        
        return recommendations


# Global instance
company_size_adaptation_service = CompanySizeAdaptationService()
