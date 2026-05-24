from fastapi import APIRouter

from easyfold.api.v1.health import router as health_router
from easyfold.api.v1.jobs import router as jobs_router
from easyfold.api.v1.sequences import router as sequences_router

router = APIRouter()
router.include_router(health_router)
router.include_router(sequences_router)
router.include_router(jobs_router)
