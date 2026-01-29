import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, Rewind, FastForward,
  Eye, EyeOff, Languages, List, Search, Upload,
  Gauge, Repeat, Volume2, VolumeX, Info, Settings,
  X, Check, AlertCircle, BookOpen, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Download, FileAudio, FileVideo, Plus, Trash2,
  SkipBack, SkipForward
} from 'lucide-react';
import { analyzeMedia } from './services/gemini';

// --- HTML Generation Logic ---
const generateHTML = (data, filename, mediaDataUrl) => {
  // Safe JSON embedding
  const safeJson = JSON.stringify(data).replace(/<\/script>/g, '<\\/script>');

  // Use a unique ID for the data script to avoid collisions
  const SCRIPT_ID = 'transcript-data-' + Math.random().toString(36).substr(2, 9);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename} - MediaSmart Analysis</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { background-color: #F8FAFC; color: #1e293b; }
    </style>
</head>
<body class="font-sans h-screen flex flex-col overflow-hidden">
    
    <!-- Header -->
    <header class="h-12 flex-none bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 shadow-sm relative">
        <div class="flex items-center gap-3">
            <div class="bg-indigo-600 text-white p-1.5 rounded-lg">
                <i data-lucide="volume-2" class="w-5 h-5"></i>
            </div>
            <h1 class="text-lg font-bold text-slate-900 hidden sm:block">MediaSmart Export</h1>
        </div>
        <div class="flex items-center gap-3">
           <button id="toggle-analysis-btn" class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 rounded-lg text-sm font-medium transition-all hover:bg-indigo-100">
               <i data-lucide="info" class="w-4 h-4"></i>
               <span class="hidden sm:inline">Show/Hide All Analysis</span>
           </button>
        </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden relative">

        <!-- Top: Player Section (Sticky) -->
        <!-- Top: Player Section (Sticky) -->
        <div class="flex-none bg-white z-10 border-b border-slate-200">
            <div class="max-w-3xl mx-auto">
                <div class="flex flex-row h-[72px] items-stretch">
                    <!-- Video (Square, Left) -->
                    <div class="relative bg-black h-full aspect-square flex-shrink-0 border-r border-slate-100">
                        <video id="main-video" class="absolute inset-0 w-full h-full object-contain" src="${mediaDataUrl}" playsinline loop></video>
                    </div>

                    <!-- Controls (Right, Flex Column) -->
                    <div class="flex-1 px-4 py-2 flex flex-col justify-center gap-1 min-w-0 bg-white">
                         <!-- Row 1: Time & Progress -->
                         <!-- Row 1: Time & Progress -->
                         <div class="flex items-center gap-3 text-[11px] font-mono font-bold text-slate-500">
                            <span id="current-time" class="w-10">00:00</span>
                            
                            <div id="progress-container" class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden cursor-pointer relative group">
                                <div class="absolute inset-0 w-full h-full hover:bg-slate-200/50 transition-colors"></div>
                                <div id="progress-bar" class="h-full bg-indigo-500 rounded-full relative group-hover:bg-indigo-600 transition-colors" style="width: 0%"></div>
                            </div>

                            <span id="duration" class="w-10 text-right">00:00</span>
                         </div>

                         <!-- Row 2: Main Buttons (Centered) -->
                         <!-- Row 2: Main Buttons (Centered) -->
                         <div class="flex items-center justify-between mt-0.5 relative">
                             <!-- Speed Selector (Popup) -->
                             <div class="relative">
                                 <button id="speed-btn" class="flex items-center justify-center gap-2 px-6 py-2 bg-slate-100 rounded-xl text-base font-bold text-slate-700 hover:bg-slate-200 transition-all min-w-[120px]">
                                     <span id="speed-display">1.0x</span>
                                 </button>
                                 <div id="speed-menu" class="hidden absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[120px] grid grid-cols-1 gap-1 z-[60]">
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="0.5">0.5x</button>
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="0.8">0.8x</button>
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="1.0">1.0x (Normal)</button>
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="1.2">1.2x</button>
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="1.5">1.5x</button>
                                     <button class="speed-opt px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-base font-bold text-slate-600" data-val="2.0">2.0x</button>
                                 </div>
                             </div>

                             <!-- Center: Prev - Play - Next -->
                             <div class="flex items-center gap-6">
                                 <button id="prev-btn" class="p-2 text-slate-400 hover:text-indigo-600 active:scale-95 transition-transform"><i data-lucide="chevron-left" class="w-8 h-8"></i></button>
                                 
                                 <button id="play-btn" class="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-95 transition-all">
                                     <i data-lucide="play" class="w-6 h-6 ml-0.5"></i>
                                 </button>
                                 
                                 <button id="next-btn" class="p-2 text-slate-400 hover:text-indigo-600 active:scale-95 transition-transform"><i data-lucide="chevron-right" class="w-8 h-8"></i></button>
                             </div>

                             <!-- Right Spacer / Volume -->
                             <div class="flex items-center gap-3">
                                 <button id="mute-btn" class="text-slate-400 hover:text-indigo-600 transition-colors"><i data-lucide="volume-2" class="w-6 h-6"></i></button>
                                 <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="1" class="w-32 sm:w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600">
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Transcript List -->
        <div class="flex-1 w-full overflow-y-auto relative" id="scroll-container">
            <div id="transcript-list" class="max-w-3xl mx-auto p-4 space-y-4 pb-32">
                <!-- Transcript items injected here -->
            </div>
        </div>

    </div>

    <script id="${SCRIPT_ID}" type="application/json">
        ${safeJson}
    </script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            try {
                // Dependency Check
                function waitForLucide(callback, retries = 20) {
                    if (window.lucide) {
                        callback();
                    } else if (retries > 0) {
                        setTimeout(() => waitForLucide(callback, retries - 1), 100);
                    } else {
                        console.warn('Lucide icons failed to load.');
                        callback();
                    }
                }

                waitForLucide(() => {
                    initApp();
                });

                function initApp() {
                    const dataEl = document.getElementById('${SCRIPT_ID}');
                    if (!dataEl) throw new Error("Transcript data element missing");
                    
                    const transcriptData = JSON.parse(dataEl.textContent);
                    // Use a global state object
                    window.miniapp = {
                        data: transcriptData,
                        openIndices: new Set()
                    };
                    const openAnalysisIndices = window.miniapp.openIndices;
                    let loopingIdx = null;

                    // Elements
                    const video = document.getElementById('main-video');
                    const list = document.getElementById('transcript-list');
                    const scrollContainer = document.getElementById('scroll-container');
                    const playBtn = document.getElementById('play-btn');
                    const progressBar = document.getElementById('progress-bar');
                    const progressContainer = document.getElementById('progress-container');
                    const currentTimeEl = document.getElementById('current-time');
                    const durationEl = document.getElementById('duration');
                    const prevBtn = document.getElementById('prev-btn');
                    const nextBtn = document.getElementById('next-btn');
                    const speedBtn = document.getElementById('speed-btn');
                    const speedMenu = document.getElementById('speed-menu');
                    const speedOpts = document.querySelectorAll('.speed-opt');

                    if(window.lucide) lucide.createIcons();

                    function render() {
                        if (!list) return;
                        // Manual HTML construction using string concatenation to avoid parser errors
                        list.innerHTML = transcriptData.map((item, i) => {
                            var patternsHtml = '';
                            if(item.patterns && item.patterns.length > 0) {
                                patternsHtml = '<div class="mt-3">' +
                                    '<div class="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider mb-2">' +
                                        '<i data-lucide="list" class="w-3 h-3"></i> Patterns' +
                                    '</div>' +
                                    '<div class="space-y-2">' + item.patterns.map(p => 
                                        '<div class="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">' +
                                            '<span class="font-bold text-slate-800 text-base block mb-0.5">' + p.term + '</span>' +
                                            '<span class="text-slate-600 text-sm block">' + p.definition + '</span>' +
                                        '</div>'
                                    ).join('') + '</div>' +
                                '</div>';
                            }
                            
                            var wordsHtml = '';
                            if(item.words && item.words.length > 0) {
                                wordsHtml = '<div class="mt-3">' +
                                    '<div class="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-wider mb-2">' +
                                        '<i data-lucide="book-open" class="w-3 h-3"></i> Words' +
                                    '</div>' +
                                    '<div class="divide-y divide-emerald-100/50 border border-emerald-100/30 rounded-xl overflow-hidden bg-white">' +
                                        item.words.map(w => 
                                            '<div class="p-2.5 flex items-start gap-3 hover:bg-emerald-50/30">' +
                                                '<span class="font-bold text-emerald-700 text-base min-w-[30%]">' + w.word + '</span>' +
                                                '<div class="flex-1">' +
                                                    '<span class="block text-slate-700 text-sm font-medium">' + w.meaning + '</span>' +
                                                    (w.func ? '<span class="block text-slate-400 text-[10px]">' + w.func + '</span>' : '') +
                                                '</div>' +
                                            '</div>'
                                        ).join('') + 
                                    '</div>' +
                                '</div>';
                            }

                            var translationHtml = item.translation ? 
                                '<div class="bg-indigo-50/80 rounded-xl p-4 border border-indigo-100 mb-6">' +
                                    '<div class="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider mb-2"><i data-lucide="languages" class="w-3 h-3"></i> Translation</div>' +
                                    '<p class="text-slate-700 text-base leading-relaxed whitespace-pre-line font-medium">' + item.translation + '</p>' +
                                '</div>' : '';

                            // Check initial state
                            var isOpen = openAnalysisIndices.has(i);
                            // Use inline styles for reliability against Tailwind CDN
                            var analysisStyle = isOpen 
                                ? 'max-height: 2000px; opacity: 1; margin-top: 16px; padding-top: 16px; border-top-width: 1px;' 
                                : 'max-height: 0px; opacity: 0; margin-top: 0px; padding-top: 0px; border-top-width: 0px;';
                            
                            var toggleIcon = isOpen ? 'chevron-up' : 'chevron-down';
                            var toggleColor = isOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50';

                            return '<div id="item-' + i + '" class="group relative bg-white/80 border border-slate-100 rounded-2xl mb-3 transition-all duration-300 p-3 sm:p-4 opacity-60 hover:opacity-100 hover:bg-white hover:shadow-lg">' +
                                '<div class="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-transparent transition-all active-indicator"></div>' +
                                '<div class="flex flex-wrap items-center justify-between gap-3 mb-2">' +
                                    '<div class="flex items-center gap-3">' +
                                        '<button onclick="seekTo(' + item.seconds + ')" class="flex items-center gap-2 px-2 py-1 rounded-full text-sm font-bold font-mono bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all timestamp-btn">' +
                                            '<i data-lucide="play" class="w-3 h-3 fill-current"></i> ' + item.timestamp +
                                        '</button>' +
                                         // Individual Toggle Button
                                        '<button onclick="toggleAnalysis(' + i + ')" id="toggle-btn-' + i + '" class="p-1.5 rounded-lg transition-colors ' + toggleColor + '">' +
                                            '<i data-lucide="' + toggleIcon + '" class="w-4 h-4"></i>' +
                                        '</button>' +
                                    '</div>' +
                                    '<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity controls-group">' +
                                         '<button onclick="handlePrev(' + i + ')" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>' +
                                         '<button onclick="toggleLoop(' + i + ')" id="loop-btn-' + i + '" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><i data-lucide="repeat" class="w-4 h-4"></i></button>' +
                                         '<button onclick="jumpTo(' + i + ')" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><i data-lucide="play" class="w-4 h-4"></i></button>' +
                                         '<button onclick="handleNext(' + i + ')" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>' +
                                    '</div>' +
                                '</div>' +
                                '<div onclick="jumpTo(' + i + ')" class="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed cursor-pointer text-slate-500 hover:text-slate-900 mb-2 main-text transition-colors">' + item.text + '</div>' +
                                '<div id="analysis-' + i + '" class="analysis-section overflow-hidden transition-all duration-500 ease-in-out border-slate-100" style="' + analysisStyle + '">' +
                                    translationHtml +
                                    '<div class="grid md:grid-cols-2 gap-6">' +
                                        patternsHtml +
                                        wordsHtml +
                                    '</div>' +
                                '</div>' +
                            '</div>';
                        }).join('');
                        if(window.lucide) lucide.createIcons();
                    }

                    // Utils
                    function formatTime(s) {
                        return new Date(s * 1000).toISOString().substr(14, 5);
                    }

                    function getCurrentIndex() {
                        if (!video || !transcriptData || transcriptData.length === 0) return -1;
                        const now = video.currentTime;
                        return transcriptData.findIndex((item, i) => 
                            now >= item.seconds && (i === transcriptData.length - 1 || now < transcriptData[i+1].seconds)
                        );
                    }

                    function updateActiveItem() {
                        if (!video || !transcriptData || transcriptData.length === 0) return;
                        const activeIdx = getCurrentIndex();
                        
                        // Loop Logic
                        if (loopingIdx !== null) {
                            const start = transcriptData[loopingIdx].seconds;
                            const end = loopingIdx < transcriptData.length - 1 ? transcriptData[loopingIdx+1].seconds : video.duration;
                            if (video.currentTime >= end - 0.1) {
                                video.currentTime = Math.max(0, start - 1.0);
                                video.play();
                            }
                        }

                        // UI Logic
                        // Using a more efficient way than iterating all items everytime could be better, but acceptable for this size
                        for(let i=0; i<transcriptData.length; i++) {
                            const el = document.getElementById('item-' + i);
                            if (!el) continue;
                            const isAct = i === activeIdx;
                            
                            if(isAct) {
                                el.classList.remove('opacity-60', 'bg-white/80', 'border-slate-100');
                                el.classList.add('bg-white', 'border-indigo-200', 'shadow-xl', 'ring-1', 'ring-indigo-500/20', 'opacity-100');
                                
                                const ind = el.querySelector('.active-indicator'); if(ind) ind.classList.add('bg-indigo-500');
                                const tBtn = el.querySelector('.timestamp-btn'); 
                                if(tBtn) {
                                    tBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
                                    tBtn.classList.remove('bg-slate-100', 'text-slate-500');
                                }
                                const txt = el.querySelector('.main-text');
                                if(txt) {
                                    txt.classList.add('text-slate-900');
                                    txt.classList.remove('text-slate-500');
                                }
                                const ctr = el.querySelector('.controls-group'); if(ctr) ctr.classList.remove('opacity-0');
                                
                                if (loopingIdx === null) {
                                    // Smooth scroll to center if possible, or start
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            } else {
                                el.classList.add('opacity-60', 'bg-white/80', 'border-slate-100');
                                el.classList.remove('bg-white', 'border-indigo-200', 'shadow-xl', 'ring-1', 'ring-indigo-500/20', 'opacity-100');
                                
                                const ind = el.querySelector('.active-indicator'); if(ind) ind.classList.remove('bg-indigo-500');
                                const tBtn = el.querySelector('.timestamp-btn');
                                if(tBtn) {
                                    tBtn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                                    tBtn.classList.add('bg-slate-100', 'text-slate-500');
                                }
                                const txt = el.querySelector('.main-text');
                                if(txt) {
                                    txt.classList.remove('text-slate-900');
                                    txt.classList.add('text-slate-500');
                                }
                                if(loopingIdx !== i) {
                                    const ctr = el.querySelector('.controls-group'); if(ctr) ctr.classList.add('opacity-0');
                                }
                            }
                        }
                    }

                    function updateLoopBtns() {
                        for(let i=0; i<transcriptData.length; i++) {
                            const btn = document.getElementById('loop-btn-' + i);
                            if (!btn) continue;
                            if(loopingIdx === i) {
                                btn.classList.add('bg-orange-100', 'text-orange-600', 'ring-2', 'ring-orange-200');
                                btn.classList.remove('text-slate-400');
                            } else {
                                btn.classList.remove('bg-orange-100', 'text-orange-600', 'ring-2', 'ring-orange-200');
                                btn.classList.add('text-slate-400');
                            }
                        }
                    }

                    // Playback Events
                    if (video) {
                        video.addEventListener('timeupdate', () => {
                            const pct = (video.currentTime / video.duration) * 100 || 0;
                            if(progressBar) progressBar.style.width = pct + '%';
                            if(currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
                            if(durationEl) durationEl.textContent = formatTime(video.duration || 0);
                            updateActiveItem();
                        });
                        
                        video.addEventListener('play', () => {
                            if(playBtn) playBtn.innerHTML = '<i data-lucide="pause" class="w-5 h-5 fill-current"></i>';
                            if(window.lucide) lucide.createIcons();
                        });
                        video.addEventListener('pause', () => {
                            if(playBtn) playBtn.innerHTML = '<i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i>';
                            if(window.lucide) lucide.createIcons();
                        });

                        if(playBtn) playBtn.onclick = () => video.paused ? video.play() : video.pause();
                        if(muteBtn) muteBtn.onclick = () => { video.muted = !video.muted; };
                        if(speedBtn) speedBtn.onclick = () => { if(speedMenu) speedMenu.classList.toggle('hidden'); };
                        if(speedOpts) speedOpts.forEach(opt => {
                            opt.onclick = () => {
                                const val = parseFloat(opt.dataset.val);
                                video.playbackRate = val;
                                if(speedDisplay) speedDisplay.textContent = val + 'x';
                                if(speedMenu) speedMenu.classList.add('hidden');
                            };
                        });
                        const volumeSlider = document.getElementById('volume-slider');
                        if(volumeSlider) volumeSlider.oninput = (e) => {
                             if(video) video.volume = e.target.value;
                        };
                        if(video) video.addEventListener('volumechange', () => {
                             if(volumeSlider) volumeSlider.value = video.volume;
                             if(muteBtn) {
                                 if(video.muted || video.volume === 0) muteBtn.innerHTML = '<i data-lucide="volume-x" class="w-5 h-5"></i>';
                                 else muteBtn.innerHTML = '<i data-lucide="volume-2" class="w-5 h-5"></i>';
                                 if(window.lucide) lucide.createIcons();
                             }
                        });
                        if(speedBtn) speedBtn.onclick = () => { if(speedMenu) speedMenu.classList.toggle('hidden'); };
                        if(speedOpts) speedOpts.forEach(opt => {
                            opt.onclick = () => {
                                const val = parseFloat(opt.dataset.val);
                                video.playbackRate = val;
                                if(speedDisplay) speedDisplay.textContent = val + 'x';
                                if(speedMenu) speedMenu.classList.add('hidden');
                            };
                        });
                        
                        if(progressContainer) progressContainer.onclick = (e) => {
                            const rect = progressContainer.getBoundingClientRect();
                            const pos = (e.clientX - rect.left) / rect.width;
                            video.currentTime = pos * video.duration;
                        };
                    }

                    if(prevBtn) prevBtn.onclick = () => {
                        const idx = getCurrentIndex();
                        if(idx > 0) window.jumpTo(idx - 1);
                    };
                    if(nextBtn) nextBtn.onclick = () => {
                        const idx = getCurrentIndex();
                        if(idx < transcriptData.length - 1) window.jumpTo(idx + 1);
                    };


                    // Global Funcs
                    window.togglePlay = () => {
                        if (video) {
                            if (video.paused) video.play();
                            else video.pause();
                        }
                    };

                    window.seekTo = (s) => { if (video) { video.currentTime = s; video.play(); } };
                    
                    window.jumpTo = (i) => { 
                        if (transcriptData[i] && video) {
                            loopingIdx = null; 
                            window.seekTo(Math.max(0, transcriptData[i].seconds - 1.0)); 
                            updateLoopBtns(); 
                        }
                    };

                    window.toggleLoop = (i) => {
                        if (!video || !transcriptData[i]) return;
                        if(loopingIdx === i) loopingIdx = null;
                        else {
                            loopingIdx = i;
                            video.currentTime = Math.max(0, transcriptData[i].seconds - 1.0);
                            video.play();
                        }
                        updateLoopBtns();
                    };

                    window.handlePrev = (i) => { if(i > 0) window.jumpTo(i-1); };
                    window.handleNext = (i) => { if(i < transcriptData.length-1) window.jumpTo(i+1); };

                    window.toggleAnalysis = (i) => {
                        try {
                            const openIndices = window.miniapp.openIndices;
                            const totalItems = window.miniapp.data.length;
                            const isAllOpen = openIndices.size === totalItems;
                            
                            // If everything is open, we close all. Otherwise, we open all.
                            // This effectively makes every button a "Global Toggle"
                            const shouldOpenAll = !isAllOpen;

                            if (shouldOpenAll) {
                                for(let k=0; k<totalItems; k++) openIndices.add(k);
                            } else {
                                openIndices.clear();
                            }

                            // Update ALL items in DOM
                            window.miniapp.data.forEach((_, idx) => {
                                const el = document.getElementById('analysis-' + idx);
                                const btn = document.getElementById('toggle-btn-' + idx);
                                
                                if (shouldOpenAll) {
                                    if(el) {
                                        el.style.maxHeight = '2000px';
                                        el.style.opacity = '1';
                                        el.style.marginTop = '16px';
                                        el.style.paddingTop = '16px';
                                        el.style.borderTopWidth = '1px';
                                    }
                                    if(btn) {
                                        btn.innerHTML = '<i data-lucide="chevron-up" class="w-4 h-4"></i>';
                                        btn.className = 'p-2 rounded-lg transition-colors text-indigo-600 bg-indigo-50';
                                    }
                                } else {
                                    if(el) {
                                        el.style.maxHeight = '0px';
                                        el.style.opacity = '0';
                                        el.style.marginTop = '0px';
                                        el.style.paddingTop = '0px';
                                        el.style.borderTopWidth = '0px';
                                    }
                                    if(btn) {
                                        btn.innerHTML = '<i data-lucide="chevron-down" class="w-4 h-4"></i>';
                                        btn.className = 'p-2 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 hover:bg-slate-50';
                                    }
                                }
                            });

                            if(window.lucide) {
                                lucide.createIcons();
                            }
                            updateAnalysisState(); // Sync global header button too
                        } catch (e) {
                            console.error(e);
                        }
                    };

                    function updateAnalysisState() {
                         if(analyzeBtn) {
                             const isAllOpen = openAnalysisIndices.size === transcriptData.length;
                             if (isAllOpen) {
                                analyzeBtn.classList.add('bg-indigo-100', 'text-indigo-800');
                             } else {
                                analyzeBtn.classList.remove('bg-indigo-100', 'text-indigo-800');
                             }
                        }
                    }

                    // Keyboard Shortcuts
                    document.addEventListener('keydown', (e) => {
                         // Prevent blocking input fields
                        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                        const activeIdx = getCurrentIndex();

                        if (e.code === 'Space') {
                            e.preventDefault();
                            window.togglePlay();
                        } else if (e.code === 'Enter') {
                            // Loop current active item
                            if (activeIdx !== -1) window.toggleLoop(activeIdx);
                        } else if (e.code === 'ArrowLeft') {
                            if (activeIdx !== -1 && activeIdx > 0) window.jumpTo(activeIdx - 1);
                            else if (activeIdx === -1 && transcriptData.length > 0) window.jumpTo(0);
                        } else if (e.code === 'ArrowRight') {
                            if (activeIdx !== -1 && activeIdx < transcriptData.length - 1) window.jumpTo(activeIdx + 1);
                             else if (activeIdx === -1 && transcriptData.length > 0) window.jumpTo(0);
                        } else if (e.code === 'ArrowUp') {
                            e.preventDefault();
                            if(video) video.volume = Math.min(1, video.volume + 0.1);
                        } else if (e.code === 'ArrowDown') {
                            e.preventDefault();
                            if(video) video.volume = Math.max(0, video.volume - 0.1);
                        }
                    });

                    if(analyzeBtn) {
                        analyzeBtn.onclick = () => {
                            const isAllOpen = openAnalysisIndices.size === transcriptData.length;
                            
                            if (isAllOpen) {
                                // Close all
                                openAnalysisIndices.clear();
                            } else {
                                // Open all
                                for(let i=0; i<transcriptData.length; i++) openAnalysisIndices.add(i);
                            }
                            // Re-render essentially to update all classes at once or simple loop
                            transcriptData.forEach((_, i) => {
                                // Manually update each one to sync state
                                const el = document.getElementById('analysis-' + i);
                                const btn = document.getElementById('toggle-btn-' + i);
                                if(openAnalysisIndices.has(i)) {
                                    if(el) {
                                        el.style.maxHeight = '2000px';
                                        el.style.opacity = '1';
                                        el.style.marginTop = '16px';
                                        el.style.paddingTop = '16px';
                                        el.style.borderTopWidth = '1px';
                                    }
                                    if(btn) {
                                        btn.innerHTML = '<i data-lucide="chevron-up" class="w-4 h-4"></i>';
                                        btn.className = 'p-2 rounded-lg transition-colors text-indigo-600 bg-indigo-50';
                                    }
                                } else {
                                    if(el) {
                                        el.style.maxHeight = '0px';
                                        el.style.opacity = '0';
                                        el.style.marginTop = '0px';
                                        el.style.paddingTop = '0px';
                                        el.style.borderTopWidth = '0px';
                                    }
                                    if(btn) {
                                        btn.innerHTML = '<i data-lucide="chevron-down" class="w-4 h-4"></i>';
                                        btn.className = 'p-2 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 hover:bg-slate-50';
                                    }
                                }
                            });
                             if(window.lucide) lucide.createIcons();
                             updateAnalysisState();
                        };
                    }

                    // Kickoff
                    render();
                    updateAnalysisState();
                }

            } catch (err) {
                console.error("Critical Application Error:", err);
                alert("App Error: " + err.message);
            }
        });
    </script>
</body>
</html>`;
};


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
  }, [isActive, isGlobalLooping]);

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
  const [volume, setVolume] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [loopingSentenceIdx, setLoopingSentenceIdx] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // UI state
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
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
    return transcriptData.findIndex((item, idx) =>
      currentTime >= item.seconds && (idx === transcriptData.length - 1 || currentTime < transcriptData[idx + 1].seconds)
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
    if (showSettings) {
      setCacheKeys(Object.keys(localStorage).filter(k => k.startsWith('gemini_analysis_')));
    }
  }, [showSettings]);

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

  // Media Controls
  const seekTo = useCallback((s) => {
    if (videoRef.current) {
      videoRef.current.currentTime = s;
      videoRef.current.play();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  }, []);

  const toggleLoop = useCallback((index) => {
    if (loopingSentenceIdx === index) {
      setLoopingSentenceIdx(null);
    } else {
      setLoopingSentenceIdx(index);
      if (activeFile?.data?.[index]) {
        // Adjusted offset to -1.0s
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
    if (currentIndex > 0) jumpToSentence(currentIndex - 1);
  }, [jumpToSentence]);

  const handleNext = useCallback((currentIndex) => {
    if (activeFile?.data && currentIndex < activeFile.data.length - 1) jumpToSentence(currentIndex + 1);
  }, [jumpToSentence, activeFile]);


  // Time & Loop Logic
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeFile?.data) return;

    // Auto loop the whole video
    v.loop = true;

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
    return () => {
      v.removeEventListener('timeupdate', update);
      v.removeEventListener('play', null);
      v.removeEventListener('pause', null);
    };
  }, [mediaUrl, activeFile]);

  // Rate & Volume
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; }, [volume]);

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
        case 'ArrowLeft': handlePrev(currentIdx); break;
        case 'ArrowRight': handleNext(currentIdx); break;
        case 'ArrowUp': e.preventDefault(); setVolume(v => Math.min(v + 0.1, 1)); break;
        case 'ArrowDown': e.preventDefault(); setVolume(v => Math.max(v - 0.1, 0)); break;
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

  const handleDownload = () => {
    if (!activeFile?.data?.length) return;

    // Read the file as Data URL to embed it
    const reader = new FileReader();
    reader.onload = () => {
      const mediaDataUrl = reader.result;

      // Generate HTML content
      const htmlContent = generateHTML(activeFile.data, activeFile.file.name, mediaDataUrl);

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeFile.file.name}_analysis.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    reader.readAsDataURL(activeFile.file);
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
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in duration-300">
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
                          <div key={key} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                            <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]" title={key}>{name}</span>
                            <button onClick={() => deleteCache(key)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors" title="Delete">
                              <Trash2 size={14} />
                            </button>
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
      </div>
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

      {/* Header */}
      <header className="h-16 flex-none bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
            <Volume2 size={18} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 hidden sm:block">MediaSmart</h1>
        </div>

        {/* File Tabs */}
        <div className="flex-1 overflow-x-auto mx-6 no-scrollbar flex items-center gap-2">
          {files.map(f => (
            <div
              key={f.id}
              onClick={() => setActiveFileId(f.id)}
              className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap border transition-all
                        ${f.id === activeFileId
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                  : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}
                    `}
            >
              {f.file.type.startsWith('video') ? <FileVideo size={12} /> : <FileAudio size={12} />}
              <span className="max-w-[100px] truncate">{f.file.name}</span>
              <button onClick={(e) => removeFile(f.id, e)} className="hover:text-red-500 rounded p-0.5"><X size={12} /></button>
            </div>
          ))}
          <label className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1">
            <Plus size={18} />
            <input type="file" multiple className="hidden" onChange={(e) => processFiles(e.target.files)} accept="audio/*,video/*" />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} /> <span className="hidden sm:inline">HTML</span>
          </button>

          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showAnalysis ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Info size={16} />
            <span className="hidden sm:inline">All Analysis</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Active File Content */}
        {activeFile ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 w-full overflow-y-auto bg-[#F8FAFC]" onClick={() => setShowSpeedMenu(false)}>
              <div className="max-w-6xl mx-auto p-4 md:p-6 pb-32">
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
              <div className="max-w-3xl mx-auto">
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
                    <div className="flex items-center justify-between mt-0.5 relative">

                      {/* Left: Speed Menu Popup */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                          className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-100 rounded-xl text-base font-bold text-slate-700 hover:bg-slate-200 transition-all min-w-[120px]"
                        >
                          {playbackRate.toFixed(1)}x
                        </button>

                        {showSpeedMenu && (
                          <div className="absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in zoom-in-95 duration-200 min-w-[200px]">
                            <div className="grid grid-cols-4 gap-1">
                              {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0].map(rate => (
                                <button
                                  key={rate}
                                  onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSpeedMenu(false); }}
                                  className={`px-1 py-2 text-center rounded-lg text-sm font-bold transition-colors ${Math.abs(playbackRate - rate) < 0.01 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                  {rate.toFixed(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Center: Prev - Play - Next */}
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => handlePrev(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                          className="p-2 text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform"
                        >
                          <ChevronLeft size={32} />
                        </button>

                        <button
                          onClick={togglePlay}
                          className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                        >
                          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>

                        <button
                          onClick={() => handleNext(currentSentenceIdx !== -1 ? currentSentenceIdx : 0)}
                          className="p-2 text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform"
                        >
                          <ChevronRight size={32} />
                        </button>
                      </div>

                      {/* Right: Volume */}
                      <div className="flex items-center gap-3 pr-4">
                        <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                          {volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-32 sm:w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

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
