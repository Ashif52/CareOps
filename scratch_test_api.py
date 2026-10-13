import urllib.request
import json

BASE = "http://localhost:8000/api"

def post(path, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f"{BASE}{path}", data=json.dumps(data).encode(), headers=headers)
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

def get(path, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

print("Testing CareOps backend endpoints...")

# 1. Admin login
adm = post('/auth/login', {'email': 'admin@careops.hospital', 'password': 'password123'})
adm_token = adm['access_token']
print("1. Admin login SUCCESS")

# 2. NPS dashboard
nps = get('/nps/dashboard', adm_token)
print(f"2. NPS Dashboard: Total={nps['total_responses']}, Formal NPS={nps['formal_nps']['score']}, Happy%={nps['emoji_satisfaction']['happy_pct']}%")

# 3. Department analytics
dept = get('/departments/maintenance/analytics', adm_token)
print(f"3. Dept Analytics: {dept['department_name']}, Total={dept['total_tickets']}, Overdue={dept['overdue_tickets']}, SLA={dept['sla_compliance_percentage']}%")

# 4. AI Vision Models
models = get('/ai-verify/models', adm_token)
print(f"4. AI Vision Models: Active Provider={models['active_provider']}, Model={models['active_model']}")

# 5. Super Admin Maintenance Preview
sa = post('/auth/login', {'email': 'superadmin@careops.hospital', 'password': 'password123'})
sa_token = sa['access_token']
prev = post('/system/maintenance/preview', {'categories': ['demo_tickets', 'demo_nps']}, sa_token)
print(f"5. Super Admin Maintenance Preview: Affected Records={prev['total_records_affected']}, Counts={prev['affected_counts']}")

print("\nALL BACKEND API VERIFICATIONS PASSED!")
