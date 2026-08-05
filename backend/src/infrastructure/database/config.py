import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Get DATABASE_URL from environment variables, fallback to SQLite for local dev
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./crypto_lab.db")

# For SQLite, we need connect_args={"check_same_thread": False} to allow multi-thread access in FastAPI
# This is not needed for PostgreSQL
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency to get a database session per request.
    Yields a session and automatically closes it after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
