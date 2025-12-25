# D3 Report Generator - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Gemini API key from: https://makersuite.google.com/app/apikey

3. Add it to `.env`:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

### 3. Run Development Server
```bash
npm run dev
```

## File Versions

### v1.1 Enhanced (Recommended)
**File:** `D3ReportGenerator_v1.1_Enhanced.jsx`

**New Features:**
- ✅ Comprehensive error handling with user-friendly messages
- ✅ CSV input validation
- ✅ Sample data loader for quick testing
- ✅ Clear/Reset functionality
- ✅ Environment variable support
- ✅ Enhanced loading states with feedback
- ✅ API response validation
- ✅ Better UX with disabled states

### v1.0 Prototype
**File:** `D3ReportGenerator_v1.0_Prototype.jsx`

Basic functionality without error handling.

## Usage

1. **Load Sample Data**: Click "Sample" to test with example CSV
2. **Enter Client Name**: Optional client identifier
3. **Paste CSV Data**: Your security audit data
4. **Generate Report**: AI analyzes and creates report
5. **Export PDF**: Print/save the professional report

## Environment Variables

Vite automatically loads `.env` files. Variables must be prefixed with `VITE_`:

```env
VITE_GEMINI_API_KEY=your_key_here
```

Access in code:
```javascript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

## Troubleshooting

**"API key not configured"**
- Ensure `.env` file exists with `VITE_GEMINI_API_KEY`
- Restart dev server after creating `.env`

**"Network connection failed"**
- Check internet connection
- Verify API key is valid
- Check Gemini API status

**"Invalid report structure"**
- AI response format issue
- Try regenerating or contact support
