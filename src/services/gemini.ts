import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export type Message = {
  role: 'user' | 'model';
  content: string;
};

export async function* chatWithGemini(messages: Message[]) {
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  const currentPrompt = messages[messages.length - 1].content;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Siz aqlli, yordam beruvchi va do'stona sun'iy intellekt assistantisiz. Sizning ismingiz 'Sun'iy Intellekt'. Foydalanuvchi bilan o'zbek tilida muloqot qiling. Javoblaringiz aniq va foydali bo'lsin.",
      },
      history: history
    });

    const result = await chat.sendMessageStream({
      message: currentPrompt
    });

    for await (const chunk of result) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
