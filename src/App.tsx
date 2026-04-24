import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Search, 
  ChevronRight, 
  LogOut, 
  LayoutDashboard, 
  AlertCircle, 
  Clock, 
  Zap,
  QrCode,
  ArrowLeft,
  Settings,
  MoreVertical,
  X,
  Share2,
  Sparkles,
  Menu
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { extractDeadlines } from './lib/gemini';
import { Board, Task, Priority, TaskType } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Local Storage Helpers ---
const STORAGE_KEYS = {
  BOARDS: 'syncstream_boards',
  TASKS: 'syncstream_tasks',
  USER: 'syncstream_user_profile'
};

const getLocalData = <T,>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const setLocalData = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- Components ---
const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const configs = {
    urgent: 'bg-amber-100 text-amber-600 border-amber-200',
    high: 'bg-red-100 text-red-600 border-red-200',
    medium: 'bg-blue-100 text-blue-600 border-blue-200',
    low: 'bg-emerald-100 text-emerald-600 border-emerald-200',
  };
  
  return (
    <span className={cn("px-2 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider", configs[priority])}>
      {priority}
    </span>
  );
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [view, setView] = useState<'home' | 'board'>('home');
  const [aiText, setAiText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Initial Load
  useEffect(() => {
    const savedBoards = getLocalData<Board[]>(STORAGE_KEYS.BOARDS, []);
    setBoards(savedBoards);
    if (savedBoards.length > 0) {
      setActiveBoardId(savedBoards[0].id);
      setView('board');
    }
    setLoading(false);
  }, []);

  // Fetch Tasks when active board changes
  useEffect(() => {
    if (!activeBoardId) {
      setTasks([]);
      return;
    }
    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const boardTasks = allTasks.filter(t => t.boardId === activeBoardId)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    setTasks(boardTasks);
  }, [activeBoardId]);

  const saveBoardsToStorage = (updatedBoards: Board[]) => {
    setBoards(updatedBoards);
    setLocalData(STORAGE_KEYS.BOARDS, updatedBoards);
  };

  const saveTasksToStorage = (updatedTasks: Task[]) => {
    setLocalData(STORAGE_KEYS.TASKS, updatedTasks);
    if (activeBoardId) {
      setTasks(updatedTasks.filter(t => t.boardId === activeBoardId)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()));
    }
  };

  const [newBoardName, setNewBoardName] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [showBoardModal, setShowBoardModal] = useState(false);

  const createBoard = async (nameOverride?: string) => {
    const finalName = nameOverride || newBoardName.trim();
    if (!finalName) return;
    setIsCreatingBoard(true);
    
    const newBoard: Board = {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
      category: 'University',
      ownerId: 'local-user',
      createdAt: new Date().toISOString()
    };

    const updatedBoards = [newBoard, ...boards];
    saveBoardsToStorage(updatedBoards);
    setActiveBoardId(newBoard.id);
    setView('board');
    setNewBoardName('');
    setShowBoardModal(false);
    setIsCreatingBoard(false);
    setIsSidebarOpen(false);
  };

  const updateBoard = (boardId: string, updates: Partial<Board>) => {
    const updatedBoards = boards.map(b => 
      b.id === boardId ? { ...b, ...updates } : b
    );
    saveBoardsToStorage(updatedBoards);
    setEditingBoard(null);
  };

  const deleteBoard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this entire board and all tasks?')) return;
    
    const updatedBoards = boards.filter(b => b.id !== id);
    saveBoardsToStorage(updatedBoards);

    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const remainingTasks = allTasks.filter(t => t.boardId !== id);
    setLocalData(STORAGE_KEYS.TASKS, remainingTasks);

    if (activeBoardId === id) {
      setView('home');
      setActiveBoardId(null);
    }
  };

  const handleExtract = async () => {
    if (!aiText.trim() || !activeBoardId) return;
    setIsExtracting(true);
    try {
      // Hard split by lines to guarantee separate tasks
      const lines = aiText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
      let newlyExtracted: Task[] = [];

      for (const line of lines) {
        try {
          const extracted = await extractDeadlines(line);
          const formatted: Task[] = extracted.map((item: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            ...item,
            status: 'pending',
            ownerId: 'local-user',
            boardId: activeBoardId,
            createdAt: new Date().toISOString()
          }));
          newlyExtracted = [...newlyExtracted, ...formatted];
        } catch (lineError) {
          console.error("Failed to extract line:", line, lineError);
        }
      }

      saveTasksToStorage([...allTasks, ...newlyExtracted]);
      setAiText('');
    } catch (e) {
      console.error(e);
      alert('Failed to extract: ' + (e as Error).message);
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTaskStatus = (task: Task) => {
    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const updatedTasks = allTasks.map(t => 
      t.id === task.id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
    );
    saveTasksToStorage(updatedTasks);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const updatedTasks = allTasks.map(t => 
      t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    saveTasksToStorage(updatedTasks);
    setEditingTask(null);
  };

  const deleteTask = (taskId: string) => {
    if (!confirm('Delete task?')) return;
    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const updatedTasks = allTasks.filter(t => t.id !== taskId);
    saveTasksToStorage(updatedTasks);
  };

  const deleteSelectedTasks = () => {
    if (!confirm(`Delete ${selectedTaskIds.length} selected tasks?`)) return;
    const allTasks = getLocalData<Task[]>(STORAGE_KEYS.TASKS, []);
    const updatedTasks = allTasks.filter(t => !selectedTaskIds.includes(t.id));
    saveTasksToStorage(updatedTasks);
    setSelectedTaskIds([]);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const calculateGlobalUrgency = () => {
    return {
      overdue: tasks.filter(t => isPast(new Date(t.deadline)) && t.status === 'pending').length,
      urgent: tasks.filter(t => differenceInDays(new Date(t.deadline), new Date()) < 1 && t.status === 'pending').length
    };
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="text-indigo-600"
      >
        <Sparkles size={40} />
      </motion.div>
      <div className="ml-4 text-indigo-600 font-bold text-sm">Syncing Stream...</div>
    </div>
  );

  const getUrgencyColor = (deadline: Date, status: string) => {
    if (status === 'completed') return 'text-slate-400';
    if (isPast(deadline)) return 'text-red-500 font-bold';
    const days = differenceInDays(deadline, new Date());
    if (days < 1) return 'text-amber-500 font-bold';
    if (days < 3) return 'text-orange-500 font-semibold';
    if (days < 7) return 'text-blue-500';
    return 'text-emerald-500';
  };

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const globalUrgency = calculateGlobalUrgency();

  return (
    <div className="flex h-screen w-full bg-[#F7F9FC] font-sans text-slate-800 overflow-hidden relative">
      {/* Sidebar Navigation - Responsive */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[70] w-72 bg-white border-r border-slate-200 flex flex-col p-6 overflow-y-auto lg:relative lg:translate-x-0"
            >
              <div className="flex items-center justify-between mb-10">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => { setView('home'); setActiveBoardId(null); setIsSidebarOpen(false); }}
                >
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">Σ</div>
                  <span className="font-bold text-xl tracking-tight text-slate-900">SyncStream</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <nav className="space-y-4 flex-1">
                <div className="space-y-3">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Create New Board</div>
                   <form 
                      onSubmit={(e) => { e.preventDefault(); createBoard(); }} 
                      className="px-2"
                    >
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          placeholder="Board name..." 
                          className="w-full bg-slate-50 border border-slate-100 h-11 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                        />
                        <button 
                          type="submit"
                          disabled={isCreatingBoard || !newBoardName.trim()}
                          className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 transition-all"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                   </form>
                </div>

                <div className="pt-4 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">My Boards ({boards.length})</div>
                  <div className="space-y-1">
                    <AnimatePresence>
                      {boards.map(board => (
                        <motion.div 
                          key={board.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold transition-all group text-left cursor-pointer",
                            activeBoardId === board.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                          )}
                          onClick={() => { setActiveBoardId(board.id); setView('board'); setIsSidebarOpen(false); }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{board.category === 'University' ? '🎓' : board.category === 'Home' ? '🏠' : board.category === 'Work' ? '💼' : '🏛️'}</span>
                            <span className="truncate max-w-[120px]">{board.name}</span>
                          </div>
                          <button 
                            onClick={(e) => deleteBoard(e, board.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all ml-2 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </nav>

              <div className="mt-6 flex items-center gap-3 px-4 py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest border-t border-slate-100 pt-6">
                <Settings size={14} /> Local Mode
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Persistent Sidebar for Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 overflow-y-auto">
          <div 
            className="flex items-center gap-3 mb-10 cursor-pointer"
            onClick={() => { setView('home'); setActiveBoardId(null); }}
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">Σ</div>
            <span className="font-bold text-xl tracking-tight text-slate-900">SyncStream</span>
          </div>
          
          <nav className="space-y-4 flex-1">
            <div className="space-y-3">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Create New Board</div>
               <form 
                  onSubmit={(e) => { e.preventDefault(); createBoard(); }} 
                  className="px-2"
                >
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="Board name..." 
                      className="w-full bg-slate-50 border border-slate-100 h-11 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                    />
                    <button 
                      type="submit"
                      disabled={isCreatingBoard || !newBoardName.trim()}
                      className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
               </form>
            </div>

            <div className="pt-4 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">My Boards ({boards.length})</div>
              <div className="space-y-1">
                <AnimatePresence>
                  {boards.map(board => (
                    <motion.div 
                      key={board.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold transition-all group text-left cursor-pointer",
                        activeBoardId === board.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                      )}
                      onClick={() => { setActiveBoardId(board.id); setView('board'); }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{board.category === 'University' ? '🎓' : board.category === 'Home' ? '🏠' : board.category === 'Work' ? '💼' : '🏛️'}</span>
                        <span className="truncate">{board.name}</span>
                      </div>
                      <button 
                        onClick={(e) => deleteBoard(e, board.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all ml-2 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto pt-4 sm:pt-6">
        {/* Header */}
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {selectedTaskIds.length > 0 ? (
              <button 
                onClick={() => setSelectedTaskIds([])}
                className="p-2 -ml-2 hover:bg-slate-50 rounded-xl text-slate-600"
              >
                <X size={24} />
              </button>
            ) : (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 hover:bg-slate-50 rounded-xl lg:hidden text-slate-600"
              >
                <Menu size={24} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <h1 className="text-lg lg:text-2xl font-extrabold text-slate-900 leading-tight truncate max-w-[150px] lg:max-w-none">
                {selectedTaskIds.length > 0 ? `${selectedTaskIds.length} Selected` : (activeBoard ? activeBoard.name : 'Welcome!')}
              </h1>
              {!activeBoard && !selectedTaskIds.length && (
                <button 
                  onClick={() => setEditingBoard(activeBoard)}
                  className="p-1 text-slate-300 hover:text-indigo-600 transition-colors"
                >
                  <Settings size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {selectedTaskIds.length > 0 ? (
              <button 
                onClick={deleteSelectedTasks}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
              >
                <Trash2 size={18} /> Delete
              </button>
            ) : (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dashboard</span>
                  <div className="flex gap-2 mt-1">
                    <div className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-extrabold border border-red-200">
                      {globalUrgency.overdue}
                    </div>
                    <div className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-extrabold border border-amber-200">
                      {globalUrgency.urgent}
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-xs lg:text-base">
                  S
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Container */}
        <div className="p-4 lg:p-8 flex flex-col gap-6 lg:gap-8 flex-1 mt-6 lg:mt-10">
          {activeBoardId ? (
            <>
              {/* AI Parser Area */}
              <section className="bg-white rounded-3xl lg:rounded-[2.5rem] p-1 border-2 border-dashed border-indigo-200 shadow-sm transition-all focus-within:border-indigo-400">
                <div className="flex flex-col items-center gap-3 p-3 lg:p-4">
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-50 rounded-full flex items-center justify-center text-xl lg:text-2xl shrink-0 mt-1">✨</div>
                    <textarea 
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      placeholder="Paste messy notes here... 
Example:
- Math exam Friday
- Quiz on Monday 10am" 
                      className="flex-1 bg-transparent border-none outline-none text-slate-600 italic placeholder:text-slate-300 text-sm lg:text-base min-h-[100px] py-2 resize-none"
                    />
                  </div>
                  <button 
                    onClick={handleExtract}
                    disabled={isExtracting || !aiText.trim()}
                    className="w-full px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-200 disabled:shadow-none transition-all text-sm lg:text-base"
                  >
                    {isExtracting ? 'Extracting...' : 'Extract Tasks'}
                  </button>
                </div>
              </section>

              {/* Tasks Grid */}
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-8">
                {/* Tasks List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2 font-extrabold text-slate-700 uppercase tracking-widest text-[10px]">
                    <span>Tasks & Deadlines</span>
                    <span>{tasks.length} total</span>
                  </div>

                  <AnimatePresence>
                    {tasks.length === 0 ? (
                      <div className="bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2rem] p-12 text-center">
                         <Sparkles className="mx-auto text-slate-200 mb-4" size={40} />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No Tasks Detected</p>
                      </div>
                    ) : (
                      tasks.map(task => {
                        const deadlineDate = new Date(task.deadline);
                        const past = isPast(deadlineDate) && task.status === 'pending';
                        const colorClass = past ? 'bg-red-500' : task.priority === 'urgent' ? 'bg-amber-500' : task.priority === 'high' ? 'bg-orange-500' : 'bg-indigo-500';
                        const borderClass = past ? 'border-red-100 shadow-red-50' : task.priority === 'urgent' ? 'border-amber-100 shadow-amber-50' : 'border-indigo-50';

                        return (
                          <motion.div 
                            layout
                            key={task.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => selectedTaskIds.length > 0 && toggleTaskSelection(task.id)}
                            onContextMenu={(e) => { e.preventDefault(); toggleTaskSelection(task.id); }}
                            className={cn(
                              "group relative bg-white p-4 sm:p-5 rounded-[2rem] border-2 shadow-md flex gap-4 sm:gap-5 transition-all hover:scale-[1.01] cursor-default active:scale-95",
                              borderClass,
                              task.status === 'completed' && "opacity-60 grayscale",
                              selectedTaskIds.includes(task.id) && "border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/30"
                            )}
                          >
                            <div className={cn("w-1.5 sm:w-2 rounded-full shrink-0", colorClass)}></div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between mb-1">
                                <div className={cn("text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest", getUrgencyColor(deadlineDate, task.status))}>
                                  {past ? 'Overdue' : formatDistanceToNow(deadlineDate, { addSuffix: true })}
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedTaskIds.includes(task.id) && <CheckCircle2 size={14} className="text-indigo-600" />}
                                  <PriorityBadge priority={task.priority} />
                                </div>
                              </div>
                              <h3 className={cn("font-bold text-slate-900 leading-tight text-base sm:text-lg overflow-wrap-anywhere", task.status === 'completed' && "line-through")}>
                                {task.title}
                              </h3>
                              <p className="text-xs sm:text-sm text-slate-400 mt-1 overflow-wrap-anywhere">
                                {task.description || format(deadlineDate, 'MMMM do, h:mm a')}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                                className="p-2 hover:bg-slate-50 rounded-xl text-lg lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                              >
                                {task.status === 'completed' ? '↩️' : '✅'}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                className="p-2 hover:bg-indigo-50 rounded-xl text-lg lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                              >
                                ⚙️
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                {/* Insights Area */}
                <div className="space-y-6">
                   <div className="hidden xl:block text-[10px] font-extrabold text-slate-700 uppercase tracking-widest px-2">
                    <span>Performance</span>
                  </div>

                  <div className="bg-slate-900 rounded-[2rem] p-6 lg:p-8 text-white relative overflow-hidden shadow-xl">
                    <div className="relative z-10">
                      <div className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-[0.3em] mb-4">Productivity</div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl lg:text-5xl font-extrabold">{tasks.filter(t => t.status === 'completed').length}</span>
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Done</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                         <div 
                          className="bg-indigo-500 h-full transition-all duration-1000" 
                          style={{ width: tasks.length > 0 ? `${(tasks.filter(t => t.status === 'completed').length / tasks.length) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <Zap className="absolute -bottom-4 -right-4 text-white opacity-5" size={120} />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 lg:py-20">
               <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-md mb-6 animate-bounce">
                  <LayoutDashboard size={32} className="text-indigo-600 lg:size-[40px]" />
               </div>
               <h3 className="text-xl lg:text-2xl font-extrabold text-slate-900 mb-2 px-4">Create Your First Board</h3>
               <p className="text-slate-500 max-w-xs lg:max-w-sm px-6 text-sm lg:text-base">Start organizing your subjects, home duties, or work projects. AI-powered extraction is ready.</p>
               <button 
                 onClick={() => setShowBoardModal(true)}
                 className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm lg:text-base"
               >
                 <Plus size={20} /> New Board
               </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="h-14 bg-white border-t border-slate-200 px-4 lg:px-8 flex items-center justify-between text-[9px] lg:text-[10px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> 
              <span className="hidden xs:inline">Local Storage Mode</span>
            </span>
          </div>
          <span className="text-indigo-500 font-black">v1.1.0-mobile</span>
        </footer>
      </main>

      {/* Editing Modal */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white p-6 sm:p-10 rounded-t-[2.5rem] sm:rounded-[3rem] max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-extrabold text-slate-900">Task Settings</h3>
                 <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2">Title</label>
                  <input 
                    type="text" 
                    defaultValue={editingTask.title}
                    onBlur={(e) => updateTask(editingTask.id, { title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 h-12 rounded-2xl px-5 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2">Priority</label>
                    <select 
                      defaultValue={editingTask.priority}
                      onChange={(e) => updateTask(editingTask.id, { priority: e.target.value as Priority })}
                      className="w-full bg-slate-50 border border-slate-100 h-12 rounded-2xl px-4 appearance-none font-bold text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => deleteTask(editingTask.id)}
                      className="w-full h-12 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={18} /> Delete
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingTask(null)}
                  className="w-full bg-indigo-600 text-white h-14 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-indigo-100 mt-4 mb-8 sm:mb-0"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Board Creation Modal */}
      <AnimatePresence>
        {showBoardModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white p-6 sm:p-10 rounded-t-[2.5rem] sm:rounded-[3rem] max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-extrabold text-slate-900">New Board</h3>
                 <button onClick={() => setShowBoardModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); createBoard(); }} className="space-y-6">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2 px-1">Board Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="e.g. University, Home, Work"
                    className="w-full bg-slate-50 border border-slate-100 h-14 rounded-2xl px-6 focus:outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all font-bold"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isCreatingBoard || !newBoardName.trim()}
                  className="w-full bg-indigo-600 text-white h-16 rounded-[2rem] font-extrabold text-sm uppercase tracking-widest mt-4 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:bg-slate-200 mb-8 sm:mb-0"
                >
                  {isCreatingBoard ? 'Creating...' : 'Create Board'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Board Edit Modal */}
      <AnimatePresence>
        {editingBoard && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white p-6 sm:p-10 rounded-t-[2.5rem] sm:rounded-[3rem] max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-extrabold text-slate-900">Board Settings</h3>
                 <button onClick={() => setEditingBoard(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X size={20} />
                 </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2 px-1">Board Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    defaultValue={editingBoard.name}
                    onBlur={(e) => updateBoard(editingBoard.id, { name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 h-14 rounded-2xl px-6 focus:outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all font-bold"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <button 
                      onClick={(e) => { deleteBoard(e, editingBoard.id); setEditingBoard(null); }}
                      className="flex-1 bg-red-50 text-red-600 h-14 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={20} /> Delete Board
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="flex-1 bg-slate-100 text-slate-600 h-14 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                    >
                      🔄 Refresh App
                    </button>
                  </div>
                  <button 
                    onClick={() => setEditingBoard(null)}
                    className="w-full bg-indigo-600 text-white h-14 rounded-2xl font-bold shadow-lg shadow-indigo-100"
                  >
                    Done
                  </button>
                </div>
              </div>
              <div className="h-8 sm:hidden"></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
