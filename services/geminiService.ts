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
    // Prepare context for AI
    const activeEvents = events.filter(e => e.status === 'ACTIVE');
    const pendingDemands = demands.filter(d => d.status !== 'Concluído');
    const highPriority = pendingDemands.filter(d => d.priority === 'Alta');
    
    const context = JSON.stringify({
      activeEvents: activeEvents.map(e => e.title),
      urgentCount: highPriority.length,
      nextUrgent: highPriority[0] ? { title: highPriority[0].title, due: highPriority[0].dueDate } : null
    });

    const prompt = `
      Você é o assistente inteligente do sistema "Lon Demandas".
      Dados atuais: ${context}

      Tarefa:
      Crie uma "Saudação de Briefing" (summary) que comece com "Olá" ou "Bom dia", e em seguida, de forma amigável mas direta, avise sobre o evento ou demanda mais urgente.
      Exemplo: "Bom dia! Se atente ao evento X que tem demandas urgentes." ou "Olá, tudo tranquilo, mas não esqueça de Y."

      Se não houver nada urgente, dê um feedback positivo.

      Além disso, liste até 3 pontos críticos curtos se existirem.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A saudação e aviso principal." },
            criticalAlerts: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (response.text) {
      const result = parseJSON(response.text);
      return result || { summary: "Não foi possível processar a resposta da IA.", criticalAlerts: [] };
    }
    return { summary: "Não foi possível analisar.", criticalAlerts: [] };
  } catch (error) {
    console.error(error);
    return { summary: "Erro na análise de IA.", criticalAlerts: ["Verifique sua conexão."] };
  }
}