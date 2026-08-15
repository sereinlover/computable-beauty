import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from routers import analysis, harness, health

# Local dev only — containers get config via docker-compose.base.yml's env_file
# instead, and this path doesn't exist there. Return value also signals
# uvicorn's reload= below (see __main__).
USING_LOCAL_ENV = load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env.local")

# Root logger defaults to WARNING, which would drop harness's logger.info(...) calls.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI(title="Computable Beauty — Engine")
app.include_router(health.router)
app.include_router(analysis.router)
app.include_router(harness.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Flatten FastAPI's default {"detail": ...} shape to the project's {"error", "message"} contract."""
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": "http_error", "message": str(exc.detail)})


if __name__ == "__main__":
    import uvicorn

    # reload=USING_LOCAL_ENV: file-watching only makes sense in local dev —
    # containers never change source at runtime, so this is False there too.
    uvicorn.run(
        "main:app",
        host=os.getenv("ENGINE_HOST", "0.0.0.0"),
        port=int(os.environ["ENGINE_PORT"]),
        reload=USING_LOCAL_ENV,
    )
