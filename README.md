# 🚀 Sales Scorecard PWA

A Progressive Web Application for the Sales Scorecard platform, providing a modern, responsive, and installable web experience for sales management and evaluation.

## ✨ Features

### 🎯 Core Functionality
- **User Management**: Create, edit, and manage users with role-based access
- **Team Management**: Organize sales teams and hierarchies
- **Evaluation System**: Create and manage sales evaluations
- **Analytics Dashboard**: Real-time insights and reporting
- **Offline Support**: Work without internet connection
- **Push Notifications**: Real-time updates and alerts

### 📱 PWA Features
- **Installable**: Add to home screen on any device
- **Offline First**: Works without internet connection
- **Fast Loading**: Optimized performance with service workers
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Cross-Platform**: Works on iOS, Android, and desktop

## 🏗️ Architecture

```
SalesScorecard-PWA/
├── src/
│   ├── components/          # React components
│   ├── services/           # API services
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript types
│   └── App.tsx             # Main app component
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service worker
│   └── icons/             # App icons
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ZahariVassilev87/SalesScorecard-PWA.git
   cd SalesScorecard-PWA
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your API endpoint
   ```

4. **Start development server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# API Configuration
REACT_APP_API_BASE_URL=https://api.instorm.io
REACT_APP_API_TIMEOUT=10000

# PWA Configuration
REACT_APP_NAME=Sales Scorecard
REACT_APP_SHORT_NAME=SalesScorecard
REACT_APP_DESCRIPTION=Sales management and evaluation platform
REACT_APP_THEME_COLOR=#667eea
REACT_APP_BACKGROUND_COLOR=#ffffff

# Feature Flags
REACT_APP_ENABLE_OFFLINE=true
REACT_APP_ENABLE_PUSH_NOTIFICATIONS=true
REACT_APP_ENABLE_ANALYTICS=true
```

## 📱 PWA Features

### Installation
- **Desktop**: Click the install button in the address bar
- **Mobile**: "Add to Home Screen" from browser menu
- **Automatic**: Prompts users to install after engagement

### Offline Support
- **Cached Data**: Recent data available offline
- **Background Sync**: Syncs when connection restored
- **Offline Indicators**: Clear status of connection state

### Performance
- **Service Worker**: Intelligent caching strategy
- **Lazy Loading**: Components loaded on demand
- **Optimized Assets**: Compressed images and code

## 🎨 Design System

### Color Palette
- **Primary**: #667eea (Blue)
- **Secondary**: #764ba2 (Purple)
- **Success**: #10b981 (Green)
- **Warning**: #f59e0b (Amber)
- **Error**: #ef4444 (Red)
- **Neutral**: #6b7280 (Gray)

### Typography
- **Font Family**: Inter, system-ui, sans-serif
- **Headings**: 600 weight
- **Body**: 400 weight
- **Code**: JetBrains Mono

## 🔌 API Integration

The PWA connects to the Sales Scorecard API:

- **Base URL**: `https://api.instorm.io`
- **Authentication**: JWT tokens
- **Endpoints**: RESTful API
- **Real-time**: WebSocket support (planned)

### Available Endpoints
- `GET /public-admin/users` - User management
- `GET /public-admin/teams` - Team management
- `POST /auth/login` - Authentication
- `GET /api/evaluations` - Evaluations
- `GET /api/analytics` - Analytics data

## 🚀 Deployment

### Development
```bash
npm start
```

### Production Build
```bash
npm run build
```

### Deploy to AWS CloudFront
```bash
npm run deploy
```

## 📊 Performance Metrics

### Lighthouse Scores (Target)
- **Performance**: 95+
- **Accessibility**: 95+
- **Best Practices**: 95+
- **SEO**: 90+
- **PWA**: 100

### Bundle Size
- **Initial Load**: < 200KB gzipped
- **Total Bundle**: < 1MB gzipped
- **Lazy Loaded**: Components loaded on demand

## 🔒 Security

### Data Protection
- **HTTPS Only**: All communications encrypted
- **JWT Tokens**: Secure authentication
- **CSP Headers**: Content Security Policy
- **Input Validation**: Client and server-side validation

### Privacy
- **No Tracking**: No third-party analytics by default
- **Local Storage**: Sensitive data encrypted
- **GDPR Compliant**: Privacy-first approach

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

### PWA Testing
```bash
npm run test:pwa
```

## 📈 Analytics

### Performance Monitoring
- **Core Web Vitals**: LCP, FID, CLS tracking
- **User Experience**: Real user monitoring
- **Error Tracking**: Automatic error reporting

### Usage Analytics
- **User Engagement**: Feature usage tracking
- **Performance Metrics**: Load times and interactions
- **Offline Usage**: Offline feature utilization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/ZahariVassilev87/SalesScorecard-PWA/wiki)
- **Issues**: [GitHub Issues](https://github.com/ZahariVassilev87/SalesScorecard-PWA/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ZahariVassilev87/SalesScorecard-PWA/discussions)

## 🎯 Roadmap

### Phase 1: Core PWA (Current)
- ✅ Basic PWA setup
- ✅ User and team management
- ✅ Offline support
- ✅ Responsive design

### Phase 2: Advanced Features
- 🔄 Push notifications
- 🔄 Background sync
- 🔄 Advanced caching
- 🔄 Performance optimization

### Phase 3: Enterprise Features
- 📋 Advanced analytics
- 📋 Custom themes
- 📋 Multi-language support
- 📋 Advanced offline capabilities

---

**Built with ❤️ for modern sales teams**
