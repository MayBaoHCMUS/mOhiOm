# MongoDB Local Setup Guide - Windows

This guide will help you set up MongoDB locally on Windows without Docker.

## Step 1: Install MongoDB Community Edition

### Download
1. Go to https://www.mongodb.com/try/download/community
2. Select **Windows** as your OS
3. Select your Windows version (64-bit recommended)
4. Download the MSI installer

### Install
1. Run the downloaded MSI installer
2. Choose **Complete** installation type
3. Follow the installation wizard
4. MongoDB will be installed to: `C:\Program Files\MongoDB\Server\7.0\` (or your version)

### Verify Installation
1. Open Command Prompt or PowerShell
2. Run:
   ```bash
   mongosh
   ```
3. You should see a MongoDB connection message

## Step 2: Ensure MongoDB Service is Running

### Check if MongoDB Service is Running
1. Press `Win + R`
2. Type `services.msc`
3. Look for **MongoDB Server**
4. Status should be **Running**

If not running:
- Right-click on **MongoDB Server**
- Click **Start**
- It should now show as "Running"

### Verify Connection
Open PowerShell and run:
```bash
mongosh
```

You should see:
```
Current Mongosh Log ID: ...
Connecting to:          mongodb://127.0.0.1:27017/?directConnection=true
...
>
```

Type `exit` to quit the shell.

## Step 3: Set Up Your Project

### Install Project Dependencies

**Frontend:**
```bash
cd F:\Thesis\frontend
npm install
```

**Backend:**
```bash
cd F:\Thesis\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Step 4: Run the Application

### Terminal 1 - MongoDB (Verify it's Running)
```bash
mongosh
# Just verify the connection works
# Then close with: exit
```

### Terminal 2 - Backend
```bash
cd F:\Thesis\backend
venv\Scripts\activate
python -m app.main
```

Expected output:
```
Connected to MongoDB: mohiom_db
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Terminal 3 - Frontend
```bash
cd F:\Thesis\frontend
npm run dev
```

Expected output:
```
> next dev
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
```

## Step 5: Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **MongoDB**: mongodb://localhost:27017 (default, no authentication)

## Optional: Use MongoDB Compass (GUI)

For a visual database management tool:

1. Download MongoDB Compass: https://www.mongodb.com/products/compass
2. Install and open it
3. Click **New Connection**
4. Connection string: `mongodb://localhost:27017`
5. Click **Save & Connect**

You can now browse:
- Database: `mohiom_db`
- Collection: `items` (created after first API request)

## Troubleshooting

### MongoDB Service Won't Start
```bash
# Check status
Get-Service -Name "MongoDB Server"

# Manually start
Start-Service -Name "MongoDB Server"

# Create data directory if missing
mkdir C:\data\db
```

### Port 27017 Already in Use
```bash
# Find what's using the port
netstat -ano | findstr :27017

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F

# Or use a different port (update config)
mongod --port 27018
```

### Backend Can't Connect to MongoDB
1. Check MongoDB is running: `mongosh`
2. Check connection string in `backend/.env`: `MONGODB_URL=mongodb://localhost:27017`
3. Restart the backend service

### "database.py" or "models.py" Import Errors
The project uses MongoDB (PyMongo), not PostgreSQL. Make sure you have:
```bash
# In backend/
pip install -r requirements.txt
```

## Next Steps

1. **Start development:**
   - Add components in `frontend/src/components/`
   - Create API routes in `backend/app/routers/`
   - Define schemas in `backend/app/schemas.py`

2. **Test API endpoints:**
   - Create an item: POST http://localhost:8000/api/items
   - Get all items: GET http://localhost:8000/api/items
   - See API docs: http://localhost:8000/docs

3. **View database:**
   - Use MongoDB Compass or `mongosh` to view data

## Useful MongoDB Commands

```bash
# Connect to MongoDB shell
mongosh

# Switch to your database
use mohiom_db

# View all collections
show collections

# View items collection data
db.items.find()

# Insert test data
db.items.insertOne({ name: "Test Item", description: "A test item" })

# Count documents
db.items.countDocuments()

# Delete all items
db.items.deleteMany({})
```

## Environment Variables

**Backend (`.env` file):**
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
DEBUG=False
CORS_ORIGINS=["http://localhost:3000"]
```

**Frontend (`.env.local` file):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

That's it! You're ready to develop. 🎉

