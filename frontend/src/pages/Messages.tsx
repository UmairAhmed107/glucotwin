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
  } = useThreadDetail(selectedThreadId || undefined);

  // Context options for new thread linking
  const { data: visits } = useVisits(selectedPatientId);
  const { data: alerts } = useAlerts({ patient_id: selectedPatientId });
  const { data: scenarios } = useSavedScenarios(selectedPatientId);

  // Mutations
  const createThreadMutation = useCreateThread();
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkThreadRead();

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads && threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  // Mark thread as read when selected
  useEffect(() => {
    if (selectedThreadId && activeThread && activeThread.unread_count > 0) {
      markReadMutation.mutate(selectedThreadId);
    }
  }, [selectedThreadId, activeThread?.unread_count]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (typeof chatBottomRef.current?.scrollIntoView === 'function') {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !newMessageText.trim()) return;

    sendMessageMutation.mutate(
      { threadId: selectedThreadId, content: newMessageText.trim() },
      {
        onSuccess: () => {
          setNewMessageText('');
        },
      }
    );
  };

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadTitle.trim()) return;

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
        return <Calendar className="w-3.5 h-3.5 text-teal-600" />;
      case 'alert':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
      case 'scenario':
        return <Sliders className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Care Team Discussion Hub</h1>
              <p className="text-sm text-slate-500">
                Direct clinical messaging between {isPatient ? 'you and your endocrinology team' : 'clinicians and patients'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchThreads()}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Refresh conversations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNewThreadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Thread
          </button>
        </div>
      </div>

      {/* Main Split Layout: Thread List (Left) + Chat View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Column: Thread List */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-sm">
              Conversations ({threads?.length || 0})
            </span>
            <span className="text-xs text-slate-400">
              {threads?.filter((t) => t.unread_count > 0).length || 0} unread
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {threadsLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3 space-y-2 bg-slate-50/70 rounded-xl">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : threadsError ? (
              <div className="p-6 text-center space-y-2.5">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Failed to load conversations</p>
                <p className="text-xs text-slate-500">
                  {threadsErrorObj instanceof Error ? threadsErrorObj.message : 'Please check your connection and retry.'}
                </p>
                <button
                  onClick={() => refetchThreads()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : !threads || threads.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No message threads yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a conversation with your care team</p>
                <button
                  onClick={() => setShowNewThreadModal(true)}
                  className="mt-4 text-xs font-semibold text-teal-600 hover:text-teal-700"
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
                        ? 'bg-teal-50/70 border-l-4 border-teal-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {thread.title}
                      </span>
                      {thread.unread_count > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-teal-600 text-white rounded-full">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Linked Context Tag */}
                    {thread.topic_type && thread.topic_type !== 'general' && (
                      <div className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 w-fit">
                        {getTopicIcon(thread.topic_type)}
                        <span className="font-medium capitalize">{thread.topic_type}:</span>
                        <span className="truncate max-w-[150px]">{thread.topic_title || `#${thread.topic_id}`}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {thread.last_message || 'No messages yet'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
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
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {threadLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-medium text-slate-600">Loading discussion messages...</p>
            </div>
          ) : threadError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Could not load discussion</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {threadErrorObj instanceof Error ? threadErrorObj.message : 'An error occurred while loading this thread.'}
              </p>
              <button
                onClick={() => refetchThreadDetail()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-xl text-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : activeThread ? (
            <>
              {/* Active Thread Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 text-base">{activeThread.title}</h2>
                    {activeThread.topic_type && activeThread.topic_type !== 'general' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
                        {getTopicIcon(activeThread.topic_type)}
                        {activeThread.topic_title || `${activeThread.topic_type} #${activeThread.topic_id}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Patient: <span className="font-medium text-slate-700">{activeThread.patient_name}</span> • Started by{' '}
                    <span className="font-medium text-slate-700">{activeThread.creator_name || 'Care Team'}</span>
                  </p>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(activeThread.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/30">
                {!activeThread.messages || activeThread.messages.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm">
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
                        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">{msg.sender_name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              isClinicianSender
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {msg.sender_role || 'member'}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isSelf
                              ? 'bg-teal-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Send Error Banner */}
              {sendMessageMutation.isError && (
                <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs flex items-center justify-between">
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
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a clinical note or question to care team..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim() || sendMessageMutation.isPending}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-700">Select a Thread</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                Choose a conversation from the left to view replies, or start a new clinical thread.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg">Start New Discussion</h3>
              <button
                onClick={() => setShowNewThreadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              {/* Patient Selector (Clinician only) */}
              {!isPatient && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Patient
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thread Title *
                </label>
                <input
                  type="text"
                  required
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  placeholder="e.g., Post-meal spike after pasta; Medication timing adjustment"
                  className="w-full text-sm border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Contextual Link Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border font-medium transition ${
                        topicType === tab.id
                          ? 'bg-teal-50 border-teal-500 text-teal-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-selector depending on topic type */}
                {topicType === 'visit' && (
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50"
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
                    className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50"
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
                    className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Message
                </label>
                <textarea
                  rows={3}
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Explain the reason for this discussion..."
                  className="w-full text-sm border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {createThreadMutation.isError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{createThreadMutation.error?.message || 'Failed to create discussion thread.'}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!threadTitle.trim() || createThreadMutation.isPending}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium shadow-sm transition"
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
