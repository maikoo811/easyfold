from fastapi import FastAPI

from easyfold.api.v1 import router as v1_router

app = FastAPI(title="EasyFold API", version="0.1.0")
app.include_router(v1_router, prefix="/api/v1")
