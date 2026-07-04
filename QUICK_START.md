# Quick Start Guide

## 🚀 Start Your Application (Local MongoDB)

### Prerequisites
- MongoDB installed and running on Windows
- Node.js 18+ installed
- Python 3.10+ installed

### Run in 3 Commands

**Terminal 1 - Backend:**
```bash
cd F:\Thesis\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

**Terminal 2 - Frontend:**
```bash
cd F:\Thesis\frontend
npm install
npm run dev
```

### That's It! 🎉

Open your browser:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 📋 First Time Setup

### 1. Install MongoDB (Windows)

**Option A - Automatic:**
1. Download from: https://www.mongodb.com/try/download/community
2. Run the MSI installer
3. Choose "Complete" installation
4. MongoDB will start automatically

**Option B - Verify it's running:**
```bash
mongosh
```
(Should show connection prompt)

### 2. Verify MongoDB Connection

```bash
mongosh
# Output: Current Mongosh Log ID: ...
# Output: Connecting to: mongodb://127.0.0.1:27017/?directConnection=true
# Type: exit
```

### 3. Install Project Dependencies

**Frontend:**
```bash
cd F:\Thesis\frontend
npm install
```

**Backend:**
```bash
cd F:\Thesis\backend
python -m venv venv

# Windows activation:
venv\Scripts\activate

# Install packages:
pip install -r requirements.txt
```

### 4. Run Backend Server

```bash
cd F:\Thesis\backend
venv\Scripts\activate
python -m app.main
```

**Expected output:**
```
Connected to MongoDB: mohiom_db
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 5. Run Frontend Server

```bash
cd F:\Thesis\frontend
npm run dev
```

**Expected output:**
```
> next dev
  ▲ Next.js 14.x.x
  - Local: http://localhost:3000
```

---

## 📂 Project Structure

```
F:\Thesis\
├── frontend/          # React + Next.js
├── backend/           # FastAPI
├── database/          # MongoDB docs
└── docs/
    ├── MONGODB_LOCAL_SETUP.md    ⭐ Full setup guide
    ├── SETUP_SUMMARY_LOCAL_MONGODB.md
    └── QUICK_START.md            ⭐ This file
```

---

## 🔗 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Your app |
| Backend API | http://localhost:8000 | API server |
| API Docs | http://localhost:8000/docs | Swagger UI |
| MongoDB | localhost:27017 | Database |

---

## 💾 Common Commands

### Backend
```bash
# Navigate to backend
cd F:\Thesis\backend

# Activate virtual environment
venv\Scripts\activate

# Run server
python -m app.main

# View logs
# (logs appear in terminal)
```

### Frontend
```bash
# Navigate to frontend
cd F:\Thesis\frontend

# Install packages
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production build
npm start
```

### MongoDB
```bash
# Connect to MongoDB
mongosh

# View databases
show databases

# Switch to mohiom_db
use mohiom_db

# View collections
show collections

# View items
db.items.find()

# Exit
exit
```

---

## 🧪 Test the API

### Using Swagger UI (Browser)
1. Go to: http://localhost:8000/docs
2. Click on endpoint (e.g., `POST /api/items`)
3. Click "Try it out"
4. Enter data and click "Execute"

### Using cURL
```bash
# Create item
curl -X POST "http://localhost:8000/api/items" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","description":"A test"}'

# Get all items
curl "http://localhost:8000/api/items"

# Get health status
curl "http://localhost:8000/health"
```

---

## 🛠️ Troubleshooting

### MongoDB Not Connecting
```bash
# Check if MongoDB is running
mongosh

# If not, start it:
# Services > MongoDB Server > Right-click > Start
```

### Backend Won't Start
```bash
# 1. Check Python version
python --version  # Should be 3.10+

# 2. Check virtual environment is activated
# You should see (venv) before your path

# 3. Reinstall packages
pip install -r requirements.txt
```

### Frontend Won't Load
```bash
# 1. Check Node version
node --version  # Should be 18+

# 2. Delete node_modules and reinstall
rm -r node_modules package-lock.json
npm install

# 3. Try different port
npm run dev -- -p 3001
```

### Port Already in Use
```bash
# Find what's using port 8000
netstat -ano | findstr :8000

# Find what's using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

---

## 📚 More Information

For detailed setup instructions, see:
- **`MONGODB_LOCAL_SETUP.md`** - Complete MongoDB installation guide
- **`database/README.md`** - Database documentation
- **`backend/README.md`** - Backend documentation
- **`frontend/README.md`** - Frontend documentation

---

## ✅ Checklist

- [ ] MongoDB installed and running
- [ ] Backend virtual environment created
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Backend server running (port 8000)
- [ ] Frontend server running (port 3000)
- [ ] Can access http://localhost:3000
- [ ] Can access http://localhost:8000/docs

You're all set! 🎉

