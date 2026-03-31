# Project Setup Guide - Local MongoDB (No Docker)

## Overview
This project consists of:
- **Frontend**: Next.js + React (Port 3000)
- **Backend**: FastAPI + Python (Port 8000)
- **Database**: MongoDB Local (Port 27017)

---

## 📋 Prerequisites

### 1. MongoDB Installation (Already Installed)
✅ MongoDB Server 8.2 is already installed on your system
- Location: `C:\Program Files\MongoDB\Server\8.2\bin`
- mongosh (shell): `C:\Program Files\mongosh\`

### 2. Python
```bash
python --version  # Should be 3.9+
```

### 3. Node.js & npm
```bash
node --version
npm --version
```

---

## 🗂️ Project Structure

```
Thesis/
├── backend/                 # FastAPI Application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── config.py       # Settings & configuration
│   │   ├── database.py     # MongoDB connection manager
│   │   ├── crud.py         # Database operations
│   │   ├── schemas.py      # Pydantic models
│   │   ├── lifespan.py     # App lifecycle hooks
│   │   └── routers/        # API route handlers
│   │       ├── __init__.py
│   │       └── items.py
│   ├── .env                # Environment variables (create from .env.example)
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile
│
├── frontend/               # Next.js Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/    # React components
│   │   ├── services/
│   │   │   └── api.ts     # API client
│   │   ├── styles/        # CSS files
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   ├── .env.local         # Environment variables (create from .env.local.example)
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── Dockerfile
│
├── database/              # Database initialization scripts
│   ├── init-mongo.js      # MongoDB initialization
│   └── init.sql           # SQL reference (not used for local MongoDB)
│
└── docker-compose.yml     # Docker setup (optional - not needed for local MongoDB)
```

---

## 🚀 Setup Instructions

### Step 1: Start MongoDB Local Server

**Option A: Windows Service (Recommended)**
MongoDB is installed as a Windows service. Check if it's running:
```bash
# In PowerShell (Run as Administrator)
Get-Service MongoDB
# Should show: Running

# If not running, start it:
Start-Service MongoDB
```

**Option B: Manual Command Line**
```bash
mongod --dbpath "C:\data\db"
```

**Verify MongoDB is Running:**
```bash
mongosh
# You should see: test>
exit
```

---

### Step 2: Initialize MongoDB Database

**Option A: Using mongosh**
```bash
# Open MongoDB Shell
mongosh

# Copy and paste each command:
use mohiom_db
db.createCollection("items")
db.items.insertOne({ title: "Sample Item", description: "This is a test", completed: false })
exit
```

**Option B: Using init script (if available)**
```bash
mongosh < database/init-mongo.js
```

---

### Step 3: Setup Backend (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (Command Prompt):
venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
# MONGODB_URL=mongodb://localhost:27017
# DATABASE_NAME=mohiom_db
# DEBUG=True
# CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Server will be available at: http://localhost:8000
# API docs at: http://localhost:8000/docs
```

---

### Step 4: Setup Frontend (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env.local file (copy from .env.local.example)
# NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Run development server
npm run dev

# App will be available at: http://localhost:3000
```

---

## 🔗 Configuration Files

### Backend Configuration Files

#### `backend/.env`
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
DEBUG=True
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
```

#### `backend/app/config.py`
Already configured to read from `.env`:
- `MONGODB_URL`: Connection string for local MongoDB
- `DATABASE_NAME`: Database name
- `DEBUG`: Debug mode
- `CORS_ORIGINS`: Allowed origins

### Frontend Configuration Files

#### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

#### `frontend/src/services/api.ts`
API client configured to use `NEXT_PUBLIC_API_URL`

---

## 📦 Dependencies

### Backend (Python)
- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **PyMongo**: MongoDB driver
- **Pydantic**: Data validation
- **python-dotenv**: Environment variables
- **python-multipart**: Form data handling
- **httpx**: HTTP client

### Frontend (Node.js)
- **Next.js**: React framework
- **React**: UI library
- **Axios**: HTTP client
- **TypeScript**: Type safety
- **ESLint**: Code linting

---

## 🧪 Testing the Setup

### 1. Test Backend API
```bash
# With backend running, open in browser:
curl http://localhost:8000/api/health

# Or visit API documentation:
# http://localhost:8000/docs
```

### 2. Test Frontend
```bash
# With frontend running, open in browser:
http://localhost:3000
```

### 3. Test Database Connection
```bash
# From backend terminal (while app is running):
# Check logs for: "Connected to MongoDB: mohiom_db"
```

---

## 🛠️ Common Commands

### Backend
```bash
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install new dependency
pip install package_name

# Update requirements
pip freeze > requirements.txt

# Run with auto-reload
uvicorn app.main:app --reload

# Run tests
pytest
```

### Frontend
```bash
# Install new dependency
npm install package_name

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### MongoDB
```bash
# Connect to MongoDB
mongosh

# List all databases
show dbs

# Use a database
use mohiom_db

# List collections
show collections

# Query data
db.items.find().pretty()

# Insert data
db.items.insertOne({ title: "Test", description: "Test item" })

# Exit
exit
```

---

## 📝 Environment Variables Summary

| Variable | Backend | Frontend | Value |
|----------|---------|----------|-------|
| MONGODB_URL | ✅ | ❌ | `mongodb://localhost:27017` |
| DATABASE_NAME | ✅ | ❌ | `mohiom_db` |
| DEBUG | ✅ | ❌ | `True` or `False` |
| CORS_ORIGINS | ✅ | ❌ | `["http://localhost:3000"]` |
| NEXT_PUBLIC_API_URL | ❌ | ✅ | `http://localhost:8000/api` |

---

## 🔍 Troubleshooting

### MongoDB Connection Issues
**Problem**: `Cannot connect to MongoDB`
**Solution**:
1. Check if MongoDB service is running: `Get-Service MongoDB`
2. Verify connection string: `mongosh`
3. Check firewall settings

### Backend Port Already in Use
**Problem**: `Address already in use: ('::', 8000)`
**Solution**:
```bash
# Find process using port 8000
netstat -ano | findstr :8000
# Kill the process
taskkill /PID <PID> /F
```

### Frontend Port Already in Use
**Problem**: `Port 3000 is in use`
**Solution**:
```bash
# Run on different port
npm run dev -- -p 3001
```

### CORS Issues
**Problem**: `Access-Control-Allow-Origin` error
**Solution**: Update `CORS_ORIGINS` in `backend/.env` and restart backend

### Module Not Found Errors
**Problem**: `ModuleNotFoundError` in Python
**Solution**: Ensure virtual environment is activated and dependencies installed:
```bash
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## ✅ Verification Checklist

- [ ] MongoDB installed and running
- [ ] Backend virtual environment created
- [ ] Backend dependencies installed (`pip install -r requirements.txt`)
- [ ] Backend `.env` file created with correct settings
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Frontend `.env.local` file created
- [ ] MongoDB database initialized with `mohiom_db`
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] API documentation accessible at `http://localhost:8000/docs`
- [ ] Can query MongoDB from backend
- [ ] Frontend can connect to backend API

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [PyMongo Documentation](https://pymongo.readthedocs.io/)
- [Axios Documentation](https://axios-http.com/)

---

**Created**: March 25, 2026
**Last Updated**: March 25, 2026

