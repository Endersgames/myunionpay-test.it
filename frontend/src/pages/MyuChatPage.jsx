import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, Send, RotateCcw, CheckCircle2, Clock, X, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { myuAPI } from "@/lib/api";

const ACTION_LABELS = {
  navigate: { icon: ChevronRight, color: "bg-[#2B7AB8]" },
  create_task: { icon: CheckCircle2, color: "bg-[#E85A24]" },
  suggest_merchant: { icon: ChevronRight, color: "bg-emerald-600" },
};

function ActionButton({ action, onClick }) {
  const config = ACTION_LABELS[action.type] || ACTION_LABELS.navigate;
  const Icon = config.icon;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-medium ${config.color} hover:opacity-90 transition`}
      data-testid={`myu-action-${action.type}`}
    >
      {action.label || action.title || "Vai"}
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function TaskCard({ task, onUpdate }) {
  const isPending = task.status === "active";
  return (
    <div className="flex items-center gap-3 p-3 bg-[#F5F5F5] rounded-xl border border-black/5" data-testid={`task-${task.id}`}>
      <button
        onClick={() => isPending && onUpdate(task.id, "completed")}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isPending ? "border-[#E85A24] hover:bg-[#E85A24]/10" : "border-emerald-500 bg-emerald-500"}`}
      >
        {!isPending && <CheckCircle2 className="w-4 h-4 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${!isPending ? "line-through text-[#6B7280]" : "text-[#1A1A1A]"}`}>{task.title}</p>
        {task.due_date && <p className="text-xs text-[#6B7280] flex items-center gap-1"><Clock className="w-3 h-3" />{task.due_date}</p>}
      </div>
      {isPending && (
        <button onClick={() => onUpdate(task.id, "cancelled")} className="p-1 text-[#6B7280] hover:text-red-500">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function MyuChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadData = async () => {
    try {
      const [history, taskList] = await Promise.all([
        myuAPI.getHistory(),
        myuAPI.getTasks()
      ]);
      setMessages(history || []);
      setTasks(taskList || []);
    } catch (err) {
      console.error(err);
    }
    setInitialLoading(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text, created_at: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await myuAPI.chat(text);
      setMessages(prev => [...prev, {
        role: "assistant",
        text: res.message,
        actions: res.actions || [],
        created_at: new Date().toISOString()
      }]);

      if (res.actions?.some(a => a.type === "create_task")) {
        const taskList = await myuAPI.getTasks();
        setTasks(taskList || []);
      }
    } catch (err) {
      if (err.message.includes("Saldo")) {
        toast.error("Saldo insufficiente per MYU");
        setMessages(prev => [...prev, {
          role: "assistant",
          text: "Non hai abbastanza UP per questa chat. Ricarica il tuo saldo per continuare.",
          actions: [{ type: "navigate", path: "/dashboard", label: "Ricarica" }],
          created_at: new Date().toISOString()
        }]);
      } else {
        toast.error("Errore nella chat");
      }
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleAction = (action) => {
    if (action.type === "navigate" && action.path) {
      navigate(action.path);
    }
  };

  const handleTaskUpdate = async (taskId, status) => {
    try {
      await myuAPI.updateTask(taskId, status);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      toast.success(status === "completed" ? "Task completato!" : "Task cancellato");
    } catch {
      toast.error("Errore aggiornamento task");
    }
  };

  const handleNewSession = async () => {
    try {
      await myuAPI.newSession();
      setMessages([]);
      toast.success("Nuova conversazione iniziata");
    } catch {
      toast.error("Errore");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeTasks = tasks.filter(t => t.status === "active");

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-[#E85A24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]" data-testid="myu-chat-page">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-black/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2" data-testid="myu-back-btn">
              <ArrowLeft className="w-5 h-5 text-[#1A1A1A]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E85A24] to-[#FF8C42] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-[#1A1A1A] text-base leading-tight">MYU</h1>
                <p className="text-[10px] text-[#6B7280]">0.01 UP per messaggio</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTasks.length > 0 && (
              <button
                onClick={() => setShowTasks(!showTasks)}
                className="px-2.5 py-1 rounded-full bg-[#E85A24]/10 text-[#E85A24] text-xs font-semibold"
                data-testid="myu-tasks-toggle"
              >
                {activeTasks.length} task
              </button>
            )}
            <button onClick={handleNewSession} className="p-2 text-[#6B7280] hover:text-[#1A1A1A]" data-testid="myu-new-session">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tasks Panel */}
      {showTasks && activeTasks.length > 0 && (
        <div className="flex-shrink-0 bg-white border-b border-black/5 px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">I tuoi task</p>
          {activeTasks.map(task => (
            <TaskCard key={task.id} task={task} onUpdate={handleTaskUpdate} />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E85A24] to-[#FF8C42] flex items-center justify-center mb-4">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">Ciao, sono MYU</h2>
            <p className="text-sm text-[#6B7280] mb-6">Il tuo compagno digitale. Chiedimi qualcosa!</p>
            <div className="space-y-2 w-full max-w-xs">
              {["Qual è il mio saldo?", "Ci sono negozi interessanti?", "Aiutami a organizzarmi"].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="w-full text-left px-4 py-2.5 bg-white rounded-xl border border-black/5 text-sm text-[#1A1A1A] hover:border-[#E85A24]/30 transition"
                  data-testid={`myu-suggestion-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] ${msg.role === "user"
              ? "bg-[#2B7AB8] text-white rounded-2xl rounded-br-md px-4 py-2.5"
              : "bg-white border border-black/5 text-[#1A1A1A] rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm"
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-black/5">
                  {msg.actions.map((action, i) => (
                    <ActionButton key={i} action={action} onClick={() => handleAction(action)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-black/5 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#E85A24] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#E85A24] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#E85A24] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-black/5 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi a MYU..."
              rows={1}
              className="w-full resize-none rounded-xl border border-black/10 bg-[#F5F5F5] px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#E85A24]/50 focus:ring-1 focus:ring-[#E85A24]/20"
              style={{ maxHeight: "120px" }}
              data-testid="myu-input"
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="h-11 w-11 rounded-xl bg-[#E85A24] hover:bg-[#D14E1A] disabled:opacity-40 flex-shrink-0"
            data-testid="myu-send-btn"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
