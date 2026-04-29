/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Loader2, Trash2, Cpu, Mic, MicOff, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatWithGemini, Message } from './services/gemini';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Salom! Men sizning sun'iy intellekt assistantingizman. Sizga qanday yordam bera olaman?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'uz-UZ';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Kechirasiz, brauzeringiz ovozli kiritishni qo'llab-quvvatlamaydi.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  }, [isListening]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const cleanBase64 = base64Audio.split(',')[1];
          handleVoiceSubmit(cleanBase64, 'audio/webm');
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Mikrofonga ruxsat berilmadi yoki xatolik yuz berdi.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceSubmit = async (base64Data: string, mimeType: string) => {
    if (isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input || "Ovozli xabar",
      audio: { data: base64Data, mimeType }
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const updatedMessages = [...messages, userMessage];
    
    try {
      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of chatWithGemini(updatedMessages)) {
        fullResponse += chunk;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'model', content: fullResponse }
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: "Kechirasiz, xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const updatedMessages = [...messages, userMessage];
    
    try {
      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of chatWithGemini(updatedMessages)) {
        fullResponse += chunk;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'model', content: fullResponse }
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: "Kechirasiz, xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'model', content: "Chat tozalandi. Sizga qanday yordam bera olaman?" }]);
  };

  return (
    <div className="flex flex-col h-screen bg-black font-sans text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 bg-black/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2.5 bg-indigo-600 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Sun'iy Intellekt</h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Quantum Core</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
          title="Chatni tozalash"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-0 py-8" style={{ backgroundColor: '#4600ff' }}>
        <div className="max-w-3xl mx-auto space-y-8">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`flex gap-5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                  message.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-zinc-100" />
                  )}
                </div>
                <div 
                  className={`max-w-[85%] px-6 py-4 rounded-2xl transition-all ${
                    message.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-[0_4px_15px_rgba(79,70,229,0.2)]' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none shadow-xl'
                  }`}
                  style={message.role === 'model' ? { backgroundColor: '#ffffff', borderColor: '#ffffff' } : {}}
                >
                  <div className={`prose max-w-none prose-sm md:prose-base ${message.role === 'user' ? 'prose-invert' : 'text-slate-900'}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => (
                          <p 
                            style={message.role === 'model' ? { backgroundColor: '#000000', padding: '0.5rem', borderRadius: '0.5rem', color: '#fff' } : {}} 
                            {...props} 
                          />
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.role === 'model' && message.content === '' && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-6 md:pb-10 bg-gradient-to-t from-black via-black to-transparent">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end gap-3 p-2 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl focus-within:border-indigo-500/50 transition-all duration-300 group shadow-2xl"
          >
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={isListening ? "Savolingizni ayting..." : "Xabar yozing..."}
              className={`flex-1 p-3.5 bg-transparent border-none focus:ring-0 resize-none max-h-48 overflow-y-auto text-zinc-100 placeholder-zinc-600 transition-colors ${
                isListening ? 'text-indigo-400 font-medium' : ''
              }`}
            />
            <div className="flex items-center gap-1.5 p-1.5">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800'
                }`}
                title={isRecording ? "To'xtatish" : "Ovoz yozish"}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-2xl transition-all duration-300 ${
                  isListening 
                    ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' 
                    : 'text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800'
                }`}
                title={isListening ? "To'xtatish" : "Ovozli kiritish (STT)"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all duration-300 shadow-lg shadow-indigo-600/20"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
          <div className="flex justify-center items-center gap-4 mt-3">
            <span className="text-[9px] text-zinc-600 uppercase tracking-[0.3em]">
              AI ba'zida yanglishishi mumkin
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
