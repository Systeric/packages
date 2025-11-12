#!/bin/bash

# pg-queue-tester API Test Requests
# Copy and paste individual curl commands directly

echo "=== Health Check ==="
curl -X GET "http://localhost:3001/health"
echo -e "\n"

echo "=== Get Queue Stats ==="
curl -X GET "http://localhost:3001/stats"
echo -e "\n"

echo "=== Enqueue Email (Success) ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.send",
    "payload": {
      "to": "user@example.com",
      "subject": "Test Email",
      "body": "This is a test email"
    },
    "priority": 5,
    "maxRetries": 3
  }'
echo -e "\n"

echo "=== Enqueue Email (Will Fail) ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.send",
    "payload": {
      "to": "fail@example.com",
      "subject": "Test Email",
      "body": "This email will fail"
    },
    "priority": 3,
    "maxRetries": 3
  }'
echo -e "\n"

echo "=== Enqueue SMS ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sms.send",
    "payload": {
      "phone": "+1234567890",
      "message": "Test SMS"
    },
    "priority": 3,
    "maxRetries": 3
  }'
echo -e "\n"

echo "=== Enqueue Webhook ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "webhook.post",
    "payload": {
      "url": "https://httpbin.org/post",
      "data": {
        "event": "test"
      }
    },
    "priority": 5,
    "maxRetries": 3
  }'
echo -e "\n"

echo "=== Enqueue Task (High Priority) ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task.process",
    "payload": {
      "taskName": "Generate Report",
      "shouldFail": false
    },
    "priority": 1,
    "maxRetries": 5
  }'
echo -e "\n"

echo "=== Enqueue Task (Will Fail) ==="
curl -X POST "http://localhost:3001/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task.process",
    "payload": {
      "taskName": "Import Data",
      "shouldFail": true,
      "failReason": "Database connection timeout"
    },
    "priority": 5,
    "maxRetries": 3
  }'
echo -e "\n"

echo "=== Get PENDING Messages ==="
curl -X GET "http://localhost:3001/messages/PENDING?limit=10"
echo -e "\n"

echo "=== Get PROCESSING Messages ==="
curl -X GET "http://localhost:3001/messages/PROCESSING?limit=10"
echo -e "\n"

echo "=== Get COMPLETED Messages ==="
curl -X GET "http://localhost:3001/messages/COMPLETED?limit=10"
echo -e "\n"

echo "=== Get FAILED Messages ==="
curl -X GET "http://localhost:3001/messages/FAILED?limit=10"
echo -e "\n"

echo "=== Get DEAD_LETTER Messages ==="
curl -X GET "http://localhost:3001/messages/DEAD_LETTER?limit=10"
echo -e "\n"
