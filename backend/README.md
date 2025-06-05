# MarketSeer Backend

This is the FastAPI backend for MarketSeer. It handles stock data, technical analysis, news, sentiment, and portfolio management.

## Setup

### Local Development

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows you can do venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the backend directory:
```
FINNHUB_API_KEY=your_finnhub_api_key
FRONTEND_URL=http://localhost:3000  # for local development
```

4. Run the development server:
```bash
uvicorn app.main:app --reload
```

The API will be available at [http://localhost:8000](http://localhost:8000)

### Production Deployment

For production deployment (e.g., Railway), set these environment variables:
```
FINNHUB_API_KEY=your_finnhub_api_key
FRONTEND_URL=https://marketseer.vercel.app  # Your production frontend URL
PORT=8000  # Optional: Railway will set this automatically
```

## API Endpoints

- `/api/stocks/search/{query}` — Search for stocks
- `/api/stocks/{symbol}` — Get stock data
- `/api/news/{symbol}` — Get news for a stock
- `/api/sentiment/{symbol}` — Get sentiment analysis
- `/api/portfolio` — Get user portfolio


## Project Structure

- `app/` — FastAPI app and route definitions
- `models/` — Pydantic models for data validation
- `services/` — Business logic and integrations

## Future Plans

- Database integration
- User authentication
- Real-time updates
- More advanced analytics

---

For frontend setup, see [../frontend/README.md](../frontend/README.md). 