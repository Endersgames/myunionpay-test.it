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


class CoachingProfileUpdate(BaseModel):
    current_job: str = Field(default="", max_length=180)
    weekly_work_hours: int = Field(default=40, ge=0, le=120)
    weekly_network_time_hours: float = Field(default=3.0, ge=0, le=80)
    sales_network_experience: str = Field(default="", max_length=200)
    economic_goal: str = Field(default="", max_length=1500)
    urgency_level: str = Field(default="media", max_length=20)
    personal_dreams_goals: str = Field(default="", max_length=1800)
    deep_motivation: str = Field(default="", max_length=1800)
    stress_level: str = Field(default="medio", max_length=20)
    family_context: str = Field(default="", max_length=1200)
    sustainable_availability: str = Field(default="", max_length=1200)


class CoachingProfileResponse(BaseModel):
    id: str = ""
    user_id: str
    current_job: str = ""
    weekly_work_hours: int = 40
    weekly_network_time_hours: float = 3.0
    sales_network_experience: str = ""
    economic_goal: str = ""
    urgency_level: str = "media"
    personal_dreams_goals: str = ""
    deep_motivation: str = ""
    stress_level: str = "medio"
    family_context: str = ""
    sustainable_availability: str = ""
    wellbeing_first: bool = True
    exists: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
