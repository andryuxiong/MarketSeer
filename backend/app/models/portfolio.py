from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PortfolioItem(BaseModel):
    symbol: str
    shares: float
    average_price: float
    current_price: float
    total_value: float
    gain_loss: float
    gain_loss_percent: float
    purchase_date: datetime

class Portfolio(BaseModel):
    total_value: float
    total_gain_loss: float
    total_gain_loss_percent: float
    items: List[PortfolioItem]
    last_updated: datetime
    performance_history: List[dict]
    allocation: dict 