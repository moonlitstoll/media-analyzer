import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Play, Pause, Rewind, FastForward,
  Eye, EyeOff, Languages, List, Search, Upload,
  Gauge, Repeat, Volume2, VolumeX, Info, Settings,
  X, Check, AlertCircle, BookOpen, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, FileAudio, FileVideo, Plus, Trash2,
  SkipBack, SkipForward, Clock, History, MoreVertical, XCircle
} from 'lucide-react';
import { analyzeMedia } from './services/gemini';




const TranscriptItem = memo(({
  item, idx, isActive, isGlobalLooping,
  seekTo, jumpToSentence, toggleLoop,
  onPrev, onNext,
  isLooping, showAnalysis, toggleGlobalAnalysis,
  showTranslations, // New prop
  onQuickSync
}) => {
  const itemRef = useRef(null);

  useEffect(() => {
    if (isActive && itemRef.current && !isGlobalLooping) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isActive, isGlobalLooping, showAnalysis]);

  return (
    <div
      ref={itemRef}
      className={`
        group relative transition-all duration-300 ease-out rounded-2xl border mb-3 scroll-mt-32
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

      <div className="p-3 sm:p-4">
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
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      ...item,
      seconds: typeof item.seconds === 'number' ? item.seconds : parseTime(item.timestamp)
    })).sort((a, b) => a.seconds - b.seconds);
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
        alert(`Loaded analysis for: ${name}\nNote: Media playback requires re-selecting the file.`);
      } catch (e) {
        console.error("Failed to load cache:", e);
        alert("Failed to load cached data.");
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

  // File Handling
  const processFiles = async (fileList) => {
    setIsDragging(false);
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      url: URL.createObjectURL(f),
      data: [],
      isAnalyzing: true,
      error: null
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // If no active file, set first new one
    if (!activeFileId && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    } else if (files.length === 0 && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }

    newFiles.forEach(async (fItem) => {
      try {
        if (!apiKey) throw new Error("Please set Gemini API Key in Settings.");

        // --- CACHE CHECK ---
        const cacheKey = `gemini_analysis_${fItem.file.name}_${fItem.file.size}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          console.log("Using cached analysis for", fItem.file.name);
          const rawData = JSON.parse(cached);
          const data = sanitizeData(rawData); // Sort & Sanitize
          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));
        } else {
          // No cache -> Call API
          const rawData = await analyzeMedia(fItem.file, apiKey);
          const data = sanitizeData(rawData); // Sort & Sanitize BEFORE CACHING

          // Save to Cache (Sorted)
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {
            console.warn("Quota exceeded or failed to save to localStorage", e);
          }

          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));
        }
      } catch (err) {
        console.error("Analysis Error", err);
        setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, error: err.message, isAnalyzing: false } : p));
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

        {/* Cache History Popup */}
        {showCacheHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in duration-300 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><History size={20} /> Analysis History</h3>
                <button onClick={() => setShowCacheHistory(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto mb-3 pr-1 bg-slate-50/50 rounded-lg p-1">
                {cacheKeys.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No history found.</p>
                ) : (
                  cacheKeys.map(key => {
                    const name = key.replace('gemini_analysis_', '').replace(/_\d+$/, '');
                    return (
                      <div
                        key={key}
                        onClick={() => loadCache(key)}
                        className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer group/item"
                      >
                        <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-4">{name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCache(key); }}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {cacheKeys.length > 0 && (
                <button onClick={clearAllCache} className="w-full py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                  <Trash2 size={14} /> Clear History
                </button>
              )}
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

      {/* Header - Non-fixed, scrolls with page */}
      <header className="flex-none bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
            <Volume2 size={18} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 hidden sm:block">MediaSmart</h1>
        </div>

        {/* Center: File List Popup Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowFileList(!showFileList)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors max-w-[200px]"
          >
            {activeFile ? (
              <>
                {activeFile.file.type.startsWith('video') ? <FileVideo size={14} className="text-indigo-600" /> : <FileAudio size={14} className="text-indigo-600" />}
                <span className="text-sm font-bold text-slate-700 truncate">{activeFile.file.name}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </>
            ) : (
              <span className="text-sm text-slate-500">Select File...</span>
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

        <div className="flex items-center gap-2">
          {/* Cache History Button */}
          <button
            onClick={() => setShowCacheHistory(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="History"
          >
            <History size={20} />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Active File Content */}
        {activeFile ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 w-full overflow-y-auto bg-[#F8FAFC]" onClick={() => { setShowSpeedMenu(false); setShowFileList(false); }}>
              <div className="max-w-6xl mx-auto px-2 py-4 md:p-6 pb-32">
                {isAnalyzing ? (
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
                  <div className="space-y-4">
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
                          isGlobalLooping={loopingSentenceIdx !== null}
                          showAnalysis={showAnalysis}
                          showTranslations={showTranslations}
                          toggleGlobalAnalysis={() => setShowAnalysis(!showAnalysis)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Bottom Player Controls (Sticky Bottom) */}
            <div className="flex-none bg-white border-t border-slate-200 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-row h-[80px] items-stretch">
                  {/* Video (Square, Left) */}
                  <div className="relative bg-black h-full aspect-square flex-shrink-0 border-r border-slate-100 group">
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

                  {/* Controls (Right, Flex Column) */}
                  <div className="flex-1 px-4 py-2 flex flex-col justify-center gap-1.5 min-w-0 bg-white relative">

                    {/* Row 1: Time & Progress */}
                    <div className="flex items-center gap-3 text-[11px] font-mono font-bold text-slate-500">
                      <span className="w-10 shrink-0 text-indigo-600">
                        {new Date(Math.max(0, currentTime) * 1000).toISOString().substr(14, 5)}
                      </span>

                      <div
                        className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden cursor-pointer group relative"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          seekTo(((e.clientX - rect.left) / rect.width) * videoRef.current.duration);
                        }}
                      >
                        <div className="absolute inset-0 w-full h-full hover:bg-slate-200/50 transition-colors" />
                        <div
                          className="h-full bg-indigo-500 rounded-full relative group-hover:bg-indigo-600 transition-colors"
                          style={{ width: `${videoRef.current?.duration ? (currentTime / videoRef.current.duration) * 100 : 0}%` }}
                        />
                      </div>

                      <span className="w-10 shrink-0 text-right">{videoRef.current?.duration ? new Date(videoRef.current.duration * 1000).toISOString().substr(14, 5) : "00:00"}</span>
                    </div>

                    {/* Row 2: Main Buttons (Responsive & Spaced) */}
                    <div className="flex items-center justify-evenly mt-2 gap-1 sm:gap-2">

                      {/* 1. Speed Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                          className={`
                            flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-w-[55px] sm:min-w-[65px]
                            ${showSpeedMenu ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}
                          `}
                        >
                          <Gauge size={14} /> {playbackRate.toFixed(1)}x
                        </button>

                        {showSpeedMenu && (
                          <div className="absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-2xl border border-indigo-50 p-3 z-[60] animate-in slide-in-from-bottom-2 duration-200 w-48 sm:w-56">
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[10px] font-bold text-slate-400 capitalize">Playback Speed</span>
                              <span className="text-xs font-mono font-bold text-indigo-600">{playbackRate.toFixed(1)}x</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0].map(rate => (
                                <button
                                  key={rate}
                                  onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                  className={`
                                    py-2 text-center rounded-lg text-xs font-bold transition-all
                                    ${Math.abs(playbackRate - rate) < 0.01
                                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                      : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}
                                  `}
                                >
                                  {rate.toFixed(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Hide Translation (Eye) */}
                      <button
                        onClick={() => setShowTranslations(!showTranslations)}
                        className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 ${showTranslations ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                        title={showTranslations ? "Hide Translations" : "Show Translations"}
                      >
                        {showTranslations ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>

                      {/* 3. Prev */}
                      <button
                        onClick={() => handlePrev(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                        className="p-1 sm:p-2 text-slate-400 hover:text-indigo-600 active:scale-75 transition-all"
                      >
                        <SkipBack size={24} />
                      </button>

                      {/* 4. Play/Pause (Largest) */}
                      <button
                        onClick={togglePlay}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-90 transition-all"
                      >
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                      </button>

                      {/* 5. Next */}
                      <button
                        onClick={() => handleNext(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                        className="p-1 sm:p-2 text-slate-400 hover:text-indigo-600 active:scale-75 transition-all"
                      >
                        <SkipForward size={24} />
                      </button>

                      {/* 6. Sentence Loop (Repeat) */}
                      <button
                        onClick={() => {
                          if (currentSentenceIdx !== -1) {
                            toggleLoop(currentSentenceIdx);
                          }
                        }}
                        className={`
                          p-2 sm:p-2.5 rounded-xl transition-all active:scale-95
                          ${loopingSentenceIdx !== null ? 'bg-amber-100 text-amber-600 shadow-sm' : 'text-slate-400 hover:bg-slate-100'}
                        `}
                        title="Loop Current Sentence"
                      >
                        <Repeat size={20} className={loopingSentenceIdx !== null ? 'animate-spin-slow' : ''} />
                      </button>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
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
      )}

      {/* Cache History Modal */}
      {showCacheHistory && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-xl">
                  <History size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Analysis History</h2>
                  <p className="text-xs text-slate-500 font-medium">Load previous analysis results</p>
                </div>
              </div>
              <button onClick={() => setShowCacheHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cacheKeys.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <Clock size={40} className="mx-auto mb-4 opacity-20" />
                  <p>No cached analysis found.</p>
                </div>
              ) : (
                cacheKeys.sort().reverse().map(key => {
                  const name = key.replace('gemini_analysis_', '');
                  return (
                    <div
                      key={key}
                      className="group flex items-center justify-between p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-2xl transition-all cursor-pointer"
                      onClick={() => loadCache(key)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-white rounded-lg shadow-sm group-hover:text-indigo-600">
                          <BookOpen size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">CACHED VERSION</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={clearAllCache}
                className="w-full py-3 bg-white hover:bg-red-50 hover:text-red-600 text-slate-500 font-bold rounded-2xl border border-slate-200 hover:border-red-100 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 size={16} /> Clear All History
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
