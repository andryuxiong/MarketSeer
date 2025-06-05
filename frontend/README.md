# MarketSeer Frontend

This is the React frontend for MarketSeer. It's built with TypeScript and Chakra UI.

## Available Scripts

```bash
npm start         # Run the app in development mode
npm run build     # Build the app for production
npm test          # Run tests
```

## Environment Variables

Create a `.env` file in this directory with:

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FINNHUB_API_KEY=your_finnhub_api_key
```

By default, the app will use `REACT_APP_API_URL` if set, otherwise it will fall back to `http://localhost:8000` for local development.

## Development

- The app runs on [http://localhost:3000](http://localhost:3000)
- Make sure the backend is running for API calls
- The app uses environment variables for configuration
- API endpoints are configured in `src/config/api.ts`

## Building the frontend

```bash
npm run build
```

This will create a `build` folder with the production-ready files.

---

For more details on the backend, check out [../backend/README.md](../backend/README.md).
