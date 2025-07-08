# Reading Tracker Suite

A comprehensive reading tracking system with AI-powered newsletter generation. Track your web reading habits, generate insights, and create automated newsletters for your community.

## 🚀 Features

### Phase 1: Core Foundation ✅
- **Dockerized Architecture**: Complete containerized setup with Docker Compose
- **REST API**: Node.js + Express + SQLite backend
- **Web Dashboard**: React frontend with real-time statistics
- **Reading Sessions**: Track articles, time spent, word count, and tags
- **Statistics**: Real-time analytics of reading habits

### Phase 2: Browser Integration 🚧
- **Browser Extension**: Automatic web reading detection
- **Content Scripts**: Smart reading time calculation
- **Real-time Sync**: Live updates to dashboard

### Phase 3: AI Intelligence 📋
- **LLM Integration**: OpenAI, Claude, and local model support
- **Content Analysis**: Automatic categorization and tagging
- **Newsletter Generation**: AI-powered daily/weekly summaries

### Phase 4: Publishing & Advanced Features 📋
- **Substack Integration**: One-click newsletter publishing
- **Cloud Sync**: Multi-device synchronization
- **Advanced Analytics**: Reading patterns and insights

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd reading-tracker-suite
   ```

2. **Start the application**
   ```bash
   docker compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Health: http://localhost:3001/health

### Development Commands

```bash
# Start all services
docker compose up --build

# Start in detached mode
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Restart specific service
docker compose restart frontend
```

## 📊 API Endpoints

### Reading Sessions
- `GET /api/sessions` - Get all reading sessions
- `POST /api/sessions` - Create new reading session
- `GET /api/stats` - Get reading statistics

### Tags
- `GET /api/tags` - Get all tags

### Health Check
- `GET /health` - API health status

## 📝 Example API Usage

### Create Reading Session
```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Interesting Article",
    "url": "https://example.com/article",
    "reading_time": 15,
    "word_count": 500,
    "tags": ["Technology", "Research"]
  }'
```

### Get Statistics
```bash
curl http://localhost:3001/api/stats
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Docker Compose                │
├─────────────────────────────────────────┤
│  📱 Frontend (React + TypeScript)       │
│  🔧 Backend (Node.js + Express)         │
│  🗄️  SQLite Database (Volume)           │
└─────────────────────────────────────────┘
```

## 📁 Project Structure

```
reading-tracker-suite/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── types/         # TypeScript definitions
│   ├── Dockerfile
│   └── package.json
├── backend/               # Node.js backend API
│   ├── scripts/           # Database initialization
│   ├── server.js          # Main server file
│   ├── Dockerfile
│   └── package.json
├── extension/             # Browser extension (Phase 2)
├── docker-compose.yml     # Docker services configuration
├── CLAUDE.md             # Development documentation
└── README.md
```

## 🔧 Database Schema

### Reading Sessions
- `id`: Unique identifier
- `title`: Article/content title
- `url`: Source URL (optional)
- `content_type`: Type (web, pdf, epub, manual)
- `reading_time`: Time spent reading (minutes)
- `word_count`: Estimated word count
- `created_at`: Timestamp

### Tags
- `id`: Unique identifier
- `name`: Tag name
- `color`: Display color

## 🚧 Development Status

- ✅ **Phase 1**: Core foundation complete
- 🚧 **Phase 2**: Browser extension in development
- 📋 **Phase 3**: AI integration planned
- 📋 **Phase 4**: Advanced features planned

## 🤝 Contributing

This project is in active development. Contributions welcome!

## 📄 License

MIT License - see LICENSE file for details

---

*Built with Docker, React, Node.js, and SQLite*