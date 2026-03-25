# PrivexBot Backend API Reference

## Overview

Complete API reference for PrivexBot Backend with detailed examples for Postman testing. This guide covers authentication, organization management, workspace creation, knowledge base operations, and advanced features.

**Base URL**: `http://localhost:8000/api/v1`

**Architecture**: Multi-tenant SaaS with organization → workspace → resources hierarchy

**Authentication**: JWT-based with multiple strategies (email/password, wallet-based)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Organization Management](#organization-management)
3. [Workspace Management](#workspace-management)
4. [Knowledge Base Draft Endpoints](#knowledge-base-draft-endpoints)
5. [KB Pipeline Monitoring](#kb-pipeline-monitoring)
6. [Knowledge Base Management](#knowledge-base-management)
7. [Content Enhancement](#content-enhancement)
8. [Enhanced Search](#enhanced-search)
9. [Error Handling](#error-handling)
10. [Postman Testing Setup](#postman-testing-setup)

---

## Authentication

### 1. User Signup (Email/Password)

**Endpoint**: `POST /auth/email/signup`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/email/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@company.com",
    "password": "SecurePass123!"
  }'
```

**Request Body**:

```json
{
  "username": "john_doe",
  "email": "john@company.com",
  "password": "SecurePass123!"
}
```

**Response** (201 Created):

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}

{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTEzOSwiaWF0IjoxNzY0MDAyNzM5fQ.3XrlK7W5xYvAmWCQtJ3Z-OWE7aihMFp0rE5-fb44lP8","token_type":"bearer","expires_in":86400}
```

### 2. User Login

**Endpoint**: `POST /auth/email/login`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@company.com",
    "password": "SecurePass123!"
  }'
```

**Request Body**:

```json
{
  "email": "john@company.com",
  "password": "SecurePass123!"
}

{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw","token_type":"bearer","expires_in":86400}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Save Token for Next Commands**:

```bash
# Save the token in an environment variable
export ACCESS_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

### 3. Get Current User

**Endpoint**: `GET /auth/me`

**Curl Command**:

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw"
```

**Response** (200 OK):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "username": "john_doe",
  "is_active": true,
  "created_at": "2024-11-24T10:30:00Z",
  "updated_at": "2024-11-24T10:30:00Z",
  "auth_methods": [
    {
      "provider": "email",
      "provider_id": "john@company.com",
      "linked_at": "2024-11-24T10:30:00Z"
    }
  ]
}
```

```
{"username":"john_doe","id":"44c294c9-5507-4a9a-b164-b381dfd909f9","is_active":true,"created_at":"2025-11-24T16:45:38.639003","updated_at":"2025-11-24T16:45:38.639006","auth_methods":[{"provider":"email","provider_id":"john@company.com","linked_at":"2025-11-24T16:45:38.886968"}]}%

```

### 4. EVM Wallet Authentication

#### Challenge (Step 1)

**Endpoint**: `POST /auth/evm/challenge`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/evm/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6635Cc12688C662Bb4bA8B04b8ad1234"
  }'
```

#### Verify (Step 2)

**Endpoint**: `POST /auth/evm/verify`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/evm/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6635Cc12688C662Bb4bA8B04b8ad1234",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "0x1234567890abcdef...",
    "username": "john_eth"
  }'
```

#### Link to Account (Step 3)

**Endpoint**: `POST /auth/evm/link`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/evm/link \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6635Cc12688C662Bb4bA8B04b8ad1234",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "0x1234567890abcdef..."
  }'
```

### 5. Solana Wallet Authentication

#### Challenge (Step 1)

**Endpoint**: `POST /auth/solana/challenge`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/solana/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
  }'
```

#### Verify (Step 2)

**Endpoint**: `POST /auth/solana/verify`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/solana/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "base58_encoded_signature",
    "username": "john_sol"
  }'
```

#### Link to Account (Step 3)

**Endpoint**: `POST /auth/solana/link`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/solana/link \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "base58_encoded_signature"
  }'
```

### 6. Cosmos Wallet Authentication

#### Challenge (Step 1)

**Endpoint**: `POST /auth/cosmos/challenge`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/cosmos/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "address": "cosmos1abc123def456ghi789jkl012mno345pqr678st"
  }'
```

#### Verify (Step 2)

**Endpoint**: `POST /auth/cosmos/verify`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/cosmos/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "cosmos1abc123def456ghi789jkl012mno345pqr678st",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "base64_encoded_signature",
    "public_key": "Ay1hY2tfcHVibGljX2tleQ==",
    "username": "john_cosmos"
  }'
```

#### Link to Account (Step 3)

**Endpoint**: `POST /auth/cosmos/link`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/auth/cosmos/link \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "cosmos1abc123def456ghi789jkl012mno345pqr678st",
    "signed_message": "privexbot.com wants you to sign in...",
    "signature": "base64_encoded_signature",
    "public_key": "Ay1hY2tfcHVibGljX2tleQ=="
  }'
```

---

## Organization Management

### 1. Create Organization

**Endpoint**: `POST /orgs/`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/orgs/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "billing_email": "billing@acme.com"
  }'
```

```
curl -X POST http://localhost:8000/api/v1/orgs/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "billing_email": "billing@acme.com"
  }'
```

```
{"id":"2b8b4b3e-04ed-4a64-be36-3bcaf8e62ad2","name":"Acme Corporation","billing_email":"billing@acme.com","avatar_url":null,"subscription_tier":"free","subscription_status":"trial","trial_ends_at":"2025-12-24T16:53:20.208481","created_by":"44c294c9-5507-4a9a-b164-b381dfd909f9","created_at":"2025-11-24T16:53:20.209350","updated_at":"2025-11-24T16:53:20.209352","member_count":1,"workspace_count":1,"user_role":"owner"}%

```

**Request Body**:

```json
{
  "name": "Acme Corporation",
  "billing_email": "billing@acme.com"
}
```

**Response** (201 Created):

```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "name": "Acme Corporation",
  "billing_email": "billing@acme.com",
  "avatar_url": null,
  "subscription_tier": "free",
  "subscription_status": "trial",
  "trial_ends_at": "2024-12-24T10:30:00Z",
  "created_by": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2024-11-24T10:30:00Z",
  "updated_at": "2024-11-24T10:30:00Z",
  "member_count": 1,
  "workspace_count": 1,
  "user_role": "owner"
}
```

### 2. Get Organization Details

**Endpoint**: `GET /orgs/{org_id}`

**Curl Command**:

```bash
# Replace ORG_ID with actual organization ID
export ORG_ID="456e7890-e89b-12d3-a456-426614174001"

curl -X GET "http://localhost:8000/api/v1/orgs/$ORG_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "name": "Acme Corporation",
  "billing_email": "billing@acme.com",
  "avatar_url": null,
  "subscription_tier": "free",
  "subscription_status": "trial",
  "trial_ends_at": "2024-12-24T10:30:00Z",
  "created_by": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2024-11-24T10:30:00Z",
  "updated_at": "2024-11-24T10:30:00Z",
  "member_count": 3,
  "workspace_count": 2,
  "user_role": "admin"
}
```

### 2. Update Organization

**Endpoint**: `PUT /orgs/{org_id}`

**Curl Command**:

```bash
curl -X PUT "http://localhost:8000/api/v1/orgs/$ORG_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation Updated",
    "billing_email": "new_billing@acme.com",
    "settings": {
      "branding": {
        "primary_color": "#007bff"
      }
    }
  }'
```

**Request Body**:

```json
{
  "name": "Acme Corporation Updated",
  "billing_email": "new_billing@acme.com",
  "settings": {
    "branding": {
      "primary_color": "#007bff"
    }
  }
}
```

**Response** (200 OK):

```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "description": "Leading AI solutions provider",
  "owner_id": "123e4567-e89b-12d3-a456-426614174000",
  "settings": {
    "billing_plan": "free",
    "features": ["chatbots", "chatflows", "knowledge_bases"],
    "usage_limits": {
      "max_chatbots": 5,
      "max_knowledge_bases": 10,
      "max_monthly_messages": 1000
    }
  },
  "updated_at": "2024-11-24T11:15:00Z"
}
```

---

## Workspace Management

### 1. Create Workspace

**Endpoint**: `POST /orgs/{org_id}/workspaces`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/orgs/$ORG_ID/workspaces" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support",
    "description": "Workspace for customer support chatbots",
    "settings": {
      "default_language": "en",
      "time_zone": "UTC"
    }
  }'
```

```
curl -X POST "http://localhost:8000/api/v1/orgs/2b8b4b3e-04ed-4a64-be36-3bcaf8e62ad2/workspaces" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support",
    "description": "Workspace for customer support chatbots",
    "settings": {
      "default_language": "en",
      "time_zone": "UTC"
    }
  }'

```

```
(base) user@users-MBP privexbot % curl -X POST "http://localhost:8000/api/v1/orgs/2b8b4b3e-04ed-4a64-be36-3bcaf8e62ad2/workspaces" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support",
    "description": "Workspace for customer support chatbots",
    "settings": {
      "default_language": "en",
      "time_zone": "UTC"
    }
  }'
{"id":"9e6e6150-f96f-4923-a21f-646b819263e8","organization_id":"2b8b4b3e-04ed-4a64-be36-3bcaf8e62ad2","name":"Customer Support","description":"Workspace for customer support chatbots","avatar_url":null,"is_default":false,"created_by":"44c294c9-5507-4a9a-b164-b381dfd909f9","created_at":"2025-11-24T16:58:08.840255","updated_at":"2025-11-24T16:58:08.840257","member_count":1,"user_role":"admin"}%

```

**Request Body**:

```json
{
  "name": "Customer Support",
  "description": "Workspace for customer support chatbots",
  "settings": {
    "default_language": "en",
    "time_zone": "UTC"
  }
}
```

**Response** (201 Created):

```json
{
  "id": "abc12345-e89b-12d3-a456-426614174003",
  "name": "Customer Support",
  "description": "Workspace for customer support chatbots",
  "org_id": "456e7890-e89b-12d3-a456-426614174001",
  "owner_id": "123e4567-e89b-12d3-a456-426614174000",
  "settings": {
    "default_language": "en",
    "time_zone": "UTC"
  },
  "created_at": "2024-11-24T11:20:00Z"
}
```

### 2. List Workspaces

**Endpoint**: `GET /orgs/{org_id}/workspaces`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/orgs/$ORG_ID/workspaces" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "items": [
    {
      "id": "789e0123-e89b-12d3-a456-426614174002",
      "name": "Default Workspace",
      "description": "Default workspace created during registration",
      "org_id": "456e7890-e89b-12d3-a456-426614174001",
      "owner_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2024-11-24T10:30:00Z"
    },
    {
      "id": "abc12345-e89b-12d3-a456-426614174003",
      "name": "Customer Support",
      "description": "Workspace for customer support chatbots",
      "org_id": "456e7890-e89b-12d3-a456-426614174001",
      "owner_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2024-11-24T11:20:00Z"
    }
  ],
  "total": 2
}
```

### 3. Get Workspace Details

**Endpoint**: `GET /orgs/{org_id}/workspaces/{workspace_id}`

**Curl Command**:

```bash
# Replace WORKSPACE_ID with actual workspace ID
export WORKSPACE_ID="abc12345-e89b-12d3-a456-426614174003"

curl -X GET "http://localhost:8000/api/v1/orgs/$ORG_ID/workspaces/$WORKSPACE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Workspace switched successfully",
  "workspace": {
    "id": "abc12345-e89b-12d3-a456-426614174003",
    "name": "Customer Support",
    "org_id": "456e7890-e89b-12d3-a456-426614174001"
  }
}
```

---

## Context Switching

### 1. Switch Organization

**Endpoint**: `POST /switch/organization`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/switch/organization \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "456e7890-e89b-12d3-a456-426614174001"
  }'
```

**Response** (200 OK):

```json
{
  "message": "Organization switched successfully",
  "organization": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "name": "Acme Corp"
  }
}
```

### 2. Switch Workspace

**Endpoint**: `POST /switch/workspace`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/switch/workspace \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "abc12345-e89b-12d3-a456-426614174003"
  }'
```

**Response** (200 OK):

```json
{
  "message": "Workspace switched successfully",
  "workspace": {
    "id": "abc12345-e89b-12d3-a456-426614174003",
    "name": "Customer Support",
    "org_id": "456e7890-e89b-12d3-a456-426614174001"
  }
}
```

### 3. Get Current Context

**Endpoint**: `GET /switch/current`

**Curl Command**:

```bash
curl -X GET http://localhost:8000/api/v1/switch/current \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john@company.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "current_organization": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "name": "Acme Corp"
  },
  "current_workspace": {
    "id": "abc12345-e89b-12d3-a456-426614174003",
    "name": "Customer Support",
    "org_id": "456e7890-e89b-12d3-a456-426614174001"
  }
}
```

---

## Knowledge Base Draft Endpoints

> **Important**: All KB creation starts in draft mode (Redis) before database save. This allows configuration, preview, and validation before finalization.

### 1. Create KB Draft

**Endpoint**: `POST /kb-drafts/`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
    "context": "both"
  }'
```

```
curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "workspace_id": "9e6e6150-f96f-4923-a21f-646b819263e8",
    "context": "both"
  }'

```

```
(base) user@users-MBP privexbot % curl -X POST http://localhost:8000/api/v1/kb-drafts/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NGMyOTRjOS01NTA3LTRhOWEtYjE2NC1iMzgxZGZkOTA5ZjkiLCJvcmdfaWQiOiJiMjJkYzZhNy0zNGU4LTQ3MmEtOTg3NS05MDJjMzkzY2NiMmQiLCJ3c19pZCI6ImM1MWQ5YTc5LWUxNjQtNDQwNi1iM2RlLTczOGMxODEyNjZmNiIsImV4cCI6MTc2NDA4OTIxNSwiaWF0IjoxNzY0MDAyODE1fQ.QiVQhxvuDFAbwsTygbR69NP7_aKizI005V7KKr10PHw" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "workspace_id": "9e6e6150-f96f-4923-a21f-646b819263e8",
    "context": "both"
  }'
{"draft_id":"draft_kb_a3b68dc0","workspace_id":"9e6e6150-f96f-4923-a21f-646b819263e8","expires_at":"2025-11-25T17:01:42.661255","message":"KB draft created successfully (stored in Redis, no database writes)"}%
(base) user@users-MBP privexbot %

```

**Request Body**:

```json
{
  "name": "Company Documentation",
  "description": "Internal documentation and guides",
  "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
  "context": "both"
}
```

**Response** (201 Created):

```json
{
  "draft_id": "draft_kb_987fcdeb-51a2-43d8-b024-123456789abc",
  "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
  "expires_at": "2024-11-25T12:00:00Z",
  "message": "KB draft created successfully (stored in Redis, no database writes)"
}
```

### 2. Add Web Source to KB Draft

**Endpoint**: `POST /kb-drafts/{draft_id}/sources/web`

**Curl Command (Single URL)**:

```bash
# Replace DRAFT_ID with actual draft ID from create response
export DRAFT_ID="draft_kb_987fcdeb-51a2-43d8-b024-123456789abc"

curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/web" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.example.com/getting-started",
    "config": {
      "method": "scrape",
      "max_pages": 1,
      "include_patterns": [],
      "exclude_patterns": ["/admin/**", "*.pdf"],
      "wait_for": "networkidle",
      "extract_metadata": true
    }
  }'
```

**Curl Command (Multiple URLs)**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/web" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://docs.example.com/getting-started",
      "https://docs.example.com/api-reference",
      "https://docs.example.com/tutorials"
    ],
    "config": {
      "method": "bulk_scrape",
      "per_url_timeout": 30,
      "max_concurrent": 3,
      "retry_attempts": 2,
      "extract_metadata": true
    },
    "per_url_configs": {
      "https://docs.example.com/api-reference": {
        "wait_for": "domcontentloaded",
        "include_code_blocks": true
      }
    }
  }'
```

**Request Body (Single URL)**:

```json
{
  "url": "https://docs.example.com/getting-started",
  "config": {
    "method": "scrape",
    "max_pages": 1,
    "include_patterns": [],
    "exclude_patterns": ["/admin/**", "*.pdf"],
    "wait_for": "networkidle",
    "extract_metadata": true
  }
}
```

**Request (Multiple URLs)**:

```json
{
  "urls": [
    "https://docs.example.com/getting-started",
    "https://docs.example.com/api-reference",
    "https://docs.example.com/tutorials"
  ],
  "config": {
    "method": "bulk_scrape",
    "per_url_timeout": 30,
    "max_concurrent": 3,
    "retry_attempts": 2,
    "extract_metadata": true
  },
  "per_url_configs": {
    "https://docs.example.com/api-reference": {
      "wait_for": "domcontentloaded",
      "include_code_blocks": true
    }
  }
}
```

**Response** (200 OK):

```json
{
  "message": "Web source(s) added successfully",
  "source_id": "source_web_456def78-91a2-43b8-c345-987654321def",
  "urls_added": [
    "https://docs.example.com/getting-started",
    "https://docs.example.com/api-reference",
    "https://docs.example.com/tutorials"
  ],
  "draft_data": {
    "draft_id": "draft_kb_987fcdeb-51a2-43d8-b024-123456789abc",
    "sources": [
      {
        "id": "source_web_456def78-91a2-43b8-c345-987654321def",
        "type": "web",
        "urls": [
          "https://docs.example.com/getting-started",
          "https://docs.example.com/api-reference",
          "https://docs.example.com/tutorials"
        ],
        "config": {
          "method": "bulk_scrape",
          "per_url_timeout": 30,
          "max_concurrent": 3,
          "retry_attempts": 2,
          "extract_metadata": true
        },
        "status": "pending",
        "added_at": "2024-11-24T12:00:00Z"
      }
    ]
  },
  "ttl_extended": true,
  "expires_at": "2024-11-25T12:00:00Z"
}
```

### 3. Add File Source to KB Draft

**Endpoint**: `POST /kb-drafts/{draft_id}/sources/files`

**Curl Command (File Upload)**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/files" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "files=@file1.pdf" \
  -F "files=@file2.docx" \
  -F 'config={
    "preserve_formatting": true,
    "extract_images": true,
    "ocr_enabled": false,
    "language": "en"
  }'
```

**Alternative with JSON config file**:

```bash
# Create config file
echo '{
  "preserve_formatting": true,
  "extract_images": true,
  "ocr_enabled": false,
  "language": "en"
}' > config.json

# Upload with config file
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/files" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "files=@file1.pdf" \
  -F "files=@file2.docx" \
  -F "config=@config.json"
```

**Form Data Structure**:

```
files: [file1.pdf, file2.docx]
config: {
  "preserve_formatting": true,
  "extract_images": true,
  "ocr_enabled": false,
  "language": "en"
}
```

**Response** (200 OK):

```json
{
  "message": "Files uploaded successfully",
  "source_id": "source_files_789abc12-34d5-67e8-f901-234567890abc",
  "files_added": [
    {
      "filename": "file1.pdf",
      "size": 1024000,
      "type": "application/pdf",
      "status": "uploaded"
    },
    {
      "filename": "file2.docx",
      "size": 512000,
      "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "status": "uploaded"
    }
  ],
  "total_files": 2,
  "total_size_bytes": 1536000,
  "ttl_extended": true,
  "expires_at": "2024-11-25T12:00:00Z"
}
```

### 4. Get KB Draft Status

**Endpoint**: `GET /kb-drafts/{draft_id}`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "draft_id": "draft_kb_987fcdeb-51a2-43d8-b024-123456789abc",
  "kb_data": {
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "config": {
      "chunking_strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200,
      "embedding_model": "text-embedding-ada-002"
    },
    "context_settings": {
      "access_mode": "all",
      "allowed_chatbots": [],
      "allowed_chatflows": []
    },
    "sources": [
      {
        "id": "source_web_456def78-91a2-43b8-c345-987654321def",
        "type": "web",
        "urls": [
          "https://docs.example.com/getting-started",
          "https://docs.example.com/api-reference",
          "https://docs.example.com/tutorials"
        ],
        "status": "pending",
        "added_at": "2024-11-24T12:00:00Z"
      },
      {
        "id": "source_files_789abc12-34d5-67e8-f901-234567890abc",
        "type": "files",
        "files": [
          { "filename": "file1.pdf", "size": 1024000 },
          { "filename": "file2.docx", "size": 512000 }
        ],
        "status": "uploaded",
        "added_at": "2024-11-24T12:05:00Z"
      }
    ],
    "workspace_id": "789e0123-e89b-12d3-a456-426614174002"
  },
  "ttl_seconds": 85800,
  "expires_at": "2024-11-25T12:00:00Z",
  "can_finalize": true
}
```

### 5. Preview KB Draft Chunking

**Endpoint**: `POST /kb-drafts/{draft_id}/preview`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/preview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "max_preview_pages": 5
  }'
```

**Request Body**:

```json
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_pages": 5
}
```

**Response** (200 OK):

```json
{
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Getting Started\n\nWelcome to our documentation. This guide will help you get up and running quickly...",
      "token_count": 156,
      "chunk_metadata": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "heading_level": 1,
        "contains_code": false,
        "language": "en"
      }
    },
    {
      "index": 1,
      "content": "## Installation\n\nTo install the application, follow these steps:\n\n1. Download the installer...",
      "token_count": 203,
      "chunk_metadata": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "heading_level": 2,
        "contains_code": false,
        "language": "en"
      }
    }
  ],
  "total_chunks_estimated": 12,
  "chunking_strategy_used": "by_heading",
  "content_analysis": {
    "content_type": "documentation",
    "structure_score": 0.8,
    "heading_count": 6,
    "code_blocks": 3,
    "total_characters": 8450
  }
}
```

### 6. Finalize KB Draft

**Endpoint**: `POST /kb-drafts/{draft_id}/finalize`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/finalize" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (201 Created):

```json
{
  "message": "Knowledge base created successfully",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "pipeline_id": "pipeline_kb_def45678_90ab_12c3_d456",
  "processing_status": "queued",
  "estimated_completion_time": "2024-11-24T12:30:00Z",
  "kb_data": {
    "id": "def45678-90ab-12c3-d456-789012345def",
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
    "status": "processing",
    "sources_count": 2,
    "created_at": "2024-11-24T12:10:00Z"
  },
  "next_steps": {
    "monitor_progress": "/api/v1/kb-pipeline/{pipeline_id}/status",
    "view_kb": "/api/v1/kbs/{kb_id}"
  }
}
```

### 7. Delete KB Draft

**Endpoint**: `DELETE /kb-drafts/{draft_id}`

**Curl Command**:

```bash
curl -X DELETE "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Draft deleted successfully",
  "draft_id": "draft_kb_987fcdeb-51a2-43d8-b024-123456789abc"
}
```

### 8. Remove Source from Draft

**Endpoint**: `DELETE /kb-drafts/{draft_id}/sources/{source_id}`

**Curl Command**:

```bash
# Replace SOURCE_ID with actual source ID
curl -X DELETE "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/$SOURCE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Source removed successfully",
  "source_id": "source_web_456def78-91a2-43b8-c345-987654321def",
  "remaining_sources": 1
}
```

### 9. Update Chunking Configuration

**Endpoint**: `POST /kb-drafts/{draft_id}/chunking`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/chunking" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "by_heading",
    "chunk_size": 1500,
    "chunk_overlap": 300,
    "preserve_code_blocks": true
  }'
```

**Request Body**:

```json
{
  "strategy": "by_heading",
  "chunk_size": 1500,
  "chunk_overlap": 300,
  "preserve_code_blocks": true
}
```

**Response** (200 OK):

```json
{
  "message": "Chunking configuration updated",
  "config": {
    "strategy": "by_heading",
    "chunk_size": 1500,
    "chunk_overlap": 300,
    "preserve_code_blocks": true
  },
  "draft_updated": true
}
```

### 10. Update Embedding Configuration

**Endpoint**: `POST /kb-drafts/{draft_id}/embedding`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/embedding" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true
  }'
```

**Request Body**:

```json
{
  "model": "all-MiniLM-L6-v2",
  "device": "cpu",
  "batch_size": 32,
  "normalize_embeddings": true
}
```

**Response** (200 OK):

```json
{
  "message": "Embedding configuration updated",
  "config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true
  },
  "draft_updated": true
}
```

### 11. Update Vector Store Configuration

**Endpoint**: `POST /kb-drafts/{draft_id}/vector-store`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/vector-store" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "qdrant",
    "connection_config": {
      "url": "http://localhost:6333",
      "api_key": null,
      "collection_name": "kb_example",
      "timeout": 30
    },
    "metadata_config": {
      "store_full_content": true,
      "indexed_fields": ["document_id", "page_number", "content_type"],
      "filterable_fields": ["document_id", "created_at", "workspace_id"]
    },
    "performance_config": {
      "cache_enabled": true,
      "cache_ttl": 3600,
      "batch_upsert": true,
      "batch_size": 100
    }
  }'
```

**Request Body**:

```json
{
  "provider": "qdrant",
  "connection_config": {
    "url": "http://localhost:6333",
    "api_key": null,
    "collection_name": "kb_example",
    "timeout": 30
  },
  "metadata_config": {
    "store_full_content": true,
    "indexed_fields": ["document_id", "page_number", "content_type"],
    "filterable_fields": ["document_id", "created_at", "workspace_id"]
  },
  "performance_config": {
    "cache_enabled": true,
    "cache_ttl": 3600,
    "batch_upsert": true,
    "batch_size": 100
  }
}
```

**Response** (200 OK):

```json
{
  "message": "Vector store configuration updated",
  "config": {
    "provider": "qdrant",
    "connection_config": {
      "url": "http://localhost:6333",
      "api_key": null,
      "collection_name": "kb_example",
      "timeout": 30
    },
    "metadata_config": {
      "store_full_content": true,
      "indexed_fields": ["document_id", "page_number", "content_type"],
      "filterable_fields": ["document_id", "created_at", "workspace_id"]
    },
    "performance_config": {
      "cache_enabled": true,
      "cache_ttl": 3600,
      "batch_upsert": true,
      "batch_size": 100
    }
  },
  "draft_updated": true
}
```

### 12. Validate KB Draft

**Endpoint**: `GET /kb-drafts/{draft_id}/validate`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/validate" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "valid": true,
  "validation_results": {
    "sources": {
      "count": 2,
      "valid": true,
      "issues": []
    },
    "configuration": {
      "valid": true,
      "chunking_strategy": "valid",
      "embedding_model": "valid",
      "issues": []
    },
    "content": {
      "estimated_chunks": 147,
      "estimated_processing_time": "2-3 minutes",
      "content_size_mb": 2.5
    }
  },
  "can_finalize": true,
  "issues": [],
  "warnings": ["Large number of chunks may result in longer processing time"]
}
```

### 13. Preview Chunking (Generic)

**Endpoint**: `POST /kb-drafts/preview`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-drafts/preview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Sample Content\n\nThis is sample content for chunking preview...",
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200
  }'
```

**Request Body**:

```json
{
  "content": "# Sample Content\n\nThis is sample content for chunking preview...",
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200
}
```

**Response** (200 OK):

```json
{
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Sample Content\n\nThis is sample content...",
      "token_count": 45,
      "chunk_metadata": {
        "strategy": "by_heading",
        "heading_level": 1
      }
    }
  ],
  "total_chunks": 1,
  "strategy_used": "by_heading",
  "estimated_processing_time": "5 seconds"
}
```

### 14. Get Draft Pages

**Endpoint**: `GET /kb-drafts/{draft_id}/pages`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/pages" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "pages": [
    {
      "index": 0,
      "url": "https://docs.example.com/getting-started",
      "title": "Getting Started Guide",
      "content_preview": "# Getting Started\n\nWelcome to our platform...",
      "word_count": 1250,
      "status": "scraped",
      "scraped_at": "2024-11-24T12:00:00Z"
    },
    {
      "index": 1,
      "url": "https://docs.example.com/api-reference",
      "title": "API Reference",
      "content_preview": "# API Reference\n\n## Authentication...",
      "word_count": 2100,
      "status": "scraped",
      "scraped_at": "2024-11-24T12:01:30Z"
    }
  ],
  "total_pages": 2,
  "total_word_count": 3350
}
```

### 15. Get Specific Draft Page

**Endpoint**: `GET /kb-drafts/{draft_id}/pages/{page_index}`

**Curl Command**:

```bash
# Get first page (index 0)
curl -X GET "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/pages/0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "page": {
    "index": 0,
    "url": "https://docs.example.com/getting-started",
    "title": "Getting Started Guide",
    "content": "# Getting Started\n\nWelcome to our platform. This comprehensive guide will help you get up and running quickly with our API...\n\n## Installation\n\nTo install our SDK...",
    "metadata": {
      "word_count": 1250,
      "character_count": 6800,
      "headings": 5,
      "code_blocks": 3,
      "images": 2
    },
    "scraped_at": "2024-11-24T12:00:00Z"
  }
}
```

### 16. Get Draft Chunks

**Endpoint**: `GET /kb-drafts/{draft_id}/chunks`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/chunks?limit=10&offset=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "chunks": [
    {
      "index": 0,
      "content": "# Getting Started\n\nWelcome to our platform. This guide will help you get up and running quickly...",
      "token_count": 156,
      "source_page": 0,
      "chunk_metadata": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "heading_level": 1,
        "contains_code": false
      }
    },
    {
      "index": 1,
      "content": "## Installation\n\nTo install our SDK, you can use npm or yarn...",
      "token_count": 203,
      "source_page": 0,
      "chunk_metadata": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "heading_level": 2,
        "contains_code": true
      }
    }
  ],
  "total_chunks": 147,
  "total_pages": 2,
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

---

## KB Pipeline Monitoring

> **Important**: Frontend should poll these endpoints every 2 seconds to show real-time progress during KB processing.

### 1. Get Pipeline Status

**Endpoint**: `GET /kb-pipeline/{pipeline_id}/status`

**Curl Command**:

```bash
# Replace PIPELINE_ID with actual pipeline ID from finalize response
export PIPELINE_ID="pipeline_kb_def45678_90ab_12c3_d456"

curl -X GET "http://localhost:8000/api/v1/kb-pipeline/$PIPELINE_ID/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Continuous Monitoring Script**:

```bash
#!/bin/bash
echo "Monitoring pipeline: $PIPELINE_ID"
while true; do
  STATUS=$(curl -s "http://localhost:8000/api/v1/kb-pipeline/$PIPELINE_ID/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.status')

  echo "$(date): Status: $STATUS"

  if [[ "$STATUS" == "completed" ]] || [[ "$STATUS" == "failed" ]] || [[ "$STATUS" == "cancelled" ]]; then
    echo "Pipeline finished with status: $STATUS"
    break
  fi

  sleep 2
done
```

**Response** (200 OK):

```json
{
  "pipeline_id": "pipeline_kb_def45678_90ab_12c3_d456",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "status": "running",
  "current_stage": "scraping",
  "progress_percentage": 35,
  "stats": {
    "pages_discovered": 8,
    "pages_scraped": 3,
    "pages_failed": 0,
    "chunks_created": 0,
    "embeddings_generated": 0,
    "vectors_indexed": 0
  },
  "started_at": "2024-11-24T12:10:15Z",
  "updated_at": "2024-11-24T12:12:45Z",
  "estimated_completion": "2024-11-24T12:25:00Z"
}
```

**Status Values**:

- `queued`: Pipeline queued for processing
- `running`: Currently processing
- `completed`: Successfully completed
- `failed`: Processing failed
- `cancelled`: Cancelled by user

**Stage Values**:

- `scraping`: Fetching content from sources
- `parsing`: Parsing and cleaning content
- `chunking`: Creating text chunks
- `embedding`: Generating embeddings
- `indexing`: Storing in vector database

### 2. Get Pipeline Logs

**Endpoint**: `GET /kb-pipeline/{pipeline_id}/logs?limit=50`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kb-pipeline/$PIPELINE_ID/logs?limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Live Log Monitoring**:

```bash
# Watch logs in real-time
watch -n 2 "curl -s 'http://localhost:8000/api/v1/kb-pipeline/$PIPELINE_ID/logs?limit=10' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' | jq -r '.logs[] | "\(.timestamp) [\(.level)] \(.message)"'"
```

**Response** (200 OK):

```json
{
  "pipeline_id": "pipeline_kb_def45678_90ab_12c3_d456",
  "logs": [
    {
      "timestamp": "2024-11-24T12:10:15Z",
      "level": "info",
      "message": "Pipeline started",
      "details": {
        "sources_count": 2,
        "total_urls": 3,
        "total_files": 2
      }
    },
    {
      "timestamp": "2024-11-24T12:10:30Z",
      "level": "info",
      "message": "Starting web scraping",
      "details": {
        "urls": [
          "https://docs.example.com/getting-started",
          "https://docs.example.com/api-reference",
          "https://docs.example.com/tutorials"
        ]
      }
    },
    {
      "timestamp": "2024-11-24T12:11:15Z",
      "level": "info",
      "message": "Successfully scraped URL",
      "details": {
        "url": "https://docs.example.com/getting-started",
        "content_length": 8450,
        "extraction_time": "2.3s"
      }
    },
    {
      "timestamp": "2024-11-24T12:12:20Z",
      "level": "warning",
      "message": "Slow response from URL",
      "details": {
        "url": "https://docs.example.com/api-reference",
        "response_time": "8.5s",
        "timeout_threshold": "10s"
      }
    }
  ]
}
```

### 3. Cancel Pipeline

**Endpoint**: `POST /kb-pipeline/{pipeline_id}/cancel`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kb-pipeline/$PIPELINE_ID/cancel" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Pipeline cancellation requested",
  "pipeline_id": "pipeline_kb_def45678_90ab_12c3_d456",
  "status": "cancelled"
}
```

---

## Knowledge Base Management

### 1. List Knowledge Bases

**Endpoint**: `GET /kbs/?workspace_id={workspace_id}&status={status}&context={context}`

**Curl Command**:

```bash
# List all KBs in organization
curl -X GET "http://localhost:8000/api/v1/kbs/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# List KBs in specific workspace
curl -X GET "http://localhost:8000/api/v1/kbs/?workspace_id=$WORKSPACE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# List active KBs for chatbots only
curl -X GET "http://localhost:8000/api/v1/kbs/?status=active&context=chatbot" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
[
  {
    "id": "def45678-90ab-12c3-d456-789012345def",
    "name": "Company Documentation",
    "description": "Internal documentation and guides",
    "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
    "status": "active",
    "stats": {
      "total_documents": 5,
      "total_chunks": 147,
      "total_size_bytes": 2048000,
      "last_updated": "2024-11-24T12:25:00Z"
    },
    "created_at": "2024-11-24T12:10:00Z",
    "updated_at": "2024-11-24T12:25:00Z",
    "created_by": "123e4567-e89b-12d3-a456-426614174000"
  }
]
```

### 2. Get Knowledge Base Details

**Endpoint**: `GET /kbs/{kb_id}`

**Curl Command**:

```bash
# Replace KB_ID with actual KB ID from finalize or list response
export KB_ID="def45678-90ab-12c3-d456-789012345def"

curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "id": "def45678-90ab-12c3-d456-789012345def",
  "name": "Company Documentation",
  "description": "Internal documentation and guides",
  "workspace_id": "789e0123-e89b-12d3-a456-426614174002",
  "status": "active",
  "config": {
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32
  },
  "vector_store_config": {
    "provider": "qdrant",
    "collection_name": "kb_def45678"
  },
  "indexing_method": "gpu_optimized",
  "stats": {
    "total_documents": 5,
    "total_chunks": 147,
    "total_size_bytes": 2048000,
    "last_updated": "2024-11-24T12:25:00Z"
  },
  "total_documents": 5,
  "total_chunks": 147,
  "error_message": null,
  "created_at": "2024-11-24T12:10:00Z",
  "updated_at": "2024-11-24T12:25:00Z",
  "created_by": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 3. Delete Knowledge Base

**Endpoint**: `DELETE /kbs/{kb_id}`

**Curl Command**:

```bash
curl -X DELETE "http://localhost:8000/api/v1/kbs/$KB_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "KB 'Company Documentation' deletion queued",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "note": "Qdrant collection deletion is processing in background"
}
```

### 4. Reindex Knowledge Base

**Endpoint**: `POST /kbs/{kb_id}/reindex`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kbs/$KB_ID/reindex" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Re-indexing queued for KB 'Company Documentation'",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "task_id": "abc123-def456-789ghi",
  "status": "queued",
  "note": "Re-indexing will regenerate all embeddings and update Qdrant. This may take several minutes."
}
```

### 5. Get Knowledge Base Stats

**Endpoint**: `GET /kbs/{kb_id}/stats`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "stats": {
    "total_documents": 5,
    "total_chunks": 147,
    "vector_count": 147,
    "storage_size_mb": 2.5,
    "avg_chunk_size": 850,
    "embedding_model": "text-embedding-ada-002",
    "last_indexed": "2024-11-24T12:25:00Z"
  },
  "health": {
    "vector_db_status": "healthy",
    "postgres_status": "healthy",
    "sync_status": "up_to_date"
  }
}
```

### 6. Create KB Document

**Endpoint**: `POST /kbs/{kb_id}/documents`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kbs/$KB_ID/documents" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Installation Guide",
    "content": "# Installation Guide\n\nTo install...",
    "source_type": "manual",
    "metadata": {
      "author": "John Doe",
      "category": "documentation"
    }
  }'
```

**Request Body**:

```json
{
  "name": "Installation Guide",
  "content": "# Installation Guide\n\nTo install...",
  "source_type": "manual",
  "metadata": {
    "author": "John Doe",
    "category": "documentation"
  }
}
```

**Response** (200 OK):

```json
{
  "document_id": "doc_789012-345abc-678def",
  "filename": "new_guide.pdf",
  "status": "pending"
}
```

### 7. List KB Documents

**Endpoint**: `GET /kbs/{kb_id}/documents?skip=0&limit=50`

**Curl Command**:

```bash
curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID/documents?skip=0&limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "items": [
    {
      "id": "doc_123456",
      "kb_id": "def45678-90ab-12c3-d456-789012345def",
      "source_type": "web",
      "source_url": "https://docs.example.com/getting-started",
      "title": "Getting Started Guide",
      "status": "completed",
      "metadata": {
        "content_type": "documentation",
        "page_count": 12,
        "word_count": 2450,
        "last_updated": "2024-11-24T12:25:00Z"
      },
      "created_at": "2024-11-24T12:10:00Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 50
}
```

### 6. Preview Rechunk Strategy

**Endpoint**: `POST /kbs/{kb_id}/preview-rechunk`

**Curl Command**:

```bash
curl -X POST "http://localhost:8000/api/v1/kbs/$KB_ID/preview-rechunk" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chunking_strategy": "semantic",
    "chunk_size": 1200,
    "chunk_overlap": 200,
    "document_ids": ["doc_123456"]
  }'
```

**Request Body**:

```json
{
  "chunking_strategy": "semantic",
  "chunk_size": 1200,
  "chunk_overlap": 200,
  "document_ids": ["doc_123456"]
}
```

**Response** (200 OK):

```json
{
  "preview": {
    "current_chunks": 35,
    "estimated_new_chunks": 42,
    "sample_chunks": [
      {
        "content": "## Overview\n\nThis guide covers the installation process...",
        "token_count": 127,
        "strategy": "semantic"
      }
    ]
  },
  "comparison": {
    "chunk_count_change": "+7",
    "avg_chunk_size_change": "+150 tokens",
    "estimated_processing_time": "2-3 minutes"
  }
}
```

### 8. Get KB Document Details

**Endpoint**: `GET /kbs/{kb_id}/documents/{document_id}`

**Curl Command**:

```bash
export DOCUMENT_ID="doc_123456"

curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "id": "doc_123456",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "name": "Getting Started Guide",
  "source_type": "web",
  "source_url": "https://docs.example.com/getting-started",
  "status": "completed",
  "content_full": "# Getting Started Guide\n\n## Overview...",
  "chunks_count": 35,
  "metadata": {
    "content_type": "documentation",
    "page_count": 12,
    "word_count": 2450,
    "extracted_at": "2024-11-24T12:15:00Z",
    "chunking_strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "created_at": "2024-11-24T12:10:00Z",
  "updated_at": "2024-11-24T12:25:00Z"
}
```

### 9. Update KB Document

**Endpoint**: `PUT /kbs/{kb_id}/documents/{document_id}`

**Curl Command**:

```bash
curl -X PUT "http://localhost:8000/api/v1/kbs/$KB_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Installation Guide",
    "content": "# Updated Installation Guide\n\n## New Overview...",
    "metadata": {
      "author": "Jane Smith",
      "version": "2.0",
      "last_reviewed": "2024-11-24"
    }
  }'
```

**Request Body**:

```json
{
  "name": "Updated Installation Guide",
  "content": "# Updated Installation Guide\n\n## New Overview...",
  "metadata": {
    "author": "Jane Smith",
    "version": "2.0",
    "last_reviewed": "2024-11-24"
  }
}
```

**Response** (200 OK):

```json
{
  "id": "doc_123456",
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "name": "Updated Installation Guide",
  "source_type": "manual",
  "status": "processing",
  "metadata": {
    "author": "Jane Smith",
    "version": "2.0",
    "last_reviewed": "2024-11-24"
  },
  "updated_at": "2024-11-24T14:30:00Z"
}
```

### 10. Delete KB Document

**Endpoint**: `DELETE /kbs/{kb_id}/documents/{document_id}`

**Curl Command**:

```bash
curl -X DELETE "http://localhost:8000/api/v1/kbs/$KB_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Document deleted successfully",
  "document_id": "doc_123456",
  "chunks_deleted": 35,
  "vectors_deleted": 35
}
```

### 11. List KB Chunks

**Endpoint**: `GET /kbs/{kb_id}/chunks?document_id={document_id}&skip=0&limit=50`

**Curl Command**:

```bash
# List all chunks for the KB
curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID/chunks?skip=0&limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# List chunks for specific document
curl -X GET "http://localhost:8000/api/v1/kbs/$KB_ID/chunks?document_id=$DOCUMENT_ID&skip=0&limit=50" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "items": [
    {
      "id": "chunk_abc123-def456-789ghi",
      "document_id": "doc_123456",
      "kb_id": "def45678-90ab-12c3-d456-789012345def",
      "content": "## Installation\n\nTo install the application...",
      "position": 0,
      "chunk_index": 0,
      "chunk_metadata": {
        "token_count": 245,
        "strategy": "by_heading",
        "heading": "Installation",
        "chunk_size": 1000,
        "chunk_overlap": 200
      },
      "created_at": "2024-11-24T12:15:00Z"
    }
  ],
  "total": 147,
  "skip": 0,
  "limit": 50
}
```

---

## Content Enhancement

> **Advanced Features**: Content cleanup, OCR, and intelligent strategy recommendations.

### 1. Enhance Content

**Endpoint**: `POST /content-enhancement/enhance-content`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/content-enhancement/enhance-content \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Welcome! 🎉\n\nThis is our documentation with lots of emojis 😊 and tracking links: https://example.com/track?utm_source=newsletter&utm_campaign=promo...",
    "url": "https://docs.example.com/page",
    "remove_emojis": true,
    "filter_unwanted_links": true,
    "enable_deduplication": true,
    "normalize_whitespace": true,
    "merge_short_lines": true
  }'
```

**Request Body**:

```json
{
  "content": "# Welcome! 🎉\n\nThis is our documentation with lots of emojis 😊 and tracking links: https://example.com/track?utm_source=newsletter&utm_campaign=promo...",
  "url": "https://docs.example.com/page",
  "remove_emojis": true,
  "filter_unwanted_links": true,
  "enable_deduplication": true,
  "normalize_whitespace": true,
  "merge_short_lines": true
}
```

**Response** (200 OK):

```json
{
  "enhanced_content": "# Welcome!\n\nThis is our documentation with clean links: https://example.com/...",
  "enhancement_stats": {
    "original_length": 156,
    "enhanced_length": 98,
    "emojis_removed": 3,
    "links_filtered": 1,
    "duplicates_removed": 0,
    "improvement_score": 0.87
  },
  "metadata": {
    "processed_at": "2024-11-24T13:15:00Z",
    "config_applied": {
      "remove_emojis": true,
      "filter_unwanted_links": true,
      "enable_deduplication": true
    },
    "enhancement_applied": true
  }
}
```

### 2. Extract Image Text (OCR)

**Endpoint**: `POST /content-enhancement/extract-image-text`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/content-enhancement/extract-image-text \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check out this diagram: ![Installation Steps](https://example.com/images/install.png)",
    "url": "https://docs.example.com/page",
    "enabled": true,
    "max_images": 5,
    "min_confidence": 60.0,
    "language": "eng"
  }'
```

**Request Body**:

```json
{
  "content": "Check out this diagram: ![Installation Steps](https://example.com/images/install.png)",
  "url": "https://docs.example.com/page",
  "enabled": true,
  "max_images": 5,
  "min_confidence": 60.0,
  "language": "eng"
}
```

**Response** (200 OK):

```json
{
  "enhanced_content": "Check out this diagram: ![Installation Steps](https://example.com/images/install.png)\n\n[OCR Text from install.png]: Step 1: Download installer Step 2: Run setup.exe Step 3: Follow wizard",
  "ocr_results": [
    {
      "image_url": "https://example.com/images/install.png",
      "extracted_text": "Step 1: Download installer\nStep 2: Run setup.exe\nStep 3: Follow wizard",
      "confidence_score": 89.5,
      "processing_time": "1.2s",
      "image_size": "800x600",
      "success": true,
      "error_message": null
    }
  ],
  "ocr_stats": {
    "images_processed": 1,
    "successful_extractions": 1,
    "total_text_extracted": 67,
    "average_confidence": 89.5
  },
  "metadata": {
    "processed_at": "2024-11-24T13:20:00Z",
    "ocr_config": {
      "enabled": true,
      "max_images": 5,
      "min_confidence": 60.0,
      "language": "eng"
    },
    "ocr_available": true
  }
}
```

### 3. Recommend Strategy

**Endpoint**: `POST /content-enhancement/recommend-strategy`

**Curl Command**:

````bash
curl -X POST http://localhost:8000/api/v1/content-enhancement/recommend-strategy \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# API Reference\n\n## Authentication\n\n### POST /auth/login\n\n```bash\ncurl -X POST...\n```\n\n### Response\n\n```json\n{\"token\": \"...\"}",
    "url": "https://docs.example.com/api"
  }'
````

**Request Body**:

````json
{
  "content": "# API Reference\n\n## Authentication\n\n### POST /auth/login\n\n```bash\ncurl -X POST...\n```\n\n### Response\n\n```json\n{\"token\": \"...\"}",
  "url": "https://docs.example.com/api"
}
````

**Response** (200 OK):

```json
{
  "recommended_strategy": {
    "strategy": "by_heading",
    "chunk_size": 1200,
    "chunk_overlap": 200,
    "max_pages": 100,
    "max_depth": 3
  },
  "content_analysis": {
    "content_type": "code_documentation",
    "structure_score": 0.9,
    "complexity_score": 0.7,
    "heading_count": 3,
    "heading_density": 0.6,
    "code_density": 0.4,
    "avg_paragraph_length": 85,
    "total_characters": 256
  },
  "recommendation_reasoning": "Content is well-structured API documentation with clear headings and code examples. By-heading strategy will preserve API endpoint organization while maintaining context.",
  "alternative_strategies": {
    "documentation": "by_heading - Best for structured docs",
    "blog_content": "paragraph_based - Best for articles",
    "code_content": "by_section - Best for repositories",
    "academic": "semantic - Best for papers",
    "mixed_content": "adaptive - Best for unknown types"
  },
  "metadata": {
    "analyzed_at": "2024-11-24T13:25:00Z",
    "service_available": true
  }
}
```

### 4. List Strategy Presets

**Endpoint**: `GET /content-enhancement/presets`

**Curl Command**:

```bash
curl -X GET http://localhost:8000/api/v1/content-enhancement/presets \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Response** (200 OK):

```json
{
  "presets": {
    "documentation": {
      "chunking_strategy": "by_heading",
      "chunk_size": 1200,
      "chunk_overlap": 200,
      "description": "Best for structured documentation with clear headings"
    },
    "blog": {
      "chunking_strategy": "paragraph_based",
      "chunk_size": 800,
      "chunk_overlap": 150,
      "description": "Best for blog posts and articles"
    },
    "code_repository": {
      "chunking_strategy": "by_section",
      "chunk_size": 1500,
      "chunk_overlap": 300,
      "description": "Best for code repositories and technical content"
    },
    "academic_paper": {
      "chunking_strategy": "semantic",
      "chunk_size": 1000,
      "chunk_overlap": 200,
      "description": "Best for academic papers and research content"
    }
  },
  "content_types": [
    "documentation",
    "blog",
    "code_repository",
    "academic_paper",
    "tutorial",
    "news_article",
    "reference_manual",
    "forum_discussion",
    "product_specs",
    "unknown"
  ],
  "metadata": {
    "total_presets": 4,
    "service_available": true
  }
}
```

### 5. Enhanced Content Preview

**Endpoint**: `POST /content-enhancement/enhanced-preview`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/content-enhancement/enhanced-preview \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.example.com/getting-started",
    "apply_enhancement": true,
    "apply_ocr": false,
    "auto_strategy": true,
    "strategy": null,
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "max_preview_chunks": 3
  }'
```

**Request Body**:

```json
{
  "url": "https://docs.example.com/getting-started",
  "apply_enhancement": true,
  "apply_ocr": false,
  "auto_strategy": true,
  "strategy": null,
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "max_preview_chunks": 3
}
```

**Response** (200 OK):

```json
{
  "preview_chunks": [
    {
      "index": 0,
      "content": "# Getting Started\n\nWelcome to our platform. This guide will help you get up and running quickly.",
      "token_count": 156,
      "chunk_metadata": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "heading_level": 1,
        "enhanced": true
      }
    }
  ],
  "total_chunks_estimated": 8,
  "chunking_strategy_used": "by_heading",
  "content_analysis": {
    "content_type": "documentation",
    "structure_score": 0.8,
    "enhancement_applied": true
  },
  "enhancement_options": {
    "content_enhancement_applied": true,
    "ocr_applied": false,
    "auto_strategy_applied": true
  },
  "available_apis": {
    "content_enhancement": "/api/v1/content-enhancement/enhance-content",
    "ocr_processing": "/api/v1/content-enhancement/extract-image-text",
    "strategy_recommendation": "/api/v1/content-enhancement/recommend-strategy",
    "strategy_presets": "/api/v1/content-enhancement/presets"
  }
}
```

### 6. Enhancement Service Health

**Endpoint**: `GET /content-enhancement/health`

**Curl Command**:

```bash
curl -X GET http://localhost:8000/api/v1/content-enhancement/health
```

**Response** (200 OK):

```json
{
  "services": {
    "content_enhancement": {
      "available": true,
      "status": "healthy"
    },
    "ocr": {
      "available": false,
      "status": "dependencies_missing"
    },
    "strategy_recommendation": {
      "available": true,
      "status": "healthy"
    }
  },
  "overall_status": "healthy",
  "checked_at": "2024-11-24T13:30:00Z",
  "backward_compatibility": "maintained"
}
```

---

## Enhanced Search

> **Advanced Features**: Context-aware search with adaptive strategies and confidence scoring.

### 1. Enhanced Search

**Endpoint**: `POST /enhanced-search/`

**Curl Command**:

```bash
curl -X POST http://localhost:8000/api/v1/enhanced-search/ \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kb_id": "'$KB_ID'",
    "query": "How do I configure authentication?",
    "search_strategy": "adaptive",
    "top_k": 5,
    "include_reasoning": true,
    "requester_type": "chatbot",
    "requester_id": "chatbot_123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Request Body**:

```json
{
  "kb_id": "def45678-90ab-12c3-d456-789012345def",
  "query": "How do I configure authentication?",
  "search_strategy": "adaptive",
  "top_k": 5,
  "include_reasoning": true,
  "requester_type": "chatbot",
  "requester_id": "chatbot_123e4567-e89b-12d3-a456-426614174000"
}
```

**Response** (200 OK):

````json
{
  "results": [
    {
      "chunk_id": "chunk_auth_123-456-789",
      "content": "## Authentication Configuration\n\nTo configure authentication, you need to set up the following environment variables:\n\n- `SECRET_KEY`: JWT signing key\n- `DATABASE_URL`: Database connection...",
      "score": 0.95,
      "confidence": 0.92,
      "document_id": "doc_config_guide",
      "page_url": "https://docs.example.com/configuration",
      "page_title": "Configuration Guide",
      "content_type": "documentation",
      "strategy_used": "adaptive",
      "context_type": "chatbot",
      "reasoning": "High relevance for authentication configuration query. Content contains specific setup instructions."
    },
    {
      "chunk_id": "chunk_auth_456-789-012",
      "content": "### JWT Configuration\n\nThe application uses JWT tokens for authentication. Configure these settings:\n\n```json\n{\n  \"jwt_secret\": \"your-secret-key\",\n  \"jwt_expiry\": 3600\n}",
      "score": 0.89,
      "confidence": 0.87,
      "document_id": "doc_api_reference",
      "page_url": "https://docs.example.com/api/auth",
      "page_title": "Authentication API",
      "content_type": "code_documentation",
      "strategy_used": "adaptive",
      "context_type": "chatbot",
      "reasoning": "Contains specific JWT configuration details relevant to authentication setup."
    }
  ],
  "search_strategy_used": "adaptive",
  "total_results": 2,
  "processing_time_ms": 45.67,
  "fallback_used": false
}
````

### 2. Enhanced Search Health Check

**Endpoint**: `GET /enhanced-search/health`

**Response** (200 OK):

```json
{
  "status": "healthy",
  "service": "enhanced_search_service",
  "features": [
    "adaptive_chunking_analysis",
    "context_aware_search",
    "metadata_filtering",
    "confidence_scoring",
    "backward_compatibility"
  ]
}
```

---

## Error Handling

### Standard Error Response Format

All API endpoints return errors in this format:

```json
{
  "detail": "Error message",
  "error_code": "ERROR_TYPE",
  "timestamp": "2024-11-24T13:35:00Z",
  "request_id": "req_123456789"
}
```

### Common HTTP Status Codes

| Status | Description           | Example                    |
| ------ | --------------------- | -------------------------- |
| `400`  | Bad Request           | Invalid request parameters |
| `401`  | Unauthorized          | Missing or invalid token   |
| `403`  | Forbidden             | Insufficient permissions   |
| `404`  | Not Found             | Resource doesn't exist     |
| `422`  | Validation Error      | Invalid input data         |
| `429`  | Too Many Requests     | Rate limit exceeded        |
| `500`  | Internal Server Error | Server error               |
| `503`  | Service Unavailable   | Service temporarily down   |

### Authentication Errors

**Missing Token**:

```json
{
  "detail": "Not authenticated",
  "error_code": "MISSING_TOKEN",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

**Invalid Token**:

```json
{
  "detail": "Could not validate credentials",
  "error_code": "INVALID_TOKEN",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

**Expired Token**:

```json
{
  "detail": "Token has expired",
  "error_code": "EXPIRED_TOKEN",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

### Access Control Errors

**Workspace Access Denied**:

```json
{
  "detail": "Access to workspace denied",
  "error_code": "WORKSPACE_ACCESS_DENIED",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

**KB Access Denied**:

```json
{
  "detail": "This knowledge base is not accessible by chatbots",
  "error_code": "KB_ACCESS_DENIED",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

### Validation Errors

**Invalid URL**:

```json
{
  "detail": [
    {
      "loc": ["body", "url"],
      "msg": "invalid or unreachable URL",
      "type": "value_error.url"
    }
  ],
  "error_code": "VALIDATION_ERROR",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

**Missing Required Fields**:

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ],
  "error_code": "VALIDATION_ERROR",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

### Service Errors

**Service Unavailable**:

```json
{
  "detail": "Content enhancement service not available",
  "error_code": "SERVICE_UNAVAILABLE",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

**Pipeline Error**:

```json
{
  "detail": "Pipeline processing failed: connection timeout",
  "error_code": "PIPELINE_FAILED",
  "timestamp": "2024-11-24T13:35:00Z"
}
```

---

## Postman Testing Setup

### 1. Environment Variables

Create a Postman environment with these variables:

```json
{
  "base_url": "http://localhost:8000/api/v1",
  "access_token": "",
  "user_id": "",
  "org_id": "",
  "workspace_id": "",
  "kb_id": "",
  "draft_id": "",
  "pipeline_id": ""
}
```

### 2. Collection Setup

Import this collection structure:

```
PrivexBot API Tests/
├── Authentication/
│   ├── Register User
│   ├── Login User
│   └── Get Current User
├── Organization Management/
│   ├── Get Organization
│   └── Update Organization
├── Workspace Management/
│   ├── Create Workspace
│   ├── List Workspaces
│   └── Switch Workspace
├── KB Draft Operations/
│   ├── Create KB Draft
│   ├── Add Web Source
│   ├── Add File Source
│   ├── Get Draft Status
│   ├── Preview Chunking
│   └── Finalize Draft
├── KB Pipeline Monitoring/
│   ├── Get Pipeline Status
│   ├── Get Pipeline Logs
│   └── Cancel Pipeline
├── Knowledge Base Management/
│   ├── List Knowledge Bases
│   ├── Get KB Details
│   ├── Update KB
│   ├── Query KB
│   ├── Get KB Analytics
│   ├── Add Document
│   ├── List Documents
│   └── Delete KB
├── Content Enhancement/
│   ├── Enhance Content
│   ├── Extract Image Text
│   ├── Recommend Strategy
│   ├── List Presets
│   ├── Enhanced Preview
│   └── Health Check
└── Enhanced Search/
    ├── Enhanced Search
    └── Health Check
```

### 3. Pre-request Scripts

For authenticated endpoints, add this pre-request script:

```javascript
// Set authorization header
if (pm.environment.get("access_token")) {
  pm.request.headers.add({
    key: "Authorization",
    value: "Bearer " + pm.environment.get("access_token"),
  });
}
```

### 4. Test Scripts

For login endpoint, add this test script to save the token:

```javascript
// Save access token from login response
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set("access_token", response.access_token);
  pm.environment.set("user_id", response.user.id);
  pm.environment.set("org_id", response.user.org_id);
  pm.environment.set("workspace_id", response.user.current_workspace_id);

  console.log("Token saved:", response.access_token);
}
```

For KB creation, save the KB ID:

```javascript
// Save KB ID from finalization response
if (pm.response.code === 201) {
  const response = pm.response.json();
  pm.environment.set("kb_id", response.kb_id);
  pm.environment.set("pipeline_id", response.pipeline_id);

  console.log("KB ID saved:", response.kb_id);
  console.log("Pipeline ID saved:", response.pipeline_id);
}
```

### 5. Testing Workflow

**Complete Testing Sequence**:

1. **Setup**

   - Register user → Save tokens
   - Create organization (automatic)
   - Create workspace

2. **KB Draft Creation**

   - Create KB draft → Save `draft_id`
   - Add web source(s)
   - Add file source(s)
   - Preview chunking
   - Finalize draft → Save `kb_id` and `pipeline_id`

3. **Monitor Processing**

   - Poll pipeline status (every 2s until completed)
   - View pipeline logs
   - Check for errors

4. **KB Operations**

   - List knowledge bases
   - Get KB details
   - Query KB for testing
   - View analytics

5. **Advanced Features**
   - Test content enhancement
   - Test OCR (if available)
   - Test strategy recommendations
   - Test enhanced search

### 6. Performance Testing

**Key Metrics to Monitor**:

- Authentication: < 200ms
- KB Draft operations: < 1s
- Pipeline status: < 50ms
- KB queries: < 500ms
- Content enhancement: < 2s
- Enhanced search: < 100ms

### 7. Common Test Scenarios

**Happy Path**:

```
Register → Login → Create Workspace → Create KB Draft →
Add Sources → Preview → Finalize → Monitor Pipeline →
Test KB Query → Test Enhanced Search
```

**Error Scenarios**:

```
Invalid credentials → Expired token → Access denied →
Invalid URLs → Large file uploads → Pipeline failures →
Service unavailable
```

---

## Additional Notes

### Rate Limiting

- Authentication endpoints: 5 requests/minute
- KB operations: 100 requests/minute
- Pipeline monitoring: No limit (designed for polling)
- Search operations: 200 requests/minute

### File Upload Limits

- Max file size: 50MB per file
- Max files per request: 10 files
- Supported formats: PDF, DOCX, TXT, MD, CSV, JSON, XML, HTML

### URL Scraping Limits

- Max URLs per request: 50 URLs
- Max pages per crawl: 1000 pages
- Max crawl depth: 10 levels
- Request timeout: 30 seconds per page

### Pipeline Processing Times

| Source Type              | Typical Duration |
| ------------------------ | ---------------- |
| Single URL               | 5-15 seconds     |
| Multiple URLs (5-10)     | 30-60 seconds    |
| File upload (PDF)        | 10-30 seconds    |
| Large crawl (100+ pages) | 5-15 minutes     |

### Webhook Events (Future)

The API will support webhook notifications for:

- Pipeline completion
- KB processing status changes
- Error notifications
- Usage limit warnings

---

## Complete Testing Scripts

### Environment Variables Setup

Before running any curl commands, set up these environment variables:

```bash
# Base configuration
export BASE_URL="http://localhost:8000/api/v1"

# Authentication (will be set after login)
export ACCESS_TOKEN=""

# Entity IDs (will be set during testing flow)
export USER_ID=""
export ORG_ID=""
export WORKSPACE_ID=""
export KB_ID=""
export DRAFT_ID=""
export PIPELINE_ID=""
export SOURCE_ID=""
```

### Complete Testing Workflow Script

```bash
#!/bin/bash

# Complete PrivexBot API Testing Script
# This script demonstrates the full workflow from registration to KB operations

set -e  # Exit on error

echo "=== PrivexBot API Testing Workflow ==="
echo

# Step 1: Register User
echo "1. Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "first_name": "Test",
    "last_name": "User",
    "org_name": "Test Organization"
  }')

echo "Registration response: $REGISTER_RESPONSE"
echo

# Step 2: Login and get token
echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }')

# Extract token and IDs
export ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
export USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
export ORG_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.org_id')
export WORKSPACE_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.current_workspace_id')

echo "Login successful. Token: ${ACCESS_TOKEN:0:20}..."
echo "User ID: $USER_ID"
echo "Org ID: $ORG_ID"
echo "Workspace ID: $WORKSPACE_ID"
echo

# Step 3: Create KB Draft
echo "3. Creating KB draft..."
DRAFT_RESPONSE=$(curl -s -X POST "$BASE_URL/kb-drafts/create" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Knowledge Base",
    "description": "Test KB for API workflow",
    "config": {
      "chunking_strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  }')

export DRAFT_ID=$(echo "$DRAFT_RESPONSE" | jq -r '.draft_id')
echo "Draft created: $DRAFT_ID"
echo

# Step 4: Add web source
echo "4. Adding web source..."
SOURCE_RESPONSE=$(curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/sources/web" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/html",
    "config": {
      "method": "scrape",
      "extract_metadata": true
    }
  }')

export SOURCE_ID=$(echo "$SOURCE_RESPONSE" | jq -r '.source_id')
echo "Source added: $SOURCE_ID"
echo

# Step 5: Preview chunking
echo "5. Previewing chunking..."
PREVIEW_RESPONSE=$(curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/preview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "'$SOURCE_ID'",
    "url": "https://httpbin.org/html",
    "max_preview_chunks": 3
  }')

echo "Preview chunks: $(echo "$PREVIEW_RESPONSE" | jq '.total_chunks_estimated') estimated"
echo

# Step 6: Finalize KB
echo "6. Finalizing KB..."
FINALIZE_RESPONSE=$(curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/finalize" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

export KB_ID=$(echo "$FINALIZE_RESPONSE" | jq -r '.kb_id')
export PIPELINE_ID=$(echo "$FINALIZE_RESPONSE" | jq -r '.pipeline_id')

echo "KB created: $KB_ID"
echo "Pipeline ID: $PIPELINE_ID"
echo

# Step 7: Monitor pipeline
echo "7. Monitoring pipeline..."
for i in {1..30}; do
  STATUS_RESPONSE=$(curl -s "$BASE_URL/kb-pipeline/$PIPELINE_ID/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress_percentage')

  echo "Status: $STATUS, Progress: $PROGRESS%"

  if [[ "$STATUS" == "completed" ]] || [[ "$STATUS" == "failed" ]]; then
    break
  fi

  sleep 2
done
echo

# Step 8: Query KB
echo "8. Querying KB..."
QUERY_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases/$KB_ID/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test content",
    "top_k": 3
  }')

RESULTS_COUNT=$(echo "$QUERY_RESPONSE" | jq '.results | length')
echo "Query returned $RESULTS_COUNT results"
echo

# Step 9: Enhanced search
echo "9. Testing enhanced search..."
ENHANCED_RESPONSE=$(curl -s -X POST "$BASE_URL/enhanced-search/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kb_id": "'$KB_ID'",
    "query": "test content",
    "search_strategy": "adaptive",
    "top_k": 3
  }')

ENHANCED_COUNT=$(echo "$ENHANCED_RESPONSE" | jq '.total_results')
echo "Enhanced search returned $ENHANCED_COUNT results"
echo

echo "=== Testing completed successfully! ==="
echo "Saved environment variables:"
echo "KB_ID: $KB_ID"
echo "DRAFT_ID: $DRAFT_ID"
echo "PIPELINE_ID: $PIPELINE_ID"
echo "ACCESS_TOKEN: ${ACCESS_TOKEN:0:20}..."
```

### Individual API Testing Functions

```bash
# Source this file to get helper functions
# Save as: api_helpers.sh

# Test authentication
test_auth() {
  echo "Testing authentication..."
  curl -X GET "$BASE_URL/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
}

# Test KB creation workflow
test_kb_workflow() {
  echo "Testing KB workflow..."

  # Create draft
  DRAFT_ID=$(curl -s -X POST "$BASE_URL/kb-drafts/create" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": "Quick Test KB"}' | jq -r '.draft_id')

  echo "Created draft: $DRAFT_ID"

  # Add source
  curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/sources/web" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://httpbin.org/html"}' > /dev/null

  echo "Added source"

  # Finalize
  KB_ID=$(curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/finalize" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.kb_id')

  echo "Finalized KB: $KB_ID"
}

# Test content enhancement
test_enhancement() {
  echo "Testing content enhancement..."
  curl -X POST "$BASE_URL/content-enhancement/enhance-content" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "content": "Test content with emojis 🎉 and links http://example.com?utm=test",
      "remove_emojis": true,
      "filter_unwanted_links": true
    }'
}

# Monitor pipeline with live updates
monitor_pipeline() {
  local pipeline_id="$1"
  echo "Monitoring pipeline: $pipeline_id"

  while true; do
    response=$(curl -s "$BASE_URL/kb-pipeline/$pipeline_id/status" \
      -H "Authorization: Bearer $ACCESS_TOKEN")

    status=$(echo "$response" | jq -r '.status')
    progress=$(echo "$response" | jq -r '.progress_percentage')
    stage=$(echo "$response" | jq -r '.current_stage')

    echo "$(date '+%H:%M:%S') - Status: $status, Stage: $stage, Progress: $progress%"

    if [[ "$status" == "completed" ]] || [[ "$status" == "failed" ]] || [[ "$status" == "cancelled" ]]; then
      echo "Pipeline finished with status: $status"
      break
    fi

    sleep 2
  done
}
```

## Quick Start Commands

### One-Line Complete Test

```bash
# Complete workflow in one command (requires jq)
export BASE_URL="http://localhost:8000/api/v1" && \
export ACCESS_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"TestPass123!"}' | jq -r '.access_token') && \
export DRAFT_ID=$(curl -s -X POST "$BASE_URL/kb-drafts/create" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"name":"Quick Test"}' | jq -r '.draft_id') && \
curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/sources/web" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"url":"https://httpbin.org/html"}' && \
export KB_ID=$(curl -s -X POST "$BASE_URL/kb-drafts/$DRAFT_ID/finalize" -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.kb_id') && \
echo "KB Created: $KB_ID"
```

### Web-Based Testing Tools

**Using HTTPie (alternative to curl)**:

```bash
# Install: pip install httpie

# Register
http POST localhost:8000/api/v1/auth/register email=test@example.com password=TestPass123! first_name=Test last_name=User org_name="Test Org"

# Login and save token
http POST localhost:8000/api/v1/auth/login email=test@example.com password=TestPass123!
export TOKEN="your_token_here"

# Create KB
http POST localhost:8000/api/v1/kb-drafts/create Authorization:"Bearer $TOKEN" name="Test KB"
```

**Using Postman CLI**:

```bash
# Install Postman CLI
npm install -g @postman/newman

# Export collection from Postman and run
newman run PrivexBot-API-Collection.json -e PrivexBot-Environment.json
```

**Using VS Code REST Client**:

```http
### Register User
POST http://localhost:8000/api/v1/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPass123!",
  "first_name": "Test",
  "last_name": "User",
  "org_name": "Test Org"
}

### Login
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPass123!"
}
```

---

This comprehensive API reference provides complete testing coverage for all PrivexBot Backend endpoints. You can use the curl commands directly in terminal, import the Postman collection for GUI testing, or use the provided scripts for automated testing workflows.
