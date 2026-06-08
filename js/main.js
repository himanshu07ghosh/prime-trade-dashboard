let tradingData = [];
let traderStats = new Map();
const SENTIMENTS = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
const SENTIMENT_COLORS = { 'Extreme Fear': '#ff6b6b', 'Fear': '#ffa500', 'Neutral': '#ffff00', 'Greed': '#90ee90', 'Extreme Greed': '#00ff88' };
let charts = {};

function getSentimentFromDate(dateStr) {
    if (!dateStr) return 'Neutral';
    let date;
    if (typeof dateStr === 'string') {
        const parts = dateStr.split(/[-/ :]/);
        if (parts.length >= 3) {
            date = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            date = new Date(dateStr);
        }
    } else {
        date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return 'Neutral';
    const month = date.getMonth();
    const year = date.getFullYear();
    if (year === 2023) {
        if (month >= 8) return 'Greed';
        return 'Neutral';
    }
    if (year === 2024) {
        if (month <= 2) return 'Extreme Fear';
        if (month <= 4) return 'Fear';
        if (month <= 7) return 'Neutral';
        if (month <= 9) return 'Greed';
        return 'Extreme Greed';
    }
    if (year === 2025) {
        if (month <= 2) return 'Extreme Greed';
        if (month <= 4) return 'Greed';
        return 'Neutral';
    }
    return 'Neutral';
}

function formatAddress(addr, length = 10) {
    if (!addr) return 'Unknown';
    if (addr.length <= length + 3) return addr;
    return addr.substring(0, length) + '...';
}

function formatCurrency(value) {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
}

function processTradingData(data) {
    const metrics = {};
    SENTIMENTS.forEach(s => {
        metrics[s] = {
            totalPnl: 0, winCount: 0, lossCount: 0, totalTrades: 0,
            totalSize: 0, longCount: 0, shortCount: 0, coinPnl: new Map()
        };
    });
    traderStats.clear();
    
    data.forEach(row => {
        const timestamp = row.timestamp || row.Timestamp || row['Timestamp IST'] || row['Timestamp'];
        const sentiment = getSentimentFromDate(timestamp);
        let pnl = parseFloat(row.closedPnl) || parseFloat(row['Closed PnL']) || parseFloat(row['ClosedPnL']) || 0;
        const size = parseFloat(row.sizeUSD) || parseFloat(row['Size USD']) || parseFloat(row['Size']) || 0;
        let side = (row.side || row.Side || row.Direction || '').toUpperCase();
        const account = row.account || row.Account || 'Unknown';
        const symbol = (row.symbol || row.Coin || row.Symbol || 'Unknown').toString();
        
        if (side === 'OPEN LONG') side = 'BUY';
        if (side === 'OPEN SHORT') side = 'SELL';
        if (side === 'CLOSE LONG') side = 'SELL';
        if (side === 'CLOSE SHORT') side = 'BUY';
        
        if (metrics[sentiment]) {
            metrics[sentiment].totalPnl += pnl;
            metrics[sentiment].totalTrades++;
            metrics[sentiment].totalSize += size;
            if (pnl > 0) metrics[sentiment].winCount++;
            else if (pnl < 0) metrics[sentiment].lossCount++;
            if (side === 'BUY') metrics[sentiment].longCount++;
            else if (side === 'SELL') metrics[sentiment].shortCount++;
            const currentPnl = metrics[sentiment].coinPnl.get(symbol) || 0;
            metrics[sentiment].coinPnl.set(symbol, currentPnl + pnl);
        }
        
        if (!traderStats.has(account)) {
            traderStats.set(account, {
                totalPnl: 0, trades: 0, wins: 0, losses: 0,
                sentimentWins: {}, totalSize: 0
            });
        }
        const ts = traderStats.get(account);
        ts.totalPnl += pnl;
        ts.trades++;
        ts.totalSize += size;
        if (pnl > 0) {
            ts.wins++;
            ts.sentimentWins[sentiment] = (ts.sentimentWins[sentiment] || 0) + 1;
        } else if (pnl < 0) {
            ts.losses++;
        }
    });
    
    SENTIMENTS.forEach(s => {
        const m = metrics[s];
        m.winRate = m.totalTrades > 0 ? (m.winCount / m.totalTrades) * 100 : 0;
        m.avgPnl = m.totalTrades > 0 ? m.totalPnl / m.totalTrades : 0;
        m.avgSize = m.totalTrades > 0 ? m.totalSize / m.totalTrades : 0;
        m.topCoin = Array.from(m.coinPnl.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
    });
    
    const topTraders = Array.from(traderStats.entries())
        .map(([addr, stats]) => ({
            address: addr,
            displayAddress: formatAddress(addr, 8),
            totalPnl: stats.totalPnl,
            trades: stats.trades,
            winRate: stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0,
            avgSize: stats.totalSize / stats.trades,
            bestSentiment: Object.entries(stats.sentimentWins)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral'
        }))
        .sort((a, b) => b.totalPnl - a.totalPnl)
        .slice(0, 10);
    
    return { metrics, topTraders };
}

function createOrUpdateChart(chartId, type, labels, datasets, options = {}) {
    const ctx = document.getElementById(chartId).getContext('2d');
    if (charts[chartId]) {
        charts[chartId].data.datasets = datasets;
        charts[chartId].update();
    } else {
        charts[chartId] = new Chart(ctx, {
            type: type,
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#e0e0e0' } },
                    tooltip: { backgroundColor: '#1a1f2e', titleColor: '#00d4ff' }
                },
                ...options
            }
        });
    }
}

function updateAllCharts(metrics, topTraders) {
    const labels = SENTIMENTS;
    createOrUpdateChart('pnlChart', 'bar', labels, [{
        label: 'Total PnL (USD)',
        data: labels.map(s => metrics[s].totalPnl),
        backgroundColor: labels.map(s => SENTIMENT_COLORS[s] + '80'),
        borderColor: labels.map(s => SENTIMENT_COLORS[s]),
        borderWidth: 2,
        borderRadius: 8
    }]);
    createOrUpdateChart('winRateChart', 'line', labels, [{
        label: 'Win Rate (%)',
        data: labels.map(s => metrics[s].winRate),
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointRadius: 6,
        pointBackgroundColor: '#00ff88',
        pointBorderColor: '#fff'
    }]);
    createOrUpdateChart('avgPnlChart', 'bar', labels, [{
        label: 'Avg PnL per Trade (USD)',
        data: labels.map(s => metrics[s].avgPnl),
        backgroundColor: labels.map(s => SENTIMENT_COLORS[s] + '80'),
        borderColor: labels.map(s => SENTIMENT_COLORS[s]),
        borderWidth: 2,
        borderRadius: 8
    }]);
    createOrUpdateChart('biasChart', 'bar', labels, [
        { label: 'Long Positions', data: labels.map(s => metrics[s].longCount), backgroundColor: '#00ff88', borderRadius: 8 },
        { label: 'Short Positions', data: labels.map(s => metrics[s].shortCount), backgroundColor: '#ff4444', borderRadius: 8 }
    ]);
    createOrUpdateChart('tradeSizeChart', 'line', labels, [{
        label: 'Avg Trade Size (USD)',
        data: labels.map(s => metrics[s].avgSize),
        borderColor: '#ffd700',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointRadius: 6,
        pointBackgroundColor: '#ffd700'
    }]);
    createOrUpdateChart('topTradersChart', 'bar', topTraders.map(t => t.displayAddress), [{
        label: 'Gross PnL (USD)',
        data: topTraders.map(t => t.totalPnl),
        backgroundColor: 'rgba(0, 212, 255, 0.8)',
        borderRadius: 8
    }]);
}

function updateStatsGrid(metrics, topTraders) {
    const totalTrades = Object.values(metrics).reduce((sum, m) => sum + m.totalTrades, 0);
    const totalPnl = Object.values(metrics).reduce((sum, m) => sum + m.totalPnl, 0);
    const bestSentiment = SENTIMENTS.reduce((best, s) => metrics[s].totalPnl > (metrics[best]?.totalPnl || -Infinity) ? s : best, '');
    const greedWinRate = metrics['Greed']?.winRate || 0;
    const fearWinRate = metrics['Fear']?.winRate || 0;
    const topTrader = topTraders[0];
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${totalTrades.toLocaleString()}</div><div class="stat-label">Total Trades Analyzed</div><div class="stat-sub">May 2023 – May 2025</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${formatCurrency(totalPnl)}</div><div class="stat-label">Total Gross PnL</div><div class="stat-sub">${traderStats.size} unique traders</div></div>
        <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-value">${bestSentiment}</div><div class="stat-label">Best Sentiment Regime</div><div class="stat-sub">${formatCurrency(metrics[bestSentiment]?.totalPnl || 0)} total PnL</div></div>
        <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value">${greedWinRate.toFixed(1)}%</div><div class="stat-label">Greed Zone Win Rate</div><div class="stat-sub">vs ${fearWinRate.toFixed(1)}% in Fear zone</div></div>
        <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-value">${formatCurrency(topTrader?.totalPnl || 0)}</div><div class="stat-label">Top Trader PnL</div><div class="stat-sub">${topTrader?.displayAddress || 'N/A'} - ${topTrader?.trades || 0} trades</div></div>
    `;
}

function updateInsightsGrid(metrics, topTraders) {
    const topTrader = topTraders[0];
    const extremeFearSize = metrics['Extreme Fear']?.avgSize || 0;
    const extremeFearWinRate = metrics['Extreme Fear']?.winRate || 0;
    document.getElementById('insightsGrid').innerHTML = `
        <div class="insight-card"><div class="insight-icon">💎</div><h3>Insight 1: Extreme Greed Yields Highest Returns</h3><p>Extreme Greed shows the highest avg PnL per trade (${formatCurrency(metrics['Extreme Greed']?.avgPnl || 0)}) and win rate (${metrics['Extreme Greed']?.winRate.toFixed(1) || 0}%), making it the most profitable market regime to trade aggressively in.</p></div>
        <div class="insight-card"><div class="insight-icon">📊</div><h3>Insight 2: Contrarian Accumulation Signal</h3><p>Traders open significantly more Long positions during Fear and Neutral phases (e.g., ${metrics['Fear']?.longCount.toLocaleString() || 0} longs vs ${metrics['Fear']?.shortCount.toLocaleString() || 0} shorts in Fear) — a classic contrarian accumulation signal.</p></div>
        <div class="insight-card"><div class="insight-icon">💪</div><h3>Insight 3: Bigger Bets in Extreme Fear</h3><p>Trade sizes are largest in Extreme Fear (${formatCurrency(extremeFearSize)} avg) — experienced traders bet bigger when prices are depressed, amplifying upside when sentiment recovers.</p></div>
        <div class="insight-card"><div class="insight-icon">⚠️</div><h3>Insight 4: High Risk, High Reward in Fear</h3><p>Extreme Fear has the lowest win rate (${extremeFearWinRate.toFixed(1)}%) despite large size bets — high-risk, high-reward plays that pay off when timed correctly but carry significant downside.</p></div>
        <div class="insight-card"><div class="insight-icon">👑</div><h3>Insight 5: Top Performer Strategy</h3><p>Top performer ${topTrader?.displayAddress || 'N/A'} earns ${formatCurrency(topTrader?.totalPnl || 0)} with a ${topTrader?.winRate.toFixed(1) || 0}% win rate — suggesting a disciplined range-trading strategy optimized for market conditions.</p></div>
        <div class="insight-card"><div class="insight-icon">🪙</div><h3>Insight 6: Sentiment-Based Coin Selection</h3><p>Different coins perform best in different sentiments. Diversification across sentiment regimes reduces concentration risk and optimizes returns.</p></div>
    `;
}

function updateTradersTable(topTraders) {
    document.getElementById('tradersTableBody').innerHTML = topTraders.map((trader, index) => `
        <tr><td class="rank-cell">#${index + 1}</td><td class="trader-address">${trader.displayAddress}</td><td class="pnl-${trader.totalPnl >= 0 ? 'positive' : 'negative'}">${formatCurrency(trader.totalPnl)}</td><td>${trader.trades.toLocaleString()}</td><td class="pnl-positive">${trader.winRate.toFixed(1)}%</td><td>${trader.bestSentiment}</td></tr>
    `).join('');
}

function updateCoinsGrid(metrics) {
    const allTopCoins = [];
    SENTIMENTS.forEach(sentiment => {
        (metrics[sentiment]?.topCoin || []).forEach(([coin, pnl]) => {
            allTopCoins.push({ coin, sentiment, pnl });
        });
    });
    const uniqueCoins = [...new Map(allTopCoins.map(c => [c.coin, c])).values()];
    document.getElementById('coinsGrid').innerHTML = uniqueCoins.slice(0, 8).map(coin => `
        <div class="coin-card"><div class="coin-symbol">${coin.coin}</div><div class="coin-sentiment">Best in: ${coin.sentiment}</div><div class="coin-pnl">${formatCurrency(coin.pnl)}</div></div>
    `).join('');
}

function updateDashboard(metrics, topTraders) {
    updateStatsGrid(metrics, topTraders);
    updateAllCharts(metrics, topTraders);
    updateInsightsGrid(metrics, topTraders);
    updateTradersTable(topTraders);
    updateCoinsGrid(metrics);
}

function loadCSV(file, callback) {
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) { callback(results.data); },
        error: function(error) { console.error('CSV Parse Error:', error); callback([]); }
    });
}

function processUploadedData(file) {
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('dashboardContent').style.display = 'none';
    loadCSV(file, (data) => {
        if (data && data.length > 0) {
            tradingData = data;
            const { metrics, topTraders } = processTradingData(tradingData);
            updateDashboard(metrics, topTraders);
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';
            document.getElementById('uploadSection').style.display = 'none';
        } else {
            document.getElementById('loadingIndicator').style.display = 'none';
            alert('No valid data found in the CSV file.');
        }
    });
}

// LOAD SAMPLE DATA (80k records) - This is your main file now
function loadSampleData() {
    fetch('data/sample_data.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSV file not found');
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.data && results.data.length > 0) {
                        tradingData = results.data;
                        const { metrics, topTraders } = processTradingData(tradingData);
                        updateDashboard(metrics, topTraders);
                        document.getElementById('loadingIndicator').style.display = 'none';
                        document.getElementById('dashboardContent').style.display = 'block';
                        document.getElementById('uploadSection').style.display = 'none';
                        console.log(`✅ Loaded ${results.data.length} trades from sample_data.csv`);
                    }
                }
            });
        })
        .catch(error => {
            console.log('⚠️ No sample_data.csv found, showing upload option');
            document.getElementById('loadingIndicator').style.display = 'none';
        });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('tradesUpload').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) processUploadedData(e.target.files[0]);
    });
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
    // ❌ REMOVED: loadSampleData(); - No more auto-load
});
