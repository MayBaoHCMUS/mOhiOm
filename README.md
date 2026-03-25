# mOhiOm Project

A full-stack web application with React + Next.js frontend, FastAPI backend, and MongoDB database.

## 📋 Project Structure

```
Thesis/
├── frontend/               # React + Next.js application
│   ├── public/
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # Reusable React components
│   │   ├── services/      # API client
│   │   └── styles/        # Global styles
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── Dockerfile
│   └── README.md
│
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py        # Entry point
│   │   ├── config.py      # Configuration
│   │   ├── database.py    # MongoDB connection
│   │   ├── schemas.py     # Pydantic models
│   │   ├── crud.py        # Database operations
│   │   ├── lifespan.py    # Startup/shutdown
│   │   └── routers/       # API routes
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── database/               # MongoDB configuration
│   ├── docker-compose.yml
│   ├── init-mongo.js      # Database initialization
│   └── README.md
│
├── docker-compose.yml      # Full stack Docker compose
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- MongoDB installed locally on Windows

### Option 1: Manual Setup (Recommended for Local Development)

#### 1. Start MongoDB

Make sure MongoDB is running on your machine:

```bash
# MongoDB should be running as a Windows Service by default
# Or manually start with:
mongosh  # Just verify it connects
```

#### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit: http://localhost:3000

#### 3. Start Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

API running at: http://localhost:8000
API Docs: http://localhost:8000/docs

### Option 2: Using Docker Compose (Full Stack)

If you prefer Docker for the entire stack:

```bash
docker-compose up -d
```

This will start all services including MongoDB in a container.

## 📦 Tech Stack

- **Frontend**: React 18, Next.js 14, TypeScript, Axios
- **Backend**: FastAPI, Uvicorn, Pydantic, PyMongo
- **Database**: MongoDB 7.0
- **Containerization**: Docker & Docker Compose

## 🔧 Configuration

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Backend `.env`
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
DEBUG=False
CORS_ORIGINS=["http://localhost:3000"]
```

## 📚 Documentation

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
- [Database README](./database/README.md)

## 🐳 Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js application |
| Backend | 8000 | FastAPI server |
| MongoDB | 27017 | Database |

## 🛑 Stopping Services

```bash
docker-compose down
```

## 📝 API Endpoints

Available at `http://localhost:8000/api`

- `GET /items` - List all items
- `POST /items` - Create new item
- `GET /items/{id}` - Get item by ID
- `PUT /items/{id}` - Update item
- `DELETE /items/{id}` - Delete item
- `GET /health` - Health check

## 🔐 MongoDB Setup

**Local Installation (No Docker Required):**

1. **Install MongoDB Community Edition** from https://www.mongodb.com/try/download/community
2. **Verify it's running:**
   ```bash
   mongosh
   ```
3. **Default Connection:** `mongodb://localhost:27017`

See [database/README.md](./database/README.md) for detailed installation instructions.

## 📝 Notes

- Update credentials in production environments
- API documentation available at `/docs` endpoint
- Frontend communicates with backend via API client in `frontend/src/services/api.ts`

## 📄 License

Your License Here
