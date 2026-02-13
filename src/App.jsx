import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, memo } from 'react';
import {
  Play, Pause, Rewind, FastForward,
  Eye, EyeOff, Languages, List, Search, Upload,
  Gauge, Repeat, Volume2, VolumeX, Info, Settings,
  X, Check, AlertCircle, BookOpen, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, FileAudio, FileVideo, Plus, Trash2,
  SkipBack, SkipForward, Clock, History, MoreVertical, XCircle
} from 'lucide-react';
import { analyzeMedia } from './services/gemini';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <h3 className="font-bold mb-2">Something went wrong.</h3>
          <p className="text-sm font-mono whitespace-pre-wrap">{this.state.error?.toString()}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-xs font-bold transition-colors">
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


const TranscriptItem = memo(({
  item, idx, isActive, isGlobalLooping,
  seekTo, jumpToSentence, toggleLoop,
  onPrev, onNext,
  isLooping, showAnalysis, toggleGlobalAnalysis,
  showTranslations,
  onQuickSync
}) => {
  const itemRef = useRef(null);

  // 1. Smooth Auto-Scroll on Active Change (Playback)
  useEffect(() => {
    if (isActive && itemRef.current && !isGlobalLooping) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isActive, isGlobalLooping]);

  // 2. Instant Scroll Anchoring on Layout Change (Toggle Analysis)
  useLayoutEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [showAnalysis]);

  return (
    <div
      ref={itemRef}
      className={`
        group relative transition-all duration-300 ease-out rounded-xl sm:rounded-2xl border mb-3 scroll-mt-32
        ${isActive
          ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-500/20'
          : 'bg-white/80 border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-slate-100/50 hover:bg-white'}
      `}
    >
      {/* Active Indicator */}
      <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all duration-300 ${isActive ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-200'}`} />

      {/* Looping Indicator (Top Right) */}
      {isLooping && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-sm border border-amber-200 z-10">
          <Repeat size={10} className="stroke-[3]" /> Looping
        </div>
      )}

      <div className="p-2 sm:p-4">
        {/* Header: Timestamp & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <button
            onClick={() => seekTo(item.seconds)}
            className={`
              flex items-center gap-2 px-2 py-1 rounded-full text-sm font-bold font-mono tracking-wide transition-all
              ${isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}
            `}
          >
            <Play size={10} fill="currentColor" /> {item.timestamp}
          </button>
        </div>
        <div
          onClick={() => jumpToSentence(idx)}
          className={`
            text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed cursor-pointer transition-colors duration-200 mb-2 px-1
            ${isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}
          `}
        >
          {item.text}
        </div>

        {/* Translation */}
        {/* Translation moved to Analysis Section */}

        {/* Toggle Global Explanation Button */}
        <div className="flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); toggleGlobalAnalysis(); }}
            className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            {showAnalysis ? 'Hide' : 'Show'}
            {showAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Detailed Analysis Section */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showAnalysis ? 'max-h-[2000px] opacity-100 mt-2 pt-2 border-t border-slate-100' : 'max-h-0 opacity-0 mt-0 pt-0'}`}>

          {/* Translation (Always show if showTranslations is true or analysis is expanded) */}
          {(showTranslations || showAnalysis) && item.translation && (
            <div className={`rounded-xl p-3 border transition-colors duration-300 mb-4 ${showAnalysis ? 'bg-indigo-50/80 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider mb-1">
                <Languages size={14} /> Translation
              </div>
              <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-line font-medium">{item.translation}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Patterns */}
            {item.patterns && item.patterns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider mb-2">
                  <List size={14} /> Patterns
                </div>
                <div className="space-y-2">
                  {item.patterns.map((pat, pi) => (
                    <div key={pi} className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                      <span className="font-bold text-slate-800 text-lg block mb-0.5">{pat.term}</span>
                      <span className="text-slate-600 text-base leading-relaxed block">{pat.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Word Analysis */}
            {item.words && item.words.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-wider mb-3">
                  <BookOpen size={14} /> Word Analysis
                </div>
                <div className="divide-y divide-emerald-100/50 border border-emerald-100/30 rounded-xl overflow-hidden bg-white">
                  {item.words.map((w, wi) => (
                    <div key={wi} className="p-2.5 flex items-start gap-3 hover:bg-emerald-50/30 transition-colors">
                      <span className="font-bold text-emerald-700 text-base min-w-[30%] break-words">{w.word}</span>
                      <div className="flex-1">
                        <span className="block text-slate-700 text-sm font-medium">{w.meaning}</span>
                        {w.func && <span className="block text-slate-400 text-xs mt-0.5">{w.func}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
});

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('miniapp_gemini_key') || '');
  const BUFFER_SECONDS = 0.8; // Audio Buffer (0.8s)

  // Multi-file state
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);

  // Player state
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [loopingSentenceIdx, setLoopingSentenceIdx] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showTranslations, setShowTranslations] = useState(true); // New global state
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showCacheHistory, setShowCacheHistory] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const [cacheKeys, setCacheKeys] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSwitchingFile, setIsSwitchingFile] = useState(false);


  const videoRef = useRef(null);
  const activeIdxRef = useRef(null);
  const loopingSentenceIdxRef = useRef(null);

  // Derived active file
  const activeFile = files.find(f => f.id === activeFileId);
  const transcriptData = activeFile?.data || [];
  const mediaUrl = activeFile?.url || null;
  const isAnalyzing = activeFile?.isAnalyzing || false;




  // Helper: Parse MM:SS.ms to seconds
  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const cleanStr = timeStr.replace(/[\[\]]/g, '');
    const parts = cleanStr.split(':');
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return 0;
  };

  // Helper: Sanitize & Sort Data
  const sanitizeData = (data) => {
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data);
      return [];
    }
    return data
      .filter(item => item && typeof item === 'object') // Filter null/non-objects
      .map(item => {
        let seconds = 0;
        if (typeof item.seconds === 'number') {
          seconds = item.seconds;
        } else if (typeof item.timestamp === 'string') {
          seconds = parseTime(item.timestamp);
        }

        return {
          ...item,
          seconds: isNaN(seconds) ? 0 : seconds,
          text: item.text || "(No text)",
          translation: item.translation || "",
          words: Array.isArray(item.words) ? item.words : [],
          patterns: Array.isArray(item.patterns) ? item.patterns : []
        };
      })
      .filter(item => item.text !== "(No text)") // Optional: remove empty text items if desired
      .sort((a, b) => a.seconds - b.seconds);
  };

  // Sync ref
  useEffect(() => { loopingSentenceIdxRef.current = loopingSentenceIdx; }, [loopingSentenceIdx]);

  const saveApiKey = (key) => {
    localStorage.setItem('miniapp_gemini_key', key);
    setApiKey(key);
    setShowSettings(false);
  };

  useEffect(() => {
    if (showSettings || showCacheHistory) {
      setCacheKeys(Object.keys(localStorage).filter(k => k.startsWith('gemini_analysis_')));
    }
  }, [showSettings, showCacheHistory]);

  const deleteCache = (key) => {
    if (confirm('Delete this cached transcript?')) {
      localStorage.removeItem(key);
      setCacheKeys(prev => prev.filter(k => k !== key));
    }
  };

  const clearAllCache = () => {
    const count = cacheKeys.length;
    if (confirm(`Clear all ${count} cached analysis files?`)) {
      cacheKeys.forEach(k => localStorage.removeItem(k));
      setCacheKeys([]);
      alert("All cache cleared!");
    }
  };

  const loadCache = (key) => {
    // FORCE RESET
    resetPlayerState();
    setIsSwitchingFile(true);

    const cachedData = localStorage.getItem(key);
    if (cachedData) {
      try {
        const rawData = JSON.parse(cachedData);
        const data = sanitizeData(rawData); // Sort & Sanitize

        // Clean up name from key
        const name = key.replace('gemini_analysis_', '').replace(/_\d+$/, '');
        const id = 'cached-' + Date.now();

        const newFileEntry = {
          id,
          // We don't have the original File object, but we need these properties
          file: { name, type: 'video/unknown' },
          data,
          url: null, // Media playback won't work without re-uploading
          isAnalyzing: false
        };

        setFiles(prev => [...prev, newFileEntry]);
        setActiveFileId(id);
        setShowSettings(false);
        setShowCacheHistory(false);
        // Alert removed for smoother check
        // alert(`Loaded analysis for: ${name}\nNote: Media playback requires re-selecting the file.`);
      } catch (e) {
        console.error("Failed to load cache:", e);
        alert("Failed to load cached data.");
        setIsSwitchingFile(false);
      }
    }
  };

  // Media Controls
  const seekTo = useCallback((s) => {
    const v = videoRef.current;
    if (v) {
      // Ensure target time is within valid range
      const targetTime = Math.max(0, Math.min(s, v.duration || 999999));

      // Force seek
      v.currentTime = targetTime;

      // If video is still in a state where it can't play, it might need a small kick
      if (v.paused) {
        v.play().catch(e => {
          console.warn("Play interrupted or failed:", e);
          // Retry playback on next frame if interrupted
          requestAnimationFrame(() => v.play().catch(() => { }));
        });
      }
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  }, []);

  const toggleLoop = useCallback((index) => {
    setLoopingSentenceIdx(prev => {
      const next = prev === index ? null : index;
      if (videoRef.current) {
        videoRef.current.loop = next === null;
      }
      return next;
    });

    if (loopingSentenceIdx !== index) {
      if (activeFile?.data?.[index]) {
        // Transcript Time -> Audio Time: T - BUFFER
        seekTo(Math.max(0, activeFile.data[index].seconds - BUFFER_SECONDS));
      }
    }
  }, [loopingSentenceIdx, seekTo, activeFile]);

  const jumpToSentence = useCallback((index) => {
    if (activeFile?.data && index >= 0 && index < activeFile.data.length) {
      setLoopingSentenceIdx(null);
      // Play with Buffer: T - 0.8s
      seekTo(Math.max(0, activeFile.data[index].seconds - BUFFER_SECONDS));
    }
  }, [seekTo, activeFile]);

  const handlePrev = useCallback((currentIndex) => {
    if (activeFile?.data?.length) {
      const prevIndex = (currentIndex - 1 + activeFile.data.length) % activeFile.data.length;
      jumpToSentence(prevIndex);
    }
  }, [jumpToSentence, activeFile]);

  const handleNext = useCallback((currentIndex) => {
    if (activeFile?.data?.length) {
      const nextIndex = (currentIndex + 1) % activeFile.data.length;
      jumpToSentence(nextIndex);
    }
  }, [jumpToSentence, activeFile]);

  // Quick Sync Handler Removed


  // --- SYNC ENGINE (High-Precision 100ms) ---

  // Strict Index Calculation
  const findActiveIndex = useCallback((time, data) => {
    if (!data || data.length === 0) return null;
    // Binary search or simple find? Simple find is fast enough for <1000 items
    // Strict Condition: time >= item.start && time < nextItem.start
    // Using seconds (float)
    const idx = data.findIndex((item, i) => {
      const start = item.seconds;
      const end = (i < data.length - 1) ? data[i + 1].seconds : (videoRef.current?.duration || Infinity);
      return time >= start && time < end;
    });
    return idx;
  }, []);

  // Sync Loop
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeFile?.data) return;

    // Auto loop the whole video only if no sentence is being looped
    v.loop = loopingSentenceIdxRef.current === null;

    let rAF;
    let lastTime = 0;

    const tick = () => {
      const now = v.currentTime;

      // 1. Update Progress Bar (Throttle to ~30fps or every frame if smooth)
      setCurrentTime(now);

      // 2. Strict Sync Check (Every Frame for precision, state update only on change)
      const newIdx = findActiveIndex(now, activeFile.data);

      if (newIdx !== -1 && newIdx !== activeIdxRef.current) {
        // Index Changed!
        activeIdxRef.current = newIdx;
        setActiveSentenceIdx(newIdx); // Triggers UI update
      }

      // 3. Loop Logic (0.8s Buffer)
      const loopIdx = loopingSentenceIdxRef.current;
      if (loopIdx !== null) {
        const item = activeFile.data[loopIdx];
        if (item) {
          const start = Math.max(0, item.seconds - BUFFER_SECONDS);
          const end = (loopIdx < activeFile.data.length - 1)
            ? activeFile.data[loopIdx + 1].seconds + BUFFER_SECONDS
            : v.duration + BUFFER_SECONDS; // Handle last item end

          if (now >= end - 0.1 || (v.ended && loopIdx === activeFile.data.length - 1)) {
            v.currentTime = start;
            v.play();
          }
        }
      }

      if (!v.paused && !v.ended) {
        rAF = requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      tick();
    };

    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rAF);
      // Immediate sync on pause to ensure correct highlighting
      const idx = findActiveIndex(v.currentTime, activeFile.data);
      if (idx !== -1 && idx !== activeIdxRef.current) {
        activeIdxRef.current = idx;
        setActiveSentenceIdx(idx);
      }
    };

    const onSeek = () => {
      // High-Precision Snapshot Scan on Seek/Scrub (Unified Engine)
      const now = v.currentTime;
      const idx = findActiveIndex(now, activeFile.data);
      if (idx !== -1 && idx !== activeIdxRef.current) {
        activeIdxRef.current = idx;
        setActiveSentenceIdx(idx);
      }
      setCurrentTime(now);
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onPause);
    v.addEventListener('timeupdate', onSeek); // Handles seek & backup sync
    v.addEventListener('seeking', onSeek);    // Handles scrub dragging

    if (!v.paused) tick();

    return () => {
      cancelAnimationFrame(rAF);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onPause);
      v.removeEventListener('timeupdate', onSeek);
      v.removeEventListener('seeking', onSeek);
    };
  }, [activeFile, findActiveIndex]);

  // Reset switching state when active file changes
  useEffect(() => {
    if (isSwitchingFile && activeFileId) {
      // Small timeout to ensure UI has painted the loading state at least once if needed, 
      // but strictly we just want to turn it off once the new active file is ready.
      // Since activeFile is derived from activeFileId, waiting for activeFileId change is correct.
      // However, we want to ensure the NEW file's isAnalyzing is true before we turn off isSwitchingFile?
      // Actually, the new file entry created in processFiles has isAnalyzing: true.
      // So once activeFileId updates to the new ID, activeFile.isAnalyzing will be true.
      // So we can safely turn off isSwitchingFile.
      setIsSwitchingFile(false);
    }
  }, [activeFileId]);

  // Derived current idx for UI (now using state directly)
  const currentSentenceIdx = activeSentenceIdx;


  // Rate
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!mediaUrl || !activeFile?.data?.length) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }

      const now = videoRef.current ? videoRef.current.currentTime : 0;
      // Index detection remains strict on timeline (no buffer for index) to avoid early highlighting
      // or should it cover the buffer? User said "full sentence played". 
      // If we seek to -0.8s, the index logic needs to know we are "in" that sentence.
      // But simple findIndex works on >= seconds. If we are at -0.8s, we are strictly before the sentence.
      // Ideally, the index logic should also account for the buffer if we want the UI to highlight immediately.
      // Let's use strict 0.1s timeline for identifying "Active" sentence, but playback allows slack.
      // Actually, if we seek to -0.8, the PREVIOUS sentence is likely active.
      // Retaining strict logic for now as per user "strict 0.1s timeline" for display.
      const data = activeFile.data;
      const currentIdx = data.findIndex((item, idx) =>
        now >= item.seconds && (idx === data.length - 1 || now < data[idx + 1].seconds)
      );

      switch (e.code) {
        case 'Enter': if (currentIdx !== -1) toggleLoop(currentIdx); break;
        case 'ArrowLeft':
          if (data.length > 0) {
            const idx = currentIdx !== -1 ? currentIdx : 0;
            const prevIdx = (idx - 1 + data.length) % activeFile.data.length;
            jumpToSentence(prevIdx);
          }
          break;
        case 'ArrowRight':
          if (data.length > 0) {
            const idx = currentIdx !== -1 ? currentIdx : 0;
            const nextIdx = (idx + 1) % activeFile.data.length;
            jumpToSentence(nextIdx);
          }
          break;
        case 'ArrowUp': e.preventDefault(); if (videoRef.current) videoRef.current.currentTime -= 5; break;
        case 'ArrowDown': e.preventDefault(); if (videoRef.current) videoRef.current.currentTime += 5; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaUrl, activeFile, togglePlay, toggleLoop, handlePrev, handleNext]);

  // --- STATE RESET LOGIC ---
  const resetPlayerState = useCallback(() => {
    setActiveSentenceIdx(-1);
    setCurrentTime(0);
    setIsPlaying(false);
    setLoopingSentenceIdx(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  // File Handling
  const processFiles = async (fileList) => {
    setIsDragging(false);
    if (!fileList || fileList.length === 0) return;

    // Force Reset
    setIsSwitchingFile(true);
    resetPlayerState();

    console.log("[Upload] Processing files...", fileList);

    const newFiles = Array.from(fileList).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      url: URL.createObjectURL(f),
      data: [],
      isAnalyzing: true,
      error: null
    }));

    // Add new files. If we want to replace, we could use setFiles(newFiles)
    // But usually multi-file implies appending. Let's append.
    setFiles(prev => [...prev, ...newFiles]);

    // Immediately set the first new file as active
    if (newFiles.length > 0) {
      // Clear old active file data reference implicitly by switch
      setActiveFileId(newFiles[0].id);
    }

    // Process each new file
    newFiles.forEach(async (fItem) => {
      try {
        if (!apiKey) throw new Error("Please set Gemini API Key in Settings.");

        // --- CACHE CHECK ---
        const cacheKey = `gemini_analysis_${fItem.file.name}_${fItem.file.size}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          console.log("Using cached analysis for", fItem.file.name);
          const rawData = JSON.parse(cached);
          const data = sanitizeData(rawData);
          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));
        } else {
          // API Call
          // Update status to analyzing (redundant but safe)
          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, isAnalyzing: true } : p));

          let rawData;
          try {
            rawData = await analyzeMedia(fItem.file, apiKey);
          } catch (apiError) {
            throw new Error(`API Error: ${apiError.message}`);
          }

          if (!rawData) throw new Error("Received empty data from API");

          const data = sanitizeData(rawData);

          if (data.length === 0) {
            throw new Error("Analysis returned no valid text data.");
          }

          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {
            console.warn("Quota exceeded or failed to save to localStorage", e);
          }

          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));
        }
      } catch (err) {
        console.error("Analysis Error", err);
        setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, error: "Analysis failed: " + err.message, isAnalyzing: false } : p));
      }
    });
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => {
    if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDragging(false);
    }
  };
  const onDrop = (e) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };



  const removeFile = (id, e) => {
    e.stopPropagation();
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      if (activeFileId === id) {
        setActiveFileId(newFiles.length > 0 ? newFiles[0].id : null);
      }
      return newFiles;
    });
  };

  const removeAllFiles = () => {
    if (confirm("Remove all active files?")) {
      setFiles([]);
      setActiveFileId(null);
      setShowFileList(false);
    }
  };

  // Empty State
  if (files.length === 0) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative"
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm flex items-center justify-center p-10 border-4 border-indigo-500 border-dashed m-4 rounded-3xl">
            <h2 className="text-4xl font-bold text-indigo-600 animate-bounce">Drop Files Here!</h2>
          </div>
        )}

        <button onClick={() => setShowSettings(true)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <Settings size={24} />
        </button>

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl animate-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Settings</h3>
                <button onClick={() => setShowSettings(false)}><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">Google Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API Key"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={() => saveApiKey(apiKey)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">Save Key</button>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center">
                    Timeline uses strict 0.1s snap. Playback adds 0.8s buffer for context.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-2 text-sm">Cached Transcripts</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-3 pr-1 bg-slate-50/50 rounded-lg p-1">
                    {cacheKeys.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No cached files found.</p>
                    ) : (
                      cacheKeys.map(key => {
                        const name = key.replace('gemini_analysis_', '').replace(/_\d+$/, '');
                        return (
                          <div
                            key={key}
                            onClick={() => loadCache(key)}
                            className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer group/item"
                          >
                            <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-4" title={key}>{name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCache(key); }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {cacheKeys.length > 0 && (
                    <button onClick={clearAllCache} className="w-full py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                      <Trash2 size={14} /> Clear All Cache
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}



        <div className="max-w-4xl w-full text-center space-y-10 animate-in fade-in zoom-in duration-500">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl ring-1 ring-indigo-100 mb-2">
              <Volume2 size={28} className="text-indigo-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Media<span className="text-indigo-600">Smart</span> Analyzer
            </h1>
          </div>
          <div className={`
                 max-w-3xl mx-auto group relative flex items-center gap-6 p-10 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
                 border-slate-200 hover:border-indigo-300 hover:bg-white bg-white/60
              `}>
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => processFiles(e.target.files)} accept="audio/*,video/*" />
            <div className="w-full flex flex-col items-center gap-4">
              <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xl">Drag & Drop Multiple Files</h3>
                <p className="text-slate-500 mt-2">or click to browse</p>
              </div>
            </div>
          </div>
        </div>
      </div >
    );
  }

  // View: Main Workspace

  const headerElement = (
    <header className="flex-none bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 z-20 shadow-sm relative">
      <div className="flex-1 min-w-0">

        {/* Center: File List Popup Trigger -> Now Unified Manager Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowCacheHistory(true)}
            className="w-full text-center px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
          >
            {activeFile ? (
              <div className="flex items-center justify-center gap-2 text-slate-900">
                {activeFile.file.type.startsWith('video') ? <FileVideo size={16} className="text-indigo-600 shrink-0" /> : <FileAudio size={16} className="text-indigo-600 shrink-0" />}
                <span className="text-lg font-bold truncate group-hover:text-indigo-700 transition-colors">{activeFile.file.name}</span>
              </div>
            ) : (
              <span className="text-lg font-bold text-slate-400">Select File...</span>
            )}
          </button>

          {/* File List Popup */}
          {showFileList && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">Active Files</span>
                <label className="cursor-pointer text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50" title="Add File">
                  <Plus size={16} />
                  <input type="file" multiple className="hidden" onChange={(e) => { processFiles(e.target.files); setShowFileList(false); }} accept="audio/*,video/*" />
                </label>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {files.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm">No files added</div>
                ) : (
                  files.map(f => (
                    <div
                      key={f.id}
                      onClick={() => { setActiveFileId(f.id); setShowFileList(false); }}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${f.id === activeFileId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      {f.file.type.startsWith('video') ? <FileVideo size={14} /> : <FileAudio size={14} />}
                      <span className="text-sm font-medium truncate flex-1">{f.file.name}</span>
                      <button onClick={(e) => removeFile(f.id, e)} className="p-1 text-slate-300 hover:text-red-500 rounded"><X size={14} /></button>
                    </div>
                  ))
                )}
              </div>
              {files.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-50">
                  <button onClick={removeAllFiles} className="w-full py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                    <Trash2 size={12} /> Clear All Files
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex flex-col h-screen bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans animate-in fade-in duration-700 relative"
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm flex items-center justify-center p-10 border-4 border-indigo-500 border-dashed m-4 rounded-3xl pointer-events-none">
          <h2 className="text-4xl font-bold text-indigo-600 animate-bounce">Drop to Add Files</h2>
        </div>
      )}

      {/* Header moved to inside scrollable areas */}

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Active File Content */}
        {activeFile ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 w-full overflow-y-auto bg-[#F8FAFC]" onClick={() => { setShowSpeedMenu(false); setShowFileList(false); }}>

              {/* Header Element - Now Inside Scroll View but Sticky-ish behavior if needed, 
                  but user asked for non-fixed. 
                  NOTE: Top Bar Sync Logic Implemented Here 
              */}
              <header className="flex-none bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 z-20 shadow-sm relative">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <button
                      onClick={() => setShowCacheHistory(true)}
                      className="w-full text-center px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center justify-center gap-2 text-slate-900">
                        {/* Icon based on file type */}
                        {activeFile.file.type.startsWith('video') ? (
                          <FileVideo size={16} className={`shrink-0 ${isAnalyzing || isSwitchingFile ? 'text-slate-400 animate-pulse' : 'text-indigo-600'}`} />
                        ) : (
                          <FileAudio size={16} className={`shrink-0 ${isAnalyzing || isSwitchingFile ? 'text-slate-400 animate-pulse' : 'text-indigo-600'}`} />
                        )}

                        {/* Text Binding with Analyzing State */}
                        <span className={`text-lg font-bold truncate group-hover:text-indigo-700 transition-colors ${isAnalyzing || isSwitchingFile ? 'text-slate-500 italic' : ''}`}>
                          {isAnalyzing || isSwitchingFile ? `Analyzing... ${activeFile.file.name}` : activeFile.file.name}
                        </span>
                      </div>
                    </button>

                    {/* File List Popup (kept as is, just ensured it uses same logic if needed) */}
                    {showFileList && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in zoom-in-95 duration-200">
                        {/* ... existing file list content ... */}
                        {/* NOTE: We aren't changing the inner content of FileList popup in this block, 
                             so we can assume it renders standard file list. 
                             However, to be safe and clean, we should just keep the existing `headerElement` variable
                             concept or strictly inline it here.
                             The previous code defined `headerElement` outside.
                             Let's inline it to ensure state binding is fresh. 
                         */}
                        {/* Actually, the previous code used `headerElement` variable. 
                             I will REPLACE the usage of `headerElement` with this inline code 
                             to ensure it re-renders with state changes correctly.
                         */}
                        <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-50">
                          <span className="text-xs font-bold text-slate-500 uppercase">Active Files</span>
                          <label className="cursor-pointer text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50" title="Add File">
                            <Plus size={16} />
                            <input type="file" multiple className="hidden" onChange={(e) => { processFiles(e.target.files); setShowFileList(false); }} accept="audio/*,video/*" />
                          </label>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {files.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 text-sm">No files added</div>
                          ) : (
                            files.map(f => (
                              <div
                                key={f.id}
                                onClick={() => {
                                  // FORCE RESET ON SWITCH
                                  if (activeFileId !== f.id) {
                                    setIsSwitchingFile(true);
                                    resetPlayerState();
                                    setActiveFileId(f.id);
                                  }
                                  setShowFileList(false);
                                }}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${f.id === activeFileId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                              >
                                {f.file.type.startsWith('video') ? <FileVideo size={14} /> : <FileAudio size={14} />}
                                <span className="text-sm font-medium truncate flex-1">{f.file.name}</span>
                                <button onClick={(e) => removeFile(f.id, e)} className="p-1 text-slate-300 hover:text-red-500 rounded"><X size={14} /></button>
                              </div>
                            ))
                          )}
                        </div>
                        {files.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-50">
                            <button onClick={removeAllFiles} className="w-full py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                              <Trash2 size={12} /> Clear All Files
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="max-w-6xl mx-auto px-0.5 py-4 sm:px-2 md:p-6 pb-32">
                {isAnalyzing || isSwitchingFile ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-bold text-slate-900">Analyzing {activeFile.file.name}...</h3>
                      <p className="text-slate-500">Extracting speech, grammar, and nuances.</p>
                    </div>
                  </div>
                ) : activeFile.error ? (
                  <div className="max-w-xl mx-auto p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center">
                    <AlertCircle size={32} className="mx-auto mb-3 text-red-500" />
                    <h3 className="font-bold text-lg mb-1">Analysis Failed</h3>
                    <p>{activeFile.error}</p>
                  </div>
                ) : transcriptData.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <p>Analysis complete but no text found.</p>
                  </div>
                ) : (
                  // KEY-SWITCHING IMPLEMENTATION
                  // key={activeFileId} forces a full remount of this container when file changes
                  <div key={activeFileId} className="space-y-4 min-h-[200px]">
                    <ErrorBoundary>
                      {transcriptData.map((item, idx) => {
                        const isActive = idx === currentSentenceIdx;
                        return (
                          <TranscriptItem
                            key={idx}
                            item={item}
                            idx={idx}
                            isActive={isActive}
                            seekTo={seekTo}
                            jumpToSentence={jumpToSentence}
                            toggleLoop={() => toggleLoop(idx)}
                            onPrev={() => handlePrev(idx)}
                            onNext={() => handleNext(idx)}
                            isLooping={loopingSentenceIdx === idx}
                            isGlobalLooping={loopingSentenceIdxRef.current !== null}
                            showAnalysis={showAnalysis}
                            showTranslations={showTranslations}
                            toggleGlobalAnalysis={() => setShowAnalysis(!showAnalysis)}
                          />
                        );
                      })}
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Bottom Player Controls (Sticky Bottom) */}
            <div className="flex-none bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 shadow-lg pb-safe">
              <div className="max-w-5xl mx-auto flex flex-row items-stretch h-[85px] sm:h-[100px]">

                {/* Left: Video Thumbnail (Tall & Larger) */}
                <div className="relative bg-black w-[110px] sm:w-[140px] shrink-0 overflow-hidden group border-r border-slate-100">
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    className="w-full h-full object-contain"
                    onClick={togglePlay}
                    playsInline
                    loop
                  />
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                      <Play size={24} fill="white" className="text-white ml-0.5" />
                    </div>
                  )}
                </div>

                {/* Right: Controls Column */}
                <div className="flex-1 flex flex-col justify-center min-w-0">

                  {/* Row 1: Progress Bar */}
                  <div className="w-full px-3 pt-2 pb-1 flex items-center gap-2 text-[10px] sm:text-xs font-mono font-bold text-slate-500">
                    <span className="w-9 shrink-0 text-indigo-600 text-right">
                      {new Date(Math.max(0, currentTime) * 1000).toISOString().substr(14, 5)}
                    </span>

                    <div
                      className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden cursor-pointer group relative"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo(((e.clientX - rect.left) / rect.width) * videoRef.current.duration);
                      }}
                    >
                      <div className="absolute inset-0 w-full h-full hover:bg-slate-200/40 transition-colors" />
                      <div
                        className="h-full bg-indigo-500 rounded-full relative group-hover:bg-indigo-600 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                        style={{ width: `${videoRef.current?.duration ? (currentTime / videoRef.current.duration) * 100 : 0}%` }}
                      />
                    </div>

                    <span className="w-9 shrink-0 text-left">{videoRef.current?.duration ? new Date(videoRef.current.duration * 1000).toISOString().substr(14, 5) : "00:00"}</span>
                  </div>

                  {/* Row 2: Control Buttons */}
                  <div className="flex items-center justify-between px-3 pl-1 py-1 gap-1">

                    {/* Speed & Analysis */}
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                          className={`
                            flex items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all min-w-[40px] border
                            ${showSpeedMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}
                          `}
                        >
                          {playbackRate.toFixed(1)}x
                        </button>
                        {showSpeedMenu && (
                          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-[60] w-48">
                            <div className="grid grid-cols-4 gap-1">
                              {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0].map(rate => (
                                <button
                                  key={rate}
                                  onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                  className={`py-1.5 rounded text-[10px] font-bold ${Math.abs(playbackRate - rate) < 0.01 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {rate.toFixed(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className={`p-1.5 rounded-lg border transition-all ${showAnalysis ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white text-slate-400 border-slate-200'}`}
                      >
                        {showAnalysis ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>

                    {/* Main Controls */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => handlePrev(currentSentenceIdx)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                        <SkipBack size={18} className="fill-current" />
                      </button>

                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 transition-transform active:scale-95"
                      >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                      </button>

                      <button onClick={() => handleNext(currentSentenceIdx)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                        <SkipForward size={18} className="fill-current" />
                      </button>
                    </div>

                    {/* Right: Loop Only (Translations removed) */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { if (currentSentenceIdx !== -1) toggleLoop(currentSentenceIdx); }}
                        className={`p-1.5 rounded-lg border transition-all ${loopingSentenceIdxRef.current !== null ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-slate-400 border-slate-200'}`}
                      >
                        <Repeat size={16} />
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {headerElement}
            <div className="flex-1 flex items-center justify-center p-10">
              <div className="max-w-md w-full p-8 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                <div className="inline-flex p-4 bg-slate-50 rounded-2xl text-slate-400">
                  <FileAudio size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">No active file</h3>
                  <p className="text-slate-500 mt-1">Upload or select a file to start the analysis.</p>
                </div>
                <button
                  onClick={() => setShowFileList(true)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-100"
                >
                  Select from List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {
        showSettings && (
          <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-xl">
                    <Settings size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Settings</h2>
                    <p className="text-xs text-slate-500 font-medium">Configure Gemini AI & Preferences</p>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      Get Key <X size={10} className="rotate-45" />
                    </a>
                  </div>
                  <div className="relative group">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                    <Check className={`absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 transition-all ${apiKey.length > 20 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} size={18} />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Your key is stored locally in your browser and never sent to our servers.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Cache Results</h4>
                      <p className="text-xs text-slate-400">Save analysis for offline use</p>
                    </div>
                    <div className="w-10 h-6 bg-emerald-500 rounded-full relative p-1">
                      <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-white rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Unified File & Analysis Management Modal */}
      {
        showCacheHistory && (
          <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-end shrink-0 bg-white z-10">
                <button onClick={() => setShowCacheHistory(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                  <X size={24} className="text-slate-400 hover:text-red-500" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                {/* Visual Header / Controls */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <List size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">File & Analysis Management</h3>
                      <p className="text-xs text-slate-500">Manage transcripts and files</p>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="relative">
                    <label
                      htmlFor="manager-file-upload"
                      className="flex items-center justify-center gap-3 w-full p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer shadow-lg shadow-indigo-200 transition-all group"
                    >
                      <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                      </div>
                      <div>
                        <span className="block text-lg font-bold">Upload New File</span>
                        <span className="text-xs text-indigo-200">Audio or Video support</span>
                      </div>
                    </label>
                    <input
                      id="manager-file-upload"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          processFiles(files);
                          e.target.value = '';
                          setShowCacheHistory(false);
                        }
                      }}
                      accept="audio/*,video/*"
                    />
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search analysis history..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-3">
                  {cacheKeys.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <Clock size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">No history found</p>
                      <p className="text-sm">Upload a file to start analyzing</p>
                    </div>
                  ) : (
                    cacheKeys
                      .filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort().reverse().map(key => {
                        const name = key.replace('gemini_analysis_', '');
                        const isActive = activeFile?.file?.name === name; // Simple check by name

                        return (
                          <div
                            key={key}
                            className={`
                              group flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all
                              ${isActive
                                ? 'bg-indigo-50 border-indigo-200 shadow-md shadow-indigo-100'
                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}
                            `}
                            onClick={() => loadCache(key)}
                          >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <div className={`p-3 rounded-xl ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {isActive ? <Check size={20} /> : <BookOpen size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-base font-bold truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{name}</p>
                                <p className={`text-xs font-medium mt-0.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                                  {isActive ? 'CURRENTLY ACTIVE' : 'CACHED VERSION'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-4 border-l border-slate-100/50 ml-4">
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteCache(key); }}
                                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Delete Analysis"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}

                  {cacheKeys.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-slate-200/50">
                      <button
                        onClick={clearAllCache}
                        className="w-full py-4 text-slate-500 font-bold hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} /> Clear All History
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default App;
