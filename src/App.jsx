import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, memo } from 'react';
import {
  Play, Pause, Rewind, FastForward,
  Eye, EyeOff, Languages, List, Search, Upload,
  Gauge, Repeat, Volume2, VolumeX, Info, Settings,
  X, Check, AlertCircle, BookOpen, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, FileAudio, FileVideo, Plus, Trash2,
  SkipBack, SkipForward, Clock, History, MoreVertical, XCircle, Home
} from 'lucide-react';
import { analyzeMedia } from './services/gemini';
import { mediaStore } from './utils/MediaStore';

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

  // 1. Force Auto-Scroll on Active Change (Always Top)
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  }, [isActive]);

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
        group relative transition-all duration-300 ease-out border-b border-slate-50 mb-4 pt-4 pb-6 scroll-mt-24 
        ${isActive ? 'border-l-[4px] border-l-purple-600 bg-transparent' : 'bg-transparent active:bg-slate-50'}
      `}
    >

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
              ${isActive ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}
            `}
          >
            <Play size={10} fill="currentColor" /> {item.timestamp}
          </button>
        </div>
        <div
          onClick={() => jumpToSentence(idx)}
          className={`
            text-xl sm:text-2xl md:text-3xl leading-relaxed cursor-pointer transition-all duration-300 mb-2 px-1
            ${isActive ? 'text-purple-600 font-bold' : 'text-slate-900 font-medium'}
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




  // Helper: Parse HH:MM:SS.ms or MM:SS.ms or total seconds to float
  const parseTime = (timeStr) => {
    if (!timeStr) return 0.0;
    if (typeof timeStr === 'number') return timeStr;

    // Remove brackets, spaces, and other non-time characters
    const cleanStr = timeStr.toString().replace(/[\[\]\s\r\n\t]/g, '').trim();

    // Split by colons
    const parts = cleanStr.split(':');

    try {
      if (parts.length === 3) {
        // HH:MM:SS.ms
        const hours = parseFloat(parts[0]) || 0;
        const minutes = parseFloat(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return (hours * 3600) + (minutes * 60) + seconds;
      } else if (parts.length === 2) {
        // MM:SS.ms
        const minutes = parseFloat(parts[0]) || 0;
        const seconds = parseFloat(parts[1]) || 0;
        return (minutes * 60) + seconds;
      } else if (parts.length === 1) {
        // SS.ms or total seconds
        return parseFloat(parts[0]) || 0;
      }
    } catch (e) {
      console.error("Error parsing time string:", timeStr, e);
    }

    return 0.0;
  };

  // Helper: Sanitize & Sort Data
  // Helper: Sanitize & Sort Data
  const sanitizeData = (data) => {
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data);
      return [];
    }
    return data
      .filter(item => item && typeof item === 'object') // Filter null/non-objects
      .map(item => {
        // Map shortened keys back to original keys if present
        const timestamp = item.s || item.timestamp;
        const secondsValue = item.v !== undefined ? item.v : item.seconds;
        const endValue = item.e !== undefined ? item.e : item.endSeconds;
        let text = item.o || item.text || "(No text)";
        const translation = item.t || item.translation || "";

        // FILTER: Remove non-verbal elements like (music), (applause), etc.
        text = text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

        // Handle patterns
        let patterns = item.p || item.patterns || [];
        if (Array.isArray(patterns)) {
          patterns = patterns.map(p => ({
            term: p.t || p.term || "",
            definition: p.d || p.definition || ""
          }));
        }

        // Handle words
        let words = item.w || item.words || [];
        if (Array.isArray(words)) {
          words = words.map(w => ({
            word: w.w || w.word || "",
            meaning: w.m || w.meaning || "",
            func: w.f || w.func || ""
          }));
        }

        // STICKY RULE: Numeric Precision at Load Time
        let seconds = 0;
        if (typeof secondsValue === 'number') {
          seconds = secondsValue;
        } else if (typeof timestamp === 'string') {
          seconds = parseTime(timestamp);
        }
        seconds = isNaN(seconds) ? 0 : seconds;

        let endSeconds = seconds + 3.0; // Default gap-fill: 3s
        if (typeof endValue === 'number') {
          endSeconds = endValue;
        }

        // DEDUPLICATION FIX: Never drop items. If text is empty, provide a placeholder.
        if (!text || text.trim() === "" || text === "(No text)") {
          text = "(연주중 / 반주 구간)";
        }

        return {
          timestamp,
          seconds,
          endSeconds,
          text,
          translation,
          patterns,
          words,
          isAnalyzed: !!(item.p || item.patterns || item.w || item.words)
        };
      })
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

  const deleteCache = async (key) => {
    if (confirm('Delete this cached transcript?')) {
      const cachedStr = localStorage.getItem(key);
      if (cachedStr) {
        try {
          const parsed = JSON.parse(cachedStr);
          const metadata = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed.metadata : null;
          if (metadata && metadata.name && metadata.size) {
            await mediaStore.deleteFile(metadata.name, metadata.size);
          }
        } catch (e) {
          console.error("Failed to delete media file from store:", e);
        }
      }
      localStorage.removeItem(key);
      setCacheKeys(prev => prev.filter(k => k !== key));
    }
  };

  const clearAllCache = async () => {
    const count = cacheKeys.length;
    if (confirm(`Clear all ${count} cached analysis files?`)) {
      cacheKeys.forEach(k => localStorage.removeItem(k));
      await mediaStore.clearAll();
      setCacheKeys([]);
      alert("All cache cleared!");
    }
  };

  const loadCache = async (key) => {
    // FORCE RESET
    resetPlayerState();
    setIsSwitchingFile(true);

    const cachedStr = localStorage.getItem(key);
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr);
        // Handle new format {data, metadata} vs legacy format [items...]
        const hasMetadata = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data;
        const rawData = hasMetadata ? parsed.data : parsed;
        const metadata = hasMetadata ? parsed.metadata : { name: key.replace('gemini_analysis_', '').replace(/_\d+$/, '') };

        const data = sanitizeData(rawData);

        // Try to find a matching file already uploaded
        // We match by name and size if available
        let matchingFile = null;
        if (hasMetadata && metadata.size) {
          matchingFile = files.find(f => f.file.name === metadata.name && f.file.size === metadata.size);
        } else {
          // Fallback to name only
          matchingFile = files.find(f => f.file.name === metadata.name);
        }

        let mediaBlob = null;
        let mediaUrl = matchingFile ? matchingFile.url : null;

        // Try to load from MediaStore if not already in memory
        if (!mediaUrl && metadata.name && metadata.size) {
          try {
            mediaBlob = await mediaStore.getFile(metadata.name, metadata.size);
            if (mediaBlob) {
              mediaUrl = URL.createObjectURL(mediaBlob);
            }
          } catch (e) {
            console.error("Failed to load media from store:", e);
          }
        }

        const id = 'cached-' + Date.now();
        const name = metadata.name;

        const newFileEntry = {
          id,
          file: matchingFile ? matchingFile.file : { name, type: metadata.type || 'video/unknown', size: metadata.size },
          data,
          url: mediaUrl,
          isAnalyzing: false,
          isFromCache: true
        };

        setFiles(prev => [...prev, newFileEntry]);
        setActiveFileId(id);
        setShowSettings(false);
        setShowCacheHistory(false);
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


  // UNIFIED CRITICAL FIX: Identify Active Item (Stateless Engine)
  const findActiveIndex = useCallback((time, data) => {
    if (!data || data.length === 0) return 0;

    // FORCED NUMERIC SYNC: Find the latest segment where start time <= current time
    let activeIdx = 0;
    let maxStartTime = -1;

    for (let i = 0; i < data.length; i++) {
      const segmentTime = data[i].seconds;
      if (segmentTime <= time && segmentTime > maxStartTime) {
        maxStartTime = segmentTime;
        activeIdx = i;
      }
    }

    return activeIdx;
  }, []);

  // Stateless Sync Engine (High-Res Event Listening)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeFile?.data) return;

    v.loop = loopingSentenceIdxRef.current === null;

    const runSync = () => {
      const now = v.currentTime;
      setCurrentTime(now);

      // STICKY LOOKUP: Stateless search for the latest started item
      const newIdx = findActiveIndex(now, activeFile.data);

      if (newIdx !== activeIdxRef.current) {
        activeIdxRef.current = newIdx;
        setActiveSentenceIdx(newIdx);
      }

      // Standard Loop Logic
      const loopIdx = loopingSentenceIdxRef.current;
      if (loopIdx !== null) {
        const item = activeFile.data[loopIdx];
        if (item) {
          const start = Math.max(0, item.seconds - BUFFER_SECONDS);
          const end = (loopIdx < activeFile.data.length - 1)
            ? activeFile.data[loopIdx + 1].seconds + BUFFER_SECONDS
            : v.duration + BUFFER_SECONDS;

          if (now >= end - 0.1 || v.ended) {
            v.currentTime = start;
            v.play().catch(() => { });
          }
        }
      }
    };

    v.addEventListener('timeupdate', runSync);

    return () => {
      v.removeEventListener('timeupdate', runSync);
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
      const currentIdx = activeSentenceIdx; // Use the globally calculated active index

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
    activeIdxRef.current = -1; // CRITICAL: Reset the ref so the engine detects the first update
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
          const parsed = JSON.parse(cached);
          const rawData = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed.data : parsed;
          const data = sanitizeData(rawData);
          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false, isFromCache: true } : p));
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
            const cacheData = {
              data: data,
              metadata: {
                name: fItem.file.name,
                size: fItem.file.size,
                type: fItem.file.type,
                lastModified: fItem.file.lastModified,
                savedAt: Date.now()
              }
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          } catch (e) {
            console.warn("Quota exceeded or failed to save to localStorage", e);
          }

          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));

          // Save media to store after successful analysis
          try {
            await mediaStore.saveFile(fItem.file);
          } catch (storageError) {
            console.warn("Failed to save media file to store", storageError);
          }
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

      {/* Header - Now Sticky & Compact */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 flex-none h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6">
        {/* Left: Home Button (Back to Upload) */}
        <button
          onClick={() => {
            setFiles([]);
            setActiveFileId(null);
            resetPlayerState();
          }}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          title="Go to Home"
        >
          <Home size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="relative">
            <button
              onClick={() => setShowCacheHistory(true)}
              className="w-full text-center px-4 py-1.5 hover:bg-slate-50 rounded-xl transition-colors group"
            >
              {activeFile ? (
                <div className="flex items-center justify-center gap-2 text-slate-900">
                  {/* Icon based on file type */}
                  {activeFile.file.type.startsWith('video') ? (
                    <FileVideo size={16} className={`shrink-0 ${isAnalyzing || isSwitchingFile ? 'text-slate-400 animate-pulse' : 'text-indigo-600'}`} />
                  ) : (
                    <FileAudio size={16} className={`shrink-0 ${isAnalyzing || isSwitchingFile ? 'text-slate-400 animate-pulse' : 'text-indigo-600'}`} />
                  )}

                  <span className={`text-base font-bold truncate group-hover:text-indigo-700 transition-colors ${isAnalyzing || isSwitchingFile ? 'text-slate-500 italic' : ''}`}>
                    {isAnalyzing || isSwitchingFile
                      ? `Analyzing... ${activeFile.file.name}`
                      : activeFile.file.name
                    }
                  </span>
                </div>
              ) : (
                <span className="text-base font-bold text-slate-400">Select File...</span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Settings (Optional shortcut) */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Active File Content */}
        {activeFile ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 w-full overflow-y-auto bg-[#F8FAFC]" onClick={() => { setShowSpeedMenu(false); setShowFileList(false); }}>

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
                        // COMPOSITE KEY: Prevents React from skipping repeated lyrics by using FileID + Index + Time
                        const compositeKey = `${activeFileId}-${idx}-${item.seconds}`;
                        return (
                          <TranscriptItem
                            key={compositeKey}
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

                {/* Left: Video Thumbnail or Recovery UI */}
                <div className="relative bg-black w-[110px] sm:w-[140px] shrink-0 overflow-hidden group border-r border-slate-100 flex items-center justify-center">
                  {mediaUrl ? (
                    <>
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
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center space-y-2">
                      <AlertCircle size={24} className="text-red-400" />
                      <div className="text-[10px] font-bold text-slate-300 leading-tight">
                        원본 파일을<br />찾을 수 없습니다
                      </div>
                      <label className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded cursor-pointer transition-colors">
                        연결하기
                        <input type="file" className="hidden" onChange={(e) => processFiles(e.target.files)} accept="audio/*,video/*" />
                      </label>
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
                  onClick={() => setShowCacheHistory(true)}
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

      {/* Unified File History Modal */}
      {
        showCacheHistory && (
          <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
              <div className="p-3 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearAllCache}
                    className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold"
                  >
                    <Trash2 size={16} /> Clear All History
                  </button>
                </div>
                <button onClick={() => setShowCacheHistory(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                  <X size={24} className="text-slate-400 hover:text-red-500" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                {/* Controls Area */}
                <div className="p-3 sm:p-4 space-y-3">
                  {/* Upload Button */}
                  <div className="relative">
                    <label
                      htmlFor="manager-file-upload"
                      className="flex items-center justify-center gap-3 w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl cursor-pointer shadow-lg shadow-indigo-200 transition-all group"
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
                      className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {
                  /* List - Merged Analyzing & Cached */
                  (() => {
                    const analyzingFiles = files.filter(f => f.isAnalyzing);
                    const filteredCacheKeys = cacheKeys.filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()));

                    if (analyzingFiles.length === 0 && filteredCacheKeys.length === 0) {
                      return (
                        <div className="text-center py-20 text-slate-400">
                          <Clock size={48} className="mx-auto mb-4 opacity-20" />
                          <p className="text-lg font-medium">No history found</p>
                          <p className="text-sm">Upload a file to start analyzing</p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-2">
                        {/* 1. Analyzing Files */}
                        {analyzingFiles.map(f => (
                          <div
                            key={f.id}
                            className="group flex items-center justify-between p-3 rounded-2xl border bg-indigo-50/50 border-indigo-200 shadow-sm"
                          >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 animate-pulse">
                                <FileVideo size={20} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-base font-bold truncate text-indigo-900">{f.file.name}</p>
                                <p className="text-xs font-medium mt-0.5 text-indigo-600 animate-pulse">
                                  Analyzing...
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-4 border-l border-indigo-100 ml-4">
                              <div className="hidden sm:flex items-center gap-2 mr-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                                <span className="text-xs font-bold text-indigo-500">Processing</span>
                              </div>
                              {/* Delete Disabled for analyzing files usually, or cancel? For now, allow remove */}
                              <button
                                onClick={(e) => removeFile(f.id, e)}
                                className="p-2.5 text-indigo-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Cancel Analysis"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* 2. Cached Files */}
                        {filteredCacheKeys
                          .sort().reverse().map(key => {
                            const name = key.replace('gemini_analysis_', '');
                            const isActive = activeFile?.file?.name === name; // Simple check by name

                            return (
                              <div
                                key={key}
                                className={`
                                  group flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all
                                  ${isActive
                                    ? 'bg-indigo-50 border-indigo-200 shadow-md shadow-indigo-100'
                                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}
                                `}
                                onClick={() => loadCache(key)}
                              >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className={`p-2.5 rounded-xl ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
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
                        }
                      </div>
                    );
                  })()
                }

              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default App;
