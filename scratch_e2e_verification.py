import requests
import sys
import time

BASE_URL = "http://localhost:8000/api"

def print_result(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} - {detail}")
    if not passed:
        sys.exit(1)

def run_tests():
    print("=== CAREOPS AI SPECIFICATION VERIFICATION SUITE ===\n")
    
    # 1. Login as Super Admin
    login_sa = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "superadmin@careops.hospital",
        "password": "password123"
    })
    print_result("Super Admin Login", login_sa.status_code == 200, f"Status: {login_sa.status_code}")
    sa_token = login_sa.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    
    # 2. Login as Admin
    login_admin = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    print_result("Admin Login", login_admin.status_code == 200, f"Status: {login_admin.status_code}")
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 3. Verify Admin CANNOT purge database (Only Super Admin can)
    admin_purge_attempt = requests.post(f"{BASE_URL}/system/maintenance/purge", headers=admin_headers, json={
        "categories": ["demo_patients"],
        "confirm_phrase": "CONFIRM_CLEAR"
    })
    print_result("Admin DB Purge Blocked (403)", admin_purge_attempt.status_code == 403, f"Status: {admin_purge_attempt.status_code}")
    
    # 4. Super Admin DB Maintenance Preview
    sa_preview = requests.post(f"{BASE_URL}/system/maintenance/preview", headers=sa_headers, json={
        "categories": ["demo_patients", "demo_tickets", "demo_nps"]
    })
    print_result("Super Admin DB Maintenance Preview", sa_preview.status_code == 200, f"Count: {sa_preview.json().get('total_eligible_records', 0)}")
    
    # 5. Super Admin Admin Accounts Management
    admins_list = requests.get(f"{BASE_URL}/system/admins", headers=sa_headers)
    print_result("Super Admin List Admins", admins_list.status_code == 200, f"Found {len(admins_list.json())} Admins")
    
    # 6. Super Admin Security Settings
    sec_settings = requests.get(f"{BASE_URL}/system/security-settings", headers=sa_headers)
    print_result("Super Admin Security Settings", sec_settings.status_code == 200, f"AI Provider: {sec_settings.json().get('ai_vision_provider')}")
    
    # 7. Department Standardization (Must have Maintenance, Housekeeping, Linen, Medical, IT - NO Biomedical)
    depts_res = requests.get(f"{BASE_URL}/departments", headers=admin_headers)
    depts = depts_res.json()
    dept_names = [d["name"] for d in depts]
    dept_ids = [d["id"] for d in depts]
    has_medical = "Medical" in dept_names or "medical" in dept_ids
    has_biomedical = any("biomedical" in d["id"].lower() for d in depts)
    print_result("Canonical Medical Department Present", has_medical, f"Dept Names: {dept_names}")
    print_result("Biomedical Department Excluded", not has_biomedical, f"Dept IDs: {dept_ids}")
    
    # 8. Department Analytics View (Interactive telemetry, workload, 7-day trend)
    dept_analytics = requests.get(f"{BASE_URL}/departments/maintenance/analytics", headers=admin_headers)
    print_result("Department Interactive Analytics", dept_analytics.status_code == 200, f"SLA: {dept_analytics.json().get('sla_compliance_rate')}%")
    
    # 9. Staff Management & Supervisor Team Listing
    supervisors_res = requests.get(f"{BASE_URL}/staff/supervisors/list", headers=admin_headers)
    print_result("Supervisors List", supervisors_res.status_code == 200, f"Supervisors: {len(supervisors_res.json())}")
    if supervisors_res.json():
        sup_id = supervisors_res.json()[0]["id"]
        team_res = requests.get(f"{BASE_URL}/staff/supervisors/{sup_id}/team", headers=admin_headers)
        team_members = team_res.json() if isinstance(team_res.json(), list) else team_res.json().get('team_members', [])
        print_result("Supervisor Team Roster", team_res.status_code == 200, f"Team count: {len(team_members)}")
    
    # 10. Permission Matrix API
    staff_res = requests.get(f"{BASE_URL}/staff?role=staff", headers=admin_headers)
    if staff_res.json().get("items"):
        target_user = staff_res.json()["items"][0]
        perm_res = requests.get(f"{BASE_URL}/staff/{target_user['id']}/permissions", headers=admin_headers)
        print_result("Permission Matrix Query", perm_res.status_code == 200, f"Perms: {len(perm_res.json().get('permissions', []))}")
        
        # Update permissions
        new_perms = perm_res.json().get("permissions", [])
        if "tickets.read" not in new_perms:
            new_perms.append("tickets.read")
        put_perm = requests.put(f"{BASE_URL}/staff/{target_user['id']}/permissions", headers=admin_headers, json={
            "permissions": new_perms
        })
        print_result("Permission Matrix Update Persisted", put_perm.status_code == 200, f"Updated Perms: {len(put_perm.json().get('permissions', []))}")
    
    # 11. Patient QR Flow: Submit complaint with mandatory mobile normalized
    patient_sub = requests.post(f"{BASE_URL}/patient/submit", json={
        "qr_token": "CARE-RM204-7X9Q",
        "department_id": "maintenance",
        "category": "Electrical & Lighting",
        "title": "Bed 2 Reading Lamp Flickering",
        "description": "The bedside reading lamp has a loose bulb socket that flickers continuously.",
        "patient_contact": "+1 (555) 234-5678",
        "idempotency_key": f"test-e2e-run-{time.time()}"
    })
    print_result("Patient Ticket Submission with Mobile", patient_sub.status_code in [200, 201], f"Ref: {patient_sub.json().get('ticket_number')}")
    ticket_data = patient_sub.json()
    ticket_num = ticket_data["ticket_number"]
    ticket_id = ticket_data.get("id")
    if not ticket_id:
        t_search = requests.get(f"{BASE_URL}/tickets?search={ticket_num}", headers=admin_headers)
        if t_search.json():
            ticket_id = t_search.json()[0]["id"]
    tracking_token = ticket_data.get("token") or ticket_data.get("tracking_token")
    
    # 12. Patient Live Ticket Tracker
    track_res = requests.get(f"{BASE_URL}/patient/ticket/{ticket_num}?token={tracking_token or ''}")
    print_result("Patient Secure Ticket Tracker", track_res.status_code == 200, f"Friendly Status: {track_res.json().get('friendly_status')}")
    
    # 13. Ticket Workflow Lifecycle
    ack_res = requests.post(f"{BASE_URL}/tickets/{ticket_id}/acknowledge", headers=admin_headers, json={
        "note": "Technician Rajesh Sharma acknowledged the ticket"
    })
    print(f"DEBUG: ticket_num={ticket_num}, ticket_id={ticket_id}, ack_status={ack_res.status_code}, ack_text={ack_res.text[:200]}")
    print_result("Ticket Acknowledge & Start ETA", ack_res.status_code == 200, f"Status: {ack_res.json().get('status') if ack_res.status_code == 200 else ack_res.status_code}")
    
    # Start Work
    start_res = requests.post(f"{BASE_URL}/tickets/{ticket_id}/start-work", headers=admin_headers, json={
        "note": "Arrived at Room 204. Work started on reading lamp."
    })
    print_result("Ticket Start Work", start_res.status_code == 200, f"Status: {start_res.json().get('status')}")
    
    # Resolution Submit
    resolv_res = requests.post(f"{BASE_URL}/tickets/{ticket_id}/submit-resolution", headers=admin_headers, json={
        "resolution_summary": "Replaced defective LED bulb and tightened fixture socket.",
        "parts_replaced": "LED Bulb 9W warm white",
        "functional_test_notes": "Tested on/off cycles 5 times. Steady illumination verified."
    })
    print_result("Ticket Submit Resolution", resolv_res.status_code == 200, f"Status: {resolv_res.json().get('status')}")
    
    # Close Ticket
    close_res = requests.post(f"{BASE_URL}/tickets/{ticket_id}/close", headers=admin_headers, json={
        "approval_note": "Supervisor inspected Room 204. Confirmed satisfactory.",
        "is_approved": True
    })
    print_result("Ticket Closure", close_res.status_code == 200, f"Status: {close_res.json().get('status')}")
    
    # 14. NPS & Patient Feedback Module
    nps_sub = requests.post(f"{BASE_URL}/nps/submit", json={
        "ticket_id": ticket_id,
        "emoji_rating": "happy",
        "nps_score": 10,
        "feedback_comment": "The maintenance technician arrived promptly and fixed the light without making noise. Excellent hospital service!"
    })
    print_result("Patient NPS Feedback Submission", nps_sub.status_code == 200, f"ID: {nps_sub.json().get('id')}")
    
    # NPS Dashboard Metrics
    nps_dash = requests.get(f"{BASE_URL}/nps/dashboard", headers=admin_headers)
    print_result("NPS Dashboard Aggregations", nps_dash.status_code == 200, f"NPS Score: {nps_dash.json().get('formal_nps_score')}, Happy: {nps_dash.json().get('emoji_distribution', {}).get('happy')}")
    
    # NPS Export
    nps_exp = requests.get(f"{BASE_URL}/nps/export", headers=admin_headers)
    print_result("NPS CSV Export", nps_exp.status_code == 200 and "text/csv" in nps_exp.headers.get("content-type", ""), f"Bytes: {len(nps_exp.content)}")
    
    # 15. AI Vision Verification Multi-Provider Engine
    models_res = requests.get(f"{BASE_URL}/ai-verify/models", headers=admin_headers)
    print_result("AI Vision Model Catalog", models_res.status_code == 200, f"Models: {[m['model_id'] for m in models_res.json().get('models', [])]}")
    
    # Trigger AI Verification Job on ticket
    ai_job = requests.post(f"{BASE_URL}/ai-verify/{ticket_id}/analyze", headers=admin_headers)
    print_result("AI Vision Multimodal Analysis", ai_job.status_code == 200, f"Result: {ai_job.json().get('resolution_status')}")
    
    print("\n=== ALL FUNCTIONAL ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
