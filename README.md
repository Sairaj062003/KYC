# KYC AI Verification System

**Flairminds Software Pvt. Ltd.** — Technology That Empowers Identity

> Intelligent, AI-powered Know Your Customer (KYC) verification platform combining OCR, LLM extraction, vector similarity search, and a full CI/CD DevOps pipeline.

---

## Architecture

```
[User Browser]
      │
   [Nginx :80/:443]  ← reverse proxy
      ├── /api/*  → [Node.js/Express Backend :5000]
      └── /*      → [React/Next.js Frontend :3000]
                          │
           ┌──────────────┼──────────────────┐
           │              │                  │
    [PostgreSQL :5432] [Qdrant :6333]   [Ollama :11434]
```

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React / Next.js 14, Tailwind CSS |
| Backend | Node.js / Express.js |
| Auth | JWT (24h expiry) |
| OCR | Tesseract.js + poppler-utils |
| LLM | Ollama (LLaMA3 / Mistral) |
| Database | PostgreSQL 15 |
| Vector DB | Qdrant |
| Deployment | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx |

---

## Prerequisites

- **Docker** v24+ & **Docker Compose** v2.20+
- **Git**
- Minimum **8GB RAM** (Ollama requires significant memory for LLM inference)
- ~10GB disk space for Docker images and model weights

---

## Quick Start — Local Development

### 1. Clone the repository

```bash
git clone https://github.com/your-org/kyc-ai-system.git
cd kyc-ai-system
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

**Required changes in `.env`:**
- `JWT_SECRET` — Set to a strong random string (minimum 32 characters)
- `POSTGRES_PASSWORD` — Change from default for security

### 3. Start all services

```bash
docker-compose up --build
```

This will start:
- **Nginx** on port `80`
- **Frontend** on port `3000` (proxied via Nginx)
- **Backend** on port `5000` (proxied via Nginx at `/api`)
- **PostgreSQL** on port `5432`
- **Qdrant** on port `6333`
- **Ollama** on port `11434` (auto-pulls LLaMA3 + nomic-embed-text models on first start)

### 4. Access the application

- **Web UI**: http://localhost
- **API**: http://localhost/api/health
- **Qdrant Dashboard**: http://localhost:6333/dashboard

### 5. Create an admin user

Register a normal user first, then promote to admin via SQL:

```bash
docker-compose exec postgres psql -U kyc_user -d kyc_db -c \
  "UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';"
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, receive JWT |

### KYC (User — requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/kyc/upload` | Upload KYC document |
| GET | `/api/kyc/status/:id` | Poll document status |
| GET | `/api/kyc/my` | List my documents |

### Admin (requires auth + admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/kyc` | Paginated KYC list |
| GET | `/api/admin/kyc/:id` | KYC detail with reviews |
| POST | `/api/admin/kyc/:id/action` | Approve/reject/reupload |

---

## Processing Pipeline

```
Upload → OCR (Tesseract) → LLM Extraction (Ollama) → Embedding → Similarity Search → Admin Review
```

1. User uploads a PDF/PNG/JPG identity document
2. **OCR**: Tesseract extracts raw text
3. **LLM**: Ollama parses structured fields (name, PAN, DOB, document type)
4. **Embedding**: Vector embeddings generated for document + phone number
5. **Similarity**: Qdrant searches for duplicate/similar submissions
6. **Admin**: Reviews extracted data, similarity scores, and takes action

---

## Production Deployment

### GitHub Actions CI/CD

The pipeline triggers on push to `main`:

1. **Test** — Runs backend tests with PostgreSQL service
2. **Build** — Builds Docker images for backend + frontend
3. **Push** — Pushes images to GitHub Container Registry (GHCR)
4. **Deploy** — SSHs into production server and runs `docker compose up`

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `PROD_HOST` | Production server IP/hostname |
| `PROD_USER` | SSH username |
| `PROD_SSH_KEY` | SSH private key |

### Production compose

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Project Structure

```
kyc-ai-system/
├── backend/                  # Node.js/Express API
│   ├── src/
│   │   ├── config/           # DB, Qdrant, Ollama clients
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # Auth, upload, error handling
│   │   ├── routes/           # Express route definitions
│   │   ├── services/         # OCR, LLM, embedding, similarity
│   │   ├── db/migrations/    # PostgreSQL schema
│   │   └── app.js            # Entry point
│   ├── uploads/              # Stored KYC documents
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # Next.js 14 UI
│   ├── app/                  # App Router pages
│   ├── components/           # Reusable UI components
│   ├── lib/                  # API client
│   ├── Dockerfile
│   └── package.json
├── nginx/nginx.conf          # Reverse proxy config
├── docker-compose.yml        # Development orchestration
├── docker-compose.prod.yml   # Production orchestration
└── .github/workflows/        # CI/CD pipeline
```

---

## License

Confidential — © 2026 Flairminds Software Pvt. Ltd. All rights reserved.

**Document Reference**: FM-KYC-SRS-001 | Version 1.0
