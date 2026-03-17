#!/bin/sh
# LetsRevise Production Health Check
# Pings the backend /api/health endpoint and reports success/failure.

URL="https://letsrevise-new.onrender.com/api/health"

if command -v curl >/dev/null 2>&1; then
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$URL"); then
        if [ "$response" = "200" ]; then
            echo "SUCCESS: Backend is healthy (HTTP 200)"
            curl -s "$URL" | head -1
            exit 0
        else
            echo "FAILURE: Unexpected status $response"
            exit 1
        fi
    else
        echo "FAILURE: Could not reach backend"
        exit 1
    fi
else
    echo "FAILURE: curl not found"
    exit 1
fi
