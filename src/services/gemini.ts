import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export type Message = {
  role: 'user' | 'model';
  content: string;
  audio?: {
    data: string; // base64
    mimeType: string;
  };
};

export async function* chatWithGemini(messages: Message[]) {
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [
      { text: msg.content },
      ...(msg.audio ? [{ inlineData: msg.audio }] : [])
    ]
  }));
  
  const currentMsg = messages[messages.length - 1];
  const parts: any[] = [{ text: currentMsg.content }];
  if (currentMsg.audio) {
    parts.push({ inlineData: currentMsg.audio });
  }

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Siz o'ta aqlli, mas'uliyatli va bilimdon sun'iy intellekt assistantisiz. Sizning ismingiz 'Sun'iy Intellekt'. Bugungi sana: 29-aprel, 2026-yil. Foydalanuvchi bilan o'zbek tilida (lotin alifbosida) muloqot qiling. Sizning asosiy vazifangiz - har bir savolga maksimal darajada aniq, to'g'ri va faktlarga asoslangan javob berishdir. Grammatik va imlo xatolariga yo'l qo'ymang. Javoblar mantiqiy, tushunarli va professional tilda bo'lishi shart. Agar ma'lumotga aniq ishonchingiz komil bo'lmasa, buni foydalanuvchiga bildiring.",
      },
      history: history
    });

    const result = await chat.sendMessageStream({
      message: parts
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
