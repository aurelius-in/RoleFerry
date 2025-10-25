import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class JargonTerm:
    term: str
    definition: str
    category: str
    position: Tuple[int, int]  # (start, end)

class JargonDetector:
    """
    Detects jargon and acronyms in text and provides plain English definitions.
    """
    
    def __init__(self):
        # Common jargon and acronyms with their definitions
        self.jargon_dictionary = {
            # Business/Corporate
            "KPI": "Key Performance Indicator - measurable values that demonstrate how effectively a company is achieving key business objectives",
            "ROI": "Return on Investment - a performance measure used to evaluate the efficiency of an investment",
            "SLA": "Service Level Agreement - a commitment between a service provider and a client",
            "B2B": "Business to Business - commerce between businesses",
            "B2C": "Business to Consumer - commerce between businesses and individual consumers",
            "SaaS": "Software as a Service - software licensing and delivery model",
            "MVP": "Minimum Viable Product - a product with just enough features to satisfy early customers",
            "POC": "Proof of Concept - evidence that demonstrates that a project or product is feasible",
            "EOD": "End of Day - by the end of the business day",
            "EOW": "End of Week - by the end of the work week",
            "EOM": "End of Month - by the end of the current month",
            "Q1": "First Quarter - January through March",
            "Q2": "Second Quarter - April through June", 
            "Q3": "Third Quarter - July through September",
            "Q4": "Fourth Quarter - October through December",
            "FY": "Fiscal Year - a 12-month period used for financial reporting",
            
            # Technology
            "API": "Application Programming Interface - a set of protocols and tools for building software applications",
            "SDK": "Software Development Kit - a collection of software development tools",
            "UI": "User Interface - the space where interactions between humans and machines occur",
            "UX": "User Experience - a person's emotions and attitudes about using a product",
            "CRUD": "Create, Read, Update, Delete - basic operations of persistent storage",
            "REST": "Representational State Transfer - an architectural style for designing web services",
            "JSON": "JavaScript Object Notation - a lightweight data interchange format",
            "XML": "eXtensible Markup Language - a markup language that defines a set of rules for encoding documents",
            "SQL": "Structured Query Language - a programming language designed for managing data in relational databases",
            "NoSQL": "Not Only SQL - a database management system that provides a mechanism for storage and retrieval of data",
            "HTTP": "HyperText Transfer Protocol - the foundation of data communication for the World Wide Web",
            "HTTPS": "HTTP Secure - a protocol for secure communication over a computer network",
            "SSL": "Secure Sockets Layer - a cryptographic protocol for secure communication",
            "TLS": "Transport Layer Security - a cryptographic protocol for secure communication",
            "DNS": "Domain Name System - a hierarchical naming system for computers, services, or other resources",
            "CDN": "Content Delivery Network - a geographically distributed network of proxy servers",
            "CI/CD": "Continuous Integration/Continuous Deployment - practices for automating the software development lifecycle",
            "DevOps": "Development and Operations - a set of practices that combines software development and IT operations",
            "Agile": "Agile software development - a methodology based on iterative development",
            "Scrum": "A framework for agile software development",
            "Kanban": "A visual workflow management method",
            
            # Recruiting/HR
            "ATS": "Applicant Tracking System - software for recruitment and hiring",
            "HR": "Human Resources - the department responsible for managing employee-related matters",
            "H1B": "H-1B visa - a non-immigrant visa that allows US companies to employ foreign workers",
            "FTE": "Full-Time Equivalent - a unit of measurement for the workload of an employed person",
            "PTO": "Paid Time Off - time that employees can take off from work while still being paid",
            "401k": "401(k) plan - a retirement savings plan sponsored by an employer",
            "ESOP": "Employee Stock Ownership Plan - a qualified defined-contribution employee benefit plan",
            "IPO": "Initial Public Offering - the first time a company's stock is offered to the public",
            "M&A": "Mergers and Acquisitions - the consolidation of companies or assets",
            "LTV": "Lifetime Value - the total revenue a company can expect from a single customer",
            "CAC": "Customer Acquisition Cost - the cost associated with acquiring a new customer",
            "ARPU": "Average Revenue Per User - a measure of the revenue generated per user",
            "MRR": "Monthly Recurring Revenue - the predictable total revenue generated by a business",
            "ARR": "Annual Recurring Revenue - the yearly value of recurring revenue",
            "Churn": "Customer churn - the rate at which customers stop doing business with a company",
            "NPS": "Net Promoter Score - a measure of customer satisfaction and loyalty",
            "CSAT": "Customer Satisfaction Score - a measure of how satisfied customers are with a product or service",
            
            # General Business
            "P&L": "Profit and Loss - a financial statement that summarizes revenues, costs, and expenses",
            "EBITDA": "Earnings Before Interest, Taxes, Depreciation, and Amortization - a measure of a company's operating performance",
            "COGS": "Cost of Goods Sold - the direct costs attributable to the production of goods sold",
            "GMV": "Gross Merchandise Value - the total value of merchandise sold over a given period",
            "ARPU": "Average Revenue Per User - a measure of the revenue generated per user",
            "DAU": "Daily Active Users - the number of unique users who engage with a product in a day",
            "MAU": "Monthly Active Users - the number of unique users who engage with a product in a month",
            "WAU": "Weekly Active Users - the number of unique users who engage with a product in a week",
            "CAC": "Customer Acquisition Cost - the cost associated with acquiring a new customer",
            "LTV": "Lifetime Value - the total revenue a company can expect from a single customer",
            "ARPU": "Average Revenue Per User - a measure of the revenue generated per user",
            "MRR": "Monthly Recurring Revenue - the predictable total revenue generated by a business",
            "ARR": "Annual Recurring Revenue - the yearly value of recurring revenue",
            "Churn": "Customer churn - the rate at which customers stop doing business with a company",
            "NPS": "Net Promoter Score - a measure of customer satisfaction and loyalty",
            "CSAT": "Customer Satisfaction Score - a measure of how satisfied customers are with a product or service",
        }
        
        # Compile regex patterns for efficient matching
        self.patterns = self._compile_patterns()
    
    def _compile_patterns(self) -> List[Tuple[re.Pattern, str]]:
        """Compile regex patterns for jargon detection."""
        patterns = []
        
        # Sort terms by length (longest first) to avoid partial matches
        sorted_terms = sorted(self.jargon_dictionary.keys(), key=len, reverse=True)
        
        for term in sorted_terms:
            # Create word boundary pattern for exact matches
            pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
            patterns.append((pattern, term))
        
        return patterns
    
    def detect_jargon(self, text: str) -> List[JargonTerm]:
        """
        Detect jargon and acronyms in the given text.
        
        Args:
            text: The text to analyze
            
        Returns:
            List of JargonTerm objects with detected terms and their definitions
        """
        detected_terms = []
        seen_positions = set()
        
        for pattern, term in self.patterns:
            for match in pattern.finditer(text):
                start, end = match.span()
                
                # Avoid overlapping matches
                if any(pos <= start < end <= pos_end for pos, pos_end in seen_positions):
                    continue
                
                # Get definition and category
                definition = self.jargon_dictionary[term]
                category = self._categorize_term(term)
                
                jargon_term = JargonTerm(
                    term=term,
                    definition=definition,
                    category=category,
                    position=(start, end)
                )
                
                detected_terms.append(jargon_term)
                seen_positions.add((start, end))
        
        # Sort by position in text
        detected_terms.sort(key=lambda x: x.position[0])
        
        return detected_terms
    
    def _categorize_term(self, term: str) -> str:
        """Categorize a jargon term."""
        if term in ["KPI", "ROI", "SLA", "P&L", "EBITDA", "COGS"]:
            return "Financial"
        elif term in ["API", "SDK", "UI", "UX", "REST", "JSON", "XML", "SQL", "NoSQL", "HTTP", "HTTPS", "SSL", "TLS", "DNS", "CDN", "CI/CD", "DevOps", "Agile", "Scrum", "Kanban"]:
            return "Technology"
        elif term in ["ATS", "HR", "H1B", "FTE", "PTO", "401k", "ESOP"]:
            return "HR/Recruiting"
        elif term in ["B2B", "B2C", "SaaS", "MVP", "POC", "EOD", "EOW", "EOM", "Q1", "Q2", "Q3", "Q4", "FY", "IPO", "M&A"]:
            return "Business"
        else:
            return "General"
    
    def simplify_text(self, text: str, replace_jargon: bool = True) -> Tuple[str, List[JargonTerm]]:
        """
        Simplify text by detecting jargon and optionally replacing it with plain English.
        
        Args:
            text: The text to simplify
            replace_jargon: Whether to replace jargon with plain English explanations
            
        Returns:
            Tuple of (simplified_text, detected_jargon_terms)
        """
        detected_terms = self.detect_jargon(text)
        
        if not replace_jargon:
            return text, detected_terms
        
        # Replace jargon with plain English (keeping original in parentheses)
        simplified_text = text
        offset = 0
        
        for term in detected_terms:
            start, end = term.position
            # Adjust positions for previous replacements
            adjusted_start = start + offset
            adjusted_end = end + offset
            
            # Create replacement text
            replacement = f"{term.term} ({term.definition})"
            
            # Replace in text
            simplified_text = (
                simplified_text[:adjusted_start] + 
                replacement + 
                simplified_text[adjusted_end:]
            )
            
            # Update offset for next replacement
            offset += len(replacement) - (end - start)
        
        return simplified_text, detected_terms
    
    def get_jargon_suggestions(self, text: str) -> List[Dict[str, str]]:
        """
        Get suggestions for simplifying jargon in text.
        
        Args:
            text: The text to analyze
            
        Returns:
            List of dictionaries with jargon suggestions
        """
        detected_terms = self.detect_jargon(text)
        
        suggestions = []
        for term in detected_terms:
            suggestions.append({
                "term": term.term,
                "definition": term.definition,
                "category": term.category,
                "position": term.position,
                "suggestion": f"Consider explaining '{term.term}' as '{term.definition}'"
            })
        
        return suggestions

# Global instance
jargon_detector = JargonDetector()

def detect_jargon_in_text(text: str) -> List[Dict[str, str]]:
    """
    Convenience function to detect jargon in text.
    
    Args:
        text: The text to analyze
        
    Returns:
        List of dictionaries with detected jargon information
    """
    detected_terms = jargon_detector.detect_jargon(text)
    
    return [
        {
            "term": term.term,
            "definition": term.definition,
            "category": term.category,
            "position": term.position
        }
        for term in detected_terms
    ]

def simplify_text_with_jargon(text: str) -> Tuple[str, List[Dict[str, str]]]:
    """
    Convenience function to simplify text with jargon detection.
    
    Args:
        text: The text to simplify
        
    Returns:
        Tuple of (simplified_text, detected_jargon_info)
    """
    simplified_text, detected_terms = jargon_detector.simplify_text(text, replace_jargon=True)
    
    jargon_info = [
        {
            "term": term.term,
            "definition": term.definition,
            "category": term.category,
            "position": term.position
        }
        for term in detected_terms
    ]
    
    return simplified_text, jargon_info
