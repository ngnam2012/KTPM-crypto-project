import logging
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from src.infrastructure.database.config import get_db
from src.infrastructure.database.models import UserModel, StrategyDefinitionModel, BacktestResultModel
from src.infrastructure.database.repositories import UserRepository
from src.core.security import get_password_hash, verify_password, create_access_token, decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Authorization"])
user_repo = UserRepository()

# Schemas
class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

class UserLoginRequest(BaseModel):
    username: str  # Can be username or email
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    created_at: Optional[str] = None
    stats: Dict[str, Any]

# Dependency to extract and verify JWT Token
def extract_token_from_header(authorization: Optional[str] = Header(None, alias="Authorization")) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(extract_token_from_header)
) -> UserModel:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    user = user_repo.get(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_optional_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(extract_token_from_header)
) -> Optional[UserModel]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = payload.get("sub")
    user = user_repo.get(db, user_id)
    if not user or not user.is_active:
        return None
    return user


@router.post("/register", response_model=TokenResponse)
async def register_user(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user account, hashes the password, and returns a JWT access token.
    """
    username = request.username.strip()
    email = request.email.strip().lower()
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format.")

    # Check if username or email is already taken
    existing_user = user_repo.get_by_username(db, username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another.")
    
    existing_email = user_repo.get_by_email(db, email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

    # Create new user
    user_id = str(uuid4())
    hashed_pwd = get_password_hash(request.password)
    
    new_user = UserModel(
        id=user_id,
        username=username,
        email=email,
        hashed_password=hashed_pwd,
        full_name=request.full_name.strip() if request.full_name else username,
        role="trader",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token = create_access_token({"sub": new_user.id, "username": new_user.username, "role": new_user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role,
            is_active=new_user.is_active,
            created_at=new_user.created_at.isoformat() if new_user.created_at else None
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user with username/email and password, returning a JWT access token.
    """
    identifier = request.username.strip()
    user = user_repo.get_by_username_or_email(db, identifier)
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been disabled."
        )

    # Generate JWT
    token = create_access_token({"sub": user.id, "username": user.username, "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at.isoformat() if user.created_at else None
        )
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the currently authenticated user's profile and quantitative stats.
    """
    strategies_count = db.query(StrategyDefinitionModel).filter(
        StrategyDefinitionModel.user_id == current_user.id
    ).count()

    backtests_count = db.query(BacktestResultModel).filter(
        BacktestResultModel.user_id == current_user.id
    ).count()

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
        stats={
            "saved_strategies": strategies_count,
            "total_backtests": backtests_count,
            "account_status": "Active Trader" if current_user.role == "trader" else current_user.role.title()
        }
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows the authenticated user to update their account password.
    """
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password does not match.")
    
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    current_user.hashed_password = get_password_hash(request.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Password updated successfully."}
