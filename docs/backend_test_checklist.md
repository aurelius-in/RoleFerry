# RoleFerry Backend Testing Checklist

## Introduction

### What This Checklist Is For

This checklist helps you test every backend feature in RoleFerry to make sure everything works correctly. Think of it like a quality control checklist for a factory - we want to verify each part works before we ship the product to users.

### How to Use This Checklist

1. **Start with Priority 0 (P0) features** - These are the most important features that must work for the app to function
2. **Test each feature** using the step-by-step instructions
3. **Mark as complete** when a feature passes all tests
4. **Fix issues** using the troubleshooting section before moving on
5. **Move to next priority** only after P0 is fully working

### Testing Basics Explained Simply

**What is "testing"?** Testing means trying to use a feature and making sure it does what it's supposed to do. For example, if you click "Save Job Preferences," it should actually save your preferences.

**How do we test?** We can test in three ways:
- **Through the website** - Use the actual RoleFerry website and see if features work
- **Using Postman** - A tool that lets us test the backend directly (like testing the engine of a car without the body)
- **Using curl commands** - Typing commands in a terminal to test features (more technical)

**What does "backend" mean?** The backend is like the kitchen in a restaurant - you don't see it, but it's where all the work happens. When you click a button on the website, the backend processes your request and sends back the result.

---

## Testing Tools

### How to Check if Backend is Running

**Method 1: Browser Test**
1. Open your web browser
2. Go to: `http://localhost:8000/docs`
3. If you see a page with API documentation, the backend is running
4. If you see an error or nothing loads, the backend is not running

**Method 2: Health Check**
1. Open your browser
2. Go to: `http://localhost:8000/health`
3. You should see: `{"status":"ok"}`
4. If you see an error, the backend is not running

**Method 3: Terminal/Command Prompt**
1. Open PowerShell (Windows) or Terminal (Mac/Linux)
2. Type: `curl http://localhost:8000/health`
3. You should see: `{"status":"ok"}`
4. If you see "connection refused" or an error, the backend is not running

### How to Start the Backend

1. Open PowerShell or Terminal
2. Navigate to the backend folder: `cd backend`
3. Activate virtual environment:
   - Windows: `.venv\Scripts\Activate.ps1`
   - Mac/Linux: `source .venv/bin/activate`
4. Start the server: `uvicorn app.main:app --reload --port 8000`
5. You should see: `Uvicorn running on http://127.0.0.1:8000`

### How to View Logs/Errors

**In Terminal:**
- When you start the backend, all errors and logs appear in the terminal window
- Look for red text or "ERROR" messages
- Copy the error message to troubleshoot

**In Browser (API Docs):**
1. Go to `http://localhost:8000/docs`
2. Click "Try it out" on any endpoint
3. Click "Execute"
4. Look at the "Response" section for errors

### Using Postman to Test

**What is Postman?** Postman is a free tool that lets you test APIs without using the website.

**How to Install:**
1. Go to https://www.postman.com/downloads/
2. Download and install Postman
3. Open Postman

**How to Test an Endpoint:**
1. Click "New" → "HTTP Request"
2. Select method (GET, POST, etc.)
3. Enter URL: `http://localhost:8000/job-preferences/save`
4. For POST requests, go to "Body" tab, select "raw" and "JSON"
5. Enter your test data
6. Click "Send"
7. Check the response at the bottom

### Using curl Commands (Advanced)

**What is curl?** curl is a command-line tool for making requests to APIs.

**Basic GET Request:**
```bash
curl http://localhost:8000/job-preferences/user123
```

**Basic POST Request:**
```bash
curl -X POST http://localhost:8000/job-preferences/save \
  -H "Content-Type: application/json" \
  -d '{"values":["Work-life balance"],"role_categories":["Technical & Engineering"]}'
```

---

## FREE Backend Features

### Priority 0 (P0) - Core Features (Must Work)

These are the essential features that make RoleFerry work. Test these first!

---

#### 1. Job Preferences

**What it does:** Saves and retrieves your job search preferences (what kind of job you want, where, salary, etc.)

**How to Connect:** No connection needed - this is built into RoleFerry

**Cost:** FREE - No cost to use

**Test 1: Save Job Preferences**
1. **Using Website:**
   - Go to Job Preferences page
   - Fill out the form (select values, industries, skills, etc.)
   - Click "Save Preferences"
   - You should see a success message

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/job-preferences/save`
   - Body (JSON):
   ```json
   {
     "values": ["Work-life balance", "Impactful work"],
     "role_categories": ["Technical & Engineering"],
     "location_preferences": ["Remote", "Hybrid"],
     "work_type": ["Full-Time"],
     "role_type": ["Individual Contributor"],
     "company_size": ["51-200 employees"],
     "industries": ["Enterprise Software"],
     "skills": ["Python", "JavaScript"],
     "minimum_salary": "$80,000",
     "job_search_status": "Actively looking",
     "state": "California",
     "user_mode": "job-seeker"
   }
   ```
   - Expected Response: `{"success": true, "message": "Job preferences saved successfully"}`

3. **Using curl:**
   ```bash
   curl -X POST http://localhost:8000/job-preferences/save \
     -H "Content-Type: application/json" \
     -d '{"values":["Work-life balance"],"role_categories":["Technical & Engineering"],"location_preferences":["Remote"],"work_type":["Full-Time"],"role_type":["Individual Contributor"],"company_size":["51-200 employees"],"industries":["Enterprise Software"],"skills":["Python"],"minimum_salary":"$80,000","job_search_status":"Actively looking","user_mode":"job-seeker"}'
   ```

**Test 2: Get Job Preferences**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/job-preferences/user123`
   - Expected Response: Returns saved preferences or mock data

2. **Using curl:**
   ```bash
   curl http://localhost:8000/job-preferences/user123
   ```

**Test 3: Get Options (Values, Industries, Skills)**
1. **Using Browser:**
   - Go to: `http://localhost:8000/job-preferences/options/values`
   - Should see list of available work values

2. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/job-preferences/options/industries`
   - Expected Response: List of industries

**Troubleshooting:**
- **Error: "Connection refused"** → Backend is not running. Start it using instructions above.
- **Error: "422 Unprocessable Entity"** → Your JSON data is missing required fields. Check that all required fields are included.
- **Error: "500 Internal Server Error"** → Check backend logs in terminal for specific error message.
- **No response** → Check that backend is running on port 8000.

**Expected Results:**
- Saving preferences should return `{"success": true}`
- Getting preferences should return your saved data
- Options endpoints should return lists of available choices

---

#### 2. Resume Upload and Parsing

**What it does:** Uploads your resume file (PDF or DOCX) and extracts information like your work experience, skills, and accomplishments using AI.

**How to Connect:** No external connection needed - uses built-in parsing

**Cost:** FREE - No cost to use

**Test 1: Upload Resume File**
1. **Using Website:**
   - Go to Your Profile page
   - Click "Upload Resume" or drag and drop a PDF/DOCX file
   - Click "Parse Resume with AI"
   - Wait for processing (should take a few seconds)
   - You should see extracted information displayed

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/resume/upload`
   - Go to "Body" tab
   - Select "form-data"
   - Key: `file` (change type to "File")
   - Click "Select Files" and choose a PDF or DOCX resume
   - Click "Send"
   - Expected Response: 
   ```json
   {
     "success": true,
     "message": "Resume parsed successfully",
     "extract": {
       "positions": [...],
       "skills": [...],
       "accomplishments": [...]
     }
   }
   ```

3. **Using curl:**
   ```bash
   curl -X POST http://localhost:8000/resume/upload \
     -F "file=@/path/to/your/resume.pdf"
   ```

**Test 2: Save Resume Extract**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/resume/save`
   - Body (JSON) - Use the extract data from Test 1:
   ```json
   {
     "positions": [{"company": "TechCorp", "title": "Engineer", ...}],
     "skills": ["Python", "JavaScript"],
     "accomplishments": ["Reduced latency by 40%"]
   }
   ```
   - Expected Response: `{"success": true, "message": "Resume extract saved successfully"}`

**Test 3: Get Resume Extract**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/resume/user123`
   - Expected Response: Returns saved resume data

**Troubleshooting:**
- **Error: "Only PDF and DOCX files are supported"** → Make sure your file is a PDF or DOCX format
- **Error: "File too large"** → Try a smaller file (under 10MB recommended)
- **Error: "Failed to parse resume"** → Check backend logs. The file might be corrupted or in an unsupported format.
- **No data extracted** → In mock mode, it returns sample data. Real AI parsing will be added later.

**Expected Results:**
- Upload should accept PDF/DOCX files
- Parsing should extract: positions, skills, accomplishments, metrics
- Save should store the extracted data
- Get should retrieve saved data

---

#### 3. Job Descriptions

**What it does:** Imports job descriptions from URLs or text, then analyzes them to find pain points, required skills, and success metrics.

**How to Connect:** No external connection needed

**Cost:** FREE - No cost to use

**Test 1: Import Job Description from URL**
1. **Using Website:**
   - Go to Job Descriptions page
   - Paste a job posting URL (e.g., LinkedIn job URL)
   - Click "Import"
   - Should see parsed job description with pain points and skills

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/job-descriptions/import?url=https://linkedin.com/jobs/view/123456`
   - Expected Response:
   ```json
   {
     "success": true,
     "message": "Job description parsed successfully",
     "job_description": {
       "title": "Senior Software Engineer",
       "company": "TechCorp Inc.",
       "pain_points": [...],
       "required_skills": [...]
     }
   }
   ```

**Test 2: Import Job Description from Text**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/job-descriptions/import`
   - Body (JSON):
   ```json
   {
     "text": "We are looking for a Senior Software Engineer with Python experience. Must have 5+ years experience. Company is growing rapidly and needs someone to help scale our infrastructure."
   }
   ```
   - Expected Response: Parsed job description with extracted information

**Test 3: Save Job Description**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/job-descriptions/save`
   - Body (JSON) - Use the job_description from Test 1 or 2
   - Expected Response: `{"success": true, "message": "Job description saved successfully"}`

**Test 4: Get All Job Descriptions**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/job-descriptions/user123`
   - Expected Response: List of all saved job descriptions

**Troubleshooting:**
- **Error: "Either URL or text must be provided"** → Make sure you provide either a URL or text content
- **Error: "Failed to parse job description"** → The URL might be invalid or the content might not be accessible. Try using the text option instead.
- **No pain points extracted** → In mock mode, it returns sample pain points. Real AI analysis will be added later.

**Expected Results:**
- Should accept both URL and text input
- Should extract: title, company, pain points, required skills, success metrics
- Should save and retrieve job descriptions

---

#### 4. Pain Point Match

**What it does:** Compares your resume to a job description and finds where your experience solves their problems. Gives you an alignment score (like a compatibility rating).

**How to Connect:** No external connection needed

**Cost:** FREE - No cost to use

**Test 1: Generate Pain Point Matches**
1. **Using Website:**
   - Complete Job Descriptions and Your Profile steps first
   - Go to Pain Point Match page
   - Should see matches between job pain points and your solutions
   - Should see an alignment score (0-100%)

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/pinpoint-match/generate`
   - Body (JSON):
   ```json
   {
     "job_description_id": "jd_123",
     "resume_extract_id": "resume_456"
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "message": "Pinpoint matches generated successfully",
     "matches": [{
       "pinpoint_1": "Need to reduce time-to-fill",
       "solution_1": "Reduced TTF by 40%",
       "metric_1": "40% reduction",
       "alignment_score": 0.85
     }]
   }
   ```

**Test 2: Get Alignment Score**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/pinpoint-match/user123/score`
   - Expected Response:
   ```json
   {
     "success": true,
     "alignment_score": 0.85,
     "score_label": "Excellent Match"
   }
   ```

**Test 3: Save Matches**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/pinpoint-match/save`
   - Body (JSON) - Use matches from Test 1
   - Expected Response: `{"success": true, "message": "Pinpoint matches saved successfully"}`

**Troubleshooting:**
- **Error: "Job description or resume not found"** → Make sure you've saved a job description and resume first
- **Low alignment score** → This is normal if your experience doesn't match the job requirements. The score helps you see how well you fit.
- **No matches found** → Check that both job description and resume have been uploaded and saved.

**Expected Results:**
- Should generate 3 pain point matches (pain point → your solution → metric)
- Should calculate alignment score (0.0 to 1.0, where 1.0 is perfect match)
- Should save and retrieve matches

---

#### 5. Basic Analytics

**What it does:** Shows you statistics about your job search activity - how many applications, reply rates, meetings booked, etc.

**How to Connect:** No external connection needed

**Cost:** FREE - No cost to use

**Test 1: Get Campaign Analytics**
1. **Using Website:**
   - Go to Analytics page
   - Should see cards showing: Reply Rate, Meetings Booked, Opportunities Created, Pipeline Value

2. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/analytics/campaign`
   - Expected Response:
   ```json
   {
     "overall_reply_rate": 15.2,
     "meetings_booked": 8,
     "opportunities_created": 12,
     "pipeline_value": 120000
   }
   ```

**Test 2: Get CSV Export**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/analytics/csv`
   - Expected Response: CSV file download

**Test 3: Get Time Series Data**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/analytics/timeseries`
   - Expected Response: Data showing metrics over time

**Troubleshooting:**
- **No data showing** → In early testing, you might see mock/placeholder data. Real data appears after you've sent campaigns.
- **Numbers seem wrong** → Check that campaigns have been launched and emails have been sent.

**Expected Results:**
- Should display key metrics (reply rate, meetings, opportunities, pipeline value)
- Should allow CSV export
- Should show trends over time

---

### Priority 1 (P1) - Important Features

These features make RoleFerry more powerful but aren't required for basic functionality.

---

#### 6. Context Research (Basic)

**What it does:** Gathers information about companies and contacts to help you personalize your outreach. Gets company info, contact bios, recent news, etc.

**How to Connect:** No external connection needed for basic version (uses mock data)

**Cost:** FREE for basic version - Uses built-in data

**Test 1: Conduct Research**
1. **Using Website:**
   - Go to Context Research page
   - Enter company name and contact IDs
   - Click "Research"
   - Should see company summary, contact bios, recent news

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/context-research/research`
   - Body (JSON):
   ```json
   {
     "company_name": "TechCorp Inc.",
     "contact_ids": ["contact_1", "contact_2"]
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "research_data": {
       "company_summary": {...},
       "contact_bios": [...],
       "recent_news": [...]
     }
   }
   ```

**Test 2: Get Research Variables**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/context-research/variables/user123`
   - Expected Response: List of variables that can be used in emails

**Troubleshooting:**
- **Limited information** → Basic version uses mock data. For real data, you'll need paid services (see Paid Features section).
- **No recent news** → Mock mode may not return news. Real integration will fetch actual news.

**Expected Results:**
- Should return company information
- Should return contact biographies
- Should return recent news (if available)
- Should provide variables for email templates

---

#### 7. Offer Creation

**What it does:** Creates personalized value propositions (your pitch) based on pain point matches. Adapts the tone for different audiences (recruiter, manager, executive).

**How to Connect:** No external connection needed

**Cost:** FREE - No cost to use

**Test 1: Create Offer**
1. **Using Website:**
   - Complete Pain Point Match step first
   - Go to Offer Creation page
   - Select tone (Recruiter, Manager, or Exec)
   - Click "Generate Offer"
   - Should see personalized offer/pitch

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/offer-creation/create`
   - Body (JSON):
   ```json
   {
     "pinpoint_matches": [{
       "pinpoint_1": "Need to reduce time-to-fill",
       "solution_1": "Reduced TTF by 40%",
       "metric_1": "40% reduction"
     }],
     "tone": "manager",
     "format": "text",
     "user_mode": "job-seeker"
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "offer": {
       "title": "How I Can Solve Your Challenge",
       "content": "I understand you're facing...",
       "tone": "manager"
     }
   }
   ```

**Test 2: Get Available Tones**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/offer-creation/tones/descriptions`
   - Expected Response: List of available tones and their descriptions

**Test 3: Save Offer**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/offer-creation/save`
   - Body (JSON) - Use offer from Test 1
   - Expected Response: `{"success": true, "message": "Offer saved successfully"}`

**Troubleshooting:**
- **Error: "Pinpoint matches are required"** → Complete the Pain Point Match step first
- **Offer seems generic** → Make sure you have good pain point matches. Better matches = better offers.
- **Wrong tone** → Check that you selected the correct tone. Each tone (recruiter/manager/exec) has different style.

**Expected Results:**
- Should generate personalized offers based on pain point matches
- Should adapt tone for different audiences
- Should save and retrieve offers
- Should provide multiple format options (text, link, video)

---

#### 8. Compose Email

**What it does:** Takes your offer and research data, then generates a complete personalized email with all variables filled in. Also detects jargon (technical terms) and explains them.

**How to Connect:** No external connection needed

**Cost:** FREE - No cost to use

**Test 1: Generate Email**
1. **Using Website:**
   - Complete Offer Creation step
   - Go to Compose page
   - Select tone
   - Click "Generate Email"
   - Should see complete email with variables filled in
   - Should see jargon terms highlighted with explanations

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/compose/generate`
   - Body (JSON):
   ```json
   {
     "tone": "manager",
     "user_mode": "job-seeker",
     "variables": [
       {"name": "{{first_name}}", "value": "Sarah", "description": "Contact's first name"},
       {"name": "{{company_name}}", "value": "TechCorp", "description": "Company name"}
     ],
     "pinpoint_matches": [...],
     "context_data": {
       "company_summary": "...",
       "recent_news": "..."
     }
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "email_template": {
       "subject": "Quick advice on Senior Engineer role at TechCorp?",
       "body": "Hi Sarah,\n\nI spotted the...",
       "jargon_terms": [...]
     }
   }
   ```

**Test 2: Detect Jargon**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/compose/detect-jargon`
   - Body (JSON):
   ```json
   {
     "text": "We need to optimize our CAC and improve our P&L metrics."
   }
   ```
   - Expected Response: List of jargon terms with explanations (CAC = Customer Acquisition Cost, etc.)

**Test 3: Get Available Variables**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/compose/variables/available`
   - Expected Response: List of all available email variables

**Troubleshooting:**
- **Variables not filled in** → Make sure you provided all required variables in the request
- **Email seems generic** → Check that you have good context research and pain point matches
- **Jargon not detected** → Some terms might not be in the jargon database. You can manually add explanations.

**Expected Results:**
- Should generate complete email with subject and body
- Should substitute all variables ({{first_name}}, {{company_name}}, etc.)
- Should detect and explain jargon terms
- Should adapt tone based on selection

---

#### 9. Campaign Management

**What it does:** Creates email sequences (multiple follow-up emails) and manages your outreach campaigns. Tracks which emails to send and when.

**How to Connect:** No external connection needed for basic management

**Cost:** FREE for campaign management - Email sending costs money (see Paid Features)

**Test 1: Create Campaign**
1. **Using Website:**
   - Complete Compose step
   - Go to Campaign page
   - Should see generated email sequence (initial email + follow-ups)
   - Can edit timing and content

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/campaign/push`
   - Body (JSON):
   ```json
   {
     "campaign_name": "TechCorp Outreach",
     "emails": [...],
     "contacts": [...]
   }
   ```
   - Expected Response: Campaign created confirmation

**Test 2: Get Campaigns**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/campaign/campaigns`
   - Expected Response: List of all campaigns

**Test 3: Export Campaign**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/campaign/export`
   - Body (JSON) - Campaign data
   - Expected Response: Export confirmation

**Troubleshooting:**
- **No emails in sequence** → Make sure you completed the Compose step first
- **Can't edit timing** → Check that the campaign hasn't been launched yet. You can only edit before launch.

**Expected Results:**
- Should create email sequences (3-5 emails typically)
- Should allow editing of content and timing
- Should track campaign status
- Should export campaign data

---

### Priority 2 (P2) - Nice-to-Have Features

These features enhance the experience but aren't critical for basic functionality.

---

#### 10. Template Engine

**What it does:** Manages email templates and variable substitution. Helps organize your email templates.

**How to Connect:** No connection needed

**Cost:** FREE - No cost to use

**Test 1: Parse Template**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/template-engine/parse`
   - Body (JSON):
   ```json
   {
     "template": "Hi {{first_name}}, I saw the {{job_title}} role at {{company_name}}."
   }
   ```
   - Expected Response: List of variables found in template

**Test 2: Substitute Variables**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/template-engine/substitute`
   - Body (JSON):
   ```json
   {
     "template": "Hi {{first_name}}...",
     "variables": {
       "first_name": "Sarah",
       "job_title": "Engineer",
       "company_name": "TechCorp"
     }
   }
   ```
   - Expected Response: Template with variables filled in

**Troubleshooting:**
- **Variables not found** → Make sure variables use {{variable_name}} format with double curly braces
- **Substitution failed** → Check that all variables in template are provided in the variables object

**Expected Results:**
- Should identify variables in templates
- Should substitute variables with actual values
- Should validate template syntax

---

#### 11. Error Handling

**What it does:** Validates data and handles errors gracefully. Makes sure bad data doesn't break the app.

**How to Connect:** No connection needed

**Cost:** FREE - No cost to use

**Test 1: Validate Email**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/error-handling/validate-email`
   - Body (JSON):
   ```json
   {
     "email": "test@example.com"
   }
   ```
   - Expected Response: Validation result (valid/invalid)

**Test 2: Validate Job Preferences**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/error-handling/validate-job-preferences`
   - Body (JSON) - Job preferences data
   - Expected Response: Validation result

**Troubleshooting:**
- **Validation always fails** → Check the data format matches what's expected
- **No error messages** → Check backend logs for detailed error information

**Expected Results:**
- Should validate email addresses
- Should validate form data
- Should return clear error messages
- Should prevent invalid data from being saved

---

#### 12. Documentation Endpoints

**What it does:** Provides API documentation and workflow information programmatically.

**How to Connect:** No connection needed

**Cost:** FREE - No cost to use

**Test 1: Get API Reference**
1. **Using Browser:**
   - Go to: `http://localhost:8000/docs/api-reference`
   - Should see API documentation

2. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/docs/api-reference`
   - Expected Response: Complete API reference

**Test 2: Get Workflow Documentation**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/docs/workflow-documentation`
   - Expected Response: Workflow step descriptions

**Expected Results:**
- Should return API documentation
- Should return workflow information
- Should be accessible without authentication

---

## PAID Backend Features

### Priority 0 (P0) - Core Paid Features (Must Work)

These features require paid external services but are essential for RoleFerry to work properly.

---

#### 1. Email Verification

**What it does:** Checks if email addresses are valid and deliverable before you send emails. Prevents bounces and improves deliverability.

**How to Connect:**
1. Sign up for NeverBounce or MillionVerifier
2. Get your API key from their dashboard
3. Add to `.env` file: `NEVERBOUNCE_API_KEY=your_key_here` or `MV_API_KEY=your_key_here`

**Cost:** 
- **NeverBounce:** $0.008 per verification (about 1 cent per email)
  - Free tier: 1,000 verifications/month
  - Paid: $15/month for 2,000 verifications, then $0.008 each
- **MillionVerifier:** $0.001 per verification (cheaper but less accurate)
  - Free tier: 1,000 verifications/month
  - Paid: Starts at $9/month

**Recommendation:** Start with NeverBounce free tier (1,000/month), then upgrade if needed.

**Test 1: Verify Single Email**
1. **Using Website:**
   - Go to Find Contact page
   - Find a contact
   - Click "Verify Email"
   - Should see verification status (Valid, Invalid, Risky)

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/email-verification/verify`
   - Body (JSON):
   ```json
   {
     "email": "test@example.com"
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "email": "test@example.com",
     "status": "valid",
     "score": 95,
     "provider": "neverbounce",
     "badge": {"label": "Valid", "color": "green"}
   }
   ```

**Test 2: Verify Multiple Emails (Bulk)**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/email-verification/verify-bulk`
   - Body (JSON):
   ```json
   {
     "emails": ["email1@example.com", "email2@example.com", "email3@example.com"]
   }
   ```
   - Expected Response: Array of verification results for each email

**Test 3: Health Check**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/email-verification/health`
   - Expected Response: Service health status

**Troubleshooting:**
- **Error: "API key not found"** → Make sure you added the API key to your `.env` file and restarted the backend
- **Error: "Rate limit exceeded"** → You've used up your free tier. Wait until next month or upgrade your plan.
- **All emails show "unknown" status** → Check your API key is correct. Test the key directly on NeverBounce website.
- **Mock mode always returns same result** → Set `ROLEFERRY_MOCK_MODE=false` in `.env` to use real verification
- **Costs adding up quickly** → Use bulk verification sparingly. Verify only emails you plan to contact.

**Connection Steps:**
1. Go to https://neverbounce.com (or https://millionverifier.com)
2. Sign up for free account
3. Go to API section in dashboard
4. Copy your API key
5. Add to `backend/.env` file: `NEVERBOUNCE_API_KEY=paste_key_here`
6. Restart backend server
7. Test using Test 1 above

**Expected Results:**
- Should verify emails and return status (valid/invalid/risky/unknown)
- Should provide confidence score (0-100)
- Should work in bulk for multiple emails
- Should show verification badges (green for valid, red for invalid, yellow for risky)

---

#### 2. Find Contact

**What it does:** Searches for contact information (email, LinkedIn) for people at target companies. Helps you find the right person to reach out to.

**How to Connect:** 
- **Free option:** Uses mock data (limited functionality)
- **Paid option:** Requires Findymail API key (see below)

**Cost:**
- **Free (Mock Mode):** FREE but returns sample data only
- **Findymail:** $0.03 per lookup (3 cents per contact)
  - Free tier: 50 lookups/month
  - Paid: $49/month for 2,000 lookups, then $0.03 each
  - Alternative: Apollo.io ($49/month for 10,000 credits)

**Test 1: Search for Contacts**
1. **Using Website:**
   - Go to Find Contact page
   - Enter company name and role (e.g., "TechCorp", "VP Engineering")
   - Click "Search"
   - Should see list of contacts with emails and LinkedIn profiles

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/find-contact/search`
   - Body (JSON):
   ```json
   {
     "query": "VP Engineering",
     "company": "TechCorp Inc.",
     "role": "VP",
     "level": "VP"
   }
   ```
   - Expected Response:
   ```json
   {
     "success": true,
     "contacts": [{
       "name": "Sarah Johnson",
       "title": "VP of Engineering",
       "email": "sarah.johnson@techcorp.com",
       "confidence": 0.95
     }]
   }
   ```

**Test 2: Verify Contact Email**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/find-contact/verify`
   - Body (JSON):
   ```json
   {
     "email": "sarah.johnson@techcorp.com"
   }
   ```
   - Expected Response: Verification result (uses email verification service)

**Troubleshooting:**
- **No contacts found** → In mock mode, it returns sample data. For real results, connect Findymail API.
- **Low confidence scores** → The confidence score shows how sure we are about the contact info. Lower scores mean less reliable.
- **API key error** → Make sure Findymail API key is in `.env` file if you want real data
- **Costs too high** → Use mock mode for testing, only use real API for actual outreach

**Connection Steps (Findymail):**
1. Go to https://findymail.com
2. Sign up for account
3. Go to API section
4. Copy API key
5. Add to `backend/.env`: `FINDYMAIL_API_KEY=paste_key_here`
6. Set `ROLEFERRY_MOCK_MODE=false` in `.env`
7. Restart backend
8. Test using Test 1 above

**Expected Results:**
- Should find contacts matching your search criteria
- Should return email addresses and LinkedIn profiles
- Should provide confidence scores
- Should allow email verification

---

#### 3. Email Sending (Instantly)

**What it does:** Actually sends your emails through Instantly.ai, which handles deliverability, tracking, and follow-ups automatically.

**How to Connect:**
1. Sign up for Instantly.ai
2. Get API key from dashboard
3. Add to `.env`: `INSTANTLY_API_KEY=your_key_here`

**Cost:**
- **Instantly.ai:** $37/month for starter plan
  - Includes: Unlimited email accounts, email warmup, basic analytics
  - Higher tiers: $97/month for more features
- **Alternative:** SendGrid (free tier: 100 emails/day, then $15/month for 40,000)

**Test 1: Push Contacts to Instantly**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/campaign/push`
   - Body (JSON):
   ```json
   {
     "list_name": "TechCorp Outreach",
     "contacts": [{
       "email": "sarah@techcorp.com",
       "first_name": "Sarah",
       "last_name": "Johnson",
       "custom_variables": {
         "job_title": "Senior Engineer",
         "company": "TechCorp"
       }
     }]
   }
   ```
   - Expected Response:
   ```json
   {
     "status": "queued",
     "list": "TechCorp Outreach",
     "count": 1
   }
   ```

**Test 2: Check Campaign Status**
1. **Using Postman:**
   - Method: GET
   - URL: `http://localhost:8000/campaign`
   - Expected Response: Campaign status and metrics

**Troubleshooting:**
- **Error: "API key not found"** → Add `INSTANTLY_API_KEY` to `.env` file
- **Error: "List not found"** → Create the email list in Instantly dashboard first
- **Emails not sending** → Check Instantly dashboard to see if emails are queued or if there are errors
- **High bounce rate** → Make sure you're verifying emails before sending (use email verification feature)
- **Account suspended** → Instantly may suspend accounts with poor deliverability. Warm up your email domain first.

**Connection Steps:**
1. Go to https://instantly.ai
2. Sign up for account ($37/month)
3. Connect your email account (Gmail, Outlook, etc.)
4. Go to Settings → API
5. Copy API key
6. Add to `backend/.env`: `INSTANTLY_API_KEY=paste_key_here`
7. Create an email list in Instantly dashboard
8. Restart backend
9. Test using Test 1 above

**Expected Results:**
- Should push contacts to Instantly
- Should queue emails for sending
- Should track email status (sent, delivered, opened, replied)
- Should handle bounces and unsubscribes

---

### Priority 1 (P1) - Important Paid Features

These features significantly improve RoleFerry but can use free alternatives initially.

---

#### 4. AI Content Generation (OpenAI)

**What it does:** Uses AI (ChatGPT) to generate personalized emails, offers, and content. Makes your outreach much more effective.

**How to Connect:**
1. Sign up for OpenAI account
2. Get API key from https://platform.openai.com/api-keys
3. Add to `.env`: `OPENAI_API_KEY=your_key_here`

**Cost:**
- **OpenAI GPT-4:** $0.03 per 1,000 tokens (about $0.10-0.50 per email generated)
  - Free tier: $5 credit when you sign up
  - Paid: Pay as you go, typically $10-50/month for moderate use
- **OpenAI GPT-3.5:** $0.002 per 1,000 tokens (much cheaper, $0.01-0.05 per email)
  - Recommended for cost savings

**Test 1: Generate AI Content (if integrated)**
1. **Using Website:**
   - Go to Offer Creation or Compose page
   - Click "Generate with AI"
   - Should see AI-generated content

2. **Using Postman (if endpoint exists):**
   - Method: POST
   - URL: `http://localhost:8000/offer-creation/create` (with AI flag)
   - Body (JSON) - Include `use_ai: true`
   - Expected Response: AI-generated offer

**Troubleshooting:**
- **Error: "API key not found"** → Add OpenAI API key to `.env` file
- **Error: "Rate limit exceeded"** → You've hit OpenAI's rate limit. Wait a few minutes or upgrade your plan.
- **Error: "Insufficient credits"** → Add payment method to OpenAI account
- **Content seems generic** → Provide better context data (company info, pain points) for better results
- **Costs too high** → Use GPT-3.5 instead of GPT-4, or use template-based generation instead

**Connection Steps:**
1. Go to https://platform.openai.com
2. Sign up for account
3. Add payment method (required for API access)
4. Go to API Keys section
5. Create new API key
6. Copy key (you can only see it once!)
7. Add to `backend/.env`: `OPENAI_API_KEY=paste_key_here`
8. Restart backend
9. Test AI generation features

**Expected Results:**
- Should generate personalized content
- Should adapt tone and style
- Should use context from research and pain points
- Should be more effective than template-based content

---

#### 5. Company Research (Serper)

**What it does:** Searches the web for company information, recent news, and other context to help personalize your outreach.

**How to Connect:**
1. Sign up for Serper.dev
2. Get API key
3. Add to `.env`: `SERPER_API_KEY=your_key_here`

**Cost:**
- **Serper.dev:** $5/month for 2,500 searches
  - Free tier: 100 searches/month
  - Paid: $5/month (2,500), $50/month (25,000)
- **Alternative:** Google Custom Search (free tier: 100 queries/day)

**Test 1: Search for Company Info**
1. **Using Website:**
   - Go to Context Research page
   - Enter company name
   - Should see company information and recent news

2. **Using Postman (if endpoint exists):**
   - Method: POST
   - URL: `http://localhost:8000/context-research/research`
   - Body (JSON):
   ```json
   {
     "company_name": "TechCorp Inc."
   }
   ```
   - Expected Response: Company data and news

**Troubleshooting:**
- **Error: "API key not found"** → Add Serper API key to `.env`
- **No results found** → Company might be too small or name might be misspelled
- **Rate limit exceeded** → You've used your free tier. Wait or upgrade.
- **Outdated information** → Serper searches current web, but some companies have limited online presence

**Connection Steps:**
1. Go to https://serper.dev
2. Sign up for free account
3. Go to API Keys section
4. Copy API key
5. Add to `backend/.env`: `SERPER_API_KEY=paste_key_here`
6. Set `ROLEFERRY_MOCK_MODE=false` in `.env`
7. Restart backend
8. Test company research feature

**Expected Results:**
- Should find company information
- Should return recent news/articles
- Should provide context for personalization
- Should work for most well-known companies

---

#### 6. Contact Enrichment (Findymail)

**What it does:** Finds email addresses for contacts when you only have their name and company. More accurate than guessing.

**How to Connect:**
1. Sign up for Findymail
2. Get API key
3. Add to `.env`: `FINDYMAIL_API_KEY=your_key_here`

**Cost:**
- **Findymail:** $0.03 per lookup (3 cents per contact)
  - Free tier: 50 lookups/month
  - Paid: $49/month for 2,000 lookups
- **Alternative:** Apollo.io ($49/month for 10,000 credits)

**Test 1: Enrich Contact**
1. **Using Website:**
   - Go to Find Contact page
   - Enter name and company
   - Click "Find Email"
   - Should see email address with confidence score

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/find-contact/search`
   - Body (JSON):
   ```json
   {
     "query": "Sarah Johnson",
     "company": "TechCorp Inc."
   }
   ```
   - Expected Response: Contact with email address

**Troubleshooting:**
- **Error: "API key not found"** → Add Findymail API key to `.env`
- **No email found** → Contact might not have public email. Try LinkedIn instead.
- **Low confidence** → Confidence score shows how reliable the email is. Lower scores = less reliable.
- **Costs adding up** → Use sparingly. Only enrich contacts you plan to contact.

**Connection Steps:**
1. Go to https://findymail.com
2. Sign up for account
3. Go to API section
4. Copy API key
5. Add to `backend/.env`: `FINDYMAIL_API_KEY=paste_key_here`
6. Set `ROLEFERRY_MOCK_MODE=false`
7. Restart backend
8. Test contact search feature

**Expected Results:**
- Should find email addresses for contacts
- Should provide confidence scores
- Should work for most professional contacts
- Should be more accurate than manual guessing

---

### Priority 2 (P2) - Nice-to-Have Paid Features

These features are helpful but not essential for basic functionality.

---

#### 7. Advanced Deliverability Checks

**What it does:** Checks your emails before sending to make sure they won't be marked as spam. Improves your email deliverability rates.

**How to Connect:** Uses built-in checks (free) or can integrate with paid services

**Cost:**
- **Basic checks:** FREE (built into RoleFerry)
- **Advanced services:** Mail-Tester.com (free), GlockApps ($29/month)

**Test 1: Pre-Flight Checks**
1. **Using Website:**
   - Go to Launch page
   - Should see checklist: Spam score, DNS validation, etc.
   - All checks should pass before launching

2. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/deliverability-launch/pre-flight-checks`
   - Body (JSON) - Email content
   - Expected Response: List of checks and results

**Troubleshooting:**
- **High spam score** → Remove spam trigger words (FREE, URGENT, CLICK HERE, etc.)
- **DNS validation failed** → Check that your sending domain is properly configured
- **All checks failing** → Review email content for common spam triggers

**Expected Results:**
- Should check spam score
- Should validate DNS records
- Should check for spam trigger words
- Should provide recommendations for improvement

---

#### 8. Offer Decks (Gamma)

**What it does:** Creates beautiful presentation decks (like PowerPoint) for your value proposition. Makes your outreach more professional.

**How to Connect:**
1. Sign up for Gamma.app
2. Get API key
3. Add to `.env`: `GAMMA_API_KEY=your_key_here`

**Cost:**
- **Gamma.app:** Free tier available, paid plans start at $10/month
  - Free: Limited decks
  - Paid: Unlimited decks, custom branding

**Test 1: Create Offer Deck**
1. **Using Postman:**
   - Method: POST
   - URL: `http://localhost:8000/offer-decks/create`
   - Body (JSON) - Offer data
   - Expected Response: Deck URL

**Troubleshooting:**
- **Error: "API key not found"** → Add Gamma API key to `.env`
- **Deck not generating** → Check that offer data is complete
- **Can't access deck** → Check Gamma dashboard for deck status

**Connection Steps:**
1. Go to https://gamma.app
2. Sign up for account
3. Go to API settings
4. Copy API key
5. Add to `backend/.env`: `GAMMA_API_KEY=paste_key_here`
6. Restart backend
7. Test deck creation

**Expected Results:**
- Should create professional presentation decks
- Should include your value proposition
- Should be shareable via URL
- Should look professional and polished

---

## Priority Testing Order

### Week 1: Core Free Features (P0 Free)
Test these in order:
1. ✅ Job Preferences
2. ✅ Resume Upload
3. ✅ Job Descriptions
4. ✅ Pain Point Match
5. ✅ Basic Analytics

**Goal:** Make sure the basic job seeker workflow works end-to-end without any paid services.

---

### Week 2: Core Paid Features (P0 Paid)
Test these in order:
1. ✅ Email Verification (NeverBounce free tier)
2. ✅ Find Contact (mock mode first, then Findymail)
3. ✅ Email Sending (Instantly - start with free trial)

**Goal:** Make sure you can actually send emails and they get delivered.

---

### Week 3: Important Features (P1)
Test these in order:
1. ✅ Context Research
2. ✅ Offer Creation
3. ✅ Compose Email
4. ✅ Campaign Management
5. ✅ AI Content Generation (OpenAI - if budget allows)
6. ✅ Company Research (Serper free tier)
7. ✅ Contact Enrichment (Findymail free tier)

**Goal:** Enhance the basic workflow with better personalization and content.

---

### Week 4: Nice-to-Have Features (P2)
Test these as needed:
1. ✅ Template Engine
2. ✅ Error Handling
3. ✅ Documentation Endpoints
4. ✅ Advanced Deliverability
5. ✅ Offer Decks (if needed)

**Goal:** Polish the experience and add advanced features.

---

## Cost Summary

### Free Features (No Cost)
- Job Preferences
- Resume Upload/Parsing
- Job Descriptions
- Pain Point Match
- Basic Analytics
- Context Research (basic)
- Offer Creation
- Compose Email
- Campaign Management
- Template Engine
- Error Handling
- Documentation

**Total Free Cost: $0/month**

---

### Paid Features (Estimated Monthly Cost)

**Minimum Setup (Essential):**
- Email Verification (NeverBounce): $0-15/month (free tier: 1,000/month)
- Email Sending (Instantly): $37/month
- **Total Minimum: $37-52/month**

**Recommended Setup (Better Results):**
- Email Verification: $15/month
- Email Sending: $37/month
- Find Contact (Findymail): $49/month (2,000 lookups)
- **Total Recommended: $101/month**

**Full Setup (Best Results):**
- Email Verification: $15/month
- Email Sending: $37/month
- Find Contact: $49/month
- AI Content (OpenAI): $20-50/month (depending on usage)
- Company Research (Serper): $5/month
- **Total Full: $126-152/month**

**Cost-Saving Tips:**
1. Start with free tiers for all services
2. Use mock mode for testing (no costs)
3. Only verify emails you plan to contact
4. Use GPT-3.5 instead of GPT-4 (10x cheaper)
5. Batch operations to reduce API calls
6. Monitor usage in each service's dashboard

---

## Common Issues and Solutions

### Backend Won't Start

**Problem:** Backend server won't start or crashes immediately.

**Solutions:**
1. Check Python version: `python --version` (should be 3.8+)
2. Install dependencies: `pip install -r requirements.txt`
3. Check port 8000 is available (not used by another app)
4. Check `.env` file exists and has correct format
5. Look at error message in terminal for specific issue

---

### API Returns 500 Error

**Problem:** API requests return "500 Internal Server Error"

**Solutions:**
1. Check backend logs in terminal for specific error
2. Verify all required environment variables are set
3. Check database connection (if using database)
4. Restart backend server
5. Check that file paths are correct

---

### API Returns 422 Error

**Problem:** API returns "422 Unprocessable Entity"

**Solutions:**
1. Check that your JSON data matches the expected format
2. Verify all required fields are included
3. Check data types (strings vs numbers)
4. Look at API documentation at `/docs` for correct format

---

### Mock Mode Not Working

**Problem:** Features return errors even in mock mode

**Solutions:**
1. Verify `ROLEFERRY_MOCK_MODE=true` in `.env` file
2. Restart backend after changing `.env`
3. Check that mock data endpoints are implemented
4. Some features might not have mock mode - check documentation

---

### API Keys Not Working

**Problem:** Paid features return "API key invalid" errors

**Solutions:**
1. Verify API key is correct (no extra spaces)
2. Check API key is active in service dashboard
3. Verify you have credits/quota remaining
4. Check API key has correct permissions
5. Some services require payment method even for free tier

---

### Costs Too High

**Problem:** API costs are adding up quickly

**Solutions:**
1. Use mock mode for testing
2. Monitor usage in each service's dashboard
3. Set usage limits/alerts
4. Use free tiers when possible
5. Batch operations to reduce API calls
6. Cache results when possible

---

## Testing Checklist Summary

Use this checklist to track your progress:

### Free Features
- [ ] Job Preferences (Save, Get, Options)
- [ ] Resume Upload (Upload, Parse, Save, Get)
- [ ] Job Descriptions (Import URL, Import Text, Save, Get)
- [ ] Pain Point Match (Generate, Get Score, Save)
- [ ] Basic Analytics (Campaign, CSV, Time Series)
- [ ] Context Research (Research, Get Variables)
- [ ] Offer Creation (Create, Get Tones, Save)
- [ ] Compose Email (Generate, Detect Jargon, Get Variables)
- [ ] Campaign Management (Create, Get, Export)
- [ ] Template Engine (Parse, Substitute, Validate)
- [ ] Error Handling (Validate various inputs)
- [ ] Documentation (API Reference, Workflow Docs)

### Paid Features
- [ ] Email Verification (Single, Bulk, Health Check)
- [ ] Find Contact (Search, Verify)
- [ ] Email Sending (Push Contacts, Check Status)
- [ ] AI Content Generation (if integrated)
- [ ] Company Research (Search Company Info)
- [ ] Contact Enrichment (Find Email by Name/Company)
- [ ] Advanced Deliverability (Pre-flight Checks)
- [ ] Offer Decks (Create Deck)

---

## Next Steps After Testing

1. **Fix all P0 issues** before moving to P1
2. **Document any bugs** you find with steps to reproduce
3. **Set up monitoring** for API usage and costs
4. **Create test accounts** for each paid service
5. **Set usage alerts** to avoid surprise bills
6. **Document your setup** so others can replicate it

---

## Getting Help

If you encounter issues not covered here:

1. **Check backend logs** - Most errors show up in terminal
2. **Check API documentation** - Go to `http://localhost:8000/docs`
3. **Test in Postman** - Isolate if issue is frontend or backend
4. **Check service dashboards** - Each paid service has its own dashboard
5. **Review error messages** - They usually tell you what's wrong

---

**Last Updated:** 2024-01-15
**Version:** 1.0

