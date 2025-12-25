# DataFortress - Security Audit Platform

A modern React-based application for generating professional security audit reports using AI-powered analysis. Built for Delta Data Defense to streamline client risk assessments.

## 🚀 Features

- **AI-Powered Analysis** - Leverages Google Gemini 2.0 Flash for intelligent security assessments
- **CSV Data Ingestion** - Import security metadata from various sources
- **Professional PDF Reports** - Print-optimized executive reports with branding
- **Risk Categorization** - Automatic CRITICAL/HIGH/MEDIUM/LOW risk classification
- **Remediation Guidance** - AI-generated actionable fix recommendations
- **Client Customization** - Personalized reports with client names and audit dates

## 📦 Tech Stack

- **React 19** - Modern UI library
- **Vite** - Lightning-fast build tool
- **Tailwind CSS 4** - Utility-first styling
- **Lucide React** - Beautiful icon system
- **Google Gemini API** - AI-powered analysis engine

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your Gemini API key to .env
# VITE_GEMINI_API_KEY=your_actual_api_key_here
```

**Get API Key:** https://makersuite.google.com/app/apikey

## 🏃 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## � Prototypes & Testing

### D3 Analyzer Prototype

The **D3 Report Generator** prototype components are now located in the separate `Analyzer Prototype/` folder to keep experimental features separate from production code.

**Location:** `../Analyzer Prototype/`

**Available Versions:**
- `v1.1 Enhanced` - Production-ready with full error handling
- `v1.0 Prototype` - Basic functionality for reference

**To integrate prototypes:**
```bash
# Copy component to main app
cp "../Analyzer Prototype/src/D3ReportGenerator_v1.1_Enhanced.jsx" "./src/"

# Import in your component
import D3ReportGenerator from './D3ReportGenerator_v1.1_Enhanced';
```

See `../Analyzer Prototype/README.md` for detailed prototype documentation.

## 🎯 Usage

1. **Import Component:**
   ```jsx
   import D3ReportGenerator from './D3ReportGenerator_v1.1_Enhanced';
   
   function App() {
     return <D3ReportGenerator />;
   }
DataFortress is designed as a modular security audit platform. Components can be integrated from the prototype folder or developed directly in the main application.

### Development Workflow

1. **Test prototypes** in `../Analyzer Prototype/` folder
2. **Copy stable components** to `src/` when ready
3. **Integrate** into main App.jsx
4. **Deploy** production-ready featuresE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Access in code:**
```javascript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

⚠️ **Important:** Restart the dev server after modifying `.env` files.

## 📁 Project Structure

```
DataFortress/
├── datafortress/                            # Main production application
│   ├── src/
│   │   ├── App.jsx                          # Main application
│   │   ├── main.jsx                         # Entry point
│   │   ├── assets/                          # Static assets
│   │   └── backup/                          # Previous versions
│   ├── public/                              # Public assets
│   ├── package.json                         # Dependencies
│   ├── vite.config.js                       # Vite configuration
│   └── tailwind.config.js                   # Tailwind configuration
│
└── Analyzer Prototype/                      # D3 Report Generator prototypes
    ├── src/
    │   ├── D3ReportGenerator_v1.0_Prototype.jsx
    │   └── D3ReportGenerator_v1.1_Enhanced.jsx
    ├── .env.example                         # Environment template
    ├── SETUP_GUIDE.md                       # Prototype setup guide
    └── README.md                            # Prototype documentation
```

## 🐛 Troubleshooting

### "API key not configured"
- Ensure `.env` file exists in project root
- Verify `VITE_GEMINI_API_KEY` is set
- Restart dev server after creating/modifying `.env`

### "Network connection failed"
- Check internet connection
- Verify Gemini API service status
- Confirm API key is valid and not expired

### "Invalid report structure"
- AI response format issue
- Try regenerating the report
- Check CSV data format is correct

### Development Server Issues
```bash
# Clear cache and restart
rm -rf node_modules dist .vite
npm install
npm run dev
```

## 📄 License

Proprietary - Delta Data Defense © 2025

## 👥 Contact

**Delta Data Defense**  
Risk Specialists | Jonesboro, AR

---

Built with React + Vite for optimal performance and developer experience.
