### Frontend
- React 18 + Vite
- D3.js, Leaflet, Chart.js
- Tailwind CSS

### Backend
- Python FastAPI
- Lightweight TF-IDF
- Environment variable configuration

### Data Sources
- D-PLACE (Database of Places, Language, Culture and Environment)
- Grambank

## Installation

### Prerequisites
- Node.js 18+
- Python 3.12+

### Frontend
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend
```bash
cd backend

# Install Python dependencies
uv sync

# Start the API server (default port 8000)
./start-uv.sh

# Or with custom configuration
PORT=8888 ./start-uv.sh

# Or use original command
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

## Project Structure

```
linguistic-react/
├── src/
│   ├── components/          # React components
│   ├── context/            # React context providers
│   ├── config/             # API configuration
│   ├── utils/              # Utility functions
│   └── langs/              # Internationalization files
├── backend/
│   ├── api.py              # Main FastAPI server
│   ├── start-uv.sh         # UV startup script
│   ├── start.py            # Python startup script
│   ├── knowledge_base.py   # Knowledge base implementation
│   └── pyproject.toml      # Python dependencies
├── public/
│   ├── cldf-datasets-wals-014143f/  # WALS dataset
│   ├── dplace-cldf/                 # D-PLACE dataset
│   ├── grambank-grambank-7ae000c/   # Grambank dataset
│   └── lexibank-asjp-f0f1d0d/       # ASJP dataset
└── README.md
```

## Usage

1. Start backend (port 8000)
2. Start frontend (port 5173)
3. Open browser

## Configuration

- Backend: `PORT`, `HOST`, `ALLOWED_ORIGINS`
- Frontend: `VITE_API_BASE_URL`
