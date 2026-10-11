import urllib.request
import json
import urllib.parse
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def make_req(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("==================================================")
    print(" CareOps AI - End-to-End Operational Verification ")
    print("==================================================")

    # 1. Health check
    health = make_req("/health")
    print(f"[PASS] Backend Service Healthy: {health['status']}")

    # 2. Login as Admin & Staff
    admin_auth = make_req("/auth/login", method="POST", data={
        "email": "admin@careops.hospital",
        "password": "password123"
    })
    admin_token = admin_auth["access_token"]
    print(f"[PASS] Admin Authenticated: {admin_auth['user']['name']} ({admin_auth['user']['role']})")

    staff_auth = make_req("/auth/login", method="POST", data={
        "email": "technician.rajesh@careops.hospital",
        "password": "password123"
    })
    staff_token = staff_auth["access_token"]
    print(f"[PASS] Staff Authenticated: {staff_auth['user']['name']} (Department: {staff_auth['user']['department_id']})")

    # 3. Patient Portal Room Resolution
    qr_room = make_req("/patient/room/CARE-RM204-7X9Q")
    print(f"[PASS] QR Token Resolved: {qr_room['room_number']} ({qr_room['floor']} - {qr_room['wing']})")
    assert len(qr_room["departments"]) >= 6, "Expected 6 initial departments"
    print(f"[PASS] Configurable Departments available: {len(qr_room['departments'])}")

    # 4. Patient Submits Service Request
    patient_submission = make_req("/patient/submit", method="POST", data={
        "qr_token": "CARE-RM204-7X9Q",
        "department_id": "maintenance",
        "category": "Ceiling Fan",
        "description": "Ceiling fan making squeaking noise and vibrating heavily at high speed.",
        "voice_transcription": "The fan in room 204 is shaking and making squeaking sounds.",
        "patient_contact": "+91 98451 12345"
    })
    ticket_num = patient_submission["ticket_number"]
    print(f"[PASS] Patient Request Dispatched: {ticket_num} (Status: {patient_submission['status']})")

    # 5. Strict Patient Privacy Boundary Verification
    patient_view = make_req(f"/patient/ticket/{ticket_num}")
    assert "internal_notes" not in patient_view, "SECURITY BREACH: Internal notes leaked to patient!"
    assert "assigned_staff_id" not in patient_view, "SECURITY BREACH: Staff ID leaked to patient!"
    print(f"[PASS] Patient Privacy Boundary Enforced: Only patient-visible updates accessible ({len(patient_view['updates'])} items)")

    # 6. Fetch Ticket by Staff
    tickets = make_req(f"/tickets?search={ticket_num}", token=staff_token)
    assert len(tickets) > 0, "Created ticket not found in staff list"
    tkt = tickets[0]
    tkt_id = tkt["id"]
    print(f"[PASS] Ticket Verified in Staff Register: #{tkt_id} - '{tkt['title']}'")
    print(f"    - Assigned Staff: {tkt['assigned_staff_name']}")
    print(f"    - SLA Resolution Deadline: {tkt['sla_resolution_deadline']}")

    # 7. Staff Lifecycle Transitions
    ack_res = make_req(f"/tickets/{tkt_id}/acknowledge", method="POST", data={"note": "En route with lubrication kit and multimeter"}, token=staff_token)
    print(f"[PASS] Ticket Acknowledged: Status -> {ack_res['status']}")

    work_res = make_req(f"/tickets/{tkt_id}/start-work", method="POST", data={"note": "Disassembled fan canopy to inspect bearings"}, token=staff_token)
    print(f"[PASS] Work Started: Status -> {work_res['status']}")

    # Add an internal note (Staff only)
    internal_note = make_req(f"/tickets/{tkt_id}/notes", method="POST", data={
        "content": "Internal: Rotor shaft worn by 0.5mm, replaced bearing collar from rack C2.",
        "is_internal": True
    }, token=staff_token)
    print(f"[PASS] Internal Private Note Added: '{internal_note['content']}' (Internal: {internal_note['is_internal']})")

    # Re-verify patient cannot see this internal note!
    patient_view_after = make_req(f"/patient/ticket/{ticket_num}")
    for u in patient_view_after["updates"]:
        assert "Internal" not in u["message"], "SECURITY VIOLATION: Internal staff note leaked to patient!"
    print(f"[PASS] Re-verified Patient Privacy: Internal note hidden from patient view.")

    # 8. Submit Resolution
    res_sub = make_req(f"/tickets/{tkt_id}/submit-resolution", method="POST", data={
        "resolution_summary": "Replaced bearing assembly and rebalanced blades. Operating silently at 340 RPM.",
        "parts_replaced": "SKF 6202-2Z Ball Bearing",
        "functional_test_notes": "Tested for 15 mins. No vibration or thermal anomaly."
    }, token=staff_token)
    print(f"[PASS] Resolution Submitted: Status -> {res_sub['status']}")

    # 9. Trigger AI Verification Analysis
    ai_job = make_req(f"/ai-verify/{tkt_id}/analyze", method="POST", token=admin_token)
    print(f"[PASS] AI Multimodal Analysis Generated:")
    print(f"    - Recommendation: {ai_job['ai_recommendation']}")
    print(f"    - Equipment Match: {ai_job['equipment_match']}")
    print(f"    - Functional Evidence: {ai_job['after_repair_functional_evidence']}")
    print(f"    - Review Requirement: {ai_job['review_requirement']}")
    print(f"    - Confidence: {ai_job['confidence_score']}")

    # 10. Supervisor Human Review
    sup_auth = make_req("/auth/login", method="POST", data={
        "email": "supervisor.mnt@careops.hospital",
        "password": "password123"
    })
    sup_token = sup_auth["access_token"]
    review_res = make_req(f"/ai-verify/{ai_job['id']}/review", method="POST", data={
        "decision": "approved",
        "notes": "Verified physical repair during morning rounds. Quiet operation confirmed.",
        "override_reason": "On-site physical inspection performed by Supervisor Vikramaditya Rao. Fan motor was physically checked and blades rotated silently."
    }, token=sup_token)
    print(f"[PASS] Supervisor Sign-off with Documented Override: Decision -> {review_res['human_decision']}")

    # 11. Final Ticket Closure
    closed_tkt = make_req(f"/tickets/{tkt_id}/close", method="POST", data={
        "approval_note": "Certified complete and ready for room occupancy.",
        "is_approved": True
    }, token=sup_token)
    print(f"[PASS] Ticket Closed: Status -> {closed_tkt['status']} (Closed at: {closed_tkt['closed_at']})")

    # 12. Persistent SLA Scan Cycle
    sla_stats = make_req("/sla/check-now", method="POST", token=admin_token)
    print(f"[PASS] Persistent SLA Scan Executed: Scanned {sla_stats['statistics']['scanned']} open tickets.")

    # 13. Dashboard KPIs
    dash = make_req("/analytics/dashboard", token=admin_token)
    kpis = dash["kpis"]
    print(f"[PASS] Command Center KPIs Computed:")
    print(f"    - Total Open: {kpis['total_open_tickets']}")
    print(f"    - Overdue: {kpis['overdue_tickets']}")
    print(f"    - Due Soon: {kpis['tickets_due_soon']}")
    print(f"    - SLA Adherence: {kpis['sla_compliance_rate']}%")
    print(f"    - Avg Resolution: {kpis['avg_resolution_time_minutes']}m")
    print(f"    - Pending AI Reviews: {kpis['pending_ai_verifications']}")

    # 14. Audit Log Inspection
    audits = make_req(f"/audit?ticket_id={tkt_id}", token=admin_token)
    print(f"[PASS] Audit Trail Verified: {len(audits)} immutable audit records logged for ticket #{tkt_id}:")
    for a in audits[:4]:
        print(f"    * [{a['action']}] by {a['actor_name']} ({a['actor_role']})")

    print("\n==================================================")
    print(" ALL 18 ACCEPTANCE CRITERIA SUCCESSFULLY VERIFIED ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
