import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined") {
    console.warn("GEMINI_API_KEY is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const extractDeadlines = async (text: string) => {
  const ai = getAI();
  if (!ai) {
    throw new Error("Gemini API Key is not configured. Please add it to your .env file.");
  }
  const model = "gemini-1.5-flash";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `EXTRACT TASKS FROM TEXT.
      Text to parse: "${text}"
      Current Reference Date: ${new Date().toISOString()} (${new Date().toLocaleDateString()})
      
      CRITICAL INSTRUCTIONS:
      1. Every separate bullet point (-), numbered list, or new line with a distinct action MUST be a SEPARATE task object in the JSON array.
      2. If the user lists 3 things, you MUST return an array of 3 objects.
      3. Identify every deadline and convert relative dates (e.g., "by friday", "next week", "tmrw") into exact ISO 8601 timestamps.
      4. If no time is mentioned, default to 23:59:59.
      5. Categorize: 'task' (normal work), 'meeting' (calls/syncs), 'quiz' (tests/exams).
      6. Prioritize: 
         - 'urgent': Due within 24 hours.
         - 'high': Due within 3 days.
         - 'medium': Due within 1 week.
         - 'low': Due after 1 week.
      7. Return ONLY a clean JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              deadline: { type: Type.STRING, description: "ISO 8601 string" },
              type: { type: Type.STRING, enum: ["task", "meeting", "quiz"] },
              priority: { type: Type.STRING, enum: ["low", "medium", "high", "urgent"] }
            },
            required: ["title", "deadline", "type", "priority"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini API failed, using smart local fallback:", error);
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    return lines.map(line => {
      const lower = line.toLowerCase();
      let deadline = new Date(Date.now() + 86400000); // Default: Tomorrow
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

      // Smart Date Detection
      if (lower.includes('next week')) deadline = new Date(Date.now() + 7 * 86400000);
      else if (lower.includes('tonight') || lower.includes('today')) deadline = new Date();
      else if (lower.includes('monday')) deadline = getNextDayOfWeek(1);
      else if (lower.includes('tuesday')) deadline = getNextDayOfWeek(2);
      else if (lower.includes('wednesday')) deadline = getNextDayOfWeek(3);
      else if (lower.includes('thursday')) deadline = getNextDayOfWeek(4);
      else if (lower.includes('friday')) deadline = getNextDayOfWeek(5);
      else if (lower.includes('tomorrow')) deadline = new Date(Date.now() + 86400000);

      // Smart Time-Based Priority Logic
      const hoursToDeadline = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      
      if (hoursToDeadline <= 24) priority = 'urgent';
      else if (hoursToDeadline <= 72) priority = 'high';
      else if (lower.includes('later') || lower.includes('low')) priority = 'low';
      
      // Override with explicit keywords if present
      if (lower.includes('urgent') || lower.includes('asap')) priority = 'urgent';
      else if (lower.includes('high') || lower.includes('important')) priority = 'high';

      return {
        title: line,
        description: "",
        deadline: deadline.toISOString(),
        type: lower.includes('meeting') ? "meeting" : lower.includes('quiz') || lower.includes('exam') ? "quiz" : "task",
        priority
      };
    });
  }
};

const getNextDayOfWeek = (dayOfWeek: number) => {
  const resultDate = new Date();
  resultDate.setDate(resultDate.getDate() + (7 + dayOfWeek - resultDate.getDay()) % 7);
  return resultDate;
};
