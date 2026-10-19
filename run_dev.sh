#!/usr/bin/env bash
# ==============================================================================
# GlucoTwin - One-Click Developer & Demo Launch Script (macOS / Linux / WSL)
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================================================="
echo "       GlucoTwin - Metabolic Digital Twin Dev Environment        "
echo "================================================================="

# 1. Check .env configuration
ENV_FILE="$ROOT_DIR/backend/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        echo "[-] backend/.env missing. Automatically copying from .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "[+] backend/.env created with default demo configuration (MOCK_GEMINI=true)."
    else
        echo "[!] WARNING: backend/.env and .env.example are missing!"
        echo "    Create backend/.env with MOCK_GEMINI=true to run offline demo."
    fi
else
    echo "[OK] backend/.env found."
fi

# 2. Check model artifacts in backend/models/
MODELS_DIR="$ROOT_DIR/backend/models"
EXPECTED_MODELS=("twin_recommender.pkl" "meals_db.pkl" "shanghai_clinical.pkl" "model_manifest.json")
MISSING_MODELS=()

for model in "${EXPECTED_MODELS[@]}"; do
    if [ ! -f "$MODELS_DIR/$model" ]; then
        MISSING_MODELS+=("$model")
    fi
done

if [ ${#MISSING_MODELS[@]} -gt 0 ]; then
    echo "[!] WARNING: The following trained model files are missing in backend/models/:"
    for m in "${MISSING_MODELS[@]}"; do
        echo "    - $m"
    done
    echo "    The server will run with mock/baseline fallbacks. Refer to README.md for Colab export."
else
    echo "[OK] All core model artifacts verified in backend/models/."
fi

# 3. Setup Python Virtual Environment
VENV_DIR="$ROOT_DIR/backend/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
PIP_BIN="$VENV_DIR/bin/pip"

if [ ! -f "$PYTHON_BIN" ]; then
    echo "[-] Creating virtual environment in backend/.venv..."
    python3 -m venv "$VENV_DIR"
    echo "[OK] Virtual environment created."
else
    echo "[OK] Python virtual environment found."
fi

# 4. Install backend dependencies
echo "[-] Verifying backend dependencies..."
"$PIP_BIN" install -r "$ROOT_DIR/backend/requirements.txt" --quiet
echo "[OK] Backend dependencies verified."

# 5. Seed synthetic demo patients
echo "[-] Seeding 3 labelled synthetic demo patients (idempotent)..."
"$PYTHON_BIN" "$ROOT_DIR/scripts/seed_demo.py"

# 6. Verify and install frontend dependencies
FRONTEND_DIR="$ROOT_DIR/frontend"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[-] Installing frontend dependencies with npm..."
    (cd "$FRONTEND_DIR" && npm install)
    echo "[OK] Frontend packages installed."
else
    echo "[OK] Frontend node_modules verified."
fi

# 7. Launch servers and trap exit for cleanup
echo ""
echo "================================================================="
echo "  Starting Backend (Uvicorn :8000) and Frontend (Vite :5173)...   "
echo "  Press Ctrl+C to terminate both servers.                        "
echo "================================================================="
echo ""

cleanup() {
    echo ""
    echo "[-] Shutting down servers..."
    kill "$BACKEND_PID" 2>/dev/null || true
    echo "[OK] Backend server stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
(
    cd "$ROOT_DIR/backend"
    "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!

# Wait 2 seconds and attempt to open browser
(
    sleep 2
    if command -v xdg-open > /dev/null; then
        xdg-open "http://localhost:5173" 2>/dev/null || true
    elif command -v open > /dev/null; then
        open "http://localhost:5173" 2>/dev/null || true
    elif command -v python3 > /dev/null; then
        python3 -m webbrowser "http://localhost:5173" 2>/dev/null || true
    fi
) &

# Run frontend Vite dev server in foreground
(
    cd "$FRONTEND_DIR"
    npm run dev -- --port 5173
)
