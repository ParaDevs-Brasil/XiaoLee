from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from fastapi.responses import EventSourceResponse
from datetime import datetime
import json
import asyncio

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/status")
async def status():
    return {"status": "running"}
