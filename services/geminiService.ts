
import { GoogleGenAI, Type } from "@google/genai";
import { Event, Demand, AIDemandSuggestion, AIAnalysisResult } from "../types";

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
