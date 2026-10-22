import pytest
from app.migrations import run_migrations

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure database schema and migrations are fully applied before running tests."""
    run_migrations()
