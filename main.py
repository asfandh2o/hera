from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.logging import configure_logging, get_logger
from api.routes import auth, employees, prompts, tasks, metrics, projects, tickets
from db.session import engine, Base

configure_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="HERA - Flow Orchestrator",
    description="NORA's intelligent task orchestrator. Breaks prompts into tasks and routes them smartly.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(prompts.router)
app.include_router(tasks.router)
app.include_router(metrics.router)
app.include_router(projects.router)
app.include_router(tickets.router)


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("hera_started", environment=settings.ENVIRONMENT)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("hera_shutting_down")
    await engine.dispose()


@app.get("/")
async def root():
    return {"service": "HERA", "version": "1.0.0", "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
