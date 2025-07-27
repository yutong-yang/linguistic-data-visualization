# Linguistic Data Visualization Project

Visualizing and analyzing linguistic data from multiple databases.

## Features

- **Interactive Map Visualization**: Explore linguistic features across different languages and regions
- **Correlation Analysis**: Analyze relationships between linguistic features and social factors
- **Phylogenetic Tree Visualization**: View language family trees and evolutionary relationships
- **Knowledge Base Integration**: AI-powered linguistic knowledge base with document processing
- **Multi-language Support**: English and Chinese interface
- **Real-time Chat Interface**: Interactive chat widget for linguistic queries

## Technology Stack

### Frontend
- **React 18** with Vite for fast development
- **D3.js** for data visualization
- **Leaflet** for interactive maps
- **Chart.js** for statistical charts
- **Tailwind CSS** for styling

### Backend
- **Python Flask** API server
- **FAISS** for vector similarity search
- **Sentence Transformers** for text embeddings
- **SQLite** for local data storage

### Data Sources
- WALS (World Atlas of Language Structures)
- D-PLACE (Database of Places, Language, Culture and Environment)
- Grambank
- ASJP (Automated Similarity Judgment Program)

## Installation

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm or yarn

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start the API server
python simple_api.py
```

## Project Structure

```
linguistic-react/
├── src/
│   ├── components/          # React components
│   ├── context/            # React context providers
│   ├── utils/              # Utility functions
│   └── langs/              # Internationalization files
├── backend/
│   ├── api.py              # Main Flask API
│   ├── knowledge_base.py   # Knowledge base implementation
│   └── requirements.txt    # Python dependencies
├── public/
│   ├── cldf-datasets-wals-014143f/  # WALS dataset
│   ├── dplace-cldf/                 # D-PLACE dataset
│   ├── grambank-grambank-7ae000c/   # Grambank dataset
│   └── lexibank-asjp-f0f1d0d/       # ASJP dataset
└── README.md
```

## Usage

1. **Start the backend server** (runs on http://localhost:5000)
2. **Start the frontend development server** (runs on http://localhost:5173)
3. **Open your browser** and navigate to the frontend URL
4. **Upload documents** to the knowledge base for AI-powered analysis
5. **Explore linguistic data** through interactive visualizations

## Key Components

- **MapView**: Interactive world map showing language distributions
- **CorrelationAnalysis**: Statistical analysis of linguistic features
- **PhyloTree**: Phylogenetic tree visualization
- **ChatWidget**: AI-powered chat interface
- **KnowledgeBaseManager**: Document upload and management

## Acknowledgments

- WALS (World Atlas of Language Structures) for linguistic data
- D-PLACE for cultural and environmental data
- Grambank for grammatical features
- ASJP for lexical similarity data
