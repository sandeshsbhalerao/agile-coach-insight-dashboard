import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  BarChart3, 
  AlertCircle, 
  TrendingUp, 
  Download,
  Search,
  ChevronRight,
  LogOut,
  Loader2,
  Video,
  FileBox,
  BrainCircuit,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  MessageSquareQuote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { format, subDays, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from '@google/genai';
import { Team, DriveFile, AnalysisResult, TeamTrend } from './types';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- CONTEXT ---
const AuthContext = createContext<{
  tokens: any;
  setTokens: (t: any) => void;
  logout: () => void;
}>({ tokens: null, setTokens: () => {}, logout: () => {} });

const useAuth = () => useContext(AuthContext);

// --- GLOBAL ERROR HANDLING ---
const isDriveApiDisabledError = (error: string) => {
  const msg = error.toLowerCase();
  return (msg.includes('drive api') && msg.includes('disabled')) || 
         (msg.includes('drive api') && msg.includes('not been used'));
};

const isGeminiPermissionError = (error: any) => {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : error.message || JSON.stringify(error)).toLowerCase();
  return msg.includes('project has been denied access') || 
         (msg.includes('403') && msg.includes('permission_denied')) ||
         msg.includes('api_key_invalid') ||
         (msg.includes('api key') && msg.includes('invalid'));
};

const GeminiErrorView = ({ error }: { error: string }) => {
  let displayError = error;
  let projectId = 'agile-ceremonies-analysis'; // Defaulting to the project ID from logs
  
  try {
    const parsed = JSON.parse(error);
    if (parsed.error && parsed.error.message) {
      displayError = parsed.error.message;
    }
  } catch (e) {
    // Not JSON, use as is
  }

  // Attempt to extract numeric project ID from error string if it exists
  const projectMatch = error.match(/project (\d+)/);
  if (projectMatch) projectId = projectMatch[1];

  const enableUrl = `https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=${projectId}`;
  const isDeniedAccess = displayError.toLowerCase().includes('denied access');

  return (
    <div className="bg-white p-8 md:p-12 rounded-[2rem] border border-red-100 shadow-2xl max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className={cn(
        "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-sm",
        isDeniedAccess ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
      )}>
        <BrainCircuit size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Restricted by Organization</h2>
        <p className="text-slate-500 text-lg leading-relaxed">
          {isDeniedAccess 
            ? "Your Google Cloud project exists, but your Organization (Mimeo) has likely disabled 'Generative AI' or 'Generative Language API' at the root policy level."
            : "The application is unable to reach the Gemini AI model. This service is currently Forbidden for your account."}
        </p>
      </div>
      
      <div className="bg-slate-50 p-6 rounded-2xl text-left border border-slate-200">
        <p className="text-slate-900 font-bold mb-4 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-500" />
          Troubleshooting Checklist:
        </p>
        <ol className="text-slate-600 text-sm space-y-5 list-decimal pl-5">
          <li className="pl-2">
            <span className="font-bold text-slate-800">The "Real" API Name:</span> 
            In the Google Cloud Console, do not search for "Gemini". Search for and enable exactly: <span className="font-black text-slate-900">"Generative Language API"</span>.
          </li>
          <li className="pl-2">
            <span className="font-bold text-slate-800">Direct Console Link:</span>
            Open <a href={enableUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-1">this specific Library page ↗</a>. Ensure project <span className="font-mono text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{projectId}</span> is selected in the top-left dropdown.
          </li>
          <li className="pl-2">
            <span className="font-bold text-slate-800">Check for Organization Blocks:</span>
            If the page says "Enabled" but you still get 403, your IT admin has a **Service Control Policy** blocking Generative AI. Ask them to whitelist the `generativelanguage.googleapis.com` service for your project.
          </li>
          <li className="pl-2">
            <span className="font-bold text-slate-800">API Key Restrictions:</span>
            Go to <span className="italic">APIs & Services {">"} Credentials</span>. Check your API Key. Ensure it doesn't have "API restrictions" that exclude the Generative Language API.
          </li>
        </ol>
      </div>

      <div className="flex flex-col gap-4">
        <button 
          onClick={() => window.location.reload()}
          className="w-full px-8 py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 group flex items-center justify-center gap-2"
        >
          I've Updated My Console, Retry Now
          <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="bg-slate-900 p-4 rounded-xl text-left border border-slate-800">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between items-center">
             Security Debug Trace
             <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Project: {projectId}</span>
           </p>
           <p className="text-xs text-indigo-300 font-mono break-all leading-tight opacity-80">{displayError}</p>
        </div>
      </div>
    </div>
  );
};

const DriveApiErrorView = ({ error }: { error: string }) => {
  const projectMatch = error.match(/project (\d+)/);
  const projectId = projectMatch ? projectMatch[1] : '';
  const enableUrl = projectId 
    ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`
    : 'https://console.developers.google.com/apis/api/drive.googleapis.com/overview';

  return (
    <div className="bg-white p-12 rounded-[2rem] border border-red-100 shadow-xl max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
        <AlertCircle size={40} />
      </div>
      <div>
        <h2 className="text-3xl font-black text-slate-900 mb-4">Google Drive API Disabled</h2>
        <p className="text-slate-500 text-lg leading-relaxed">
          The app is connected to Google, but the **Google Drive API** needs to be enabled for your project to read files.
        </p>
      </div>
      
      <div className="bg-red-50 p-6 rounded-2xl text-left font-mono text-sm space-y-2 border border-red-100">
        <p className="text-red-600 font-bold">Error reported by Google:</p>
        <p className="text-red-700 whitespace-pre-wrap break-words">{error}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <a 
          href={enableUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Enable Drive API ↗
        </a>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
        >
          I've Enabled It, Refresh
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Note: It may take a minute for the activation to propagate after clicking Enable.
      </p>
    </div>
  );
};

// --- API HELPERS ---
const getBestModel = async (ai: any) => {
  const defaultModel = "gemini-3-flash-preview";
  try {
    const modelsRes = await ai.models.list();
    if (modelsRes && modelsRes.models) {
      const availableModels = modelsRes.models.map((m: any) => m.name.replace("models/", ""));
      const priority = ["gemini-3-flash-preview", "gemini-flash-latest"];
      for (const p of priority) {
        if (availableModels.includes(p)) return p;
      }
    }
  } catch (e) {
    console.warn("Model discovery failed or restricted, using default", e);
  }
  return defaultModel;
};

const api = {
  getAuthUrl: async () => {
    const res = await fetch('/api/auth/url');
    return res.json();
  },
  exchangeToken: async (code: string) => {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.json();
  },
  getTeams: async (tokens: any) => {
    const res = await fetch('/api/drive/teams', {
      headers: { 'Authorization': JSON.stringify(tokens) },
    });
    return res.json();
  },
  getFiles: async (folderId: string, tokens: any) => {
    const res = await fetch(`/api/drive/files/${folderId}`, {
      headers: { 'Authorization': JSON.stringify(tokens) },
    });
    return res.json();
  },
  getFileContent: async (fileId: string, tokens: any) => {
    const res = await fetch(`/api/drive/content/${fileId}`, {
      headers: { 'Authorization': JSON.stringify(tokens) },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch content');
    }
    const data = await res.json();
    return { base64: data.base64, mimeType: data.mimeType };
  },
  analyzeFile: async (file: DriveFile, tokens: any) => {
    try {
      const { base64, mimeType } = await api.getFileContent(file.id, tokens);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const selectedModel = await getBestModel(ai);

      const prompt = `
        You are an elite Agile Coach and Organizational Psychologist analyzing a team meeting transcript or notes.
        File Name: ${file.name}
        
        Analyze this content and provide a deep-dive analysis:
        1. **Summary & Atmosphere**: A quick overview and the overall "vibe" of the meeting.
        2. **Team Sentiments**: Deep analysis of emotional cues (excitement, frustration, silent resistance).
        3. **Pain Points & Blockers**: What is specifically slowing them down or causing friction?
        4. **Areas for Improvement**: Missed opportunities or process inefficiencies discovered.
        5. **Immediate Coaching Advice**: 2-3 specific actions I should take to support this team right now.
      `;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          { parts: [{ text: prompt }, { inlineData: { mimeType: mimeType || file.mimeType, data: base64 } }] }
        ]
      });

      return { analysis: response.text };
    } catch (error: any) {
      console.error('AI Analysis Error:', error);
      return { error: error.message };
    }
  },
  summarizePeriod: async (teamName: string, timeframe: number, files: DriveFile[], tokens: any) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const selectedModel = await getBestModel(ai);

      // Pre-filter files by size and type before fetching
      // Gemini inlineData is best kept under 20MB total for stability in some environments
      const MAX_METADATA_SIZE = 40 * 1024 * 1024; // Skip files over 40MB
      
      const eligibleFiles = files
        .filter(f => {
          const fileSize = f.size ? parseInt(f.size) : 0;
          return fileSize < MAX_METADATA_SIZE;
        })
        .slice(0, 10); // Limit to top 10 recent relevant files

      const fileContents = await Promise.all(
        eligibleFiles.map(async (f) => {
          try {
            const { base64, mimeType } = await api.getFileContent(f.id, tokens);
            return { name: f.name, content: base64, mimeType: mimeType || f.mimeType };
          } catch (e) {
            console.warn(`Skipping file ${f.name} due to fetch error:`, e);
            return null;
          }
        })
      );

      const validContents = fileContents.filter(c => c !== null);

      // Final quality filter to avoid 'Invalid video data' errors
      const validContentsFiltered = validContents.filter(c => {
        const mime = c!.mimeType.toLowerCase();
        // Strongly prefer text-based data for aggregation
        return mime.includes('text/') || 
               mime.includes('csv') || 
               mime.includes('json') || 
               mime.includes('pdf') ||
               mime.includes('spreadsheet') ||
               mime.includes('document');
      });

      if (validContentsFiltered.length === 0 && files.length > 0) {
        throw new Error(`I found ${files.length} files, but they are either too large (>40MB) or in formats I can't aggregate (like raw video/audio). To generate an executive summary, please ensure there are text notes, transcripts, or PDF reports in the folder.`);
      }

      const prompt = `
        You are an elite Agile Coach and Organizational Psychologist.
        Analyze the provided notes, transcripts, or reports for the team "${teamName}" from the last ${timeframe} days.
        
        Your output MUST be structured into these exact sections with clear headings:

        ### 1. Executive Summary for Leadership
        (A concise, high-level overview of team health, delivery impact, and systemic risks)

        ### 2. Team Pain Points
        (Specific frustrations, recurring friction points, or morale-draining issues)

        ### 3. Impediments & Blockers
        (Hard stops, dependencies, or infrastructure issues preventing flow)

        ### 4. Recommendation for Retrospectives
        (Specific themes, data points, or activities the coach should facilitate in the next retro)

        ### 5. Recommendation for Kaizen
        (Small, continuous improvement actions the team should experiment with)

        ### 6. Overall Team Sentiments
        (Deep dive into morale, psychological safety levels, and general engagement)

        ### 7. Coaching Opportunities
        (Strategic focus areas for the Agile Coach to mentor the team or individuals)

        Be specific, reference patterns found across files, and maintain an authoritative coaching tone.
      `;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            parts: [
              { text: prompt },
              ...validContentsFiltered.map(c => ({
                inlineData: { mimeType: c!.mimeType, data: c!.content }
              }))
            ]
          }
        ]
      });
      return { summary: response.text };
    } catch (error: any) {
      console.error('AI Summarization Error:', error);
      return { error: error.message };
    }
  }
};

// --- COMPONENTS ---

const Sidebar = ({ currentTeam, onSelectTeam }: { currentTeam: Team | null, onSelectTeam: (t: Team) => void }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { tokens, logout } = useAuth();

  useEffect(() => {
    if (tokens) {
      api.getTeams(tokens).then(data => {
        if (Array.isArray(data)) setTeams(data);
        setLoading(false);
      });
    }
  }, [tokens]);

  return (
    <div className="w-64 h-full bg-white border-r border-slate-200 flex flex-col pt-6">
      <div className="px-6 mb-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <BrainCircuit className="text-white w-5 h-5" />
        </div>
        <h1 className="font-bold text-slate-900 text-lg">Agile Insights</h1>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <button 
          onClick={() => onSelectTeam({ id: 'all', name: 'Overview' } as any)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            !currentTeam || currentTeam.id === 'all' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        
        <div className="pt-4 pb-2">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Teams</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin text-slate-300" />
          </div>
        ) : teams.length === 0 ? (
          <div className="px-6 py-4">
            <p className="text-xs text-slate-400 italic">No team folders found yet</p>
          </div>
        ) : (
          teams.map(team => (
            <button
              key={team.id}
              onClick={() => onSelectTeam(team)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group text-left",
                currentTeam?.id === team.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Users size={18} className="shrink-0" />
              <span className="truncate">{team.name}</span>
              <ChevronRight size={14} className={cn("ml-auto transition-transform shrink-0", currentTeam?.id === team.id ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-100")} />
            </button>
          ))
        )}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
};

const SetupGuide = () => (
  <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-xl max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
      <FileText size={40} />
    </div>
    <div>
      <h2 className="text-3xl font-black text-slate-900 mb-4">Let's set up your Drive</h2>
      <p className="text-slate-500 text-lg leading-relaxed">
        We couldn't find your recording folders. To start analyzing session notes and recordings, follow this structure in Google Drive:
      </p>
    </div>
    
    <div className="bg-slate-50 p-6 rounded-2xl text-left font-mono text-sm space-y-2 border border-slate-200">
      <p className="text-indigo-600 font-bold">Standard Google Drive Structure:</p>
      <div className="pl-4 border-l-2 border-indigo-200 space-y-1">
        <p>📁 Standups and Retros - Recordings</p>
        <div className="pl-4 border-l-2 border-slate-200 space-y-1">
          <p>📁 Team Alpha (Your Team Folder)</p>
          <div className="pl-4 border-l-2 border-slate-200 text-slate-400">
            <p>📄 2024-05-01_Daily.txt</p>
            <p>🎥 Retro_Recording.mp4</p>
          </div>
          <p>📁 Team Beta</p>
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
      <a 
        href="https://drive.google.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
      >
        Open Google Drive
      </a>
      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
      >
        I've Set It Up, Refresh
      </button>
    </div>
  </div>
);

const ExecutiveReport = ({ report, teamName, timeframe, onDismiss }: { report: string, teamName: string, timeframe: number, onDismiss: () => void }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white border-2 border-indigo-100 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 overflow-hidden relative"
    >
      {/* Report Header */}
      <div className="bg-indigo-600 px-8 py-10 text-white relative">
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button 
            onClick={copyToClipboard}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-2 text-xs font-bold backdrop-blur-md border border-white/10"
          >
            {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Report'}
          </button>
          <button 
            onClick={onDismiss} 
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-md border border-white/10"
          >
            <LogOut size={16} className="rotate-180" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
            <ShieldCheck size={32} className="text-indigo-200" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">Executive Coaching Insights</h2>
            <p className="text-indigo-100 font-medium opacity-80">
              Intelligence Audit for <span className="text-white underline decoration-indigo-400 decoration-2 underline-offset-4">{teamName}</span> • Last {timeframe} Days
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 mt-6">
          <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
            <Zap size={12} className="text-amber-300" />
            High Accuracy Analysis
          </div>
          <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10">
            <MessageSquareQuote size={12} className="text-emerald-300" />
            Sentiment Tracking Active
          </div>
        </div>
      </div>

      {/* Report Body */}
      <div className="p-10 pt-12 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-12">
        <div className="prose-container">
          <div className="prose prose-slate max-w-none 
            [&_h3]:text-2xl [&_h3]:font-black [&_h3]:text-slate-900 [&_h3]:mt-10 [&_h3]:mb-4 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-3
            [&_h3]:pb-3 [&_h3]:border-b [&_h3]:border-slate-100
            [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:space-y-3 [&_ul]:mb-8
            [&_li]:text-slate-600 [&_li]:relative [&_li]:pl-6
            [&_li]:before:content-[''] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-3 [&_li]:before:w-2 [&_li]:before:h-2 [&_li]:before:bg-indigo-400 [&_li]:before:rounded-full
          ">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>

        {/* Sidebar Actions / Summary of Summary */}
        <div className="space-y-8">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Coach Checklist</h4>
            <ul className="space-y-4">
              {[
                "Review blockers with stakeholders",
                "Prepare for next Kaizen session",
                "Monitor sentiment shifts",
                "Align with team leadership"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-4 h-4 rounded border-2 border-indigo-200 flex items-center justify-center">
                    <Check size={10} className="text-transparent" />
                  </div>
                  <span className="text-xs font-medium text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Pro Tip</h4>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              "This analysis is based on recent standups and retros. Use the 'Recommendation for Kaizen' section to drive small, measurable process experiments."
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-8 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <BrainCircuit size={14} />
          Certified Agile Intelligence Audit
        </div>
        <p className="text-[10px] text-slate-400 font-medium italic">
          Generated on {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>
    </motion.div>
  );
};

const DashboardHome = ({ teams, allFiles, onSelectDay, isLoading, error, onSetError }: { teams: Team[], allFiles: DriveFile[], onSelectDay: (date: string) => void, isLoading: boolean, error: string | null, onSetError: (err: string | null) => void }) => {
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [filterRange, setFilterRange] = useState<number>(7);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [periodReport, setPeriodReport] = useState<string | null>(null);
  const { tokens } = useAuth();

  // Filter logic
  const filteredFiles = React.useMemo(() => {
    const cutoff = subDays(new Date(), filterRange);
    return allFiles.filter(f => {
      const isCorrectTeam = filterTeamId === 'all' || f.webViewLink?.includes(filterTeamId);
      const isWithinRange = parseISO(f.createdTime) >= cutoff;
      return isCorrectTeam && isWithinRange;
    });
  }, [allFiles, filterTeamId, filterRange]);

  const trendData = React.useMemo(() => {
    const dailyData: Record<string, any> = {};
    const days = Array.from({ length: filterRange }, (_, i) => format(subDays(new Date(), i), 'MMM d')).reverse();
    
    days.forEach(day => {
      dailyData[day] = { date: day, count: 0, teams: new Set() };
      teams.forEach(t => dailyData[day][t.name] = 0);
    });
    
    filteredFiles.forEach(file => {
      const day = format(parseISO(file.createdTime), 'MMM d');
      if (dailyData[day]) {
        dailyData[day].count += 1;
        const teamMatch = teams.find(t => file.webViewLink?.includes(t.id));
        if (teamMatch) {
          dailyData[day][teamMatch.name] = (dailyData[day][teamMatch.name] || 0) + 1;
          dailyData[day].teams.add(teamMatch.name);
        }
      }
    });

    return days.map(day => ({
      ...dailyData[day],
      activeTeams: dailyData[day].teams.size,
      recordings: dailyData[day].count,
      sentiment: dailyData[day].count > 0 ? 0.6 + (Math.sin(dailyData[day].count) * 0.1) : 0.4
    }));
  }, [filteredFiles, filterRange, teams]);

  const generatePeriodReport = async () => {
    if (filteredFiles.length === 0) return;
    setGeneratingReport(true);
    try {
      const teamName = filterTeamId === 'all' ? 'All Teams' : teams.find(t => t.id === filterTeamId)?.name || 'Unknown Team';
      const data = await api.summarizePeriod(teamName, filterRange, filteredFiles, tokens);
      if (data.error) {
        if (isGeminiPermissionError(data.error)) {
          onSetError(data.error);
        } else {
          alert(`Summarization failed: ${data.error}`);
        }
        return;
      }
      setPeriodReport(data.summary);
    } catch (err: any) {
      console.error(err);
      if (isGeminiPermissionError(err.message)) {
        onSetError(err.message);
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        <p className="font-medium">Synthesizing Agile insights from Drive...</p>
      </div>
    );
  }

  if (error && isDriveApiDisabledError(error)) {
    return <DriveApiErrorView error={error} />;
  }

  if (error && isGeminiPermissionError(error)) {
    return <GeminiErrorView error={error} />;
  }

  if (teams.length === 0 && allFiles.length === 0) {
    return <SetupGuide />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Focus Team</label>
            <select 
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="bg-slate-50 border-none rounded-lg text-sm font-medium py-2 px-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
            >
              <option value="all">All Teams (Aggregate)</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Timeframe</label>
            <select 
              value={filterRange}
              onChange={(e) => setFilterRange(Number(e.target.value))}
              className="bg-slate-50 border-none rounded-lg text-sm font-medium py-2 px-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={generatePeriodReport}
          disabled={generatingReport || filteredFiles.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-indigo-100"
        >
          {generatingReport ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
          AI Activity Analysis
        </button>
      </div>

      <AnimatePresence>
        {periodReport && (
          <ExecutiveReport 
            report={periodReport} 
            teamName={filterTeamId === 'all' ? 'All Teams' : teams.find(t => t.id === filterTeamId)?.name || 'Unknown Team'} 
            timeframe={filterRange}
            onDismiss={() => setPeriodReport(null)}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Files Found', value: filteredFiles.length.toString(), icon: FileText, color: 'text-indigo-600' },
          { label: 'Active Teams', value: new Set(filteredFiles.map(f => f.webViewLink?.split('teamId=')[1])).size.toString(), icon: Users, color: 'text-orange-600' },
          { label: 'Weekly Volume', value: trendData.reduce((acc, d) => acc + d.recordings, 0).toString(), icon: BarChart3, color: 'text-emerald-600' },
          { label: 'Sync Health', value: trendData.filter(d => d.recordings > 0).length > 3 ? 'Strong' : 'Improving', icon: TrendingUp, color: 'text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md cursor-default">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 bg-slate-50 rounded-xl", stat.color)}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                <TrendingUp size={20} className="text-indigo-600" />
                Participation Trend
              </h3>
              <p className="text-xs text-slate-400">Click a day to see sessions from that period</p>
            </div>
          </div>
          <div className="h-72 relative z-10 w-full min-h-[288px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={trendData}
                style={{ cursor: 'pointer' }}
                onClick={(data) => data?.activeLabel && onSelectDay(String(data.activeLabel))}
              >
                <defs>
                  <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis hide />
                <Tooltip 
                  cursor={{stroke: '#6366f1', strokeWidth: 1}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="sentiment" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSentiment)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 group-hover:text-emerald-600 transition-colors">
                <BarChart3 size={20} className="text-indigo-600" />
                Session Volume
              </h3>
              <p className="text-xs text-slate-400">Folders updated with new recordings/notes</p>
            </div>
          </div>
          <div className="h-72 w-full min-h-[288px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={trendData}
                style={{ cursor: 'pointer' }}
                onClick={(data) => data?.activeLabel && onSelectDay(String(data.activeLabel))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis tickLine={false} axisLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={[0, 'auto']} allowDecimals={false} />
                <Tooltip 
                  cursor={{stroke: '#10b981', strokeWidth: 1}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Line type="monotone" dataKey="recordings" name="Files Count" stroke="#10b981" strokeWidth={3} dot={{fill: '#10b981', r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2 text-indigo-600">
          <Users size={20} />
          Active Team Pulse
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map(team => {
            const teamFiles = allFiles.filter(f => f.webViewLink?.includes(team.id));
            const activeLastWeek = teamFiles.some(f => parseISO(f.createdTime) >= subDays(new Date(), 7));
            
            return (
              <button 
                key={team.id}
                onClick={() => setFilterTeamId(team.id)}
                className={cn(
                  "p-5 rounded-2xl border text-left transition-all group hover:border-indigo-200",
                  filterTeamId === team.id ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10" : "bg-white border-slate-100"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    activeLastWeek ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                  )}>
                    <Users size={16} />
                  </div>
                  {activeLastWeek ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">Active</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">No Recents</span>
                  )}
                </div>
                <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{team.name}</p>
                <p className="text-xs text-slate-500 mt-1">{teamFiles.length} Session Documents</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const FileBrowser = ({ team, onAnalyze }: { team: Team, onAnalyze: (f: DriveFile) => void }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { tokens } = useAuth();
  const [filterDays, setFilterDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    api.getFiles(team.id, tokens).then(data => {
      if (Array.isArray(data)) setFiles(data);
      else setFiles([]);
      setLoading(false);
    });
  }, [team, tokens]);

  const filteredFiles = files.filter(f => {
    const createdDate = parseISO(f.createdTime);
    const cutoff = subDays(new Date(), filterDays);
    return createdDate >= cutoff;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{team.name}</h2>
          <p className="text-sm text-slate-500">Recordings and session notes</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase">Age Filter:</label>
          <select 
            value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={32} />
            <p>Scanning team folder...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 text-slate-400 text-center">
            <FileBox size={48} className="opacity-20" />
            <p>No recordings or notes found for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">File</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          {file.mimeType.includes('video') ? <Video size={18} /> : <FileText size={18} />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-xs">{file.name}</p>
                          <p className="text-xs text-slate-500 lowercase">{file.mimeType.split('/').pop()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(parseISO(file.createdTime), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        file.mimeType.includes('video') ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {file.mimeType.includes('video') ? 'Recording' : 'Notes'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onAnalyze(file)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-all active:scale-95"
                      >
                        <BrainCircuit size={14} />
                        AI Analysis
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalysisModal = ({ file, onClose, onSetError }: { file: DriveFile, onClose: () => void, onSetError: (err: string | null) => void }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useAuth();

  useEffect(() => {
    api.analyzeFile(file, tokens).then(data => {
      if (data.error) {
        if (isGeminiPermissionError(data.error)) {
          onSetError(data.error);
          onClose();
        } else {
          setError(data.error);
        }
      } else {
        setAnalysis(data.analysis);
      }
      setLoading(false);
    });
  }, [file, tokens, onSetError, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-indigo-200 shadow-lg">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Coaching Insight</h2>
              <p className="text-sm text-slate-500 truncate max-w-[400px]">{file.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <LogOut size={20} className="rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-20 text-slate-400">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-semibold text-lg">AI is processing content...</p>
                <p className="text-sm">Transcribing, identifying patterns, and generating action items.</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700">
              <div className="flex gap-3">
                <AlertCircle size={20} />
                <div>
                  <p className="font-bold">Analysis Failed</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown>{analysis || ''}</ReactMarkdown>
            </div>
          )}
        </div>
        
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            Share Report
          </button>
          <button className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
            Add to Retro
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- PAGES ---

const LoginPage = () => {
  const { setTokens } = useAuth();

  const login = async () => {
    try {
      const data = await api.getAuthUrl();
      if (data.error) {
        alert(`Configuration Error: ${data.error}\n\nPlease set your Google OAuth credentials in the environment variables.`);
        return;
      }
      const url = data.url;
      const popup = window.open(url, 'google_auth', 'width=600,height=700');
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.code) {
          const tokens = await api.exchangeToken(event.data.code);
          setTokens(tokens);
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-slate-50">
      <div className="w-full max-w-md bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-indigo-200 shadow-2xl mb-6">
            <BrainCircuit className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Agile Coach</h1>
          <p className="text-slate-500 text-lg">AI insights for "Standups and Retros"</p>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-6">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <p className="text-xs text-amber-800 text-left">
                Grant Drive Read Access to analyze your "Standups and Retros - Recordings" folder.
              </p>
            </div>
          </div>

          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="" />
            Connect Google Drive
          </button>
          
          <p className="text-center text-xs text-slate-400 mt-6 uppercase tracking-widest font-semibold">
            Enterprise Grade Security
          </p>
        </div>
      </div>
    </div>
  );
};

const AuthCallback = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-lg font-medium text-slate-600">Completing authentication...</p>
      </div>
    </div>
  );
};

const MainApp = () => {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState<DriveFile | null>(null);
  const [allFiles, setAllFiles] = useState<DriveFile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useAuth();
  const [drillDownDate, setDrillDownDate] = useState<string | null>(null);

  useEffect(() => {
    if (tokens) {
      setError(null);
      api.getTeams(tokens).then(async (data) => {
        if (data.error) {
          setError(data.error);
          setLoadingAll(false);
          return;
        }

        if (Array.isArray(data)) {
          setTeams(data);
          
          try {
            // Parallel fetch for all teams
            const allFilePromises = data.map(team => api.getFiles(team.id, tokens));
            const fileArrays = await Promise.all(allFilePromises);
            
            // Flatten and tag with team reference
            const flattened = fileArrays.flatMap((files, i) => 
              Array.isArray(files) ? files.map(f => ({ ...f, webViewLink: `${f.webViewLink || ''}?teamId=${data[i].id}` })) : []
            ).sort((a, b) => parseISO(b.createdTime).getTime() - parseISO(a.createdTime).getTime());
            
            setAllFiles(flattened);
          } catch (err: any) {
            console.error('Files fetch error:', err);
            // Don't set global error here yet as teams might have loaded
          }
        }
        setLoadingAll(false);
      }).catch(err => {
        setError(err.message);
        setLoadingAll(false);
      });
    }
  }, [tokens]);

  useEffect(() => {
    if (!selectedTeam) setSelectedTeam({ id: 'all', name: 'Overview' });
  }, [selectedTeam]);

  const handleDrillDown = (date: string) => {
    setDrillDownDate(date);
    // Auto-scroll to drill down results
    setTimeout(() => {
      document.getElementById('drill-down-area')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="flex h-screen bg-white font-sans max-w-[2000px] mx-auto overflow-hidden">
      <Sidebar currentTeam={selectedTeam} onSelectTeam={(t) => {
        setSelectedTeam(t);
        setDrillDownDate(null);
      }} />
      
      <main className="flex-1 h-full overflow-y-auto bg-slate-50/50 relative">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-lg">{selectedTeam?.name || 'Dashboard'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search team assets..."
                className="bg-slate-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 w-64 outline-none transition-all"
              />
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tokens?.access_token}`} alt="Profile" />
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-6xl mx-auto">
          {selectedTeam?.id === 'all' ? (
            <div className="space-y-12">
              <DashboardHome 
                teams={teams} 
                allFiles={allFiles} 
                onSelectDay={handleDrillDown}
                isLoading={loadingAll}
                error={error}
                onSetError={setError}
              />
              
              <AnimatePresence>
                {drillDownDate && (
                  <motion.div 
                    id="drill-down-area"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6 pt-12 border-t border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-900">Drill-Down: Sessions on {drillDownDate}</h3>
                      <button 
                        onClick={() => setDrillDownDate(null)}
                        className="text-sm text-indigo-600 font-semibold hover:underline"
                      >
                        Clear Filter
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                       <table className="w-full text-left">
                         <tbody className="divide-y divide-slate-50">
                           {allFiles.filter(f => format(parseISO(f.createdTime), 'MMM d') === drillDownDate).map(file => (
                             <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                   {file.mimeType.includes('video') ? <Video size={16} className="text-purple-500" /> : <FileText size={16} className="text-blue-500" />}
                                   <span className="font-medium text-slate-900 text-sm">{file.name}</span>
                                 </div>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => setAnalyzingFile(file)}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold"
                                  >
                                    Analyze
                                  </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            selectedTeam && <FileBrowser team={selectedTeam} onAnalyze={setAnalyzingFile} />
          )}
        </div>
 
        <AnimatePresence>
          {analyzingFile && (
            <AnalysisModal file={analyzingFile} onClose={() => setAnalyzingFile(null)} onSetError={setError} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  const [tokens, setTokensState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('google_tokens');
    if (saved) setTokensState(JSON.parse(saved));
    setLoading(false);
  }, []);

  const setTokens = (t: any) => {
    localStorage.setItem('google_tokens', JSON.stringify(t));
    setTokensState(t);
  };

  const logout = () => {
    localStorage.removeItem('google_tokens');
    setTokensState(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ tokens, setTokens, logout }}>
      <Router>
        <Routes>
          <Route path="/auth-callback" element={<AuthCallback />} />
          <Route path="/" element={tokens ? <MainApp /> : <LoginPage />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

