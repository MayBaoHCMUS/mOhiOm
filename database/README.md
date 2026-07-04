# Database - MongoDB (Local Installation)

MongoDB database setup and configuration for local development.

## Quick Start

### Prerequisites
- MongoDB Community Edition installed on your Windows machine

## Installation on Windows

### Option 1: Download and Install MongoDB Community Edition

1. **Download MongoDB Community Edition:**
   - Visit: https://www.mongodb.com/try/download/community
   - Select Windows as your operating system
   - Download the MSI installer

2. **Run the Installer:**
   - Double-click the downloaded MSI file
   - Choose "Complete" installation
   - MongoDB will be installed to `C:\Program Files\MongoDB\Server\<version>`

3. **Create Data Directory:**
   ```bash
   mkdir C:\data\db
   ```

4. **Start MongoDB Service:**
   
   **Option A - As a Windows Service (Recommended):**
   - MongoDB should be installed as a service and start automatically
   - Verify it's running: Open Services app and look for "MongoDB Server"

   **Option B - Manual Start from Command Prompt:**
   ```bash
   "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

### Option 2: Install via Chocolatey (if installed)

```bash
choco install mongodb-community
```

### Option 3: Use Windows Package Manager

```bash
winget install MongoDB.Server
```

## Verify Installation

### Using MongoDB Shell:

```bash
mongosh
```

Or if using older MongoDB:

```bash
mongo
```

You should see the MongoDB connection prompt:
```
Current Mongosh Log ID: ...
Connecting to:          mongodb://127.0.0.1:27017/?directConnection=true
```

## Connection Settings

**Default Connection String:**
```
mongodb://localhost:27017
```

**Database Name:**
```
mohiom_db
```

## Running the Backend

Once MongoDB is running locally, start your backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

The backend will automatically connect to `mongodb://localhost:27017`

## MongoDB Compass (GUI)

For a visual database management tool:

1. Download: https://www.mongodb.com/products/compass
2. Install and launch
3. Connect to `mongodb://localhost:27017`
4. Browse and manage your databases and collections

## Initial Setup

When the backend first runs, it will:
- Connect to MongoDB
- Create the `mohiom_db` database
- Create the `items` collection when you make the first request

## Stopping MongoDB

**If running as a service:**
- Open Services app → Find "MongoDB Server" → Right-click → Stop

**If running manually:**
- Press `Ctrl+C` in the command prompt window

## Troubleshooting

### Port Already in Use
If port 27017 is already in use:
```bash
netstat -ano | findstr :27017
```
Kill the process or use a different port:
```bash
mongod --port 27018
```

### MongoDB Not Starting
- Check if `C:\data\db` directory exists and is writable
- Check Windows Firewall settings
- Review MongoDB logs in `C:\Program Files\MongoDB\Server\<version>\log\mongod.log`

### Connection Refused
- Make sure MongoDB service is running
- Verify connection string is correct
- Check if firewall is blocking port 27017

## Resources

- MongoDB Documentation: https://docs.mongodb.com/
- MongoDB Shell Documentation: https://docs.mongodb.com/mongosh/
- MongoDB Compass: https://www.mongodb.com/products/compass


