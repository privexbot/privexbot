#!/bin/bash
# Install Playwright browsers in the running container

echo "Installing Playwright browsers..."

# Install Playwright and its dependencies
python -m playwright install chromium
python -m playwright install-deps

echo "Playwright installation complete!"
echo "Please restart your backend service if needed."