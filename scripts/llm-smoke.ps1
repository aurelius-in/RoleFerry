param(
  [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

function Invoke-Json($method, $url, $body) {
  $headers = @{ }
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $url -Headers $headers
  }
  $json = $body | ConvertTo-Json -Depth 50
  # On Windows PowerShell, sending a .NET string can result in non-UTF8 encoding issues for FastAPI.
  # Force UTF-8 bytes so the backend reliably parses JSON.
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  try {
    return Invoke-RestMethod -Method $method -Uri $url -Headers $headers -ContentType "application/json; charset=utf-8" -Body $bytes
  } catch {
    Write-Host "Request failed: $method $url"
    Write-Host "Request JSON (first 1200 chars):"
    Write-Host ($json.Substring(0, [Math]::Min(1200, $json.Length)))
    throw
  }
}

function Assert-True($cond, $msg) {
  if (-not $cond) { throw $msg }
}

Write-Host "RoleFerry LLM smoke test"
Write-Host "BaseUrl: $BaseUrl"
Write-Host ""

# 1) LLM health probe (strongest signal of real connectivity)
$llm = Invoke-Json "GET" "$BaseUrl/health/llm" $null
Write-Host "health/llm:" ($llm | ConvertTo-Json -Depth 10)
Assert-True ($llm.should_use_real_llm -eq $true) "FAIL: should_use_real_llm is false (backend will stub). Check OPENAI_API_KEY + LLM_MODE=openai."
Assert-True (-not (($llm.probe_preview -as [string]) -match "Stubbed GPT")) "FAIL: probe_preview indicates stubbed output. Check key/network/billing."
Assert-True ($llm.probe_ok -eq $true) "FAIL: probe_ok is false (LLM probe failed)."
Write-Host "PASS: LLM probe indicates real OpenAI connectivity."
Write-Host ""

# 2) Compose generation (should be rewritten + grammatical)
$composeBody = @{
  tone = "manager"
  user_mode = "job-seeker"
  variables = @(
    @{ name="{{first_name}}"; value="Dave"; description="Contact first name" },
    @{ name="{{job_title}}"; value="Engineering Manager"; description="Role title" },
    @{ name="{{company_name}}"; value="Acme"; description="Company" },
    @{ name="{{painpoint_1}}"; value="Reducing time-to-fill for engineering roles"; description="Pain point" },
    @{ name="{{solution_1}}"; value="streamlining screening and calibrating interview scorecards"; description="Solution" },
    @{ name="{{metric_1}}"; value="40% faster (30 → 18 days)"; description="Metric" }
  )
  painpoint_matches = @(
    @{
      painpoint_1 = "Need to reduce time-to-fill for engineering roles"
      solution_1  = "Cut time-to-fill by streamlining screening, tightening role requirements, and running calibrated interviews."
      metric_1    = "40% faster (30 → 18 days)"
      painpoint_2 = "Struggling with candidate quality and cultural fit"
      solution_2  = "Added work samples + structured interviews with consistent rubrics."
      metric_2    = "35% better onsite-to-offer conversion"
      painpoint_3 = "High turnover affecting project delivery"
      solution_3  = "Implemented growth plans and leveling clarity to reduce churn."
      metric_3    = "25% lower turnover"
      alignment_score = 0.85
    }
  )
  context_data = @{
    demo = "llm-smoke"
  }
}

$compose = Invoke-Json "POST" "$BaseUrl/compose/generate" $composeBody
Write-Host "compose/generate: received"
Assert-True ($compose.success -eq $true) "FAIL: compose/generate did not return success=true"
Assert-True ($compose.email_template.subject -and $compose.email_template.body) "FAIL: compose/generate returned empty subject/body"
Assert-True (-not (($compose.email_template.body -as [string]) -match "\{\{.*\}\}")) "FAIL: compose body still contains {{variables}} (not rewritten)."
Write-Host "PASS: Compose generated non-empty copy without raw {{variables}}."
Write-Host ""

# 3) Offer creation (should be GPT-backed when LLM connected)
$offerBody = @{
  painpoint_matches = @(
    @{
      painpoint_1 = "Need to reduce time-to-fill for engineering roles"
      solution_1  = "Cut time-to-fill by streamlining screening, tightening role requirements, and running calibrated interviews."
      metric_1    = "40% faster (30 → 18 days)"
      alignment_score = 0.85
    }
  )
  tone = "manager"
  format = "text"
  user_mode = "job-seeker"
  context_research = @{
    company_summary = "Acme is scaling product engineering teams to accelerate roadmap delivery."
  }
}

$offer = Invoke-Json "POST" "$BaseUrl/offer-creation/create" $offerBody
Write-Host "offer-creation/create: received"
Assert-True ($offer.success -eq $true) "FAIL: offer-creation/create did not return success=true"
Assert-True ($offer.offer.title -and $offer.offer.content) "FAIL: offer-creation/create returned empty offer title/content"
Write-Host "PASS: Offer created."
Write-Host ""

Write-Host "ALL PASS: Backend appears LLM-connected and core generation endpoints are producing usable copy."


