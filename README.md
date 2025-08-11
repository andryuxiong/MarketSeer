# MarketSeer

This is MarketSeer, a modern stock market analysis and visualization platform. This project is split into a React frontend and a FastAPI backend, and is designed for real-time stock data, stock prediction using ML and also a sandbox portfolio using real-time stocks to trade for fun!

## Features

- Real-time stock data and market indices (kinda with rate limits its not really real-time its more like 3sec to 5 min)
- Stock price predictions using Machine Learning
- Interactive price charts and technical analysis
- Sandbox portfolio with real-time trading simulation
- News aggregation and sentiment analysis

## Project Structure

```
marketseer/
├── frontend/   # React TypeScript frontend
└── backend/    # FastAPI backend
```

- The [frontend](./frontend/README.md) handles the user interface and data visualization.
- The [backend](./backend/README.md) provides the REST API, data analysis, and portfolio logic.

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+
- (Recommended) Use a virtual environment for Python
- Finnhub API key - free tier using their limited API's

### Local Development

#### Frontend

```bash
cd frontend
npm install
npm start
```

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows you can do venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- Frontend runs on [http://localhost:3000](http://localhost:3000)
- Backend API runs on [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Environment Variables

> Note: Make sure to get your own Finnhub API key from [Finnhub's website](https://finnhub.io/) - it's free!

### Frontend
Create a `.env` file in the frontend directory:
```
VITE_API_URL=http://localhost:8000
VITE_FINNHUB_API_KEY=your_finnhub_api_key
```

### Backend
Create a `.env` file in the backend directory:
```
FINNHUB_API_KEY=your_finnhub_api_key
```

## Project Journey

### Things that were pretty hard
- Implementing real-time data updates while maintaining performance
- Handling API rate limits with the free tier of Finnhub
- Building a responsive UI that works well on all devices
- Managing state for the sandbox portfolio with real-time price updates
- Implementing ML predictions with limited historical data 

### Future Improvements that I might or might not add maybe
- Add user authentication and personalized portfolios
- Implement more advanced technical indicators
- Add social features (share portfolios, follow other traders)
- Improve ML predictions with more data and better models
- Add more interactive charts and analysis tools
- Implement WebSocket for true real-time updates (currently using 5-minute polling)
- Add mobile app version
- Include more market data sources for better coverage

## More Info

- For detailed frontend instructions, see [frontend/README.md](./frontend/README.md)
- For backend API and architecture, see [backend/README.md](./backend/README.md)

---
