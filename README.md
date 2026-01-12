# 💼 Wealth On Track (WOT) - Portfolio Tracker

**BETA V1** - Modern portfolio tracking application built with Next.js 16, Prisma, and TypeScript.

## ✨ Features

### Core Functionality
- 📊 **Multi-Currency Portfolio Management** - Track assets in EUR, USD, TRY, and more
- 🔄 **Real-Time Price Updates** - Automatic price fetching from Yahoo Finance, TEFAS, and other sources
- 📈 **Performance Analytics** - Historical performance tracking with currency normalization
- 🏆 **Top Performers Widget** - See your best performing assets at a glance
- 🎯 **Goal Tracking** - Set and monitor financial goals
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile

### Asset Support
- 🇹🇷 **BIST** - Turkish stocks (Borsa Istanbul)
- 🏦 **TEFAS** - Turkish mutual funds
- 🇺🇸 **US Markets** - Stocks, ETFs, mutual funds
- 🇪🇺 **EU Markets** - European stocks and funds
- ₿ **Crypto** - Bitcoin, Ethereum, and major cryptocurrencies
- 🥇 **Commodities** - Gold, silver, oil, etc.
- 💱 **FX** - Foreign exchange pairs
- 💵 **Cash** - Multi-currency cash holdings

### Advanced Features
- 🔐 **Secure Authentication** - Email/password and Google OAuth
- 🌍 **Multi-Language** - English and Turkish support
- 🌓 **Dark/Light Mode** - Automatic theme switching
- 📊 **Advanced Filtering** - Filter by type, exchange, currency, sector, and more
- 🎨 **Custom Grouping** - Organize assets your way
- 📉 **Historical Charts** - Visualize portfolio performance over time

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd portfolio-tracker

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
npx prisma generate
npx prisma migrate dev

# Run development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📦 Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: CSS Variables (Custom Design System)
- **Charts**: Recharts
- **API Integration**: Yahoo Finance, TEFAS, Alpha Vantage, Finnhub

## 🏗️ Project Structure

```
portfolio-tracker/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utility functions and helpers
│   ├── services/         # API services (Yahoo, TEFAS, etc.)
│   └── styles/           # Global styles
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static assets
└── scripts/              # Utility scripts
```

## 🔧 Configuration

### Environment Variables

See `.env.production.example` for all available environment variables.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - Authentication secret key
- `NEXT_PUBLIC_APP_URL` - Your application URL

Optional:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `ALPHA_VANTAGE_API_KEY` - For additional market data
- `FINNHUB_API_KEY` - For stock data fallback

## 📖 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Comprehensive production deployment instructions
- [API Documentation](./docs/API.md) - API endpoints and usage (if applicable)
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute (if applicable)

## 🛡️ Security

- ✅ Security headers configured (HSTS, CSP, X-Frame-Options)
- ✅ Error boundaries for graceful error handling
- ✅ Rate limiting ready (see middleware example)
- ✅ Environment variables for sensitive data
- ✅ SQL injection protection via Prisma

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Docker
```bash
docker build -t portfolio-tracker .
docker run -p 3000:3000 portfolio-tracker
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 📊 Performance

- Lighthouse Score: 90+ (aim)
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- Yahoo Finance for market data
- TEFAS for Turkish fund data
- Next.js team for the amazing framework
- Prisma team for the excellent ORM

## 📧 Support

For support, email [your-email] or open an issue on GitHub.

---

**Made with ❤️ by [Your Name]**
