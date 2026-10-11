"""
Enterprise Role-Based Access Control (RBAC) & Permission Service
Enforces strict healthcare SaaS authorization hierarchies, granular permissions,
and prevents privilege escalation.
"""

from typing import List, Dict, Any
import json

# Granular Permission Definitions
PERMISSIONS_CATALOG = {
    "staff.read": "View hospital personnel directory and public profiles",
    "staff.create": "Create new hospital staff identities and provision accounts",
    "staff.update": "Update staff employment details, designations, and department links",
    "staff.activate": "Activate eligible staff accounts",
    "staff.deactivate": "Deactivate hospital accounts and revoke access",
    "staff.unlock": "Unlock accounts locked by consecutive failed authentication attempts",
    "staff.password_reset": "Initiate administrative password recovery and reset flows",
    "roles.read": "View role definitions, hierarchies, and associated permissions",
    "roles.manage": "Configure role permissions and departmental assignment scopes",
    "roles.assign": "Assign approved roles to hospital personnel within delegated scope",
    "permissions.manage": "Grant granular permission overrides to authorized personnel",
    "audit.read": "Access immutable hospital operational audit trails",
    "security_events.read": "Access authentication security events, lockouts, and breach logs",
    "tickets.read": "View service orders and complaints across departments",
    "tickets.create": "Initiate hospital service orders and clinical requests",
    "tickets.resolve": "Submit resolution summaries and required diagnostic evidence",
    "tickets.close": "Supervisor authority to approve AI reviews and close work orders",
    "clinical.read": "Access inpatient clinical requests and medical ward workflows",
    "billing.manage": "Manage patient account inquiries, billing clearances, and invoices",
    "pharmacy.manage": "Access inpatient pharmacy orders and medication fulfillment",
    "rooms.manage": "Register bedside facilities, bed points, and generate QR endpoints",
    "sla.manage": "Configure hospital SLA target matrices and trigger escalation checks"
}

# Role Hierarchies & Mappings
HOSPITAL_ROLES: Dict[str, Dict[str, Any]] = {
    "admin": {
        "id": "admin",
        "name": "Super Administrator",
        "description": "Full hospital administrative authority, system policies, QR generation, role management & security audit oversight.",
        "protected_system_role": True,
        "permissions": list(PERMISSIONS_CATALOG.keys()),  # Super Admin has all permissions
    },
    "it_admin": {
        "id": "it_admin",
        "name": "IT Administrator",
        "description": "Hospital IT security specialist. Manages staff identity lifecycle, resets credentials, unlocks accounts, and inspects security events. Strictly excluded from clinical records.",
        "protected_system_role": True,
        "permissions": [
            "staff.read",
            "staff.create",
            "staff.update",
            "staff.activate",
            "staff.deactivate",
            "staff.unlock",
            "staff.password_reset",
            "roles.read",
            "roles.assign",
            "audit.read",
            "security_events.read",
            "tickets.read",
            "rooms.manage"
        ]
    },
    "supervisor": {
        "id": "supervisor",
        "name": "Department Head / Supervisor",
        "description": "Operational department lead. Approves AI verification diagnostics, manages staff roster in their department, and oversees SLA escalation breaches.",
        "protected_system_role": True,
        "permissions": [
            "staff.read",
            "staff.update",
            "roles.read",
            "tickets.read",
            "tickets.create",
            "tickets.resolve",
            "tickets.close",
            "audit.read",
            "sla.manage"
        ]
    },
    "doctor": {
        "id": "doctor",
        "name": "Physician & Duty Doctor",
        "description": "Attending medical practitioner. Manages patient clinical requests, medical equipment faults, and urgent care escalations.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.create",
            "clinical.read"
        ]
    },
    "nurse": {
        "id": "nurse",
        "name": "Clinical Nursing Staff",
        "description": "Registered inpatient ward nurse. Triage patient nurse-calls, bedside IV alarms, and room amenities requests.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.create",
            "clinical.read"
        ]
    },
    "staff": {
        "id": "staff",
        "name": "Facilities & Maintenance Lead",
        "description": "Biomedical and engineering technician. Acknowledges tickets, captures photographic evidence, and completes physical work orders.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.resolve"
        ]
    },
    "housekeeping": {
        "id": "housekeeping",
        "name": "Housekeeping & Sanitation Lead",
        "description": "Hygiene and infection control staff. Executes room turnover, sanitization tickets, and waste disposal.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.resolve"
        ]
    },
    "billing": {
        "id": "billing",
        "name": "Patient Accounts & Billing Specialist",
        "description": "Hospital cashier and accounts officer. Handles insurance queries, interim billing, and discharge financial clearances.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.create",
            "tickets.resolve",
            "billing.manage"
        ]
    },
    "pharmacy": {
        "id": "pharmacy",
        "name": "Inpatient Clinical Pharmacist",
        "description": "Hospital pharmacy officer. Fulfills inpatient STAT medication orders and medical consumables.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.create",
            "tickets.resolve",
            "pharmacy.manage"
        ]
    },
    "reception": {
        "id": "reception",
        "name": "Reception & Patient Admissions",
        "description": "Front-desk personnel. Coordinates patient check-in, bedside onboarding, and room guide allocation.",
        "protected_system_role": False,
        "permissions": [
            "staff.read",
            "tickets.read",
            "tickets.create"
        ]
    },
    "auditor": {
        "id": "auditor",
        "name": "Compliance & Quality Auditor",
        "description": "Independent hospital governance auditor. Strictly read-only access to audit logs, SLA breach ledgers, and compliance telemetry.",
        "protected_system_role": True,
        "permissions": [
            "staff.read",
            "roles.read",
            "audit.read",
            "security_events.read",
            "tickets.read"
        ]
    }
}

def get_role_permissions(role_id: str) -> List[str]:
    """Retrieve default permissions for a designated role."""
    role = HOSPITAL_ROLES.get(role_id)
    if not role:
        # Fallback for standard staff
        return ["staff.read", "tickets.read"]
    return role.get("permissions", [])

def get_user_permissions(user) -> List[str]:
    """
    Calculate effective permissions for a user, combining base role permissions
    and any custom authorized permissions overrides.
    """
    if not user:
        return []
    
    # Super Admin has all permissions
    if user.role in ["admin", "super_admin"]:
        return list(PERMISSIONS_CATALOG.keys())
    
    base_permissions = set(get_role_permissions(user.role))
    
    # Check overrides
    if hasattr(user, "permissions_override") and user.permissions_override:
        try:
            overrides = json.loads(user.permissions_override)
            if isinstance(overrides, list):
                base_permissions.update(overrides)
        except Exception:
            pass
            
    return sorted(list(base_permissions))

def has_permission(user, permission_key: str) -> bool:
    """Check if the given user holds the requested permission key."""
    if not user or not user.is_active or getattr(user, "account_status", "active") != "active":
        return False
    
    if user.role in ["admin", "super_admin"]:
        return True
    
    effective = get_user_permissions(user)
    return permission_key in effective

def get_all_roles_metadata() -> List[Dict[str, Any]]:
    """Return all hospital roles formatted for administration view."""
    results = []
    for r_id, r_info in HOSPITAL_ROLES.items():
        results.append({
            "id": r_id,
            "name": r_info["name"],
            "description": r_info["description"],
            "protected_system_role": r_info["protected_system_role"],
            "permissions": r_info["permissions"],
            "permission_count": len(r_info["permissions"])
        })
    return results
