# D3 Analyzer - Prototype

AI-powered security audit report generation prototype built with React and Google Gemini API.

## 📁 Project Structure

```
Analyzer Prototype/
├── src/
│   ├── D3ReportGenerator_v1.0_Prototype.jsx  # Basic version
│   └── D3ReportGenerator_v1.1_Enhanced.jsx   # Production-ready version
├── .env.example                               # Environment template
├── SETUP_GUIDE.md                             # Detailed setup instructions
└── README.md                                  # This file
```

## 🚀 Quick Start

This is a **standalone prototype** separate from the main DataFortress application.

### Option 1: Test in Main DataFortress App

1. Copy the component you want to test:
   ```bash
   cp "src/D3ReportGenerator_v1.1_Enhanced.jsx" "../datafortress/src/"
   ```

2. Import in your main app:
   ```jsx
   import D3ReportGenerator from './D3ReportGenerator_v1.1_Enhanced';
   ```

3. Configure `.env` in datafortress folder:
   ```bash
   cp .env.example ../datafortress/.env
   # Add your API key to ../datafortress/.env
   ```

4. Run DataFortress dev server:
   ```bash
   cd ../datafortress
   npm run dev
   ```

### Option 2: Create Standalone App

1. Initialize new React + Vite project:
   ```bash
   npm create vite@latest d3-analyzer -- --template react
   cd d3-analyzer
   npm install
   ```

2. Install dependencies:
   ```bash
   npm install lucide-react
   npm install -D tailwindcss@next @tailwindcss/vite@next
   ```

3. Copy prototype files:
   ```bash
   cp ../src/D3ReportGenerator_v1.1_Enhanced.jsx ./src/
   cp ../.env.example ./.env
   ```

4. Configure Tailwind (see SETUP_GUIDE.md)

5. Add API key to `.env` and run:
   ```bash
   npm run dev
   ```

## 📦 What's Included

### v1.1 Enhanced (Recommended)
**File:** `src/D3ReportGenerator_v1.1_Enhanced.jsx`

**Features:**
- ✅ Comprehensive error handling
- ✅ CSV input validation
- ✅ Sample data loader
- ✅ Clear/Reset functionality
- ✅ Environment variable support
- ✅ Enhanced loading states
- ✅ API response validation
- ✅ Network error detection

### v1.0 Prototype
**File:** `src/D3ReportGenerator_v1.0_Prototype.jsx`

Basic functionality - good for learning/reference.

## 🔑 API Configuration

1. Get Gemini API key: https://makersuite.google.com/app/apikey
2. Copy `.env.example` to `.env`
3. Add key: `VITE_GEMINI_API_KEY=your_key_here`

## 📚 Documentation

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions, troubleshooting, and usage examples.

## 🎯 Use Cases

- **Testing**: Try new features before integrating into main app
- **Learning**: Study AI integration patterns
- **Reference**: Copy components to other projects
- **Demonstrations**: Showcase capabilities to clients

## ⚠️ Important Notes

- This is a **prototype** - not production DataFortress
- Requires internet connection for AI API calls
- API key needed for report generation
- Best used with DataFortress infrastructure

## 🔗 Integration with DataFortress

To use in the main DataFortress application:

1. Copy desired version to `datafortress/src/`
2. Import in `App.jsx` or create new route
3. Ensure `.env` is configured in datafortress folder
4. Component is ready to use!

---

**Delta Data Defense** | Prototype Development | 2025
