import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  AlertCircle,
  Calendar,
  Sliders,
  CheckCheck,
  Check,
  User,
  Shield,
  Stethoscope,
  Sparkles,
  Inbox,
  Clock,
  ChevronRight,
  RefreshCw,
  Home,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  useThreads,
  useThreadDetail,
  useCreateThread,
  useSendMessage,
  useMarkThreadRead,
  usePatients,
  useVisits,
  useAlerts,
  useSavedScenarios,
} from '../api/queries';
import { MessageThread } from '../api/types';

export const MessagesPage: React.FC = () => {
  const { activePatientId, setActivePatientId } = useApp();
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';

  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);

  // New Thread Form State
  const [threadTitle, setThreadTitle] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [topicType, setTopicType] = useState<'general' | 'visit' | 'alert' | 'scenario'>('general');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<number>(activePatientId || 1);

  // Queries
  const { data: patients } = usePatients();
  const {
    data: threads,
    isLoading: threadsLoading,
    isError: threadsError,
    error: threadsErrorObj,
    refetch: refetchThreads,
  } = useThreads(isPatient ? undefined : activePatientId || undefined);

  const {
    data: activeThread,
    isLoading: threadLoading,
    isError: threadError,
    error: threadErrorObj,
    refetch: refetchThreadDetail,
  } = useThreadDetail(selectedThreadId ?? undefined);

  // Contextual dropdown sources for linking discussions
  const { data: visits } = useVisits(isPatient ? null : selectedPatientId ?? null);
  const { data: alerts } = useAlerts(isPatient ? undefined : { patient_id: selectedPatientId });
  const { data: scenarios } = useSavedScenarios(isPatient ? null : selectedPatientId ?? null);

  // Mutations
  const createThreadMutation = useCreateThread();
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkThreadRead();

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-select first thread if none is selected
  useEffect(() => {
    if (threads && threads.length > 0 && selectedThreadId === null) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  // Mark unread messages as read when opening a thread
  useEffect(() => {
    if (selectedThreadId && activeThread?.unread_count && activeThread.unread_count > 0) {
      markReadMutation.mutate(selectedThreadId);
    }
  }, [selectedThreadId, activeThread?.unread_count]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !newMessageText.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(
      { threadId: selectedThreadId, content: newMessageText.trim() },
      {
        onSuccess: () => {
          setNewMessageText('');
          refetchThreadDetail();
          refetchThreads();
        },
      }
    );
  };

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadTitle.trim() || createThreadMutation.isPending) return;

    createThreadMutation.mutate(
      {
        patient_id: isPatient ? (patients?.[0]?.id || 1) : selectedPatientId,
        title: threadTitle.trim(),
        initial_message: initialMessage.trim() || undefined,
        topic_type: topicType,
        topic_id: selectedTopicId || undefined,
      },
      {
        onSuccess: (newThread) => {
          setShowNewThreadModal(false);
          setThreadTitle('');
          setInitialMessage('');
          setTopicType('general');
          setSelectedTopicId('');
          setSelectedThreadId(newThread.id);
          refetchThreads();
        },
      }
    );
  };

  const getTopicIcon = (type?: string | null) => {
    switch (type) {
      case 'visit':
        return <Calendar className="w-3.5 h-3.5 text-zinc-400" />;
      case 'alert':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'scenario':
        return <Sliders className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar (Matches Reference UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-6 rounded-2xl border border-zinc-800/90 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white">Care Team Coordination</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Discussion Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Care Team Discussion Hub
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
            Direct clinical messaging between {isPatient ? 'you and your endocrinology team' : 'clinicians and patients'}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => refetchThreads()}
            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition"
            title="Refresh conversations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNewThreadModal(true)}
            className="btn-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black stroke-[3]" />
            <span>New Thread</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Thread List (Left) + Chat View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Column: Thread List */}
        <div className="lg:col-span-4 bg-[#09090b] rounded-2xl border border-zinc-800/90 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-950">
            <span className="font-bold text-white text-xs uppercase tracking-wider">
              Conversations ({threads?.length || 0})
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {threads?.filter((t) => t.unread_count > 0).length || 0} unread
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-850">
            {threadsLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3.5 space-y-2 bg-zinc-900/60 rounded-xl">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : threadsError ? (
              <div className="p-6 text-center space-y-2.5">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-sm font-semibold text-white">Failed to load conversations</p>
                <p className="text-xs text-zinc-400">
                  {threadsErrorObj instanceof Error ? threadsErrorObj.message : 'Please check your connection and retry.'}
                </p>
                <button
                  onClick={() => refetchThreads()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold rounded-full text-zinc-200 border border-zinc-800 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : !threads || threads.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-300">No message threads yet</p>
                <p className="text-xs text-zinc-500 mt-1">Start a conversation with your care team</p>
                <button
                  onClick={() => setShowNewThreadModal(true)}
                  className="mt-4 text-xs font-semibold text-white underline"
                >
                  + Create first discussion
                </button>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-zinc-900/90 border-l-4 border-white'
                        : 'hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white truncate">
                        {thread.title}
                      </span>
                      {thread.unread_count > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-black rounded-full font-mono">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Linked Context Tag */}
                    {thread.topic_type && thread.topic_type !== 'general' && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-800 w-fit">
                        {getTopicIcon(thread.topic_type)}
                        <span className="font-semibold capitalize">{thread.topic_type}:</span>
                        <span className="truncate max-w-[150px]">{thread.topic_title || `#${thread.topic_id}`}</span>
                      </div>
                    )}

                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {thread.last_message || 'No messages yet'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 font-mono">
                      <span>{thread.patient_name}</span>
                      <span>
                        {thread.last_message_at
                          ? new Date(thread.last_message_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat View */}
        <div className="lg:col-span-8 bg-[#09090b] rounded-2xl border border-zinc-800/90 shadow-sm flex flex-col overflow-hidden">
          {threadLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-white mx-auto" />
              <p className="text-sm font-medium text-zinc-300">Loading discussion messages...</p>
            </div>
          ) : threadError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-500 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-semibold text-white">Could not load discussion</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                {threadErrorObj instanceof Error ? threadErrorObj.message : 'An error occurred while loading this thread.'}
              </p>
              <button
                onClick={() => refetchThreadDetail()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold rounded-full text-zinc-200 border border-zinc-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : activeThread ? (
            <>
              {/* Active Thread Header */}
              <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-950">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white text-base tracking-tight">{activeThread.title}</h2>
                    {activeThread.topic_type && activeThread.topic_type !== 'general' && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 font-medium">
                        {getTopicIcon(activeThread.topic_type)}
                        {activeThread.topic_title || `${activeThread.topic_type} #${activeThread.topic_id}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Patient: <span className="font-semibold text-zinc-200">{activeThread.patient_name}</span> • Started by{' '}
                    <span className="font-semibold text-zinc-200">{activeThread.creator_name || 'Care Team'}</span>
                  </p>
                </div>

                <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(activeThread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-black/40">
                {!activeThread.messages || activeThread.messages.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500 text-sm">
                    No messages in this discussion yet. Send the first message below.
                  </div>
                ) : (
                  activeThread.messages.map((msg) => {
                    const isSelf = msg.sender_id === user?.id;
                    const isClinicianSender = msg.sender_role === 'clinician' || msg.sender_role === 'dietitian';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400">
                          <span className="font-semibold text-zinc-300">{msg.sender_name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                              isClinicianSender
                                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                          >
                            {msg.sender_role || 'member'}
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs shadow-sm leading-relaxed ${
                            isSelf
                              ? 'bg-white text-black font-medium rounded-tr-none'
                              : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Send Error Banner */}
              {sendMessageMutation.isError && (
                <div className="px-4 py-2 bg-rose-950/40 border-t border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Failed to send message: {sendMessageMutation.error?.message || 'Please retry.'}</span>
                  </div>
                  <button
                    onClick={() => sendMessageMutation.reset()}
                    className="text-xs font-bold hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950 border-t border-zinc-850 flex items-center gap-3">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a clinical note or question to care team..."
                  className="flex-1 bg-[#050508] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition font-normal"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim() || sendMessageMutation.isPending}
                  className="btn-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-black" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-500">
              <MessageSquare className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-base font-bold text-white">Select a Thread</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">
                Choose a conversation from the left to view replies, or start a new clinical thread.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] rounded-3xl border border-zinc-800 shadow-2xl max-w-lg w-full p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <h3 className="font-bold text-white text-base">Start New Discussion</h3>
              <button
                onClick={() => setShowNewThreadModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              {/* Patient Selector (Clinician only) */}
              {!isPatient && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Select Patient
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                    className="w-full text-xs border border-zinc-800 rounded-xl p-2.5 bg-zinc-950 text-white focus:outline-none focus:border-white"
                  >
                    {patients?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} (ID: {p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Thread Title */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Thread Title *
                </label>
                <input
                  type="text"
                  required
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  placeholder="e.g., Post-meal spike after pasta; Medication timing adjustment"
                  className="w-full text-xs border border-zinc-800 rounded-xl p-2.5 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                />
              </div>

              {/* Contextual Link Selector */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Link to Clinical Item (Optional)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2 text-xs">
                  {[
                    { id: 'general', label: 'General', icon: MessageSquare },
                    { id: 'visit', label: 'Visit', icon: Calendar },
                    { id: 'alert', label: 'Alert', icon: AlertCircle },
                    { id: 'scenario', label: 'Scenario', icon: Sliders },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setTopicType(tab.id as any);
                        setSelectedTopicId('');
                      }}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition ${
                        topicType === tab.id
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'border-zinc-800 text-zinc-400 hover:text-white bg-zinc-950'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {topicType === 'visit' && (
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full text-xs border border-zinc-800 rounded-xl p-2 bg-zinc-950 text-white"
                  >
                    <option value="">-- Select Scheduled Visit --</option>
                    {visits?.map((v) => (
                      <option key={v.id} value={v.id}>
                        Visit #{v.id} - {new Date(v.scheduled_at).toLocaleDateString()} ({v.status})
                      </option>
                    ))}
                  </select>
                )}

                {topicType === 'alert' && (
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full text-xs border border-zinc-800 rounded-xl p-2 bg-zinc-950 text-white"
                  >
                    <option value="">-- Select Active Alert --</option>
                    {alerts?.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.severity.toUpperCase()}] {a.rule_key} - {a.message.slice(0, 45)}...
                      </option>
                    ))}
                  </select>
                )}

                {topicType === 'scenario' && (
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full text-xs border border-zinc-800 rounded-xl p-2 bg-zinc-950 text-white"
                  >
                    <option value="">-- Select Saved Scenario --</option>
                    {scenarios?.map((s) => (
                      <option key={s.id} value={s.id}>
                        Scenario #{s.id} - {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Initial Message
                </label>
                <textarea
                  rows={3}
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Explain the reason for this discussion..."
                  className="w-full text-xs border border-zinc-800 rounded-xl p-2.5 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                />
              </div>

              {createThreadMutation.isError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{createThreadMutation.error?.message || 'Failed to create discussion thread.'}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-300 rounded-full text-xs font-semibold hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!threadTitle.trim() || createThreadMutation.isPending}
                  className="btn-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {createThreadMutation.isPending ? 'Starting...' : 'Start Discussion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
