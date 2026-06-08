# Prime Trade Analytics Dashboard - By Himanshu Ghosh

## 📊 Live Demo - (Himanshu Ghosh Github & vercel production)
- **GitHub Pages**: https://himanshu07ghosh.github.io/prime-trade-dashboard/
- **Vercel Live Production Link**: https://vercel.com/himanshu07ghoshs-projects/prime-trade-dashboard

## 🚀 Quick Deploy

### Deploy on Vercel (Recommended - 2 minutes)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/prime-trade-dashboard)

Or manually:
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. Click Deploy

### Deploy on GitHub Pages (1 minute)
1. Go to Settings → Pages
2. Set branch to `main` / root folder
3. Save - your site is live at `https://YOUR_USERNAME.github.io/prime-trade-dashboard/`

### Run Locally
```bash
git clone https://github.com/YOUR_USERNAME/prime-trade-dashboard.git
cd prime-trade-dashboard
python -m http.server 8000
# Open http://localhost:8000


## 📊 Data Source

This dashboard uses the `sample_data.csv` file located in the `/data` folder containing:
- **211,224+ trades** from May 2023 - May 2025
- **32 unique traders**
- Multiple trading pairs (BTC, ETH, HYPE, @107, AAVE, etc.)

### CSV Columns Expected:
| Column | Description |
|--------|-------------|
| Account | Trader wallet address |
| Coin | Trading pair symbol |
| Size USD | Trade size in USD |
| Side | BUY or SELL |
| Timestamp IST | Trade date and time |
| Closed PnL | Profit/Loss from trade |
| Fee | Transaction fee |
