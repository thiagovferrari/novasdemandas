
import { GoogleGenAI, Type } from "@google/genai";
import { Event, Demand, AIDemandSuggestion, AIAnalysisResult, AIActionResponse } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean AI response (strip markdown code blocks)
const parseJSON = (text: string) => {
  try {
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON from AI:", text);
    return null;
  }
};

export const generateDemandsForEvent = async (event: Event): Promise<AIDemandSuggestion[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key missing. AI features disabled.");
    return [];
  }

  try {
    const prompt = `
      Gere uma lista de 5 a 7 demandas operacionais essenciais para o seguinte evento:
      Título: ${event.title}
      Descrição: ${event.description}
      Local: ${event.location}
      
      Foque em tarefas práticas (logística, marketing, catering, equipamento).
      Determine a prioridade (Baixa, Média, Alta) baseada na urgência típica.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Título curto da demanda" },
              description: { type: Type.STRING, description: "Descrição detalhada da tarefa" },
              priority: { type: Type.STRING, enum: ["Baixa", "Média", "Alta"], description: "Nível de prioridade" }
            },
            required: ["title", "priority", "description"]
          }
        }
      }
    });

    if (response.text) {
      return parseJSON(response.text) || [];
    }
    return [];
  } catch (error) {
    console.error("Error generating demands:", error);
    return [];
  }
};

export const analyzeProjectRisks = async (events: Event[], demands: Demand[]): Promise<AIAnalysisResult> => {
  if (!process.env.API_KEY) return { summary: "API Key não configurada.", criticalAlerts: [] };

  try {
    const activeEvents = events.filter(e => e.status === 'ACTIVE');
    const context = JSON.stringify({
      activeEvents: activeEvents.map(e => e.title),
    });

    const prompt = `
      Você é o assistente inteligente do sistema "Lon Demandas".
      Dados atuais: ${context}

      Tarefa:
      Crie uma "Saudação de Briefing" (summary) curta e amigável.
      Liste até 3 pontos de atenção genéricos se não houver dados específicos.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            criticalAlerts: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (response.text) return parseJSON(response.text) || { summary: "Sem dados.", criticalAlerts: [] };
    return { summary: "Erro.", criticalAlerts: [] };
  } catch (error) {
    return { summary: "Erro na análise.", criticalAlerts: [] };
  }
};

// NOVA FUNÇÃO: Processar Comandos de Chat
export const processNaturalLanguageCommand = async (command: string, existingEvents: Event[]): Promise<AIActionResponse> => {
  if (!process.env.API_KEY) return { type: 'UNKNOWN', data: null, message: "API Key não configurada." };

  try {
    // Mapear eventos para enviar IDs e Nomes para a IA entender o contexto
    const eventsContext = existingEvents.map(e => ({ id: e.id, title: e.title }));
    
    const prompt = `
      Você é um assistente operacional. O usuário vai pedir para criar Eventos ou Demandas.
      
      Eventos Existentes: ${JSON.stringify(eventsContext)}
      
      Comando do Usuário: "${command}"
      
      Regras:
      1. Se o usuário quiser criar DEMANDAS para um evento existente, encontre o ID do evento mais parecido na lista.
         Retorne type: 'CREATE_DEMAND'. data deve ser um ARRAY de objetos demanda (title, description, priority, dueDate no formato YYYY-MM-DD).
         Se o usuário disse "para amanhã", calcule a data.
      
      2. Se o usuário quiser criar um EVENTO NOVO, retorne type: 'CREATE_EVENT'.
         data deve ser um objeto evento (title, date YYYY-MM-DD, description, location).
         
      3. Se não entendeu, type: 'UNKNOWN'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['CREATE_DEMAND', 'CREATE_EVENT', 'UNKNOWN'] },
            message: { type: Type.STRING, description: "Uma mensagem curta confirmando o que foi feito." },
            data: { 
               type: Type.OBJECT, 
               description: "O objeto do evento ou a lista de demandas. Se for lista, coloque dentro de uma propriedade 'items'."
            }
          }
        }
      }
    });

    if (response.text) {
      const result = parseJSON(response.text);
      
      // Normalizar resposta da IA se ela colocar array direto ou dentro de objeto
      if (result.type === 'CREATE_DEMAND' && !Array.isArray(result.data) && result.data?.items) {
          result.data = result.data.items;
      }
      
      return result;
    }
    
    return { type: 'UNKNOWN', data: null, message: "Não entendi." };

  } catch (error) {
    console.error("AI Command Error:", error);
    return { type: 'UNKNOWN', data: null, message: "Erro ao processar comando." };
  }
};
