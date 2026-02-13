import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, Rewind, FastForward,
  Eye, EyeOff, Languages, List, Search, Upload,
  Gauge, Repeat, Volume2, VolumeX, Info, Settings,
  X, Check, AlertCircle, BookOpen, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, FileAudio, FileVideo, Plus, Trash2,
  SkipBack, SkipForward, Clock, History, MoreVertical, XCircle
} from 'lucide-react';
import { analyzeMedia } from './services/gemini';




const TranscriptItem = ({
  item, idx, isActive, isGlobalLooping,
  seekTo, jumpToSentence, toggleLoop,
  onPrev, onNext,
  isLooping, showAnalysis, toggleGlobalAnalysis
}) => {
  const itemRef = useRef(null);

  useEffect(() => {
    // Scroll to START (top) of the view
    if (isActive && itemRef.current && !isGlobalLooping) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isActive, isGlobalLooping, showAnalysis]);

  return (
    <div
      ref={itemRef}
      className={`
        group relative transition-all duration-300 ease-out rounded-2xl border mb-3
        ${isActive
          ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-500/20'
          : 'bg-white/80 border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-slate-100/50 hover:bg-white'}
      `}
    >
      {/* Active Indicator */}
      <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all duration-300 ${isActive ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-200'}`} />

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

          {/* Control Group */}
          <div className={`flex items-center gap-1 transition-opacity duration-200 ${isActive || isLooping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>

            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
              title="Previous Sentence"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleLoop(idx); }}
              className={`p-2 rounded-full transition-all ${isLooping ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-200' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
              title="Repeat Sentence"
            >
              <Repeat size={16} />
            </button>

            <button
              onClick={() => jumpToSentence(idx)}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
              title="Play from here"
            >
              <Play size={16} fill={isActive ? "currentColor" : "none"} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
              title="Next Sentence"
            >
              <ChevronRight size={16} />
            </button>

          </div>
        </div>

        {/* Main Text */}
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

          {/* Explanation */}
          {/* Translation (Replaces Explanation) */}
          {item.translation && (
            <div className="bg-indigo-50/80 rounded-xl p-3 border border-indigo-100 mb-4">
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
};

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('miniapp_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  // Multi-file state
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);

  // Player state
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [loopingSentenceIdx, setLoopingSentenceIdx] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // UI state
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showCacheHistory, setShowCacheHistory] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const [cacheKeys, setCacheKeys] = useState([]);


  const videoRef = useRef(null);
  const loopingSentenceIdxRef = useRef(null);

  // Derived active file
  const activeFile = files.find(f => f.id === activeFileId);
  const transcriptData = activeFile?.data || [];
  const mediaUrl = activeFile?.url || null;
  const isAnalyzing = activeFile?.isAnalyzing || false;

  // Derived current sentence index
  const currentSentenceIdx = useMemo(() => {
    if (!transcriptData || transcriptData.length === 0) return -1;
    const adjustedNow = currentTime;
    return transcriptData.findIndex((item, idx) =>
      adjustedNow >= item.seconds && (idx === transcriptData.length - 1 || adjustedNow < transcriptData[idx + 1].seconds)
    );
  }, [transcriptData, currentTime]);

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
        const data = JSON.parse(cachedData);
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
        seekTo(Math.max(0, activeFile.data[index].seconds - 1.0));
      }
    }
  }, [loopingSentenceIdx, seekTo, activeFile]);

  const jumpToSentence = useCallback((index) => {
    if (activeFile?.data && index >= 0 && index < activeFile.data.length) {
      setLoopingSentenceIdx(null);
      seekTo(Math.max(0, activeFile.data[index].seconds - 1.0));
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


  // Time & Loop Logic
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeFile?.data) return;

    // Auto loop the whole video only if no sentence is being looped
    v.loop = loopingSentenceIdxRef.current === null;

    const update = () => {
      const now = v.currentTime;
      setCurrentTime(now);

      const activeIdx = loopingSentenceIdxRef.current;
      const data = activeFile.data;

      if (activeIdx !== null && data.length > 0) {
        const start = data[activeIdx].seconds;
        const end = activeIdx < data.length - 1 ? data[activeIdx + 1].seconds : v.duration;
        if (now >= end - 0.1) {
          // Loop restart with -1.0s offset
          v.currentTime = Math.max(0, start - 1.0);
          v.play();
        }
      }
    };
    v.addEventListener('timeupdate', update);
    v.addEventListener('play', () => setIsPlaying(true));
    v.addEventListener('pause', () => setIsPlaying(false));
    v.addEventListener('ended', () => {
      // Handle the case where the video ends and we need to loop manually if native loop was off
      if (loopingSentenceIdxRef.current !== null) {
        const activeIdx = loopingSentenceIdxRef.current;
        const data = activeFile.data;
        if (data[activeIdx]) {
          v.currentTime = Math.max(0, data[activeIdx].seconds - 1.0);
          v.play();
        }
      } else {
        // Global loop if native loop was off for some reason
        v.currentTime = 0;
        v.play();
      }
    });

    return () => {
      v.removeEventListener('timeupdate', update);
      v.removeEventListener('play', null);
      v.removeEventListener('pause', null);
      v.removeEventListener('ended', null);
    };
  }, [mediaUrl, activeFile]);

  // Rate
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!mediaUrl || !activeFile?.data?.length) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }

      const now = videoRef.current ? videoRef.current.currentTime : 0;
      const data = activeFile.data;
      const currentIdx = data.findIndex((item, idx) =>
        now >= item.seconds && (idx === data.length - 1 || now < data[idx + 1].seconds)
      );

      switch (e.code) {
        case 'Enter': if (currentIdx !== -1) toggleLoop(currentIdx); break;
        case 'ArrowLeft':
          if (data.length > 0) {
            const idx = currentIdx !== -1 ? currentIdx : 0;
            const prevIdx = (idx - 1 + data.length) % data.length;
            jumpToSentence(prevIdx);
          }
          break;
        case 'ArrowRight':
          if (data.length > 0) {
            const idx = currentIdx !== -1 ? currentIdx : 0;
            const nextIdx = (idx + 1) % data.length;
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
          const data = JSON.parse(cached);
          setFiles(prev => prev.map(p => p.id === fItem.id ? { ...p, data: data, isAnalyzing: false } : p));
        } else {
          // No cache -> Call API
          const data = await analyzeMedia(fItem.file, apiKey);

          // Save to Cache
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
                    <span className="w-10 shrink-0">{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>

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

                  {/* Row 2: Main Buttons (Centered) */}
                  <div className="flex items-center justify-between mt-2 px-1 gap-2">

                    {/* 1. Speed Button */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-all min-w-[70px]"
                      >
                        {playbackRate.toFixed(1)}x
                      </button>

                      {showSpeedMenu && (
                        <div className="absolute bottom-full left-0 mb-3 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-[60] animate-in zoom-in-95 duration-200 min-w-[150px]">
                          <div className="grid grid-cols-3 gap-1">
                            {[0.5, 0.8, 1.0, 1.2, 1.5, 2.0].map(rate => (
                              <button
                                key={rate}
                                onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                className={`px-1 py-1.5 text-center rounded-lg text-xs font-bold transition-colors ${Math.abs(playbackRate - rate) < 0.01 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Toggle Analysis (Eye) */}
                    <button
                      onClick={() => setShowAnalysis(!showAnalysis)}
                      className={`p-2.5 rounded-xl transition-all ${showAnalysis ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                      title={showAnalysis ? "Hide Analysis" : "Show Analysis"}
                    >
                      {showAnalysis ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>

                    {/* 3. Prev */}
                    <button
                      onClick={() => handlePrev(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                      className="p-2 text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform"
                    >
                      <SkipBack size={24} />
                    </button>

                    {/* 4. Play/Pause */}
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                    >
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>

                    {/* 5. Next */}
                    <button
                      onClick={() => handleNext(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                      className="p-2 text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform"
                    >
                      <SkipForward size={24} />
                    </button>

                    {/* 6. Repeat */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLoop(currentSentenceIdx !== -1 ? currentSentenceIdx : 0); }}
                      className={`p-2 rounded-xl transition-all ${loopingSentenceIdx !== null ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-200' : 'text-slate-400 hover:text-indigo-600'}`}
                      title="Repeat Sentence"
                    >
                      <Repeat size={20} />
                    </button>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-slate-400">Select a file to view</div>
      )}
    </div>
  </div>
);
};

export default App;
