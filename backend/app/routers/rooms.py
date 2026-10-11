import uuid
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, Ticket, User, AuditLog
from app.schemas import RoomResponse, RoomCreate
from app.services.auth_service import get_current_user, require_roles

import socket

router = APIRouter(prefix="/rooms", tags=["QR Rooms"])

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

@router.get("/network-host")
def get_network_host():
    """Returns active LAN IP address for connecting mobile devices over Wi-Fi"""
    ip = get_lan_ip()
    return {
        "lan_ip": ip,
        "frontend_port": 3000,
        "backend_port": 8000,
        "frontend_url": f"http://{ip}:3000",
        "backend_url": f"http://{ip}:8000/api"
    }

@router.get("", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Room).filter(Room.is_active == True).order_by(Room.room_number.asc()).all()

@router.post("", response_model=RoomResponse)
def create_room(
    payload: RoomCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    existing = db.query(Room).filter(Room.room_number == payload.room_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Room number already exists")
        
    clean_num = payload.room_number.replace("Room ", "").replace(" ", "")
    qr_token = payload.qr_token or f"CARE-RM{clean_num}-{uuid.uuid4().hex[:6].upper()}"
    room = Room(
        room_number=payload.room_number,
        floor=payload.floor,
        wing=payload.wing,
        bed_count=payload.bed_count,
        qr_token=qr_token,
        is_active=payload.is_active
    )
    db.add(room)
    db.flush()

    audit = AuditLog(
        ticket_id=None,
        action="ROOM_QR_CREATED_ADMIN",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        details=json.dumps({
            "room_number": room.room_number,
            "qr_token": room.qr_token,
            "floor": room.floor,
            "wing": room.wing,
            "bed_count": room.bed_count
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(room)
    return room
