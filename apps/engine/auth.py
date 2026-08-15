import os

from fastapi import Header, HTTPException, status


def verify_internal_token(x_internal_token: str = Header(...)) -> None:
    """FastAPI dependency — rejects requests missing/mismatching X-Internal-Token.

    Engine never faces the browser; this only needs to stop stray/unauthenticated
    callers, not defend against a sophisticated attacker.
    """
    expected = os.environ.get("INTERNAL_TOKEN")
    if not expected or x_internal_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid or missing X-Internal-Token"},
        )
