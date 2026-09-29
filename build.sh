#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

# If node and npm are available, rebuild frontend bundle
if command -v npm &> /dev/null; then
  echo "==> Node and npm detected. Building frontend assets..."
  npm install
  npm run build
else
  echo "==> npm not found in environment. Using pre-built dist/ assets."
fi

echo "==> Build completed successfully."
