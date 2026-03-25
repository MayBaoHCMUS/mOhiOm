# Backend - Python FastAPI

This is the backend API built with FastAPI and MongoDB.

## Getting Started

### Prerequisites
- Python 3.10 or higher
- MongoDB (running locally or via Docker)

### Installation

1. Create a virtual environment:

```bash
python -m venv venv
```

2. Activate the virtual environment:

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

### Running the Server

```bash
python -m app.main
```

Or with uvicorn directly:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

## Project Structure

```
backend/
├── app/
│   ├── main.py              # Application entry point
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection
│   ├── schemas.py           # Pydantic models
│   ├── crud.py              # CRUD operations
│   └── routers/
│       └── items.py         # Item routes
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
└── README.md
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
DEBUG=False
CORS_ORIGINS=["http://localhost:3000"]
```

## Database

### Using Docker Compose

See the `database/` folder for MongoDB setup with Docker.

### Local MongoDB

Make sure MongoDB is running on `localhost:27017`

