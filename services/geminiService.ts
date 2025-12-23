import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, AIAnalysisResult, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to categorize a transaction based on description
export const suggestCategory = async (description: string, type: 'income' | 'expense' = 'expense'): Promise<string> => {
  if (!apiKey) return "Outros";
  
  const categoriesList = type === 'income' 
    ? INCOME_CATEGORIES.join(", ")
    : Object.keys(EXPENSE_CATEGORIES).join(", ");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Você é um assistente financeiro. Categorize a transação abaixo escolhendo ESTRITAMENTE uma das categorias da lista fornecida.
        
        Transação: "${description}"
        Tipo: ${type === 'income' ? 'Entrada (Receita)' : 'Saída (Despesa)'}
        
        Lista de Categorias Permitidas: ${categoriesList}
        
        Retorne APENAS o nome da categoria exata da lista. Se não tiver certeza, retorne "Outros".
      `,
    });
    const text = response.text.trim();
    // Basic cleanup to remove quotes if the model adds them
    return text.replace(/['"]/g, "") || "Outros";
  } catch (error) {
    console.error("Erro ao categorizar:", error);
    return "Outros";
  }
};

// Analyze financial health
export const analyzeFinances = async (transactions: Transaction[]): Promise<AIAnalysisResult> => {
  if (!apiKey) {
    return {
      summary: "Configure sua chave API para receber insights inteligentes.",
      tips: ["Adicione sua API Key", "Registre mais gastos", "Defina metas"],
      sentiment: "neutral"
    };
  }

  // Filter last 30 days or up to 50 recent transactions to keep context small
  const recentTransactions = transactions
    .slice(-50)
    .map(t => `${t.date}: ${t.description} (${t.type}) - R$ ${t.amount} [${t.category}]`);

  const prompt = `
    Atue como um consultor financeiro pessoal chamado "Finora". Analise estas transações recentes:
    ${JSON.stringify(recentTransactions)}

    Por favor, forneça uma análise em formato JSON com:
    1. "summary": Um parágrafo curto (max 30 palavras) sobre a saúde financeira atual em português.
    2. "tips": Uma lista de 3 dicas práticas e curtas baseadas nos gastos.
    3. "sentiment": Um dos seguintes valores: "positive" (bom), "neutral" (ok), "negative" (ruim), "caution" (atenção).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tips: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative", "caution"] }
          },
          required: ["summary", "tips", "sentiment"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response");
    
    return JSON.parse(jsonText) as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Não foi possível analisar seus dados no momento.",
      tips: ["Verifique sua conexão", "Tente novamente mais tarde"],
      sentiment: "neutral"
    };
  }
};