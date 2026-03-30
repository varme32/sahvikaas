#!/bin/bash

# API Testing Script for StudyHub Session Tracking
# This script tests all the room-related API endpoints

echo "🧪 Testing StudyHub API Endpoints"
echo "=================================="
echo ""

# Configuration
API_URL="http://localhost:5000"
TOKEN=""  # Add your JWT token here after login

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local auth=$5

  echo -n "Testing: $name... "
  
  if [ "$auth" = "true" ]; then
    if [ -z "$TOKEN" ]; then
      echo -e "${YELLOW}SKIPPED${NC} (No token provided)"
      return
    fi
    headers="-H 'Authorization: Bearer $TOKEN'"
  else
    headers=""
  fi

  if [ "$method" = "GET" ]; then
    response=$(eval curl -s -w "\n%{http_code}" $headers "$API_URL$endpoint")
  else
    response=$(eval curl -s -w "\n%{http_code}" -X $method $headers -H "Content-Type: application/json" -d "'$data'" "$API_URL$endpoint")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✅ PASSED${NC} (HTTP $http_code)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}❌ FAILED${NC} (HTTP $http_code)"
    echo "Response: $body"
    FAILED=$((FAILED + 1))
  fi
}

echo "1. Testing Health Check"
echo "----------------------"
test_endpoint "Health Check" "GET" "/api/health" "" "false"
echo ""

echo "2. Testing WebRTC ICE Config"
echo "----------------------------"
test_endpoint "WebRTC ICE Config" "GET" "/api/webrtc/ice" "" "false"
echo ""

echo "3. Testing Room Endpoints (Requires Auth)"
echo "-----------------------------------------"
echo "Note: Set TOKEN variable in this script after logging in"
echo ""

test_endpoint "Get Active Rooms" "GET" "/api/rooms/" "" "true"
test_endpoint "Get User Room Stats" "GET" "/api/rooms/user/stats" "" "true"
test_endpoint "Get User Room History" "GET" "/api/rooms/user/history" "" "true"
echo ""

echo "4. Testing In-Memory Meeting Endpoints"
echo "--------------------------------------"
test_endpoint "List Meetings" "GET" "/api/meetings" "" "false"
echo ""

echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Login to get a JWT token"
  echo "2. Add the token to this script (TOKEN variable)"
  echo "3. Run the script again to test authenticated endpoints"
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Ensure backend is running: npm run dev"
  echo "2. Check MongoDB connection"
  echo "3. Verify .env configuration"
  echo "4. Check server logs for errors"
fi
echo ""
