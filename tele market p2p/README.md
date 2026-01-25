# 🚀 Telegram Ad Marketplace

A Telegram Mini App that connects channel owners with advertisers using an escrow-style deal flow powered by TON.

![Telegram Mini App](https://img.shields.io/badge/Telegram-Mini%20App-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [AI Usage Disclosure](#-ai-usage-disclosure)
- [Known Limitations](#-known-limitations)
- [Future Improvements](#-future-improvements)

## ✨ Features

### For Channel Owners
- 📺 **Channel Registration** - Add and verify your Telegram channels
- ✅ **Quick Verification** - Instant verification via bot admin check
- 💰 **Create Listings** - Set prices for different ad formats (post, story, repost, video)
- 📊 **Channel Stats** - View subscriber count, verification status
- 👥 **Multi-Admin Support** - Sync channel admins from Telegram
- 💳 **Receive Payments** - Automatic fund release after ad verification

### For Advertisers
- 🔍 **Browse Marketplace** - Find channels with filters (price, subscribers, format)
- 📝 **Create Campaigns** - Post campaign briefs for channel owners to apply
- 🤝 **Deal Management** - Track deals from request to completion
- 💸 **Escrow Protection** - Funds held safely until ad verified
- ✏️ **Creative Approval** - Review and approve ad drafts before posting

### Escrow System
- 🔒 **Secure Funding** - Per-deal escrow wallet addresses
- ⏰ **Auto-Timeout** - Stale deals automatically cancelled
- 🤖 **Auto-Posting** - Bot posts approved ads at scheduled time
- ✅ **Post Verification** - Regular checks that ad remains live
- 💰 **Auto-Release** - Funds released after 24h verification period

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram      │────▶│   Mini App      │────▶│   Backend API   │
│   Client        │     │   (React)       │     │   (Express)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   Telegram      │◀─────────────┤
                        │   Bot API       │              │
                        └─────────────────┘              │
                                                         │
                        ┌─────────────────┐              │
                        │   MySQL DB      │◀─────────────┘
                        └─────────────────┘
```

### Key Components

1. **Frontend (React + TypeScript)**
   - Telegram Mini App integration
   - Glassmorphism dark theme UI
   - Real-time deal status updates

2. **Backend (Node.js + Express)**
   - RESTful API
   - Telegram WebApp authentication
   - Scheduled task processing

3. **Services**
   - `telegram.ts` - Bot API integration
   - `scheduler.ts` - Auto-posting & verification
   - `tonWallet.ts` - TON escrow simulation

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MySQL 8.0 |
| **Bot** | Telegram Bot API |
| **Styling** | CSS (Glassmorphism) |
| **Wallet** | TON (Simulated) |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MySQL 8.0+
- Telegram Bot Token (from @BotFather)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/tele-market-p2p.git
cd tele-market-p2p
```

### 2. Setup Database

```bash
# Login to MySQL
mysql -u root -p

# Create database and import schema
source backend/database/schema.sql
```

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
```

**Required environment variables:**
```env
PORT=3000
NODE_ENV=development
BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=your_bot_username
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ad_marketplace
FRONTEND_URL=http://localhost:5173
```

### 4. Configure Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with your API URL
npm install
```

### 5. Start Development

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 6. Configure Telegram Bot

1. Go to [@BotFather](https://t.me/BotFather)
2. Send `/setmenubutton`
3. Select your bot
4. Enter your Mini App URL

## 📚 API Documentation

### Authentication

All API endpoints require `X-Telegram-Init-Data` header with WebApp initData.

### Endpoints

#### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/channels` | Get user's channels |
| POST | `/api/channels/quick-verify` | Quick verify via Telegram |
| POST | `/api/channels/:id/verify` | Verify with code |
| GET | `/api/channels/:id/managers` | List channel managers |
| POST | `/api/channels/:id/sync-managers` | Sync from Telegram |

#### Listings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/listings` | Browse marketplace |
| POST | `/api/listings` | Create listing |
| PUT | `/api/listings/:id` | Update listing |
| DELETE | `/api/listings/:id` | Delete listing |

#### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | Browse campaigns |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/campaigns/:id/apply` | Apply with channel |
| PUT | `/api/campaigns/:id/applications/:appId` | Accept/reject |

#### Deals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | Get user's deals |
| POST | `/api/deals` | Create deal |
| POST | `/api/deals/:id/accept` | Accept deal |
| POST | `/api/deals/:id/fund` | Fund escrow |
| POST | `/api/deals/:id/drafts` | Submit creative |
| PUT | `/api/deals/:id/drafts/:draftId/review` | Review draft |
| POST | `/api/deals/:id/schedule` | Schedule post |
| POST | `/api/deals/:id/post` | Trigger auto-post |
| POST | `/api/deals/:id/complete` | Complete deal |
| POST | `/api/deals/:id/dispute` | Open dispute |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get profile |
| GET | `/api/users/wallet` | Get wallet info |
| POST | `/api/users/deposit` | Simulate deposit |
| POST | `/api/users/withdraw` | Simulate withdraw |
| GET | `/api/users/transactions` | Transaction history |

## 🌐 Deployment

### Deploy to Render

1. Push code to GitHub
2. Create Web Service on Render
3. Connect repository
4. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables
6. Deploy!

### Deploy to Vercel

Frontend can be deployed to Vercel separately.

## 🤖 AI Usage Disclosure

**AI-Assisted Development: ~85%**

This project was developed with significant AI assistance:
- Architecture design and planning
- TypeScript type definitions
- API route implementations
- Service layer logic
- Database schema design
- Documentation

Human contributions include:
- Requirements specification
- Testing and debugging
- Deployment configuration
- Business logic decisions

## ⚠️ Known Limitations

1. **TON Wallet Simulation**
   - Currently simulates TON transactions
   - Real TON integration requires @ton/ton SDK

2. **Channel Stats**
   - Basic stats via Bot API
   - Full analytics requires MTProto API

3. **Auto-Posting**
   - Requires bot to be channel admin
   - Post verification checks every 30 minutes

4. **Multi-Language**
   - Currently English only
   - i18n planned for future

## 🔮 Future Improvements

1. **Real TON Integration**
   - Connect to TON blockchain
   - Real wallet addresses
   - Smart contract escrow

2. **Enhanced Stats**
   - MTProto integration
   - Language distribution
   - Premium subscriber %

3. **Advanced Matching**
   - AI-powered campaign matching
   - Price suggestions

4. **Mobile App**
   - Dedicated iOS/Android apps
   - Push notifications

5. **Analytics Dashboard**
   - ROI tracking
   - Performance metrics

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- Telegram Mini Apps team
- TON Foundation
- Open source community

---

**Built for Telegram Mini Apps Contest 2026** 🏆
