from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ChatMessage(BaseModel):
    text: str = Field(..., max_length=500)


class TaskStatus(str, Enum):
    active = "active"
    completed = "completed"
    postponed = "postponed"
    cancelled = "cancelled"


class TaskUpdate(BaseModel):
    status: TaskStatus


class ChatResponse(BaseModel):
    message: str
    intent: Optional[dict] = None
    actions: Optional[List[dict]] = None
    cost: float = 0.01
    balance_after: float = 0.0


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    due_date: Optional[str] = None
    created_at: str
    reminder_sent: bool = False
    checkin_sent: bool = False
