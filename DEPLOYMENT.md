# WhatsFlow - Production Deployment & Operations Guide

This guide details instructions for deploying and operating WhatsFlow in production environments.

---

## 🏗️ 1. Architecture Overview

```
                      ┌────────────────────────────┐
                      │    Nginx Reverse Proxy     │
                      │  (Port 80/443 SSL Enforced)│
                      └─────────────┬──────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        ┌──────────────────┐               ┌──────────────────┐
        │  React Frontend  │               │   Express API    │
        │  (Static Bundle) │               │   (Port 5000)    │
        └──────────────────┘               └────────┬─────────┘
                                                    │
                                      ┌─────────────┴─────────────┐
                                      ▼                           ▼
                              ┌───────────────┐           ┌───────────────┐
                              │  MongoDB 7.0  │           │   Redis 7.2   │
                              │  (Data Store) │           │ (BullMQ Broker│
                              └───────────────┘           └───────┬───────┘
                                                                  │
                                                                  ▼
                                                          ┌───────────────┐
                                                          │ BullMQ Worker │
                                                          └───────┬───────┘
                                                                  │
                                                                  ▼
                                                      ┌───────────────────────┐
                                                      │  Meta WhatsApp Cloud  │
                                                      │     API (v20.0)       │
                                                      └───────────────────────┘
```

---

## 🐳 2. Quick Production Deployment with Docker Compose

WhatsFlow includes a fully orchestrated Docker Compose stack:

### Step 1: Clone and Configure Environment
```bash
cp .env.example .env
```

Ensure production values are set in `.env`:
```env
NODE_ENV=production
DEMO_MODE=false
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/whatsflow
REDIS_URL=redis://redis:6379
JWT_SECRET=<generate_a_64_char_random_hex>
JWT_REFRESH_SECRET=<generate_a_64_char_random_hex>
ENCRYPTION_KEY=<generate_a_32_byte_hex_key>

WHATSAPP_API_VERSION=v20.0
WHATSAPP_PHONE_NUMBER_ID=<your_meta_phone_number_id>
WHATSAPP_BUSINESS_ACCOUNT_ID=<your_meta_business_account_id>
WHATSAPP_ACCESS_TOKEN=<your_meta_system_user_permanent_token>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<secure_webhook_token>
```

### Step 2: Build and Run Services
```bash
docker compose up --build -d
```

### Step 3: Check Health
```bash
docker compose ps
docker compose logs -f api
```

---

## 🌐 3. Configuring Meta WhatsApp Webhooks

1. Open **[Meta for Developers](https://developers.facebook.com/)** ➔ Select your WhatsApp App.
2. In the left sidebar, click **WhatsApp** ➔ **Configuration**.
3. Under **Webhook**, click **Edit**:
   * **Callback URL**: `https://your-domain.com/api/webhooks/whatsapp`
   * **Verify Token**: Must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (default: `whatsflow_verify_token_secure`).
4. Click **Verify and Save**.
5. Click **Manage Subscriptions** and subscribe to:
   * `messages` (delivers delivery receipts: `sent`, `delivered`, `read`, `failed` and inbound replies).

---

## ☁️ 4. Cloud Deployments

### A. AWS (ECS Fargate + DocumentDB + ElastiCache)
1. Deploy `api` and `worker` Docker images to AWS ECR.
2. Launch an ECS Fargate service for `api` with an Application Load Balancer (ALB) and HTTPS certificate via AWS ACM.
3. Launch an independent ECS Fargate task for `worker`.
4. Point `MONGODB_URI` to AWS DocumentDB (or MongoDB Atlas).
5. Point `REDIS_URL` to AWS ElastiCache for Redis.

### B. Railway / Render / DigitalOcean
- **Backend Service**:
  - Deploy `apps/api/Dockerfile`
  - Set environment variables (`NODE_ENV=production`, `DEMO_MODE=false`, `MONGODB_URI`, `REDIS_URL`)
- **Worker Service**:
  - Deploy identical image with command override: `node dist/worker.js`
- **Frontend Service**:
  - Deploy static Vite build or `apps/web/Dockerfile`.

---

## 📊 5. Monitoring & Operational Runbooks

- **Interactive API Documentation**: Available in your browser at `https://your-domain.com/api/docs`.
- **Health Check Endpoint**: `GET /health` returns JSON status, timestamp, and demo mode state.
- **Log Management**: All production logs output JSON with structured request IDs, campaign IDs, and message IDs.
- **WhatsApp API Rate Limits**: Worker includes automatic throttling configured for Meta Tier 1 (80 messages/sec envelope) with exponential backoff on HTTP 429 responses.
