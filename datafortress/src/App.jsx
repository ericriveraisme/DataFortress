import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileText, Shield, Database, Users, HardDrive, ArrowRight, RefreshCw, Printer, Download } from 'lucide-react';

// --- HELPER FUNCTIONS ---

// Robust CSV Parser (handles quotes and commas inside quotes)
const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const obj = {};
    let currentLine = lines[i];
    
    // Regex to split by comma ONLY if not inside quotes
    const values = currentLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []; 
    // Fallback for simple split if regex fails or for simple CSVs
    const simpleValues = currentLine.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    // Use simple split if it matches header length, otherwise try to be smart
    const finalValues = (simpleValues.length === headers.length) ? simpleValues : values.map(v => v.replace(/^"|"$/g, ''));

    headers.forEach((header, index) => {
      obj[header] = finalValues[index] || '';
    });
    result.push(obj);
  }
  return result;
};

// --- ANALYSIS LOGIC ---

const analyzeSQL = (data) => {
  if (!data || data.length === 0) return { risk: 'UNKNOWN', findings: [] };

  const findings = [];
  let riskLevel = 'LOW';

  data.forEach(row => {
    // Parse Priority (handle strings/numbers)
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
        // Other priority items
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

  // FIX: Consolidated Keyword List
  const redFlagKeywords = ['temp', 'scanner', 'backup', 'service', 'test', 'msp', 'vendor', 'printer', 'copy'];
  
  data.forEach(row => {
    const group = (row.GroupName || '').toLowerCase();
    const name = (row.Name || '').toLowerCase();
    const sam = (row.SamAccountName || '').toLowerCase();
    const combinedSearch = `${name} ${sam}`;

    // Logic: Only care about Admin groups
    if (group.includes('admin')) {
        let isRedFlag = false;
        
        // FIX: Dynamic Iteration through keywords
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

  // Sort by date descending (assuming simple parse)
  // We need to try parsing the "TimeCreated" or "TimeGenerated" field
  const cleanData = data.map(row => {
      const timeStr = row.TimeCreated || row.TimeGenerated || row['TimeCreated'] || '';
      return {
          date: new Date(timeStr),
          message: (row.Message || '').toLowerCase(),
          original: row
      };
  }).sort((a, b) => b.date - a.date);

  if (cleanData.length > 0) latestLogDate = cleanData[0].date;

  // Find last success
  const successRow = cleanData.find(row => row.message.includes('successfully') || row.message.includes('succeeded'));
  
  if (successRow) {
      lastSuccessDate = successRow.date;
  }

  // Count recent failures (simple heuristic: if it's an Error and newer than last success)
  cleanData.forEach(row => {
      if (row.message.includes('fail') || row.message.includes('error')) {
          if (!lastSuccessDate || row.date > lastSuccessDate) {
              failCount++;
          }
      }
  });

  // Calculate Gap
  const now = new Date();
  const refTime = latestLogDate || now; // Use latest log if available to avoid "future" bugs, or now
  const compareTime = lastSuccessDate || new Date(0); // Epoch if never succeeded
  
  // Diff in hours
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
  const [files, setFiles] = useState({ sql: null, ad: null, backup: null });
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
        setFiles(prev => ({ ...prev, [type]: parsed }));
      };
      reader.readAsText(file);
    }
  };

  const runAudit = () => {
    setIsProcessing(true);
    // Simulate processing delay for effect
    setTimeout(() => {
        const sqlAnalysis = analyzeSQL(files.sql);
        const adAnalysis = analyzeAD(files.ad);
        const backupAnalysis = analyzeBackups(files.backup);

        // Overall Risk Calculation
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

  // --- EXPORT FUNCTIONS ---

  const handlePrint = () => {
    if (!reportRef.current) return;
    
    // Open new window for clean printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the report.');
      return;
    }

    const content = reportRef.current.innerHTML;
    const title = `Risk Assessment - ${clientName}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-hidden { display: none !important; }
              @page { margin: 1cm; }
            }
            body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          </style>
        </head>
        <body class="bg-white p-8 max-w-5xl mx-auto">
          ${content}
          <script>
            // Wait for Tailwind to process classes
            setTimeout(() => {
              window.print();
            }, 1000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadTxt = () => {
    if (!report) return;

    const lines = [];
    lines.push(`DATA FORTRESS RISK REPORT`);
    lines.push(`Client: ${clientName}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push(`==================================================`);
    lines.push(`\nEXECUTIVE SUMMARY`);
    lines.push(`Overall Risk Score: ${report.overall}`);
    lines.push(`\nAssessment:`);
    lines.push(`The organization is currently operating at a ${report.overall} risk level.`);
    if (report.overall === 'CRITICAL') {
        lines.push(`Critical systems lack recent backups or integrity checks. A server failure today would result in significant data loss.`);
    } else {
        lines.push(`Systems appear generally healthy.`);
    }
    
    lines.push(`\n==================================================`);
    lines.push(`DETAILED FINDINGS & BUSINESS IMPACT`);
    
    // SQL
    lines.push(`\n1. SQL Database Health: ${report.sql.risk}`);
    if (report.sql.findings.length === 0) lines.push(`   - No critical issues found.`);
    report.sql.findings.forEach(f => {
        lines.push(`   - [${f.type}] ${f.title}`);
        lines.push(`     Issue: ${f.desc}`);
        lines.push(`     Business Impact: ${f.impact}`);
        lines.push(``); // Spacer
    });

    // AD
    lines.push(`2. AD Security: ${report.ad.risk}`);
    if (report.ad.findings.length === 0) lines.push(`   - No red flag admins found.`);
    report.ad.findings.forEach(f => {
        lines.push(`   - [${f.type}] ${f.title}`);
        lines.push(`     Issue: ${f.desc}`);
        lines.push(`     Security Risk: ${f.impact}`);
        lines.push(``); // Spacer
    });

    // Backup
    lines.push(`3. Backup Integrity: ${report.backup.status}`);
    lines.push(`   - Gap Since Success: ${report.backup.gap.toFixed(1)} hours (Threshold: 24h)`);
    lines.push(`   - Last Successful Job: ${report.backup.lastSuccess ? new Date(report.backup.lastSuccess).toLocaleString() : 'Never'}`);

    lines.push(`\n==================================================`);
    lines.push(`IMMEDIATE REMEDIATION PLAN (TOP 3)`);
    
    let actionCount = 1;
    if (report.backup.status === 'FAIL') {
        lines.push(`${actionCount}. EMERGENCY BACKUP RUN`);
        lines.push(`   Why: Backups are stale (> ${report.backup.gap.toFixed(0)} hours). You are exposed to total data loss.`);
        lines.push(`   Action: Manually trigger a full backup of critical databases immediately.`);
        actionCount++;
    }
    if (report.ad.findings.length > 0) {
        lines.push(`${actionCount}. LOCK DOWN ADMIN ACCOUNTS`);
        lines.push(`   Why: Service accounts in 'Domain Admins' provide hackers an easy backdoor.`);
        lines.push(`   Action: Disable or demote flagged accounts (${report.ad.findings.map(f => f.title.split(':')[1]).join(', ')}).`);
        actionCount++;
    }
    if (report.sql.findings.length > 0) {
        lines.push(`${actionCount}. DATABASE INTEGRITY CHECKS`);
        lines.push(`   Why: Corrupt databases cannot be restored, even if backed up.`);
        lines.push(`   Action: Run DBCC CHECKDB on flagged databases.`);
        actionCount++;
    }
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clientName.replace(/\s+/g, '_')}_Risk_Assessment.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (level) => {
      switch(level) {
          case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-500';
          case 'FAIL': return 'bg-red-100 text-red-800 border-red-500';
          case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-500';
          case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-500';
          case 'LOW': return 'bg-green-100 text-green-800 border-green-500';
          case 'PASS': return 'bg-green-100 text-green-800 border-green-500';
          default: return 'bg-gray-100 text-gray-800 border-gray-300';
      }
  };

  const renderUploadCard = (title, type, icon, loaded) => (
      <div className={`p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors ${loaded ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}>
          <div className="mb-2 text-gray-500">{icon}</div>
          <h3 className="font-semibold text-sm mb-1">{title}</h3>
          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => handleFileUpload(type, e)}
            className="hidden" 
            id={`file-${type}`}
          />
          <label htmlFor={`file-${type}`} className="cursor-pointer text-xs bg-white border border-gray-300 px-3 py-1 rounded shadow-sm hover:bg-gray-50">
            {loaded ? 'File Loaded (Click to Replace)' : 'Select CSV'}
          </label>
          {loaded && <span className="text-xs text-green-600 mt-1 font-medium">Ready</span>}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <style>
        {`
          @media print {
            .print-hidden { display: none !important; }
            body { background-color: white !important; }
            .print-break-inside-avoid { page-break-inside: avoid; }
            /* Force background colors to print */
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}
      </style>

      {/* HEADER */}
      <header className="bg-slate-900 text-white p-6 shadow-md print-hidden">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
                <Shield className="h-8 w-8 text-blue-400" />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">DATA FORTRESS</h1>
                    <p className="text-slate-400 text-sm">Risk Assessment & Audit Tool</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Client Name"
                />
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        
        {/* SETUP SECTION - Hide if report generated */}
        {!report && (
            <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">1. Upload Audit Logs</h2>
                    <p className="text-slate-500 text-sm">Upload the CSV exports from the data collection scripts.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {renderUploadCard("SQL Health (sp_Blitz)", "sql", <Database size={24} />, !!files.sql)}
                    {renderUploadCard("AD Audit (PowerShell)", "ad", <Users size={24} />, !!files.ad)}
                    {renderUploadCard("Backup Logs", "backup", <HardDrive size={24} />, !!files.backup)}
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={runAudit}
                        disabled={!files.sql && !files.ad && !files.backup}
                        className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all transform hover:scale-105 ${(!files.sql && !files.ad && !files.backup) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" /> : <FileText />}
                        {isProcessing ? 'Analyzing...' : 'Generate Risk Report'}
                    </button>
                </div>
                
                <div className="mt-8 bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-200">
                    <p className="font-semibold mb-1">Testing Mode?</p>
                    <p>If you don't have files, the app will simulate a "Missing Data" response. To see the full report, upload the test CSVs generated previously.</p>
                </div>
            </div>
        )}

        {/* REPORT SECTION */}
        {report && (
            <div ref={reportRef} className="space-y-6">
                
                {/* Export / Controls Toolbar */}
                <div className="flex justify-end gap-3 print-hidden">
                    <button 
                        onClick={handleDownloadTxt}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                        <Download size={16} />
                        Download Summary (.txt)
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-600 rounded text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
                    >
                        <Printer size={16} />
                        Print / Save as PDF
                    </button>
                </div>

                {/* Executive Summary Card */}
                <div className={`rounded-xl shadow-lg border-l-8 p-6 bg-white ${report.overall === 'CRITICAL' ? 'border-red-600' : report.overall === 'HIGH' ? 'border-orange-500' : 'border-green-500'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Overall Risk Score</h2>
                            <div className={`text-4xl font-extrabold ${report.overall === 'CRITICAL' ? 'text-red-600' : 'text-green-600'}`}>
                                {report.overall}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                            <p className="text-sm font-bold">{clientName}</p>
                        </div>
                    </div>
                    
                    <div className="prose text-slate-700 max-w-none">
                        <p className="font-serif italic text-lg border-l-4 border-gray-200 pl-4 py-2 bg-gray-50 rounded-r">
                            "The organization is currently operating at a <strong className={report.overall === 'CRITICAL' ? 'text-red-600' : ''}>{report.overall}</strong> risk level. 
                            {report.overall === 'CRITICAL' 
                                ? ' Critical systems lack recent backups or integrity checks, and administrative security violations were detected. A server failure today would result in significant data loss.' 
                                : ' Systems appear generally healthy, though some warnings require attention to prevent future degradation.'}
                        "
                        </p>
                    </div>

                    <div className="mt-6 flex justify-end print-hidden">
                        <button onClick={() => setReport(null)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <RefreshCw size={14} /> Start New Audit
                        </button>
                    </div>
                </div>

                {/* Detailed Findings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-break-inside-avoid">
                    
                    {/* SQL Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Database size={18} className="text-slate-600"/>
                                <h3 className="font-bold text-slate-700">SQL Database Health</h3>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.sql.risk)}`}>
                                {report.sql.risk}
                            </span>
                        </div>
                        <div className="p-4">
                            {report.sql.findings.length === 0 ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle size={20} />
                                    <span className="text-sm font-medium">No critical issues found (Priority 1-50)</span>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {report.sql.findings.map((finding, idx) => (
                                        <li key={idx} className="bg-red-50 p-3 rounded border border-red-100">
                                            <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                                                <AlertTriangle size={16} />
                                                {finding.title}
                                            </div>
                                            <p className="text-xs text-slate-600 mb-1">{finding.desc}</p>
                                            <p className="text-xs font-semibold text-slate-800">Impact: {finding.impact}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Active Directory Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Users size={18} className="text-slate-600"/>
                                <h3 className="font-bold text-slate-700">AD Security</h3>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.ad.risk)}`}>
                                {report.ad.risk}
                            </span>
                        </div>
                        <div className="p-4">
                            {report.ad.findings.length === 0 ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle size={20} />
                                    <span className="text-sm font-medium">No 'Red Flag' admins detected</span>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {report.ad.findings.map((finding, idx) => (
                                        <li key={idx} className="bg-orange-50 p-3 rounded border border-orange-100">
                                            <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-1">
                                                <AlertTriangle size={16} />
                                                {finding.title}
                                            </div>
                                            <p className="text-xs text-slate-600 mb-1">{finding.desc}</p>
                                            <p className="text-xs font-semibold text-slate-800">Risk: {finding.impact}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Backup Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden md:col-span-2 print-break-inside-avoid">
                         <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <HardDrive size={18} className="text-slate-600"/>
                                <h3 className="font-bold text-slate-700">Backup Integrity</h3>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded font-bold border ${getRiskColor(report.backup.status)}`}>
                                GRADE: {report.backup.status}
                            </span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-4 rounded text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Hours Since Success</p>
                                <p className={`text-3xl font-bold mt-1 ${report.backup.gap > 24 ? 'text-red-600' : 'text-green-600'}`}>
                                    {report.backup.gap.toFixed(1)} hrs
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Threshold: 24 hrs</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Last Successful Job</p>
                                <p className="text-lg font-semibold text-slate-800 mt-2">
                                    {report.backup.lastSuccess ? new Date(report.backup.lastSuccess).toLocaleString() : 'NEVER / UNKNOWN'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Recent Failures</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{report.backup.failCount}</p>
                                <p className="text-xs text-slate-400 mt-1">Error events since success</p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Immediate Actions Plan */}
                <div className="bg-slate-800 text-white rounded-xl shadow-lg p-6 mt-8 print-break-inside-avoid print:bg-white print:text-slate-900 print:border-2 print:border-slate-800">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <ArrowRight className="text-blue-400 print:text-blue-600" /> Top 3 Immediate Actions
                    </h3>
                    <div className="space-y-4">
                        {report.backup.status === 'FAIL' && (
                            <div className="flex gap-4 items-start bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <div className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
                                <div>
                                    <h4 className="font-bold text-sm">Emergency Backup Run</h4>
                                    <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Backups are stale ({'>'} {report.backup.gap.toFixed(0)} hours). Manually trigger a full backup of critical databases and file shares immediately.</p>
                                </div>
                            </div>
                        )}
                        {report.ad.findings.length > 0 && (
                            <div className="flex gap-4 items-start bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <div className="bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
                                <div>
                                    <h4 className="font-bold text-sm">Lock Down Admin Accounts</h4>
                                    <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Disable or demote the flagged accounts ({report.ad.findings.map(f => f.title.split(':')[1]).join(', ')}). Service accounts should not have Domain Admin rights.</p>
                                </div>
                            </div>
                        )}
                        {report.sql.findings.length > 0 && (
                            <div className="flex gap-4 items-start bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <div className="bg-yellow-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</div>
                                <div>
                                    <h4 className="font-bold text-sm">Run DBCC CHECKDB & Log Audits</h4>
                                    <p className="text-slate-300 text-sm mt-1 print:text-slate-600">Verify database integrity on Inventory/HR databases to ensure corruption has not occurred silently.</p>
                                </div>
                            </div>
                        )}
                         {/* Fallback Action if few errors found */}
                         {report.overall !== 'CRITICAL' && (
                             <div className="flex gap-4 items-start bg-slate-700 p-4 rounded-lg print:bg-slate-100 print:border print:border-slate-200">
                                <div className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">!</div>
                                <div>
                                    <h4 className="font-bold text-sm">Schedule Quarterly Review</h4>
                                    <p className="text-slate-300 text-sm mt-1 print:text-slate-600">While risks are low, schedule a follow-up in 90 days to ensure configurations remain secure.</p>
                                </div>
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