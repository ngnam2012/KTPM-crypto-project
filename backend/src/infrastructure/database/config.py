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

def apply_migrations():
    import sqlalchemy
    try:
        with engine.connect() as conn:
            for query in [
                "ALTER TABLE strategy_definitions ADD COLUMN user_id TEXT",
                "ALTER TABLE strategy_definitions ADD COLUMN description TEXT",
                "ALTER TABLE strategy_definitions ADD COLUMN source_prompt TEXT",
                "ALTER TABLE backtest_results ADD COLUMN user_id TEXT",
                "ALTER TABLE trade_records ADD COLUMN symbol TEXT",
                "ALTER TABLE trade_records ADD COLUMN volume_usd FLOAT DEFAULT 100.0",
                "ALTER TABLE trade_records ADD COLUMN stop_loss FLOAT",
                "ALTER TABLE trade_records ADD COLUMN take_profit FLOAT",
                "ALTER TABLE trade_records ADD COLUMN fee FLOAT DEFAULT 0.0",
                "ALTER TABLE trade_records ADD COLUMN slippage FLOAT DEFAULT 0.0",
                "ALTER TABLE trade_records ADD COLUMN profit_usd FLOAT DEFAULT 0.0",
            ]:
                try:
                    conn.execute(sqlalchemy.text(query))
                except Exception:
                    pass
            conn.commit()
    except Exception:
        pass

apply_migrations()

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
