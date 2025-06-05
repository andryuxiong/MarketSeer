import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # API Keys
    FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
    
    # Server Configuration
    PORT = int(os.getenv('PORT', 8000))
    HOST = os.getenv('HOST', '0.0.0.0')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    
    # Environment
    ENV = os.getenv('NODE_ENV', 'development')
    DEBUG = ENV == 'development'

# Create configuration instance
config = Config() 