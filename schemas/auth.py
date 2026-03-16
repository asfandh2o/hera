from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    email: str
    role: str  # "admin" or "employee"
    name: str = ""


class EmployeeLoginRequest(BaseModel):
    email: str
