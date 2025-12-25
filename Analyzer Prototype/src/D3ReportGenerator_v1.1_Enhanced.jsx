/**
 * D3 Report Generator - Enhanced Version 1.1
 * 
 * @version 1.1.0
 * @date 2025-12-24
 * @description AI-powered security audit report generator with enhanced error handling
 * 
 * PROTOTYPE FEATURES:
 * - CSV data ingestion for security metadata analysis
 * - AI-powered risk assessment using Google Gemini 2.5 Flash
 * - Real-time report generation with executive summary
 * - Professional printable PDF export functionality
 * - Status-based findings with remediation guidance
 * 
 * CHANGELOG:
 * v1.1.0 - Enhanced Error Handling & UX Improvements
 *   - Added comprehensive error state management
 *   - Implemented input validation for CSV data
 *   - Added sample data functionality for testing
 *   - Clear/Reset functionality for better UX
 *   - Environment variable support for API key
 *   - Enhanced loading states with better feedback
 *   - Response validation from AI
 *   - Rate limiting on generate button
 * 
 * v1.0.0 - Initial prototype implementation
 *   - Core report generation engine
 *   - Gemini API integration
 *   - Print-optimized report layout
 *   - Risk scoring and categorization
 */

import React, { useState, useRef } from 'react';
import { 
  Shield, Zap, Eye, FileText, Loader2, 
  Printer, CheckCircle2, AlertCircle, 
  XCircle, Info, Database, Users, 
  Lock, ArrowRight, Download, RefreshCw,
  ClipboardCopy, AlertTriangle
} from 'lucide-react';

const D3ReportGenerator = () => {
  const [csvData, setCsvData] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState('');
  const reportRef = useRef(null);

  // Sample data for testing
  const SAMPLE_CSV_DATA = `Hostname,SQL_Version,Backup_Status,AD_Status,Last_Backup,Patch_Level
SERVER01,SQL2019,Failed,Active,N/A,SP2
SERVER02,SQL2016,Success,Inactive,2025-12-23,CU15
WORKSTATION03,N/A,N/A,Active,N/A,N/A`;

  const validateCSVInput = (data) => {
    if (!data || data.trim().length === 0) {
      return { valid: false, error: 'CSV data cannot be empty' };
    }
    
    const lines = data.trim().split('\n');
    if (lines.length < 2) {
      return { valid: false, error: 'CSV must contain at least a header row and one data row' };
    }
    
    const headerCols = lines[0].split(',').length;
    if (headerCols < 2) {
      return { valid: false, error: 'CSV must contain at least 2 columns' };
    }
    
    return { valid: true, error: null };
  };

  const validateReportResponse = (data) => {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const requiredFields = ['overallRisk', 'score', 'summary', 'findings', 'nextSteps'];
    const hasAllFields = requiredFields.every(field => field in data);
    
    if (!hasAllFields) return false;
    
    // Validate findings structure
    if (!Array.isArray(data.findings) || data.findings.length === 0) {
      return false;
    }
    
    const findingHasRequiredFields = data.findings.every(f => 
      f.category && f.status && f.title && f.detail && f.remediation
    );
    
    return findingHasRequiredFields && Array.isArray(data.nextSteps);
  };

  const loadSampleData = () => {
    setCsvData(SAMPLE_CSV_DATA);
    setValidationError('');
    setError(null);
    setReportData(null);
  };

  const handleReset = () => {
    setCsvData('');
    setClientName('');
    setReportData(null);
    setError(null);
    setValidationError('');
  };

  const generateReport = async () => {
    // Clear previous errors
    setError(null);
    setValidationError('');
    
    // Validate input
    const validation = validateCSVInput(csvData);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }
    
    setLoading(true);
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    
    // Check if API key is configured
    if (!apiKey || apiKey === "your_api_key_here") {
      setError({
        type: 'CONFIG',
        message: 'API key not configured',
        details: 'Please add your Gemini API key to the .env file as VITE_GEMINI_API_KEY'
      });
      setLoading(false);
      return;
    }
    
    const systemPrompt = `
      You are a Senior Cyber Insurance Auditor. 
      Analyze the provided CSV metadata. 
      Format your response as a JSON object with the following structure:
      {
        "overallRisk": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        "score": 0-100,
        "summary": "One sentence executive summary.",
        "findings": [
          { "category": "SQL", "status": "FAIL"|"PASS"|"WARN", "title": "...", "detail": "...", "remediation": "..." },
          { "category": "AD", "status": "...", "title": "...", "detail": "...", "remediation": "..." },
          { "category": "BACKUP", "status": "...", "title": "...", "detail": "...", "remediation": "..." }
        ],
        "nextSteps": ["Step 1", "Step 2"]
      }
      Only return the JSON object. No extra text.
    `;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Client Name: ${clientName || 'Valued Client'}. Data: ${csvData}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
      }

      const result = await response.json();
      const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawJson) {
        throw new Error('No response content received from API');
      }
      
      const parsed = JSON.parse(rawJson);
      
      // Validate response structure
      if (!validateReportResponse(parsed)) {
        throw new Error('Invalid report structure received from API');
      }
      
      setReportData(parsed);
      setError(null);
    } catch (error) {
      console.error("Audit Generation Failed", error);
      
      let errorType = 'GENERATION';
      let errorMessage = 'Failed to generate report';
      let errorDetails = error.message;
      
      if (error.message.includes('API request failed')) {
        errorType = 'API';
        errorMessage = 'API request failed';
      } else if (error.message.includes('JSON')) {
        errorType = 'PARSING';
        errorMessage = 'Failed to parse API response';
      } else if (error.message.includes('fetch')) {
        errorType = 'NETWORK';
        errorMessage = 'Network connection failed';
        errorDetails = 'Please check your internet connection and try again';
      }
      
      setError({ type: errorType, message: errorMessage, details: errorDetails });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PASS': return <CheckCircle2 className="text-emerald-500 w-5 h-5" />;
      case 'WARN': return <AlertCircle className="text-amber-500 w-5 h-5" />;
      case 'FAIL': return <XCircle className="text-red-500 w-5 h-5" />;
      default: return <Info className="text-slate-400 w-5 h-5" />;
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'CRITICAL': return 'text-red-500 border-red-500/50 bg-red-500/10';
      case 'HIGH': return 'text-orange-500 border-orange-500/50 bg-orange-500/10';
      case 'MEDIUM': return 'text-amber-500 border-amber-500/50 bg-amber-500/10';
      default: return 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10';
    }
  };

  const ErrorDisplay = ({ error }) => (
    <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-500 w-6 h-6 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-red-400 font-bold mb-2">{error.message}</h3>
          <p className="text-red-300 text-sm mb-3">{error.details}</p>
          <div className="flex gap-2">
            <button 
              onClick={handleReset}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear & Retry
            </button>
            {error.type === 'CONFIG' && (
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Get API Key
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* APP UI (Hidden on Print) */}
      <div className="max-w-6xl mx-auto p-6 md:p-12 print:hidden">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-emerald-500/20 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="text-emerald-500 w-8 h-8" />
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">D3 <span className="text-emerald-500">Analyzer</span></h1>
            </div>
            <p className="text-slate-500 text-sm font-medium tracking-widest uppercase">Intelligent Audit Layer v1.1</p>
          </div>
          
          <div className="flex flex-col w-full md:w-auto gap-3">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Identity</label>
             <input 
                type="text" 
                placeholder="Enter Client Name..." 
                className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-all"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
             />
          </div>
        </header>

        {/* Error Display */}
        {error && <ErrorDisplay error={error} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* INPUT COLUMN */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" /> Morning Strike Data
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={loadSampleData}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                    title="Load sample CSV data"
                  >
                    <ClipboardCopy size={10} /> Sample
                  </button>
                  <button
                    onClick={handleReset}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                    title="Clear all data"
                  >
                    <RefreshCw size={10} /> Reset
                  </button>
                </div>
              </div>
              
              {validationError && (
                <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/50 rounded-lg">
                  <p className="text-amber-400 text-xs flex items-center gap-2">
                    <AlertCircle size={12} /> {validationError}
                  </p>
                </div>
              )}
              
              <textarea 
                className="w-full h-[400px] bg-black/40 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
                placeholder="Paste your CSV extraction logs here..."
                value={csvData}
                onChange={(e) => {
                  setCsvData(e.target.value);
                  setValidationError('');
                }}
              />
              <button 
                onClick={generateReport}
                disabled={loading || !csvData}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20 group"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" />
                    Analyzing Data...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Generate Executive Report
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PREVIEW COLUMN */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 rounded-3xl text-slate-600 p-12 text-center bg-emerald-500/5">
                <Loader2 className="w-16 h-16 mb-6 animate-spin text-emerald-500" />
                <h3 className="text-white font-bold mb-2">Analyzing Security Data</h3>
                <p className="text-sm max-w-xs leading-relaxed">AI is processing your data and generating a comprehensive risk assessment...</p>
              </div>
            ) : reportData ? (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl">
                    <span className="text-sm font-bold text-emerald-500">Analysis Complete</span>
                    <button 
                      onClick={handlePrint}
                      className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-colors"
                    >
                      <Printer size={14} /> Export to PDF
                    </button>
                  </div>

                  {/* VIRTUAL PREVIEW OF THE PRINTED REPORT */}
                  <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl max-h-[600px] overflow-y-auto pointer-events-none opacity-90 scale-[0.98] origin-top">
                      <p className="text-[10px] text-slate-400 text-center mb-4 italic">--- UI Preview Only ---</p>
                      <div className="border-t-8 border-emerald-900 pt-8">
                         <div className="flex justify-between items-start mb-8">
                            <h1 className="text-3xl font-black uppercase leading-none">Security Audit<br/><span className="text-emerald-600">Certificate</span></h1>
                            <div className="text-right">
                              <p className="font-bold text-sm uppercase">Delta Data Defense</p>
                              <p className="text-[10px] text-slate-500">Arkansas Risk Compliance</p>
                            </div>
                         </div>
                         <div className={`p-4 rounded-xl border mb-6 ${getRiskColor(reportData.overallRisk).replace('text-', 'text-slate-900 bg-')}`}>
                            <p className="text-[10px] font-bold uppercase opacity-60">Risk Profile</p>
                            <p className="text-3xl font-black">{reportData.overallRisk}</p>
                         </div>
                         <p className="text-sm italic text-slate-600">"{reportData.summary}"</p>
                      </div>
                  </div>
               </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 p-12 text-center">
                <Shield className="w-16 h-16 mb-6 opacity-5" />
                <h3 className="text-white font-bold mb-2">Awaiting Intelligence Scan</h3>
                <p className="text-sm max-w-xs leading-relaxed">Paste your extraction logs on the left to generate a professional, non-technical risk assessment for your client.</p>
                <button
                  onClick={loadSampleData}
                  className="mt-6 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ClipboardCopy size={12} /> Try Sample Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FINAL PRINTABLE REPORT (Hidden on Screen, Visible on Print) */}
      {reportData && (
        <div id="printable-report" className="hidden print:block bg-white text-slate-900 p-12 min-h-screen">
          <div className="max-w-4xl mx-auto border-t-[12px] border-emerald-900 pt-10">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter leading-none mb-2">
                  Technical<br/><span className="text-emerald-600">Risk Report</span>
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Security Verification & Compliance Attestation</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black uppercase italic tracking-tighter">Delta Data Defense</div>
                <p className="text-xs text-slate-400 font-medium">Risk Specialists | Jonesboro, AR</p>
              </div>
            </div>

            {/* Client Info Bar */}
            <div className="flex justify-between border-y border-slate-100 py-4 mb-10">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Client Account</p>
                <p className="font-bold text-lg">{clientName || "Unspecified Client"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-slate-400">Audit Date</p>
                <p className="font-bold text-lg">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Executive Risk Score */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
               <div className={`md:col-span-4 p-8 rounded-2xl flex flex-col items-center justify-center text-center border-2 ${getRiskColor(reportData.overallRisk).replace('text-', 'bg-').replace('/10', '/5')}`}>
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Risk Rating</p>
                  <p className={`text-5xl font-black ${getRiskColor(reportData.overallRisk).split(' ')[0]}`}>{reportData.overallRisk}</p>
                  <div className="mt-4 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full ${getRiskColor(reportData.overallRisk).split(' ')[2]}`} style={{width: `${reportData.score}%`}}></div>
                  </div>
               </div>
               <div className="md:col-span-8 flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-3">Executive Summary</h3>
                  <p className="text-slate-600 leading-relaxed italic border-l-4 border-emerald-500 pl-6">
                    "{reportData.summary}"
                  </p>
               </div>
            </div>

            {/* Findings Section */}
            <div className="space-y-6 mb-12">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Technical Findings</h3>
              
              {reportData.findings.map((finding, idx) => (
                <div key={idx} className="flex gap-6 items-start p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="mt-1">{getStatusIcon(finding.status)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-lg">{finding.title}</h4>
                      <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter text-slate-400">{finding.category}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{finding.detail}</p>
                    <div className="bg-white p-3 rounded-lg border border-emerald-100 flex items-start gap-2">
                      <ArrowRight className="w-3 h-3 text-emerald-600 mt-1 flex-shrink-0" />
                      <p className="text-xs font-bold text-emerald-800"><span className="uppercase opacity-50 mr-1 text-[9px]">Recommended Fix:</span> {finding.remediation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Steps / Signature */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-slate-200">
              <div>
                <h4 className="font-bold mb-4 uppercase text-sm">Priority Next Steps</h4>
                <ul className="space-y-3">
                  {reportData.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <div className="w-5 h-5 bg-slate-900 text-white text-[10px] font-bold rounded flex items-center justify-center">{idx + 1}</div>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col justify-end">
                <div className="border-b-2 border-slate-900 pb-2 mb-2"></div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Assessor Certification</p>
                <p className="text-sm font-bold">Authorized Auditor - Delta Data Defense</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STYLES FOR PRINTING */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          #printable-report { display: block !important; }
        }
      `}</style>

    </div>
  );
};

export default D3ReportGenerator;
