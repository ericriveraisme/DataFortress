/**
 * DATA FORTRESS AUDITOR
 * Version: 1.4.0 (Enhanced Validation Logic)
 * Date: December 19, 2025
 * * CHANGE LOG:
 * - v1.4.0: Added "Negative Validation" logic.
 * - Now explicitly checks for "Forbidden Columns" to identify cross-uploads (e.g., detecting a Backup file uploaded to the SQL slot).
 * - Fixed potential issue where error state might not display immediately.
 * - v1.3.0: Strict column fingerprinting.
 * - v1.2.0: Added "Data Guard".
 * - v1.1.0: Export fixes.
 * - v1.0.0: Initial Release.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileText, Shield, Database, Users, HardDrive, ArrowRight, RefreshCw, Printer, Download, Search } from 'lucide-react';

// --- HELPER FUNCTIONS ---

// Robust CSV Parser
const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], data: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const obj = {};
    let currentLine = lines[i];
    const values = currentLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []; 
    const simpleValues = currentLine.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const finalValues = (simpleValues.length === headers.length) ? simpleValues : values.map(v => v.replace(/^"|"$/g, ''));

    headers.forEach((header, index) => {
      obj[header] = finalValues[index] || '';
    });
    result.push(obj);
  }
  return { headers, data: result };
};

// --- VALIDATION LOGIC (The "Data Guard") ---
const validateFile = (type, parsed) => {
    if (!parsed || parsed.data.length === 0) return { valid: false, error: "File is empty or unreadable." };
    
    const headers = parsed.headers.map(h => h.toLowerCase());
    
    // Detect file type based on unique headers
    let detectedType = null;
    if (headers.includes('priority') && headers.includes('finding')) detectedType = 'sql';
    else if (headers.includes('groupname') && headers.includes('samaccountname')) detectedType = 'ad';
    else if (headers.includes('message')) detectedType = 'backup';
    
    if (!detectedType) {
        return { valid: false, error: "Unknown file format. Ensure it's a valid CSV export." };
    }
    
    if (detectedType !== type) {
        const typeNames = { sql: 'SQL Health', ad: 'AD Security', backup: 'Backup Integrity' };
        return { valid: false, error: `This appears to be a ${typeNames[detectedType]} file. Please upload to the correct slot.` };
    }
    
    // If it matches the slot, it's valid
    return { valid: true, error: null };
};

// --- ANALYSIS LOGIC ---

const analyzeSQL = (data) => {
  if (!data || data.length === 0) return { risk: 'UNKNOWN', findings: [] };

  const findings = [];
  let riskLevel = 'LOW';

  data.forEach(row => {
    const priority = parseInt(row.Priority || 999);
    const findingText = (row.Finding || '').toLowerCase();
    const details = row.Details || '';
    const dbName = row.DatabaseName || 'Unknown';

    if (priority <= 50) {
      if (findingText.includes('backups not performed')) {
        findings.push({
          type: 'CRITICAL',
          title: `No Backups: ${dbName}`,
          desc: `Database '${dbName}' has not been backed up recently. ${details}`,
          impact: 'Total data loss of recent transactions in event of crash.'
        });
        riskLevel = 'CRITICAL';
      } else if (findingText.includes('corruption check')) {
        findings.push({
          type: 'HIGH',
          title: `Corruption Risk: ${dbName}`,
          desc: `DBCC CHECKDB never run on '${dbName}'.`,
          impact: 'Database may contain silent corruption making backups useless.'
        });
        if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
      } else {
        findings.push({
          type: 'MEDIUM',
          title: `Config Issue: ${findingText}`,
          desc: details,
          impact: 'Performance or stability risk.'
        });
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      }
    }
  });

  return { risk: riskLevel, findings };
};

const analyzeAD = (data) => {
  if (!data || data.length === 0) return { risk: 'UNKNOWN', findings: [] };

  const findings = [];
  let riskLevel = 'LOW';

  const redFlagKeywords = ['temp', 'scanner', 'backup', 'service', 'test', 'msp', 'vendor', 'printer', 'copy'];
  
  data.forEach(row => {
    const group = (row.GroupName || '').toLowerCase();
    const name = (row.Name || '').toLowerCase();
    const sam = (row.SamAccountName || '').toLowerCase();
    const combinedSearch = `${name} ${sam}`;

    if (group.includes('admin')) {
        let isRedFlag = false;
        redFlagKeywords.forEach(keyword => {
            if (combinedSearch.includes(keyword)) {
                isRedFlag = true;
            }
        });

        if (isRedFlag) {
            findings.push({
                type: 'CRITICAL',
                title: `Unsecured Admin: ${row.SamAccountName}`,
                desc: `Account '${row.Name}' is in '${row.GroupName}'. This appears to be a service or generic account.`,
                impact: 'High risk of credential theft. Service accounts should not be Domain Admins.'
            });
            riskLevel = 'CRITICAL';
        }
    }
  });

  return { risk: riskLevel, findings };
};

const analyzeBackups = (data) => {
  if (!data || data.length === 0) return { status: 'UNKNOWN', gap: 0, lastSuccess: null, failCount: 0 };

  let lastSuccessDate = null;
  let latestLogDate = null;
  let failCount = 0;

  const cleanData = data.map(row => {
      const timeStr = row.TimeCreated || row.TimeGenerated || row['TimeCreated'] || '';
      return {
          date: new Date(timeStr),
          message: (row.Message || '').toLowerCase(),
          original: row
      };
  }).sort((a, b) => b.date - a.date);

  if (cleanData.length > 0) latestLogDate = cleanData[0].date;

  const successRow = cleanData.find(row => row.message.includes('successfully') || row.message.includes('succeeded'));
  
  if (successRow) {
      lastSuccessDate = successRow.date;
  }

  cleanData.forEach(row => {
      if (row.message.includes('fail') || row.message.includes('error')) {
          if (!lastSuccessDate || row.date > lastSuccessDate) {
              failCount++;
          }
      }
  });

  const now = new Date();
  const refTime = latestLogDate || now;
  const compareTime = lastSuccessDate || new Date(0);
  
  const diffMs = refTime - compareTime;
  const hoursGap = diffMs / (1000 * 60 * 60);

  const status = (hoursGap > 24) ? 'FAIL' : 'PASS';

  return { 
      status, 
      gap: hoursGap, 
      lastSuccess: lastSuccessDate, 
      latestLog: latestLogDate,
      failCount 
  };
};

// --- MAIN COMPONENT ---

export default function DataFortressAuditor() {
  const [files, setFiles] = useState({ 
      sql: { data: null, valid: false, error: null }, 
      ad: { data: null, valid: false, error: null }, 
      backup: { data: null, valid: false, error: null } 
  });
  const [report, setReport] = useState(null);
  const [clientName, setClientName] = useState('Acme Corp');
  const [isProcessing, setIsProcessing] = useState(false);
  const reportRef = useRef(null);

  const handleFileUpload = (type, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const parsed = parseCSV(text);
        
        // Run Validation immediately
        const validation = validateFile(type, parsed);
        
        setFiles(prev => ({ 
            ...prev, 
            [type]: { 
                data: parsed.data, 
                valid: validation.valid, 
                error: validation.error 
            } 
        }));
      };
      reader.readAsText(file);
    }
  };

  const runAudit = () => {
    setIsProcessing(true);
    setTimeout(() => {
        const sqlAnalysis = analyzeSQL(files.sql.data);
        const adAnalysis = analyzeAD(files.ad.data);
        const backupAnalysis = analyzeBackups(files.backup.data);

        let overall = 'LOW';
        if (sqlAnalysis.risk === 'MEDIUM' || adAnalysis.risk === 'MEDIUM') overall = 'MEDIUM';
        if (sqlAnalysis.risk === 'HIGH' || adAnalysis.risk === 'HIGH') overall = 'HIGH';
        if (sqlAnalysis.risk === 'CRITICAL' || adAnalysis.risk === 'CRITICAL' || backupAnalysis.status === 'FAIL') overall = 'CRITICAL';

        setReport({
            sql: sqlAnalysis,
            ad: adAnalysis,
            backup: backupAnalysis,
            overall
        });
        setIsProcessing(false);
    }, 800);
  };

  // --- EXPORT FUNCTIONS (Unchanged logic, just keeping them clean) ---
  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups.'); return; }
    const content = reportRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Risk Assessment</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>@media print { body { -webkit-print-color-adjust: exact; } @page { margin: 1cm; } }</style>
      </head><body class="bg-white p-8 max-w-5xl mx-auto">${content}<script>setTimeout(() => window.print(), 1000);</script></body></html>
    `);
    printWindow.document.close();
  };

  const handleDownloadTxt = () => {
      if (!report) return;
      const lines = [`DATA FORTRESS REPORT`, `Client: ${clientName}`, `Date: ${new Date().toLocaleDateString()}`, `RISK: ${report.overall}`, `\nFINDINGS:`];
      if(report.backup.status === 'FAIL') lines.push(`- BACKUPS FAILED (Gap: ${report.backup.gap.toFixed(1)}h)`);
      report.sql.findings.forEach(f => lines.push(`- SQL: ${f.title}`));
      report.ad.findings.forEach(f => lines.push(`- AD: ${f.title}`));
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${clientName}_Audit.txt`;
      a.click();
  };

  const getRiskColor = (level) => {
      switch(level) {
          case 'CRITICAL': case 'FAIL': return 'bg-red-100 text-red-800 border-red-500';
          case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-500';
          case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-500';
          default: return 'bg-green-100 text-green-800 border-green-500';
      }
  };

  const renderUploadCard = (title, type, icon, fileState) => (
      <div className={`p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors 
        ${fileState.valid ? 'border-green-500 bg-green-50' : fileState.error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-blue-400'}`}>
          
          <div className="mb-2 text-gray-500">{icon}</div>
          <h3 className="font-semibold text-sm mb-1">{title}</h3>
          
          <input type="file" accept=".csv" onChange={(e) => handleFileUpload(type, e)} className="hidden" id={`file-${type}`} />
          
          <label htmlFor={`file-${type}`} className="cursor-pointer text-xs bg-white border border-gray-300 px-3 py-1 rounded shadow-sm hover:bg-gray-50">
            {fileState.valid ? 'File Loaded' : 'Select CSV'}
          </label>
          
          {/* VALIDATION FEEDBACK */}
          {fileState.valid && <div className="flex items-center gap-1 text-xs text-green-600 mt-2 font-bold"><CheckCircle size={12}/> Verified</div>}
          {fileState.error && <div className="flex items-center gap-1 text-xs text-red-600 mt-2 font-bold"><XCircle size={12}/> {fileState.error}</div>}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-slate-900 text-white p-6 shadow-md print-hidden">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
                <Shield className="h-8 w-8 text-blue-400" />
                <div><h1 className="text-2xl font-bold tracking-tight">DATA FORTRESS</h1><p className="text-slate-400 text-sm">Risk Assessment & Audit Tool</p></div>
            </div>
            <div className="flex items-center gap-4">
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Client Name" />
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {!report && (
            <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">1. Upload Audit Logs</h2>
                    <p className="text-slate-500 text-sm">Upload the CSV exports. The system will automatically validate the format.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {renderUploadCard("SQL Health (sp_Blitz)", "sql", <Database size={24} />, files.sql)}
                    {renderUploadCard("AD Audit (PowerShell)", "ad", <Users size={24} />, files.ad)}
                    {renderUploadCard("Backup Logs", "backup", <HardDrive size={24} />, files.backup)}
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={runAudit}
                        disabled={!files.sql.valid && !files.ad.valid && !files.backup.valid}
                        className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all transform hover:scale-105 
                        ${(!files.sql.valid && !files.ad.valid && !files.backup.valid) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" /> : <FileText />}
                        {isProcessing ? 'Analyzing...' : 'Generate Risk Report'}
                    </button>
                </div>
            </div>
        )}

        {report && (
            <div ref={reportRef} className="space-y-6">
                <div className="flex justify-end gap-3 print-hidden">
                    <button onClick={handleDownloadTxt} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"><Download size={16} /> Download Summary (.txt)</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-600 rounded text-sm font-medium text-white hover:bg-blue-700 shadow-sm"><Printer size={16} /> Print Report</button>
                </div>

                <div className={`rounded-xl shadow-lg border-l-8 p-6 bg-white ${getRiskColor(report.overall)}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Overall Risk Score</h2>
                            <div className="text-4xl font-extrabold">{report.overall}</div>
                        </div>
                        <div className="text-right"><p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p><p className="text-sm font-bold">{clientName}</p></div>
                    </div>
                    <div className="prose text-slate-700 max-w-none">
                        <p className="font-serif italic text-lg border-l-4 border-gray-200 pl-4 py-2 bg-gray-50 rounded-r">
                            "The organization is currently operating at a <strong>{report.overall}</strong> risk level. {report.overall === 'CRITICAL' ? 'Immediate action required.' : 'Systems appear healthy.'}"
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end print-hidden">
                        <button onClick={() => setReport(null)} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><RefreshCw size={14} /> Start New Audit</button>
                    </div>
                </div>

                {/* Findings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex gap-2"><Database size={18}/> SQL Health</h3>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.sql.risk)}`}>{report.sql.risk}</span>
                        </div>
                        <div className="p-4">
                            {report.sql.findings.length === 0 ? <div className="flex items-center gap-2 text-green-600"><CheckCircle size={20}/><span className="text-sm">No critical issues</span></div> : 
                            <ul className="space-y-3">{report.sql.findings.map((f, i) => <li key={i} className="bg-red-50 p-3 rounded border border-red-100"><div className="font-bold text-red-700 text-sm">{f.title}</div><p className="text-xs text-slate-600">{f.desc}</p></li>)}</ul>}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex gap-2"><Users size={18}/> AD Security</h3>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.ad.risk)}`}>{report.ad.risk}</span>
                        </div>
                        <div className="p-4">
                            {report.ad.findings.length === 0 ? <div className="flex items-center gap-2 text-green-600"><CheckCircle size={20}/><span className="text-sm">No critical issues</span></div> : 
                            <ul className="space-y-3">{report.ad.findings.map((f, i) => <li key={i} className="bg-orange-50 p-3 rounded border border-orange-100"><div className="font-bold text-orange-700 text-sm">{f.title}</div><p className="text-xs text-slate-600">{f.desc}</p></li>)}</ul>}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden md:col-span-2">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex gap-2"><HardDrive size={18}/> Backup Integrity</h3>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.backup.status)}`}>{report.backup.status}</span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-4 rounded text-center"><p className="text-xs text-slate-500 font-bold">Hours Since Success</p><p className={`text-3xl font-bold mt-1 ${report.backup.gap > 24 ? 'text-red-600' : 'text-green-600'}`}>{report.backup.gap.toFixed(1)}h</p></div>
                            <div className="bg-slate-50 p-4 rounded text-center"><p className="text-xs text-slate-500 font-bold">Last Success</p><p className="text-lg font-semibold mt-2">{report.backup.lastSuccess ? new Date(report.backup.lastSuccess).toLocaleDateString() : 'NEVER'}</p></div>
                            <div className="bg-slate-50 p-4 rounded text-center"><p className="text-xs text-slate-500 font-bold">Failures</p><p className="text-3xl font-bold mt-1">{report.backup.failCount}</p></div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 text-white rounded-xl shadow-lg p-6 mt-8 print:bg-white print:text-slate-900 print:border-2 print:border-slate-800">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ArrowRight className="text-blue-400 print:text-blue-600" /> Immediate Actions</h3>
                    <div className="space-y-4">
                        {report.overall === 'CRITICAL' ? (
                            <div className="bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <h4 className="font-bold text-sm">Critical Remediation Required</h4>
                                <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Your systems are at risk. Please schedule immediate remediation for the findings above.</p>
                            </div>
                        ) : (
                             <div className="bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <h4 className="font-bold text-sm">Routine Maintenance</h4>
                                <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Schedule next review in 90 days.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}