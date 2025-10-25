"""
Template Variable Engine for RoleFerry
Handles template variable substitution, parsing, and validation
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import json


class VariableType(Enum):
    """Types of template variables"""
    PINPOINT = "pinpoint"
    SOLUTION = "solution"
    METRIC = "metric"
    CONTACT = "contact"
    COMPANY = "company"
    PERSONAL = "personal"
    CUSTOM = "custom"


@dataclass
class TemplateVariable:
    """Represents a template variable"""
    name: str
    type: VariableType
    value: str
    confidence: float
    source: str
    description: str
    required: bool = False
    fallback: Optional[str] = None


@dataclass
class TemplateParseResult:
    """Result of template parsing"""
    template: str
    variables: List[TemplateVariable]
    missing_variables: List[str]
    parse_success: bool
    error_message: Optional[str] = None


class TemplateEngine:
    """Engine for handling template variables and substitution"""
    
    def __init__(self):
        self.variable_patterns = {
            # Pinpoint variables
            r'\{\{pinpoint_(\d+)\}\}': VariableType.PINPOINT,
            r'\{\{challenge_(\d+)\}\}': VariableType.PINPOINT,
            r'\{\{pain_point_(\d+)\}\}': VariableType.PINPOINT,
            
            # Solution variables
            r'\{\{solution_(\d+)\}\}': VariableType.SOLUTION,
            r'\{\{approach_(\d+)\}\}': VariableType.SOLUTION,
            r'\{\{method_(\d+)\}\}': VariableType.SOLUTION,
            
            # Metric variables
            r'\{\{metric_(\d+)\}\}': VariableType.METRIC,
            r'\{\{result_(\d+)\}\}': VariableType.METRIC,
            r'\{\{outcome_(\d+)\}\}': VariableType.METRIC,
            
            # Contact variables
            r'\{\{first_name\}\}': VariableType.CONTACT,
            r'\{\{last_name\}\}': VariableType.CONTACT,
            r'\{\{full_name\}\}': VariableType.CONTACT,
            r'\{\{title\}\}': VariableType.CONTACT,
            r'\{\{company\}\}': VariableType.CONTACT,
            r'\{\{email\}\}': VariableType.CONTACT,
            r'\{\{phone\}\}': VariableType.CONTACT,
            r'\{\{linkedin\}\}': VariableType.CONTACT,
            
            # Company variables
            r'\{\{company_name\}\}': VariableType.COMPANY,
            r'\{\{company_size\}\}': VariableType.COMPANY,
            r'\{\{company_industry\}\}': VariableType.COMPANY,
            r'\{\{company_description\}\}': VariableType.COMPANY,
            r'\{\{company_website\}\}': VariableType.COMPANY,
            r'\{\{company_location\}\}': VariableType.COMPANY,
            
            # Personal variables
            r'\{\{my_name\}\}': VariableType.PERSONAL,
            r'\{\{my_title\}\}': VariableType.PERSONAL,
            r'\{\{my_company\}\}': VariableType.PERSONAL,
            r'\{\{my_email\}\}': VariableType.PERSONAL,
            r'\{\{my_phone\}\}': VariableType.PERSONAL,
            r'\{\{my_linkedin\}\}': VariableType.PERSONAL,
            
            # Custom variables
            r'\{\{custom_(\w+)\}\}': VariableType.CUSTOM,
        }
        
        self.variable_descriptions = {
            "pinpoint_1": "Primary pain point or challenge identified",
            "pinpoint_2": "Secondary pain point or challenge identified",
            "pinpoint_3": "Tertiary pain point or challenge identified",
            "solution_1": "Primary solution or approach proposed",
            "solution_2": "Secondary solution or approach proposed",
            "solution_3": "Tertiary solution or approach proposed",
            "metric_1": "Primary metric or result achieved",
            "metric_2": "Secondary metric or result achieved",
            "metric_3": "Tertiary metric or result achieved",
            "first_name": "Contact's first name",
            "last_name": "Contact's last name",
            "full_name": "Contact's full name",
            "title": "Contact's job title",
            "company": "Contact's company name",
            "email": "Contact's email address",
            "phone": "Contact's phone number",
            "linkedin": "Contact's LinkedIn profile",
            "company_name": "Company name",
            "company_size": "Company size (e.g., 50-200 employees)",
            "company_industry": "Company industry",
            "company_description": "Company description",
            "company_website": "Company website URL",
            "company_location": "Company location",
            "my_name": "Your name",
            "my_title": "Your job title",
            "my_company": "Your company name",
            "my_email": "Your email address",
            "my_phone": "Your phone number",
            "my_linkedin": "Your LinkedIn profile"
        }
    
    def parse_template(self, template: str, context: Dict[str, Any]) -> TemplateParseResult:
        """Parse a template and extract variables"""
        variables = []
        missing_variables = []
        parse_success = True
        error_message = None
        
        try:
            # Find all variables in the template
            for pattern, var_type in self.variable_patterns.items():
                matches = re.finditer(pattern, template)
                for match in matches:
                    var_name = match.group(0)
                    var_key = self._extract_variable_key(var_name, pattern)
                    
                    # Get variable value from context
                    value = self._get_variable_value(var_name, var_key, var_type, context)
                    
                    if value is not None:
                        variable = TemplateVariable(
                            name=var_name,
                            type=var_type,
                            value=value,
                            confidence=0.9,  # Default confidence
                            source="context",
                            description=self.variable_descriptions.get(var_key, f"Variable: {var_key}"),
                            required=True
                        )
                        variables.append(variable)
                    else:
                        missing_variables.append(var_name)
            
            # Check for any remaining variables
            remaining_vars = re.findall(r'\{\{([^}]+)\}\}', template)
            for var in remaining_vars:
                if f"{{{{{var}}}}}" not in [v.name for v in variables]:
                    missing_variables.append(f"{{{{{var}}}}}")
        
        except Exception as e:
            parse_success = False
            error_message = str(e)
        
        return TemplateParseResult(
            template=template,
            variables=variables,
            missing_variables=missing_variables,
            parse_success=parse_success,
            error_message=error_message
        )
    
    def _extract_variable_key(self, var_name: str, pattern: str) -> str:
        """Extract the variable key from the variable name"""
        # Remove curly braces
        clean_name = var_name.strip('{}')
        
        # Handle numbered variables
        if re.match(r'pinpoint_\d+', clean_name):
            return clean_name
        elif re.match(r'solution_\d+', clean_name):
            return clean_name
        elif re.match(r'metric_\d+', clean_name):
            return clean_name
        elif re.match(r'challenge_\d+', clean_name):
            return clean_name.replace('challenge_', 'pinpoint_')
        elif re.match(r'pain_point_\d+', clean_name):
            return clean_name.replace('pain_point_', 'pinpoint_')
        elif re.match(r'approach_\d+', clean_name):
            return clean_name.replace('approach_', 'solution_')
        elif re.match(r'method_\d+', clean_name):
            return clean_name.replace('method_', 'solution_')
        elif re.match(r'result_\d+', clean_name):
            return clean_name.replace('result_', 'metric_')
        elif re.match(r'outcome_\d+', clean_name):
            return clean_name.replace('outcome_', 'metric_')
        else:
            return clean_name
    
    def _get_variable_value(self, var_name: str, var_key: str, var_type: VariableType, context: Dict[str, Any]) -> Optional[str]:
        """Get the value for a variable from context"""
        # Direct lookup
        if var_key in context:
            return str(context[var_key])
        
        # Handle numbered variables
        if var_type == VariableType.PINPOINT:
            return self._get_pinpoint_value(var_key, context)
        elif var_type == VariableType.SOLUTION:
            return self._get_solution_value(var_key, context)
        elif var_type == VariableType.METRIC:
            return self._get_metric_value(var_key, context)
        elif var_type == VariableType.CONTACT:
            return self._get_contact_value(var_key, context)
        elif var_type == VariableType.COMPANY:
            return self._get_company_value(var_key, context)
        elif var_type == VariableType.PERSONAL:
            return self._get_personal_value(var_key, context)
        elif var_type == VariableType.CUSTOM:
            return self._get_custom_value(var_key, context)
        
        return None
    
    def _get_pinpoint_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get pinpoint value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from pinpoint matches
        pinpoint_matches = context.get("pinpoint_matches", [])
        if isinstance(pinpoint_matches, list) and len(pinpoint_matches) > 0:
            index = int(var_key.split('_')[1]) - 1 if '_' in var_key else 0
            if 0 <= index < len(pinpoint_matches):
                match = pinpoint_matches[index]
                if isinstance(match, dict):
                    return match.get("pain_point", match.get("challenge", ""))
        
        return None
    
    def _get_solution_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get solution value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from pinpoint matches
        pinpoint_matches = context.get("pinpoint_matches", [])
        if isinstance(pinpoint_matches, list) and len(pinpoint_matches) > 0:
            index = int(var_key.split('_')[1]) - 1 if '_' in var_key else 0
            if 0 <= index < len(pinpoint_matches):
                match = pinpoint_matches[index]
                if isinstance(match, dict):
                    return match.get("solution", match.get("approach", ""))
        
        return None
    
    def _get_metric_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get metric value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from pinpoint matches
        pinpoint_matches = context.get("pinpoint_matches", [])
        if isinstance(pinpoint_matches, list) and len(pinpoint_matches) > 0:
            index = int(var_key.split('_')[1]) - 1 if '_' in var_key else 0
            if 0 <= index < len(pinpoint_matches):
                match = pinpoint_matches[index]
                if isinstance(match, dict):
                    return match.get("metric", match.get("result", ""))
        
        return None
    
    def _get_contact_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get contact value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from contact data
        contact = context.get("contact", {})
        if isinstance(contact, dict):
            if var_key == "first_name":
                return contact.get("first_name", contact.get("name", "").split()[0] if contact.get("name") else "")
            elif var_key == "last_name":
                name_parts = contact.get("name", "").split()
                return name_parts[-1] if len(name_parts) > 1 else ""
            elif var_key == "full_name":
                return contact.get("name", contact.get("full_name", ""))
            elif var_key == "title":
                return contact.get("title", contact.get("job_title", ""))
            elif var_key == "company":
                return contact.get("company", contact.get("company_name", ""))
            elif var_key == "email":
                return contact.get("email", "")
            elif var_key == "phone":
                return contact.get("phone", "")
            elif var_key == "linkedin":
                return contact.get("linkedin", contact.get("linkedin_url", ""))
        
        return None
    
    def _get_company_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get company value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from company data
        company = context.get("company", {})
        if isinstance(company, dict):
            if var_key == "company_name":
                return company.get("name", company.get("company_name", ""))
            elif var_key == "company_size":
                return company.get("size", company.get("company_size", ""))
            elif var_key == "company_industry":
                return company.get("industry", company.get("company_industry", ""))
            elif var_key == "company_description":
                return company.get("description", company.get("company_description", ""))
            elif var_key == "company_website":
                return company.get("website", company.get("company_website", ""))
            elif var_key == "company_location":
                return company.get("location", company.get("company_location", ""))
        
        return None
    
    def _get_personal_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get personal value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from personal data
        personal = context.get("personal", {})
        if isinstance(personal, dict):
            if var_key == "my_name":
                return personal.get("name", personal.get("my_name", ""))
            elif var_key == "my_title":
                return personal.get("title", personal.get("my_title", ""))
            elif var_key == "my_company":
                return personal.get("company", personal.get("my_company", ""))
            elif var_key == "my_email":
                return personal.get("email", personal.get("my_email", ""))
            elif var_key == "my_phone":
                return personal.get("phone", personal.get("my_phone", ""))
            elif var_key == "my_linkedin":
                return personal.get("linkedin", personal.get("my_linkedin", ""))
        
        return None
    
    def _get_custom_value(self, var_key: str, context: Dict[str, Any]) -> Optional[str]:
        """Get custom value from context"""
        if var_key in context:
            return str(context[var_key])
        
        # Try to get from custom variables
        custom_vars = context.get("custom_variables", {})
        if isinstance(custom_vars, dict):
            return custom_vars.get(var_key, "")
        
        return None
    
    def substitute_variables(self, template: str, context: Dict[str, Any]) -> str:
        """Substitute variables in a template with values from context"""
        result = template
        
        # Parse the template to get variables
        parse_result = self.parse_template(template, context)
        
        if not parse_result.parse_success:
            return template
        
        # Substitute variables
        for variable in parse_result.variables:
            result = result.replace(variable.name, variable.value)
        
        # Handle missing variables
        for missing_var in parse_result.missing_variables:
            result = result.replace(missing_var, f"[MISSING: {missing_var}]")
        
        return result
    
    def validate_template(self, template: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a template and return validation results"""
        parse_result = self.parse_template(template, context)
        
        return {
            "valid": parse_result.parse_success and len(parse_result.missing_variables) == 0,
            "variables_found": len(parse_result.variables),
            "missing_variables": parse_result.missing_variables,
            "variables": [
                {
                    "name": var.name,
                    "type": var.type.value,
                    "value": var.value,
                    "confidence": var.confidence,
                    "description": var.description
                }
                for var in parse_result.variables
            ],
            "error_message": parse_result.error_message
        }
    
    def get_available_variables(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get list of available variables based on context"""
        available_vars = []
        
        # Check for pinpoint matches
        pinpoint_matches = context.get("pinpoint_matches", [])
        if isinstance(pinpoint_matches, list):
            for i, match in enumerate(pinpoint_matches, 1):
                if isinstance(match, dict):
                    if match.get("pain_point") or match.get("challenge"):
                        available_vars.append({
                            "name": f"{{{{pinpoint_{i}}}}}",
                            "type": "pinpoint",
                            "description": f"Pinpoint {i}: {match.get('pain_point', match.get('challenge', ''))[:50]}..."
                        })
                    if match.get("solution") or match.get("approach"):
                        available_vars.append({
                            "name": f"{{{{solution_{i}}}}}",
                            "type": "solution",
                            "description": f"Solution {i}: {match.get('solution', match.get('approach', ''))[:50]}..."
                        })
                    if match.get("metric") or match.get("result"):
                        available_vars.append({
                            "name": f"{{{{metric_{i}}}}}",
                            "type": "metric",
                            "description": f"Metric {i}: {match.get('metric', match.get('result', ''))[:50]}..."
                        })
        
        # Check for contact data
        contact = context.get("contact", {})
        if isinstance(contact, dict):
            if contact.get("name"):
                available_vars.append({
                    "name": "{{full_name}}",
                    "type": "contact",
                    "description": f"Contact name: {contact['name']}"
                })
            if contact.get("title"):
                available_vars.append({
                    "name": "{{title}}",
                    "type": "contact",
                    "description": f"Contact title: {contact['title']}"
                })
            if contact.get("company"):
                available_vars.append({
                    "name": "{{company}}",
                    "type": "contact",
                    "description": f"Contact company: {contact['company']}"
                })
        
        # Check for company data
        company = context.get("company", {})
        if isinstance(company, dict):
            if company.get("name"):
                available_vars.append({
                    "name": "{{company_name}}",
                    "type": "company",
                    "description": f"Company name: {company['name']}"
                })
            if company.get("size"):
                available_vars.append({
                    "name": "{{company_size}}",
                    "type": "company",
                    "description": f"Company size: {company['size']}"
                })
        
        return available_vars


# Global instance
template_engine = TemplateEngine()
