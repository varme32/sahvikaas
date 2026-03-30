#!/bin/bash

# Deployment Script for StudyHub
# This script builds and deploys the frontend to GitHub Pages

echo "🚀 StudyHub Deployment Script"
echo "=============================="
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo ""
    echo "Please create .env.production with your backend URL:"
    echo "  VITE_API_URL=https://your-backend-url.onrender.com"
    echo ""
    echo "See .env.production.example for reference"
    exit 1
fi

# Show backend URL being used
echo "📡 Backend URL:"
cat .env.production | grep VITE_API_URL
echo ""

# Confirm deployment
read -p "Deploy to GitHub Pages? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "📦 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Check if gh-pages is installed
if ! npm list gh-pages > /dev/null 2>&1; then
    echo "📥 Installing gh-pages..."
    npm install -D gh-pages
fi

echo "🚀 Deploying to GitHub Pages..."
npx gh-pages -d dist

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Your app will be available at:"
    echo "  https://varma22.github.io/sahvikaas/"
    echo ""
    echo "Note: It may take a few minutes for changes to appear"
else
    echo "❌ Deployment failed!"
    exit 1
fi
