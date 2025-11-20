
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Calendar as CalendarIcon, MapPin, Trash2, CheckCircle2, Circle, 
  Clock, AlertCircle, Wand2, ChevronRight, Archive, Layout, Edit2, 
  AlertTriangle, Users, StickyNote, BarChart3, Upload, Mail, Phone, Briefcase,
  RefreshCw, Search, ChevronDown, XCircle, FileText, X, Info, Check, ArrowRight, Globe,
  Zap, Lightbulb, ExternalLink, Menu
} from 'lucide-react';
import { GlassCard } from './components/GlassCard';
import { Modal } from './components/Modal';
import { Event, Demand, Priority, Status, EventStatus, Client, Note, AIAnalysisResult } from './types';
import { generateDemandsForEvent, analyzeProjectRisks } from './services/geminiService';
import { supabase } from './services/supabaseClient';

// --- UTILS ---
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const formatUrl = (url: string) => {
  if (!url) return '';
  const cleanUrl = url.trim();
  if (/^https?:\/\//i.test(cleanUrl)) return cleanUrl;
  return `https://${cleanUrl}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'S/ Data';
  try {
    const cleanDateStr = dateStr.split('T')[0]; 
    const [year, month, day] = cleanDateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} ${months[parseInt(month) - 1]}`;
  } catch (e) {
    return dateStr;
  }
};

const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cleanDateStr = dateStr.split('T')[0];
  const [year, month, day] = cleanDateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  return due < today;
};

const LinkifiedText: React.FC<{ text: string }> = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <p className="text-slate-700 font-sans text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800 transition-colors relative z-10 break-all font-medium" onClick={(e) => e.stopPropagation()}>{part}</a>;
        }
        return part;
      })}
    </p>
  );
};

// --- CUSTOM COMPONENTS ---
interface ToastProps { id: string; message: string; type: 'success' | 'error' | 'info'; onClose: (id: string) => void; }
const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(() => onClose(id), 4000); return () => clearTimeout(timer); }, [id, onClose]);
  const colors = { success: 'bg-white/90 border-emerald-100 text-emerald-800 shadow-xl shadow-emerald-100/40', error: 'bg-white/90 border-rose-100 text-rose-800 shadow-xl shadow-rose-100/40', info: 'bg-white/90 border-indigo-100 text-indigo-800 shadow-xl shadow-indigo-100/40' };
  const icons = { success: <CheckCircle2 size={20} strokeWidth={2} className="text-emerald-500" />, error: <AlertCircle size={20} strokeWidth={2} className="text-rose-500" />, info: <Info size={20} strokeWidth={2} className="text-indigo-500" /> };
  return (
    <div className={`toast flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md animate-toast-in ${colors[type]}`}>
      {icons[type]}<span className="font-medium text-sm flex-1 leading-tight">{message}</span><button onClick={() => onClose(id)} className="opacity-40 hover:opacity-100 transition p-1"><X size={16}/></button>
    </div>
  );
};

interface ConfirmDialogProps { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; }
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-[2rem] p-6 md:p-8 shadow-2xl animate-scale-in bg-white/90 border-white/70">
        <div className="flex flex-col items-center text-center">
           <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600 shadow-inner"><AlertTriangle size={28} strokeWidth={1.5} /></div>
           <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3><p className="text-slate-500 mb-6 text-sm leading-relaxed px-2">{message}</p>
           <div className="flex gap-3 w-full"><button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition text-sm">Cancelar</button><button onClick={onConfirm} className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 text-sm">Confirmar</button></div>
        </div>
      </div>
    </div>
  );
};

// --- MAPPERS ---
const mapEvent = (e: any): Event => ({ id: e.id, title: e.title, date: e.date, location: e.location, description: e.description, status: e.status, imageUrl: e.image_url, websiteUrl: e.website_url });
const mapDemand = (d: any): Demand => ({ id: d.id, eventId: d.event_id, title: d.title, description: d.description, priority: d.priority, status: d.status, dueDate: d.due_date });
const mapClient = (c: any): Client => ({ id: c.id, name: c.name, company: c.company, role: c.role, email: c.email, phone: c.phone, status: c.status, notes: c.notes });
const mapNote = (n: any): Note => ({ id: n.id, content: n.content, dueDate: n.due_date, color: n.color, createdAt: n.created_at });

// --- SUB-VIEWS ---
const DashboardView: React.FC<{ events: Event[], demands: Demand[], notes: Note[], aiAnalysis: AIAnalysisResult | null, onRefreshAnalysis: () => void, onDismissAnalysis: () => void, isAnalyzing: boolean, onOpenDemandModal: () => void, onManageDemand: (d: Demand) => void, onCompleteDemand: (id: string) => void, onDeleteDemand: (id: string) => void }> = ({ events, demands, notes, aiAnalysis, onRefreshAnalysis, onDismissAnalysis, isAnalyzing, onOpenDemandModal, onManageDemand, onCompleteDemand, onDeleteDemand }) => {
  const activeEventCount = events.filter(e => e.status === 'ACTIVE').length;
  const urgentDemands = useMemo(() => demands.filter(d => d.status !== Status.DONE && d.priority === Priority.HIGH).sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); }).slice(0, 3), [demands]);
  const recentNotes = useMemo(() => [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3), [notes]);
  const activeDemands = useMemo(() => demands.filter(d => d.status !== Status.DONE).sort((a, b) => { const aOver = isOverdue(a.dueDate); const bOver = isOverdue(b.dueDate); if (aOver && !bOver) return -1; if (!aOver && bOver) return 1; const pOrder = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 }; if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority]; if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); }), [demands]);
  const getEvent = (id: string) => events.find(e => e.id === id);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-24 w-full px-2 md:px-0">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="shrink-0 w-full md:w-auto"><h2 className="text-2xl md:text-4xl font-bold text-slate-800 tracking-tight mb-1">Visão Geral</h2><p className="text-slate-500 font-medium tracking-wide text-sm md:text-base">Painel de controle operacional</p></div>
        <div className="flex-1 w-full xl:w-auto flex flex-col md:flex-row gap-3 md:gap-4 xl:justify-center">
            <div className="glass-panel px-5 py-4 rounded-2xl md:rounded-3xl flex items-center gap-5 w-full md:w-auto md:min-w-[160px] hover:bg-white/70 transition-colors cursor-default">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0"><Layout size={20} strokeWidth={2.5}/></div>
                <div><span className="block text-2xl md:text-3xl font-bold text-slate-800 leading-none">{activeEventCount}</span><span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ativos</span></div>
            </div>
            <div className="glass-panel px-5 py-4 rounded-2xl md:rounded-3xl flex-1 flex flex-col justify-center gap-2 hover:bg-white/70 transition-colors min-h-[80px] cursor-default w-full">
                <div className="flex items-center gap-2 mb-1"><Zap size={14} className="text-rose-500 fill-rose-500"/><span className="text-[10px] md:text-[11px] font-bold text-rose-500 uppercase tracking-wider">Foco Urgente</span></div>
                <div className="flex flex-col gap-1.5">{urgentDemands.length > 0 ? (urgentDemands.map(d => (<div key={d.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 truncate"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 shadow-sm"></span><span className="truncate max-w-[200px]">{d.title}</span></div>))) : (<span className="text-xs text-slate-400 italic font-medium">Sem urgências.</span>)}</div>
            </div>
            <div className="glass-panel px-5 py-4 rounded-2xl md:rounded-3xl flex-1 flex-col justify-center gap-2 hover:bg-white/70 transition-colors min-h-[80px] hidden sm:flex cursor-default w-full">
                <div className="flex items-center gap-2 mb-1"><Lightbulb size={14} className="text-amber-500 fill-amber-500"/><span className="text-[10px] md:text-[11px] font-bold text-amber-500 uppercase tracking-wider">Ideias Recentes</span></div>
                <div className="flex flex-col gap-1.5">{recentNotes.length > 0 ? (recentNotes.map(n => (<div key={n.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 truncate"><span className={`w-1.5 h-1.5 rounded-full ${n.color.replace('bg-', 'bg-').replace('-50', '-400')} shrink-0 shadow-sm`}></span><span className="truncate max-w-[150px]">{n.content}</span></div>))) : (<span className="text-xs text-slate-400 italic font-medium">Nenhuma nota recente.</span>)}</div>
            </div>
        </div>
        <div className="flex gap-3 w-full xl:w-auto shrink-0">
           <button onClick={onRefreshAnalysis} className="btn-glass flex-1 xl:flex-none px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md transition-all h-12 md:h-auto"><Wand2 size={18} strokeWidth={2.5} className={isAnalyzing ? "animate-spin text-indigo-500" : "text-indigo-500"} /><span className="hidden md:inline">{isAnalyzing ? 'Gerando...' : 'IA Insight'}</span><span className="md:hidden">IA</span></button>
           <button onClick={onOpenDemandModal} className="btn-primary flex-[2] xl:flex-none px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all h-12 md:h-auto text-sm md:text-base"><Plus size={20} strokeWidth={3} /> Nova Demanda</button>
        </div>
      </div>
      {aiAnalysis && (<div className="relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 shadow-xl shadow-indigo-100/40 animate-slide-up"><button onClick={onDismissAnalysis} className="absolute top-4 right-4 p-2 rounded-full hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition z-20"><X size={18} /></button><div className="p-6 md:p-8 relative z-10"><div className="flex flex-col gap-4 md:pr-8"><div className="flex flex-col md:flex-row md:items-start gap-4"><div className="w-10 h-10 md:w-auto md:h-auto p-3 bg-indigo-100 rounded-xl text-indigo-600 mt-1 shadow-sm flex items-center justify-center shrink-0"><Wand2 size={20} strokeWidth={2.5} /></div><div><h3 className="text-lg font-bold text-indigo-900 leading-relaxed mb-1">Briefing Inteligente</h3><p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium">{aiAnalysis.summary}</p></div></div>{aiAnalysis.criticalAlerts.length > 0 && (<div className="flex flex-wrap gap-2 md:ml-16">{aiAnalysis.criticalAlerts.map((alert, i) => (<span key={i} className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2 shadow-sm"><AlertTriangle size={14} strokeWidth={2} /> {alert}</span>))}</div>)}</div></div></div>)}
      <div>
        <div className="flex items-center justify-between mb-4 px-1"><h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-3">Fila de Atividades<span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-extrabold shadow-sm">{activeDemands.length}</span></h3></div>
        <div className="glass-panel rounded-[2rem] overflow-hidden w-full shadow-lg shadow-slate-200/30">
          {activeDemands.length > 0 ? (
            <div className="flex flex-col divide-y divide-slate-100/70">
              {activeDemands.map(demand => {
                const overdue = isOverdue(demand.dueDate);
                const event = getEvent(demand.eventId);
                return (
                  <div key={demand.id} className={`group hover-trigger relative flex flex-col md:flex-row md:items-center gap-4 p-5 transition-all duration-300 hover:bg-white/60 ${overdue ? 'bg-rose-50/30' : ''}`}>
                    {overdue && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => onCompleteDemand(demand.id)} className="shrink-0 text-slate-300 hover:text-emerald-500 transition-colors pl-2 transform active:scale-95 md:hover:scale-110 duration-200 p-2" title="Concluir"><Circle size={24} strokeWidth={1.5} /></button>
                        <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-white shadow-sm flex items-center justify-center">{event?.imageUrl ? (<img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />) : (<span className="text-xs font-bold text-slate-400">{event?.title ? event.title.substring(0,2).toUpperCase() : 'EV'}</span>)}</div>
                        <div className="flex-1 min-w-0 md:hidden"><div className="flex items-center gap-2 mb-0.5"><h4 className={`font-bold text-sm truncate ${overdue ? 'text-rose-700' : 'text-slate-800'}`}>{demand.title}</h4>{demand.priority === Priority.HIGH && (<span className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>)}</div><div className="flex items-center gap-2 text-xs text-slate-400"><span className="font-bold">{event?.title || 'Geral'}</span><span>•</span><span className={overdue ? 'text-rose-500 font-bold' : ''}>{formatDate(demand.dueDate)}</span></div></div>
                    </div>
                    <div className="flex-1 min-w-0 hidden md:flex flex-col md:flex-row md:items-center gap-2 md:gap-8"><div className="flex-1 min-w-0"><div className="flex items-center gap-3 mb-1.5"><h4 className={`font-bold text-base md:text-lg truncate ${overdue ? 'text-rose-700' : 'text-slate-800'}`}>{demand.title}</h4>{demand.priority === Priority.HIGH && (<span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-wide shadow-sm">Urgente</span>)}</div><p className="text-sm text-slate-500 truncate font-medium">{demand.description || <span className="opacity-40 italic">Sem descrição</span>}</p></div><div className="flex items-center gap-8 md:justify-end shrink-0 mt-2 md:mt-0"><div className="flex flex-col md:items-end"><span className="text-[11px] text-slate-600 px-3 py-1.5 rounded-xl bg-white/70 border border-slate-200 font-bold max-w-[160px] truncate shadow-sm">{event?.title || 'Geral'}</span></div><div className={`text-xs font-bold flex items-center gap-2 w-24 justify-end ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>{formatDate(demand.dueDate)}</div></div></div>
                    <div className="flex items-center justify-end gap-3 pl-4 md:opacity-0 hover-target transition-opacity duration-300 w-full md:w-auto border-t md:border-0 border-slate-100 pt-3 md:pt-0 mt-2 md:mt-0">
                      <button onClick={() => onManageDemand(demand)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition flex items-center gap-2 md:block" title="Editar"><Edit2 size={18} strokeWidth={2} /><span className="md:hidden text-xs font-bold">Editar</span></button>
                      <button onClick={() => onDeleteDemand(demand.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2 md:block" title="Excluir"><Trash2 size={18} strokeWidth={2} /><span className="md:hidden text-xs font-bold">Excluir</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-white/10"><div className="w-24 h-24 bg-white/60 rounded-full flex items-center justify-center mb-6 shadow-sm border border-white"><CheckCircle2 size={48} strokeWidth={1} className="text-emerald-400" /></div><p className="text-lg font-semibold text-slate-500">Tudo limpo por aqui.</p><button onClick={onOpenDemandModal} className="mt-5 text-indigo-600 text-sm font-bold hover:underline flex items-center gap-2 transition-transform hover:translate-x-1">Criar primeira demanda <ArrowRight size={16}/></button></div>
          )}
        </div>
      </div>
    </div>
  );
};

const EventsView: React.FC<{ events: Event[], onOpenEventModal: () => void, onEditEvent: (e: Event) => void, onCompleteEvent: (id: string) => void, onDeleteEvent: (id: string) => void }> = ({ events, onOpenEventModal, onEditEvent, onCompleteEvent, onDeleteEvent }) => {
  const activeEvents = useMemo(() => events.filter(e => e.status === 'ACTIVE' || e.status === 'PROSPECT').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [events]);
  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-24 w-full px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 md:mb-8"><h2 className="text-2xl md:text-3xl font-bold text-slate-800">Eventos</h2><button onClick={onOpenEventModal} className="btn-primary px-6 py-3 rounded-2xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-indigo-200 w-full md:w-auto justify-center"><Plus size={18} strokeWidth={3} /> Novo Evento</button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 min-[1800px]:grid-cols-8 gap-5 md:gap-6">
        {activeEvents.map(event => (
          <div key={event.id} className="group glass-panel rounded-[2rem] md:rounded-[2.5rem] overflow-hidden flex flex-col h-80 md:h-88 bg-white/50 relative cursor-default hover:shadow-xl hover:shadow-slate-200 transition-all duration-500">
            <div className="relative h-40 md:h-44 bg-slate-100 overflow-hidden shrink-0">{event.imageUrl ? (<img src={event.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />) : (<div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-slate-100" />)}<div className="absolute top-4 left-4 z-10">{event.status === 'PROSPECT' ? (<span className="px-3 py-1.5 rounded-xl bg-amber-100/95 text-amber-800 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md border border-white/20">Prospect</span>) : (<span className="px-3 py-1.5 rounded-xl bg-emerald-100/95 text-emerald-800 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md border border-white/20">Ativo</span>)}</div><div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-auto transform translate-y-0 md:-translate-y-2 md:group-hover:translate-y-0">{event.websiteUrl && (<a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-white/90 hover:bg-blue-50 text-slate-600 hover:text-blue-600 backdrop-blur rounded-xl transition shadow-md cursor-pointer"><ExternalLink size={16} strokeWidth={2.5} /></a>)}<button onClick={(e) => { e.stopPropagation(); onEditEvent(event); }} className="p-2 bg-white/90 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 backdrop-blur rounded-xl transition shadow-md cursor-pointer"><Edit2 size={16} strokeWidth={2.5}/></button><button onClick={(e) => { e.stopPropagation(); onCompleteEvent(event.id); }} className="p-2 bg-white/90 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 backdrop-blur rounded-xl transition shadow-md cursor-pointer"><CheckCircle2 size={16} strokeWidth={2.5}/></button><button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="p-2 bg-white/90 hover:bg-rose-50 text-slate-600 hover:text-rose-600 backdrop-blur rounded-xl transition shadow-md cursor-pointer"><Trash2 size={16} strokeWidth={2.5}/></button></div></div>
            <div className="p-5 md:p-6 flex flex-col flex-1 justify-between relative"><div className="absolute -top-7 right-6 w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center text-slate-400 text-xs font-bold border border-slate-50 z-10 transform rotate-3 group-hover:rotate-0 transition-transform duration-300"><div className="flex flex-col items-center leading-none gap-1"><span className="text-[10px] uppercase tracking-widest">{formatDate(event.date).split(' ')[1]}</span><span className="text-xl text-indigo-600">{formatDate(event.date).split(' ')[0]}</span></div></div><div className="mt-4"><h3 className="text-lg font-bold text-slate-800 leading-tight mb-2 truncate">{event.title}</h3><p className="text-xs text-slate-500 truncate max-w-[160px] flex items-center gap-1.5 font-medium"><MapPin size={14} className="text-indigo-400"/> {event.location || 'Local não definido'}</p></div></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ArchiveView: React.FC<{ events: Event[], demands: Demand[], onRestoreEvent: (id: string) => void, onRestoreDemand: (id: string) => void, onDeleteEvent: (id: string) => void }> = ({ events, demands, onRestoreEvent, onRestoreDemand, onDeleteEvent }) => {
  const completedEvents = events.filter(e => e.status === 'COMPLETED');
  const completedDemands = demands.filter(d => d.status === Status.DONE);
  const getEventName = (id: string) => events.find(e => e.id === id)?.title || 'Evento';
  return (
    <div className="space-y-10 animate-fade-in pb-20 w-full px-2 md:px-0">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Arquivados</h2>
      <div className="space-y-5"><h3 className="text-lg font-bold text-slate-500 border-b border-slate-200 pb-3 flex items-center gap-2"><Archive size={20}/> Eventos Finalizados</h3><div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7 gap-5">{completedEvents.map(event => (<GlassCard key={event.id} className="opacity-70 hover:opacity-100 hover:bg-white transition-all border-slate-100 p-6 group relative overflow-hidden"><div className="flex justify-between items-start mb-4 relative z-10"><h4 className="font-bold text-slate-700 text-sm truncate max-w-[70%]">{event.title}</h4><button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"><Trash2 size={16}/></button></div><p className="text-xs text-slate-400 mb-5 flex items-center gap-1.5"><CalendarIcon size={12}/> {formatDate(event.date)}</p><button onClick={(e) => { e.stopPropagation(); onRestoreEvent(event.id); }} className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-xs text-slate-500 hover:text-indigo-600 transition flex items-center justify-center gap-2 font-bold relative z-10 cursor-pointer"><RefreshCw size={14}/> Reabrir</button></GlassCard>))}</div></div>
      <div className="space-y-5"><h3 className="text-lg font-bold text-slate-500 border-b border-slate-200 pb-3 flex items-center gap-2"><CheckCircle2 size={20}/> Histórico de Demandas</h3><div className="glass-panel rounded-[2rem] overflow-hidden w-full">{completedDemands.length === 0 ? (<div className="p-12 text-center text-slate-400 text-sm">Histórico vazio.</div>) : (<div className="max-h-[500px] overflow-y-auto custom-scrollbar">{completedDemands.map(demand => (<div key={demand.id} className="flex items-center justify-between p-5 border-b border-slate-100 hover:bg-white/50 transition"><div className="flex-1 min-w-0 mr-4"><p className="text-slate-400 text-sm line-through decoration-slate-300 font-medium truncate">{demand.title}</p><div className="flex gap-2 mt-1"><span className="text-[10px] text-slate-500 bg-white/50 px-2 rounded-md border border-slate-100 font-semibold truncate">{getEventName(demand.eventId)}</span></div></div><button onClick={(e) => { e.stopPropagation(); onRestoreDemand(demand.id); }} className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition p-2.5 rounded-xl shadow-sm cursor-pointer" title="Restaurar"><RefreshCw size={18} /></button></div>))}</div>)}</div></div>
    </div>
  );
};

const CRMView: React.FC<{ clients: Client[], onAdd: () => void, onEdit: (c: Client) => void, onDelete: (id: string) => void }> = ({ clients, onAdd, onEdit, onDelete }) => {
    const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
    return (
        <div className="space-y-8 animate-fade-in pb-20 w-full px-2 md:px-0">
          <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-bold text-slate-800">CRM</h2><button onClick={onAdd} className="btn-primary px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 text-sm"><Plus size={18} strokeWidth={2.5} /> <span className="hidden md:inline">Novo Contato</span><span className="md:hidden">Novo</span></button></div>
          <div className="glass-panel rounded-[2rem] overflow-hidden w-full">{clients.length === 0 ? (<div className="p-20 text-center flex flex-col items-center justify-center bg-white/10"><Users size={56} className="text-indigo-200 mb-5" strokeWidth={1} /><p className="text-slate-500 font-medium text-lg">Nenhum contato cadastrado.</p><button onClick={onAdd} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Adicionar contato</button></div>) : (<div className="flex flex-col divide-y divide-slate-100">{sortedClients.map(client => (<div key={client.id} onClick={() => onEdit(client)} className="group flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-6 hover:bg-white/60 transition-all cursor-pointer"><div className="flex items-center gap-4 w-full md:w-1/3 shrink-0"><div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center text-indigo-600 font-bold text-xl shadow-sm border border-white shrink-0">{client.name.charAt(0).toUpperCase()}</div><div className="min-w-0"><h3 className="text-base md:text-lg font-bold text-slate-800 truncate">{client.name}</h3><p className="text-sm text-slate-500 truncate font-medium">{client.company || 'Empresa não informada'}</p></div></div><div className="flex flex-col gap-3 w-full"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="w-full md:w-1/3 flex flex-col gap-2"><p className="text-sm font-medium text-slate-600 truncate flex items-center gap-2"><Briefcase size={16} className="text-indigo-300"/> {client.role || 'Cargo não informado'}</p><div className="flex"><span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border w-fit ${client.status === 'Active' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : client.status === 'Inactive' ? 'border-rose-200 text-rose-600 bg-rose-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>{client.status === 'Potential' ? 'Potencial' : client.status === 'Active' ? 'Ativo' : 'Inativo'}</span></div></div><div className="w-full md:w-1/3 flex flex-col gap-2 text-xs text-slate-500"><p className="flex items-center gap-2 truncate font-medium"><Mail size={14} className="text-indigo-300"/> {client.email || '-'}</p><p className="flex items-center gap-2 truncate font-medium"><Phone size={14} className="text-indigo-300"/> {client.phone || '-'}</p></div></div></div><div className="flex items-center justify-end gap-3 md:gap-2 w-full md:w-auto mt-2 md:mt-0 border-t md:border-0 border-slate-100 pt-3 md:pt-0"><button onClick={(e) => { e.stopPropagation(); onEdit(client); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition" title="Editar"><Edit2 size={18} strokeWidth={2}/></button><button onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition" title="Excluir"><Trash2 size={18} strokeWidth={2}/></button></div></div>))}</div>)}</div>
        </div>
    );
};

const CalendarView: React.FC<{ demands: Demand[], onDeleteDemand: (id: string) => void, onCompleteDemand: (id: string) => void }> = ({ demands, onDeleteDemand, onCompleteDemand }) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const getDemandsForDay = (day: number) => demands.filter(d => { if (!d.dueDate) return false; const currentStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return d.dueDate === currentStr; });
  
    return (
      <div className="flex flex-col xl:flex-row gap-8 animate-fade-in w-full min-h-full pb-20 px-2 md:px-0">
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6"><h2 className="text-2xl md:text-3xl font-bold text-slate-800">Calendário</h2><div className="flex items-center gap-1 bg-white/40 rounded-xl p-1 border border-white shadow-sm backdrop-blur-md"><button onClick={() => setCurrentMonth(p => p === 0 ? 11 : p - 1)} className="p-2 hover:bg-white rounded-lg text-slate-600 transition"><ChevronRight className="rotate-180" size={18}/></button><span className="text-slate-800 font-bold w-32 md:w-40 text-center text-xs md:text-sm uppercase tracking-wide">{monthNames[currentMonth]} {currentYear}</span><button onClick={() => setCurrentMonth(p => p === 11 ? 0 : p + 1)} className="p-2 hover:bg-white rounded-lg text-slate-600 transition"><ChevronRight size={18}/></button></div></div>
          <div className="glass-panel rounded-[2.5rem] p-4 md:p-8 border-white flex flex-col min-h-[500px] md:min-h-[600px] shadow-lg w-full bg-white/50 overflow-x-auto"><div className="grid grid-cols-7 mb-6 text-indigo-500 text-[10px] md:text-xs font-extrabold text-center uppercase tracking-widest min-w-[300px]"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div></div><div className="grid grid-cols-7 auto-rows-fr gap-1 md:gap-3 flex-1 min-w-[300px]">{Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}{Array.from({ length: daysInMonth }).map((_, i) => { const day = i + 1; const dayDemands = getDemandsForDay(day); const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear(); const isSelected = selectedDay === day; return (<div key={day} onClick={() => setSelectedDay(day)} className={`rounded-xl md:rounded-2xl p-1 md:p-2 border-2 transition-all cursor-pointer relative flex flex-col items-center justify-start group min-h-[60px] md:min-h-[100px] ${isSelected ? 'border-indigo-400 bg-indigo-50 shadow-inner' : 'border-transparent bg-white/40 hover:bg-white/70 hover:shadow-md'} ${isToday ? 'text-indigo-600' : 'text-slate-600'}`}><span className={`text-xs md:text-sm font-bold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : ''}`}>{day}</span><div className="flex gap-1 mt-2 justify-center w-full flex-wrap content-start px-1">{dayDemands.slice(0, 4).map((d, idx) => (<div key={idx} className={`w-1.5 h-1.5 rounded-full ${d.priority === Priority.HIGH ? 'bg-rose-500' : d.priority === Priority.MEDIUM ? 'bg-amber-400' : 'bg-emerald-400'} shadow-sm`} />))}{dayDemands.length > 4 && <div className="w-1 h-1 rounded-full bg-slate-300" />}</div></div>); })}</div></div>
        </div>
        <div className="w-full xl:w-[400px] glass-panel rounded-[2.5rem] p-6 md:p-8 flex flex-col h-auto border-white bg-white/60 shadow-xl md:sticky md:top-24"><h3 className="text-lg font-bold text-slate-700 mb-5 border-b border-slate-200/60 pb-4 flex items-center gap-3"><Clock size={22} className="text-indigo-500" strokeWidth={2} />{selectedDay ? `${selectedDay} de ${monthNames[currentMonth]}` : 'Detalhes'}</h3><div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 max-h-[300px] xl:max-h-[600px] pr-2">{selectedDay ? (getDemandsForDay(selectedDay).length > 0 ? (getDemandsForDay(selectedDay).map(d => (<div key={d.id} className={`group relative p-5 rounded-2xl border transition hover:scale-[1.02] ${d.status === Status.DONE ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white/80 border-white shadow-sm'}`}><div className="pr-8"><p className="text-slate-800 font-bold text-sm leading-tight">{d.title}</p>{d.description && (<p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{d.description}</p>)}</div><div className="flex items-center justify-between mt-3"><span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider ${d.priority === Priority.HIGH ? 'bg-rose-100 text-rose-600' : d.priority === Priority.MEDIUM ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{d.priority}</span><span className="text-xs text-slate-400 font-medium">{d.status}</span></div><div className="absolute top-4 right-4 flex gap-2"><button onClick={(e) => { e.stopPropagation(); onCompleteDemand(d.id); }} className="p-2 text-slate-300 hover:text-emerald-500 rounded-xl transition" title="Concluir e Arquivar"><CheckCircle2 size={18} strokeWidth={2} /></button><button onClick={(e) => { e.stopPropagation(); onDeleteDemand(d.id); }} className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition" title="Excluir Demanda"><Trash2 size={18} strokeWidth={2} /></button></div></div>))) : <div className="flex flex-col items-center justify-center h-40 md:h-64 text-slate-400 text-sm italic"><CalendarIcon size={48} className="mb-4 opacity-20" strokeWidth={1}/><p>Nenhuma demanda para este dia.</p></div>) : (<p className="text-slate-400 text-sm text-center mt-10">Selecione um dia para ver as demandas.</p>)}</div></div>
      </div>
    );
};

const NotesView: React.FC<{ notes: Note[], onAdd: () => void, onEdit: (n: Note) => void, onDelete: (id: string) => void }> = ({ notes, onAdd, onEdit, onDelete }) => {
  return (
    <div className="space-y-8 animate-fade-in pb-20 w-full px-2 md:px-0">
      <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-bold text-slate-800">Anotações</h2><button onClick={onAdd} className="btn-primary px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 text-sm"><Plus size={18} strokeWidth={2.5} /> <span className="hidden md:inline">Nova Nota</span><span className="md:hidden">Nova</span></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {notes.length === 0 ? (<div className="col-span-full p-20 text-center flex flex-col items-center justify-center bg-white/10 rounded-[2.5rem] border border-dashed border-slate-200"><StickyNote size={56} className="text-indigo-200 mb-5" strokeWidth={1} /><p className="text-slate-500 font-medium text-lg">Nenhuma nota criada.</p><button onClick={onAdd} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Criar primeira nota</button></div>) : (notes.map(note => (<div key={note.id} onClick={() => onEdit(note)} className={`group relative p-6 rounded-[2rem] transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${note.color || 'bg-yellow-50'} border border-white/50 shadow-sm min-h-[200px] flex flex-col`}><div className="flex-1 mb-4 overflow-hidden"><LinkifiedText text={note.content} /></div><div className="flex items-end justify-between mt-auto pt-4 border-t border-black/5"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 opacity-70">{formatDate(note.createdAt)}</span>{note.dueDate && (<span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${isOverdue(note.dueDate) ? 'bg-rose-500 text-white' : 'bg-white/50 text-slate-600'}`}>{formatDate(note.dueDate)}</span>)}</div><button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="absolute top-4 right-4 p-2 rounded-xl bg-white/50 hover:bg-rose-500 hover:text-white text-slate-400 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"><Trash2 size={16} /></button></div>)))}
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'events' | 'crm' | 'calendar' | 'notes' | 'archive'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<Event>>({});
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [demandForm, setDemandForm] = useState<Partial<Demand>>({ priority: Priority.MEDIUM, status: Status.PENDING });
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({ status: 'Potential' });
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<string>('');
  const [noteDueDate, setNoteDueDate] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success'|'error'|'info'}[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const showToast = useCallback((message: string, type: 'success'|'error'|'info' = 'info') => { setToasts(prev => [...prev, { id: Math.random().toString(36), message, type }]); }, []);
  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);
  const confirmAction = (title: string, message: string, action: () => void) => { setConfirmConfig({ isOpen: true, title, message, onConfirm: () => { action(); setConfirmConfig(prev => ({ ...prev, isOpen: false })); }}); };

  // --- REALTIME & SYNC ---
  const fetchData = useCallback(async () => {
    if (!supabase) return;
    const { data: e } = await supabase.from('events').select('*'); if(e) setEvents(e.map(mapEvent));
    const { data: d } = await supabase.from('demands').select('*'); if(d) setDemands(d.map(mapDemand));
    const { data: c } = await supabase.from('clients').select('*'); if(c) setClients(c.map(mapClient));
    const { data: n } = await supabase.from('notes').select('*'); if(n) setNotes(n.map(mapNote));
  }, []);

  useEffect(() => {
    fetchData();
    if (!supabase) return;

    const handlePayload = (payload: any, setFn: React.Dispatch<React.SetStateAction<any[]>>, mapFn: (x: any) => any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        setFn(prev => {
            if (eventType === 'INSERT') {
                if (prev.some(item => item.id === newRecord.id)) return prev.map(item => item.id === newRecord.id ? mapFn(newRecord) : item);
                return [...prev, mapFn(newRecord)];
            }
            if (eventType === 'UPDATE') return prev.map(item => item.id === newRecord.id ? mapFn(newRecord) : item);
            if (eventType === 'DELETE') return prev.filter(item => item.id !== oldRecord.id);
            return prev;
        });
    };

    const channel = supabase.channel('db_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (p) => handlePayload(p, setEvents, mapEvent))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'demands' }, (p) => handlePayload(p, setDemands, mapDemand))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (p) => handlePayload(p, setClients, mapClient))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (p) => handlePayload(p, setNotes, mapNote))
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // --- HANDLERS (Optimistic) ---
  const handleRefreshAnalysis = async () => {
    setIsAnalyzing(true); const result = await analyzeProjectRisks(events, demands); setAiAnalysis(result); setIsAnalyzing(false); showToast("IA atualizada", 'success');
  };
  const handleDismissAnalysis = () => setAiAnalysis(null);
  
  const handleSaveEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!eventForm.title || !eventForm.date) return showToast("Preencha título e data.", 'error');
    const id = eventForm.id || generateId();
    const formattedUrl = formatUrl(eventForm.websiteUrl || '');
    const optimisticEvent: Event = { id, title: eventForm.title, date: eventForm.date, location: eventForm.location || '', description: eventForm.description || '', status: eventForm.status || 'ACTIVE', imageUrl: eventForm.imageUrl, websiteUrl: formattedUrl };
    
    setEvents(prev => eventForm.id ? prev.map(ev => ev.id === id ? optimisticEvent : ev) : [...prev, optimisticEvent]);
    setIsEventModalOpen(false); setEventForm({}); showToast(eventForm.id ? "Evento atualizado!" : "Evento criado!", 'success');

    if (!supabase) return;
    const payload = { id, title: eventForm.title, date: eventForm.date, location: eventForm.location, description: eventForm.description, status: eventForm.status || 'ACTIVE', image_url: eventForm.imageUrl, website_url: formattedUrl };
    if (eventForm.id) await supabase.from('events').update(payload).eq('id', id); else await supabase.from('events').insert([payload]);
  };

  const deleteItem = async (table: string, id: string, setFn: React.Dispatch<React.SetStateAction<any[]>>) => {
      setFn(prev => prev.filter(item => item.id !== id));
      if(supabase) await supabase.from(table).delete().eq('id', id);
  };

  const handleDeleteEvent = (id: string) => confirmAction("Excluir", "Tem certeza?", () => { deleteItem('events', id, setEvents); setDemands(p => p.filter(d => d.eventId !== id)); showToast("Evento excluído.", 'success'); });
  const handleDeleteDemand = (id: string) => confirmAction("Excluir", "Apagar demanda?", () => { deleteItem('demands', id, setDemands); showToast("Demanda excluída.", 'success'); });
  const handleDeleteClient = (id: string) => confirmAction("Excluir", "Remover contato?", () => { deleteItem('clients', id, setClients); showToast("Contato removido.", 'success'); });
  const handleDeleteNote = (id: string) => { deleteItem('notes', id, setNotes); showToast("Nota excluída.", 'info'); };

  const handleCompleteEvent = (id: string) => confirmAction("Finalizar", "Arquivar evento?", async () => {
      setEvents(p => p.map(e => e.id === id ? { ...e, status: 'COMPLETED' } : e)); showToast("Evento arquivado.", 'success');
      if(supabase) await supabase.from('events').update({ status: 'COMPLETED' }).eq('id', id);
  });
  const handleRestoreEvent = async (id: string) => {
      setEvents(p => p.map(e => e.id === id ? { ...e, status: 'ACTIVE' } : e)); showToast("Evento reaberto.", 'success');
      if(supabase) await supabase.from('events').update({ status: 'ACTIVE' }).eq('id', id);
  };
  const handleSaveDemand = async () => {
    let targetEventId = demandForm.eventId;
    if (!targetEventId) { if (events.length === 1) targetEventId = events[0].id; else return showToast("Selecione um evento.", 'error'); }
    const id = demandForm.id || generateId();
    const optimisticDemand: Demand = { id, eventId: targetEventId!, title: demandForm.title!, description: demandForm.description || '', priority: demandForm.priority || Priority.MEDIUM, status: demandForm.status || Status.PENDING, dueDate: demandForm.dueDate };
    setDemands(prev => demandForm.id ? prev.map(d => d.id === id ? optimisticDemand : d) : [...prev, optimisticDemand]);
    setIsDemandModalOpen(false); setDemandForm({ priority: Priority.MEDIUM, status: Status.PENDING }); showToast("Demanda salva!", 'success');
    if (!supabase) return;
    const payload = { id, event_id: targetEventId, title: demandForm.title, description: demandForm.description, priority: demandForm.priority || 'Média', status: demandForm.status || 'Pendente', due_date: demandForm.dueDate };
    if (demandForm.id) await supabase.from('demands').update(payload).eq('id', id); else await supabase.from('demands').insert([payload]);
  };
  const handleCompleteDemand = async (id: string) => {
      setDemands(p => p.map(d => d.id === id ? { ...d, status: Status.DONE } : d)); showToast("Demanda concluída!", 'success');
      if(supabase) await supabase.from('demands').update({ status: 'Concluído' }).eq('id', id);
  };
  const handleRestoreDemand = async (id: string) => {
      setDemands(p => p.map(d => d.id === id ? { ...d, status: Status.PENDING } : d)); showToast("Demanda restaurada.", 'success');
      if(supabase) await supabase.from('demands').update({ status: 'Pendente' }).eq('id', id);
  };
  const handleSaveClient = async () => {
      if(!clientForm.name) return showToast("Nome obrigatório.", 'error');
      const id = clientForm.id || generateId();
      const optClient: Client = { id, name: clientForm.name, company: clientForm.company||'', role: clientForm.role||'', email: clientForm.email||'', phone: clientForm.phone||'', status: clientForm.status||'Potential', notes: clientForm.notes||'' };
      setClients(p => clientForm.id ? p.map(c => c.id === id ? optClient : c) : [...p, optClient]);
      setIsClientModalOpen(false); setClientForm({ status: 'Potential' }); showToast("Cliente salvo!", 'success');
      if(supabase) { const payload = { id, name: clientForm.name, company: clientForm.company, role: clientForm.role, email: clientForm.email, phone: clientForm.phone, status: clientForm.status||'Potential', notes: clientForm.notes }; if(clientForm.id) await supabase.from('clients').update(payload).eq('id', id); else await supabase.from('clients').insert([payload]); }
  };
  const handleSaveNote = async () => {
      if(!noteForm.trim()) return;
      const id = editingNoteId || generateId();
      const colors = ['bg-yellow-50', 'bg-blue-50', 'bg-emerald-50', 'bg-rose-50', 'bg-purple-50'];
      const optNote: Note = { id, content: noteForm, createdAt: new Date().toISOString(), dueDate: noteDueDate, color: editingNoteId ? (notes.find(n=>n.id===id)?.color || 'bg-yellow-50') : colors[Math.floor(Math.random()*colors.length)] };
      setNotes(p => editingNoteId ? p.map(n => n.id === id ? { ...optNote, createdAt: n.createdAt } : n) : [optNote, ...p]);
      setIsNoteModalOpen(false); setNoteForm(''); setNoteDueDate(''); setEditingNoteId(null); showToast("Nota salva.", 'success');
      if(supabase) { if (editingNoteId) await supabase.from('notes').update({ content: noteForm, due_date: noteDueDate }).eq('id', id); else await supabase.from('notes').insert([{ id, content: noteForm, due_date: noteDueDate, color: optNote.color }]); }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.size < 5000000) { const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === 'string') setEventForm(p => ({ ...p, imageUrl: reader.result as string })); }; reader.readAsDataURL(file); } else if(file) showToast("Arquivo muito grande.", 'error');
  };
  const openNoteEdit = (n: Note) => { setEditingNoteId(n.id); setNoteForm(n.content); setNoteDueDate(n.dueDate||''); setIsNoteModalOpen(true); };

  return (
    <div className="min-h-screen flex bg-transparent font-sans selection:bg-indigo-100 selection:text-indigo-800">
      <div className="toast-container">{toasts.map(t => (<Toast key={t.id} {...t} onClose={removeToast} />))}</div>
      <ConfirmDialog isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={confirmConfig.onConfirm} onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} />
      {isMobileMenuOpen && (<div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />)}

      <aside className={`fixed lg:sticky top-0 h-screen w-72 flex-shrink-0 border-r border-white/60 bg-white/40 glass-sidebar flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div>
          <div className="h-20 lg:h-24 flex items-center px-6 lg:px-8 border-b border-white/40"><div className="w-10 h-10 lg:w-11 lg:h-11 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0 text-white"><Layout size={20} strokeWidth={2.5} /></div><div className="ml-4"><h1 className="font-bold text-lg tracking-tight text-slate-800">Lon Demandas</h1><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"></span><p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Pro v6.1 Lite</p></div></div><button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden ml-auto p-2 text-slate-400"><X size={24} /></button></div>
          <nav className="p-4 space-y-2">{[{ id: 'dashboard', label: 'Visão Geral', icon: BarChart3 }, { id: 'events', label: 'Eventos', icon: Layout }, { id: 'calendar', label: 'Calendário', icon: CalendarIcon }, { id: 'crm', label: 'CRM', icon: Users }, { id: 'notes', label: 'Anotações', icon: StickyNote }, { id: 'archive', label: 'Arquivados', icon: Archive }].map(item => (<button key={item.id} onClick={() => { setView(item.id as any); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-5 py-3.5 rounded-2xl transition-all duration-200 group relative border ${view === item.id ? 'bg-white/80 shadow-md shadow-slate-200/50 border-white text-indigo-600' : 'border-transparent text-slate-500 hover:bg-white/40 hover:text-indigo-500'}`}><item.icon size={20} className={`transition-transform duration-200 ${view === item.id ? 'text-indigo-600' : 'group-hover:scale-110'}`} strokeWidth={view === item.id ? 2.5 : 2} /><span className={`ml-3 font-semibold text-sm ${view === item.id ? 'text-slate-800' : ''}`}>{item.label}</span></button>))}</nav>
        </div>
        <div className="p-6"><div className="p-5 rounded-3xl bg-gradient-to-br from-white to-indigo-50 border border-white shadow-sm"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><Briefcase size={16} strokeWidth={2.5}/></div><div><p className="text-xs font-bold text-slate-700">Status Online</p><p className="text-[10px] text-slate-400 font-medium">Sincronizado</p></div></div></div></div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        <div className="h-16 lg:h-24 flex items-center px-4 lg:px-8 justify-between z-20 sticky top-0 bg-transparent w-full"><div className="flex items-center gap-4 lg:hidden"><button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-white/50 rounded-xl transition"><Menu size={24} /></button><span className="font-bold text-slate-800 text-lg">Lon Demandas</span></div><div className="hidden lg:flex text-slate-400 text-xs items-center gap-2 font-semibold tracking-wide"><span className="uppercase">Lon Demandas</span><ChevronRight size={12} className="opacity-40" strokeWidth={2} /><span className="capitalize text-indigo-900 bg-white/50 px-3 py-1.5 rounded-xl shadow-sm border border-white font-bold backdrop-blur-md">{view === 'dashboard' ? 'Visão Geral' : view === 'crm' ? 'CRM' : view}</span></div><div className="flex items-center gap-3 lg:gap-5"><div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border-2 border-white shadow-lg shadow-indigo-200 flex items-center justify-center text-xs lg:text-sm font-bold text-white cursor-pointer transform hover:scale-105 transition">AD</div></div></div>
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 w-full">
          {view === 'dashboard' && <DashboardView events={events} demands={demands} notes={notes} aiAnalysis={aiAnalysis} onRefreshAnalysis={handleRefreshAnalysis} onDismissAnalysis={handleDismissAnalysis} isAnalyzing={isAnalyzing} onOpenDemandModal={() => setIsDemandModalOpen(true)} onManageDemand={(d) => { setDemandForm(d); setIsDemandModalOpen(true); }} onCompleteDemand={handleCompleteDemand} onDeleteDemand={handleDeleteDemand} />}
          {view === 'events' && <EventsView events={events} onOpenEventModal={() => setIsEventModalOpen(true)} onEditEvent={(e) => { setEventForm(e); setIsEventModalOpen(true); }} onCompleteEvent={handleCompleteEvent} onDeleteEvent={handleDeleteEvent} />}
          {view === 'archive' && <ArchiveView events={events} demands={demands} onRestoreEvent={handleRestoreEvent} onRestoreDemand={handleRestoreDemand} onDeleteEvent={handleDeleteEvent} />}
          {view === 'crm' && <CRMView clients={clients} onAdd={() => setIsClientModalOpen(true)} onEdit={(c) => { setClientForm(c); setIsClientModalOpen(true); }} onDelete={handleDeleteClient} />}
          {view === 'calendar' && <CalendarView demands={demands} onDeleteDemand={handleDeleteDemand} onCompleteDemand={handleCompleteDemand} />}
          {view === 'notes' && <NotesView notes={notes} onAdd={() => setIsNoteModalOpen(true)} onEdit={openNoteEdit} onDelete={handleDeleteNote} />}
        </main>
      </div>
      {/* Modals (Same as before) */}
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={eventForm.id ? "Editar Evento" : "Novo Evento"}><form onSubmit={handleSaveEvent} className="space-y-6"><div className="flex flex-col items-center justify-center"><label className="w-full h-36 md:h-44 border-2 border-dashed border-slate-300 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition overflow-hidden relative group bg-white/20">{eventForm.imageUrl ? (<><img src={eventForm.imageUrl} className="w-full h-full object-cover absolute inset-0 opacity-90 group-hover:opacity-70 transition duration-500" /><div className="z-10 bg-white/90 px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 shadow-lg backdrop-blur-md transform scale-90 group-hover:scale-100 transition">Alterar Capa</div></>) : (<div className="text-center text-slate-400"><div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400 group-hover:scale-110 transition shadow-sm"><Upload size={24} strokeWidth={2} /></div><span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Carregar Imagem</span></div>)}<input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label></div><div className="space-y-4"><input type="text" placeholder="Título do Evento *" value={eventForm.title || ''} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="w-full px-5 py-4 rounded-2xl glass-input placeholder-slate-400 font-bold text-lg" autoFocus required /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="relative"><select value={eventForm.status || 'ACTIVE'} onChange={e => setEventForm({...eventForm, status: e.target.value as EventStatus})} className="w-full glass-input px-5 py-4 rounded-2xl appearance-none bg-white text-slate-700 font-medium"><option value="ACTIVE">Ativo</option><option value="PROSPECT">Prospectar</option><option value="COMPLETED">Finalizado</option></select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/></div><input type="date" value={eventForm.date || ''} onChange={e => setEventForm({...eventForm, date: e.target.value})} className="glass-input px-5 py-4 rounded-2xl text-slate-700 font-medium" required /></div><div className="relative"><input type="text" placeholder="Localização" value={eventForm.location || ''} onChange={e => setEventForm({...eventForm, location: e.target.value})} className="w-full glass-input px-5 py-4 rounded-2xl placeholder-slate-400 pl-12" /><MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /></div><div className="relative"><input type="url" placeholder="Site do Evento (ex: www.meuevento.com)" value={eventForm.websiteUrl || ''} onChange={e => setEventForm({...eventForm, websiteUrl: e.target.value})} className="w-full glass-input px-5 py-4 rounded-2xl placeholder-slate-400 pl-12" /><Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /></div><textarea placeholder="Descrição detalhada do evento..." value={eventForm.description || ''} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="glass-input px-5 py-4 rounded-2xl h-32 w-full resize-none placeholder-slate-400" /></div><button type="submit" className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition shadow-xl shadow-slate-300 transform hover:-translate-y-0.5">Salvar Evento</button></form></Modal>
      <Modal isOpen={isDemandModalOpen} onClose={() => setIsDemandModalOpen(false)} title="Gerenciar Demanda"><div className="space-y-6"><div className="space-y-4"><div className="relative"><select value={demandForm.eventId || ''} onChange={e => setDemandForm({...demandForm, eventId: e.target.value})} className="w-full glass-input px-5 py-4 rounded-2xl appearance-none text-slate-700 bg-white font-bold"><option value="" disabled className="text-slate-400 font-normal">Selecione o Evento...</option>{events.filter(e => e.status !== 'COMPLETED').map(e => (<option key={e.id} value={e.id} className="text-slate-700 font-medium">{e.title}</option>))}</select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/></div><input type="text" placeholder="Título da demanda" value={demandForm.title || ''} onChange={e => setDemandForm({...demandForm, title: e.target.value})} className="w-full px-5 py-4 rounded-2xl glass-input placeholder-slate-400 font-medium text-lg" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="relative"><select value={demandForm.priority} onChange={e => setDemandForm({...demandForm, priority: e.target.value as Priority})} className="w-full glass-input px-5 py-4 rounded-2xl appearance-none bg-white text-slate-700 font-medium">{Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}</select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/></div><input type="date" value={demandForm.dueDate || ''} onChange={e => setDemandForm({...demandForm, dueDate: e.target.value})} className="glass-input px-5 py-4 rounded-2xl text-slate-700 font-medium" /></div><textarea placeholder="Detalhes operacionais..." value={demandForm.description || ''} onChange={e => setDemandForm({...demandForm, description: e.target.value})} className="glass-input px-5 py-4 rounded-2xl h-32 w-full resize-none placeholder-slate-400" /></div><button onClick={handleSaveDemand} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition shadow-xl shadow-indigo-200 transform hover:-translate-y-0.5">Salvar Demanda</button></div></Modal>
      <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Editar Contato"><div className="space-y-4"><div className="flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><Users size={24} strokeWidth={2} /></div><input type="text" placeholder="Nome Completo" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="flex-1 px-5 py-4 rounded-2xl glass-input placeholder-slate-400 font-bold text-lg min-w-0" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="text" placeholder="Empresa" value={clientForm.company || ''} onChange={e => setClientForm({...clientForm, company: e.target.value})} className="glass-input px-5 py-4 rounded-2xl placeholder-slate-400" /><input type="text" placeholder="Cargo" value={clientForm.role || ''} onChange={e => setClientForm({...clientForm, role: e.target.value})} className="glass-input px-5 py-4 rounded-2xl placeholder-slate-400" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="email" placeholder="Email" value={clientForm.email || ''} onChange={e => setClientForm({...clientForm, email: e.target.value})} className="glass-input px-5 py-4 rounded-2xl placeholder-slate-400" /><input type="tel" placeholder="Telefone" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="glass-input px-5 py-4 rounded-2xl placeholder-slate-400" /></div><div className="relative"><select value={clientForm.status} onChange={e => setClientForm({...clientForm, status: e.target.value as any})} className="w-full glass-input px-5 py-4 rounded-2xl bg-white text-slate-700 font-medium appearance-none"><option value="Potential">Potencial</option><option value="Active">Ativo</option><option value="Inactive">Inativo</option></select><ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"/></div><div className="border-t border-slate-200 pt-4"><label className="text-xs text-slate-500 mb-2 block font-bold uppercase tracking-wider">Histórico & Observações</label><textarea placeholder="Anote reuniões, preferências..." value={clientForm.notes || ''} onChange={e => setClientForm({...clientForm, notes: e.target.value})} className="glass-input px-5 py-4 rounded-2xl h-32 w-full resize-none text-sm placeholder-slate-400" /></div><button onClick={handleSaveClient} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition shadow-xl shadow-slate-300 transform hover:-translate-y-0.5">Salvar Contato</button></div></Modal>
      <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="Editar Nota"><div className="space-y-6"><div className="flex flex-col gap-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data de Entrega (Opcional)</label><input type="date" value={noteDueDate} onChange={e => setNoteDueDate(e.target.value)} className="glass-input px-5 py-3 rounded-2xl text-slate-700 font-medium w-full" /></div><textarea placeholder="Escreva sua ideia aqui..." value={noteForm} onChange={e => setNoteForm(e.target.value)} className="glass-input px-6 py-6 rounded-3xl h-64 md:h-80 w-full resize-none text-lg leading-relaxed placeholder-slate-300 border-2 border-transparent focus:border-indigo-200" autoFocus /><button onClick={handleSaveNote} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition shadow-xl shadow-indigo-200 transform hover:-translate-y-0.5">{editingNoteId ? "Atualizar Nota" : "Salvar Nota"}</button></div></Modal>
    </div>
  );
};

export default App;
