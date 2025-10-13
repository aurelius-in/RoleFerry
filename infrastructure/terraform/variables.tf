# Terraform Variables for RoleFerry Infrastructure

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["production", "staging", "dev"], var.environment)
    error_message = "Environment must be production, staging, or dev"
  }
}

variable "domain_name" {
  description = "Domain name for RoleFerry"
  type        = string
  default     = "roleferry.com"
}

variable "database_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
}

variable "database_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.medium"
}

variable "ecs_api_cpu" {
  description = "CPU units for API tasks (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "ecs_api_memory" {
  description = "Memory for API tasks (MB)"
  type        = number
  default     = 2048
}

variable "ecs_api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "ecs_workers_desired_count" {
  description = "Desired number of worker tasks"
  type        = number
  default     = 5
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Days to retain RDS backups"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}

