
export enum Priority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta'
}

export enum Status {
  PENDING = 'Pendente',
  IN_PROGRESS = 'Em Andamento',
  DONE = 'Concluído'
}

export type EventStatus = 'ACTIVE' | 'PROSPECT' | 'COMPLETED';

export interface Demand {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  dueDate?: string; 
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  status: EventStatus;
  imageUrl?: string; // Base64 image
  websiteUrl?: string; // URL do site do evento
}

export interface Client {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  status: 'Potential' | 'Active' | 'Inactive';
  notes: string;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  dueDate?: string; // Nova data de entrega
  color: string; // for visual variety
}

export interface AIDemandSuggestion {
  title: string;
  priority: string; 
  description: string;
}

export interface AIAnalysisResult {
  summary: string;
  criticalAlerts: string[];
  topPriorityId?: string;
}

// Novos tipos para o Assistente de Chat
export type AIActionType = 'CREATE_DEMAND' | 'CREATE_EVENT' | 'UNKNOWN';

export interface AIActionResponse {
  type: AIActionType;
  data: any; // Pode ser uma lista de demandas ou um evento
  message: string; // Resposta da IA para o usuário
}
