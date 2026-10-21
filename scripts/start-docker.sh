#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  VoxMind — Local-First Voice Intelligence Platform"
echo "  Starting Containerized Services..."
echo "=========================================================="

if [ ! -f ".env" ]; then
    echo "[VoxMind] Creating .env from .env.example..."
    cp .env.example .env
fi

if [ "$1" == "--build" ]; then
    docker compose up -d --build
elif [ "$1" == "--down" ]; then
    docker compose down
    exit 0
else
    docker compose up -d
fi

echo "[VoxMind] Services started. Waiting for health checks..."
sleep 5
docker compose ps

echo ""
echo "[VoxMind] Application URLs:"
echo "  * Frontend UI:   http://localhost:5173"
echo "  * REST API:      http://localhost:5000/api/v1"
echo "  * AI Service:    http://localhost:8000"
echo "  * Health Check:  http://localhost:5000/health"
