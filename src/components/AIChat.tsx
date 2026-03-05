import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { MessageSquare, X, Send, Sparkles, User, Loader2, Mic, MicOff, AlertCircle, Volume2, VolumeX, Radio } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch, sendWSMessage } from '../utils/api';
import { Modality } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Memoized Message Component for performance
const ChatMessage = React.memo(({ msg, idx, currentlyPlayingIdx, onSpeak }: any) => (
  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
    <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${msg.role === 'user' ? 'bg-moss-dark text-white' : 'bg-white border border-moss/10 text-moss-dark'}`}>
        {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5 text-moss" />}
      </div>
      <div className={`p-4 rounded-2xl text-[14px] leading-relaxed shadow-sm relative group/msg ${msg.role === 'user' ? 'bg-moss text-white rounded-tr-none shadow-moss/20' : 'bg-white border border-moss/5 text-moss-dark rounded-tl-none'}`}>
        <div className="markdown-body prose prose-sm max-w-none prose-moss">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
        </div>
        
        {msg.role === 'model' && (
          <button
            onClick={() => onSpeak(msg.text, idx)}
            className={`absolute -right-12 top-0 p-2 rounded-xl bg-white border border-moss/10 text-moss shadow-sm hover:shadow-md transition-all opacity-0 group-hover/msg:opacity-100 ${currentlyPlayingIdx === idx ? 'opacity-100 scale-110 bg-moss text-white' : ''}`}
            title="Đọc tin nhắn này"
          >
            {currentlyPlayingIdx === idx ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  </div>
));

export default function AIChat({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: `Chào ${user?.name || 'bạn'}, em là **Bé Nhâm AI** - trợ lý riêng của anh/chị tại **Út Nữ's Future**. Em có thể giúp gì cho mình ạ?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAutoReadEnabled, setIsAutoReadEnabled] = useState(true);
  const [currentlyPlayingIdx, setCurrentlyPlayingIdx] = useState<number | null>(null);
  const [appContext, setAppContext] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopAudio = React.useCallback(() => {
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.error("Error closing AudioContext:", e);
      }
      audioContextRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setCurrentlyPlayingIdx(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!appContext) fetchContext();
      getUserLocation();
    }
  }, [isOpen]);

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const fetchContext = async (retries = 3) => {
    try {
      const stats = await apiFetch('/api/dashboard-stats');
      setAppContext(stats);
    } catch (error) {
      console.error("Bé Nhâm AI failed to fetch context:", error);
      if (retries > 0) {
        console.log(`Retrying fetch context in 5s... (${retries} retries left)`);
        setTimeout(() => fetchContext(retries - 1), 5000);
      }
    }
  };

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'vi-VN';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Automatically send if it's a voice command
        setTimeout(() => {
          const form = document.getElementById('ai-chat-form') as HTMLFormElement;
          if (form) form.requestSubmit();
        }, 300);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          alert("Bé Nhâm chưa được cấp quyền sử dụng Micro. Anh/chị vui lòng nhấn vào biểu tượng ổ khóa (hoặc dấu i) trên thanh địa chỉ trình duyệt, sau đó chọn 'Cho phép' (Allow) Micro nhé!");
        } else if (event.error === 'no-speech') {
          // Ignore no-speech errors as they happen often
        } else {
          alert(`Bé Nhâm gặp lỗi khi nghe: ${event.error}. Anh/chị thử lại sau nhé!`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } catch (e) {
      console.error("Speech recognition initialization failed:", e);
      setSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      alert("Trình duyệt này của anh/chị chưa hỗ trợ tính năng giọng nói ạ. Anh/chị dùng Chrome để có trải nghiệm tốt nhất nhé!");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsListening(false);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const speakText = React.useCallback(async (text: string, index?: number) => {
    stopAudio();
    if (index !== undefined) setCurrentlyPlayingIdx(index);
    
    try {
      // Clean markdown for better TTS
      const cleanText = text.replace(/[*_#`\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Đọc diễn cảm bằng tiếng Việt giọng nữ miền Nam, tốc độ nhanh và dứt khoát: ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = audioContext;
        
        // Safety check: if chat was closed
        if (!isOpen) {
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
          return;
        }
        // Ensure we don't exceed the buffer length and it's 2-byte aligned
        const pcmLength = Math.floor(bytes.length / 2);
        const int16Array = new Int16Array(bytes.buffer, 0, pcmLength);
        const float32Array = new Float32Array(pcmLength);
        for (let i = 0; i < pcmLength; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          if (audioContextRef.current === audioContext) {
            setCurrentlyPlayingIdx(null);
            if (audioContext.state !== 'closed') {
              audioContext.close();
            }
            audioContextRef.current = null;
          }
        };
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        source.start();
      } else {
        throw new Error("No audio data received");
      }
    } catch (error) {
      console.error("Bé Nhâm AI TTS Error (Gemini):", error);
      
      // Fallback to Web Speech API
      try {
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#`\[\]()]/g, ' '));
        utterance.lang = 'vi-VN';
        utterance.rate = 1.2;
        utterance.onend = () => setCurrentlyPlayingIdx(null);
        utterance.onerror = () => setCurrentlyPlayingIdx(null);
        window.speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error("Fallback TTS Error:", fallbackError);
        setCurrentlyPlayingIdx(null);
      }
    }
  }, [isOpen, stopAudio]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const systemInstruction = `
        Bạn là "Bé Nhâm AI", trợ lý ảo thông minh, lễ phép của Út Nữ's Future.
        Xưng "em", gọi "anh/chị". Trả lời cực kỳ ngắn gọn, súc tích, đi thẳng vào vấn đề.
        Ưu tiên liệt kê danh sách hoặc bảng biểu để dễ nhìn khi lái xe.

        Bối cảnh:
        - Tên: ${user.name}
        - Vai trò: ${user.role}
        - Vị trí: ${userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Chưa rõ'}

        Dữ liệu Út Nữ:
        - Nhân sự: ${appContext?.users || '...'}, Xe: ${appContext?.vehicles || '...'}, Báo cáo: ${appContext?.reports || '...'}
        - Hôm nay: ${appContext?.todayDeliveries || 0} giao hàng, ${appContext?.todaySales || 0} sale.

        Nhiệm vụ đặc biệt:
        - Nếu người dùng muốn báo cáo giao hàng (ví dụ: "đã giao xong", "báo cáo giao hàng"): Hãy gọi hàm report_delivery.
        - Nếu người dùng cần trợ giúp khẩn cấp (ví dụ: "cứu tôi", "hỏng xe", "cần trợ giúp"): Hãy gọi hàm request_emergency_help.
        - Nếu hỏng xe/hết xăng: Tìm trạm sửa/xăng GẦN NHẤT qua Google Search.
        - Cung cấp SỐ ĐIỆN THOẠI nếu có.
      `;

      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: { 
            systemInstruction,
            tools: [
              { googleSearch: {} },
              {
                functionDeclarations: [
                  {
                    name: "report_delivery",
                    description: "Kích hoạt giao diện báo cáo giao hàng cho tài xế.",
                    parameters: { type: Type.OBJECT, properties: {} }
                  },
                  {
                    name: "request_emergency_help",
                    description: "Gửi yêu cầu trợ giúp khẩn cấp kèm vị trí hiện tại.",
                    parameters: {
                      type: Type.OBJECT,
                      properties: {
                        reason: { type: Type.STRING, description: "Lý do cần trợ giúp (ví dụ: hỏng xe, tai nạn, hết xăng)" }
                      },
                      required: ["reason"]
                    }
                  }
                ]
              }
            ],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          },
        });
      }

      const response = await chatRef.current.sendMessage({ message: userMessage });
      
      // Handle Function Calls
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'report_delivery') {
            window.dispatchEvent(new CustomEvent('voice_report_delivered'));
            setMessages(prev => [...prev, { role: 'model', text: 'Dạ, em đã mở bảng báo cáo giao hàng cho anh/chị rồi ạ. Anh/chị kiểm tra nhé!' }]);
            speakText('Dạ, em đã mở bảng báo cáo giao hàng cho anh/chị rồi ạ.');
            setIsOpen(false); // Close chat to show the dashboard
            return;
          }
          if (call.name === 'request_emergency_help') {
            const reason = call.args.reason as string;
            if (userLocation) {
              sendWSMessage('help_request', {
                location: userLocation,
                message: `TRỢ GIÚP KHẨN CẤP: ${reason} (Gửi qua Bé Nhâm AI)`
              });
              setMessages(prev => [...prev, { role: 'model', text: `Dạ, em đã gửi yêu cầu trợ giúp khẩn cấp với lý do: "${reason}" đến tất cả anh em rồi ạ. Anh/chị giữ bình tĩnh nhé!` }]);
              speakText(`Dạ, em đã gửi yêu cầu trợ giúp khẩn cấp. Anh/chị giữ bình tĩnh nhé!`);
            } else {
              setMessages(prev => [...prev, { role: 'model', text: 'Em xin lỗi, em không lấy được vị trí GPS của anh/chị nên không gửi yêu cầu trợ giúp được ạ.' }]);
            }
            return;
          }
        }
      }

      const aiResponse = response.text || 'Em xin lỗi, em chưa hiểu ý anh/chị lắm ạ.';
      
      setMessages(prev => {
        const newMessages = [...prev, { role: 'model' as const, text: aiResponse }];
        if (isAutoReadEnabled) {
          // Use a small delay to ensure state is updated and avoid race conditions
          setTimeout(() => speakText(aiResponse, newMessages.length - 1), 50);
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Bé Nhâm AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Hệ thống của em đang bận một chút, anh/chị thử lại sau nhé!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoRead = async () => {
    const newState = !isAutoReadEnabled;
    setIsAutoReadEnabled(newState);
    
    if (!newState) {
      stopAudio();
    }

    if (newState) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        setTimeout(() => {
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
        }, 100);
      } catch (e) {
        console.error("Failed to resume audio context:", e);
      }
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-2xl bg-gradient-to-br from-moss to-moss-dark text-white shadow-2xl hover:scale-110 transition-all duration-500 z-40 group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <div className="relative">
          <Sparkles className="w-7 h-7 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-2 -right-2 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sand opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sand-dark text-[8px] items-center justify-center font-black text-moss-dark">AI</span>
          </span>
        </div>
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 w-[450px] h-[650px] max-w-[95vw] max-h-[85vh] bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/60 flex flex-col z-50 transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-20 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-moss/5 bg-gradient-to-br from-moss/10 via-transparent to-sand/5 rounded-t-[2.5rem]">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 bg-gradient-to-br from-moss to-moss-dark rounded-2xl text-white shadow-lg shadow-moss/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white"></div>
            </div>
            <div>
              <h3 className="font-black text-moss-dark text-lg tracking-tight">Bé Nhâm AI</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] font-black text-moss-dark/40 uppercase tracking-[0.2em]">Trực tuyến 24/7</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (audioContext.state === 'suspended') await audioContext.resume();
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.connect(audioContext.destination);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
                setTimeout(() => {
                  if (audioContext.state !== 'closed') {
                    audioContext.close();
                  }
                }, 200);
                alert("Nếu anh/chị nghe thấy tiếng 'bíp', nghĩa là âm thanh đã sẵn sàng ạ!");
              }}
              className="p-2.5 text-moss-dark/20 hover:text-moss-dark hover:bg-moss/5 rounded-2xl transition-all"
              title="Kiểm tra âm thanh"
            >
              <Volume2 className="w-5 h-5" />
            </button>
            <button
              onClick={toggleAutoRead}
              className={`p-2.5 rounded-2xl transition-all ${isAutoReadEnabled ? 'bg-moss/10 text-moss' : 'text-moss-dark/20 hover:bg-moss/5'}`}
              title={isAutoReadEnabled ? "Tắt tự động đọc" : "Bật tự động đọc"}
            >
              {isAutoReadEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2.5 text-moss-dark/20 hover:text-moss-dark hover:bg-moss/5 rounded-2xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.map((msg, idx) => (
            <ChatMessage 
              key={idx} 
              msg={msg} 
              idx={idx} 
              currentlyPlayingIdx={currentlyPlayingIdx} 
              onSpeak={speakText} 
            />
          ))}
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center bg-white border border-moss/10 text-moss">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-2xl bg-white border border-moss/5 text-moss-dark rounded-tl-none flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-moss" />
                  <span className="font-bold italic opacity-50 text-xs">Bé Nhâm đang soạn tin...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-moss/5 bg-white/50 rounded-b-[2.5rem]">
          {!speechSupported && (
            <div className="mb-3 flex items-center gap-2 p-2 bg-amber-50 rounded-xl text-[10px] text-amber-700 font-bold border border-amber-100">
              <AlertCircle className="w-3 h-3" />
              Trình duyệt không hỗ trợ giọng nói. Anh/chị dùng Chrome nhé!
            </div>
          )}
          <form 
            id="ai-chat-form"
            onSubmit={handleSend} 
            className="flex items-center gap-3 bg-white border-2 border-moss/10 rounded-[1.5rem] p-2 shadow-sm focus-within:border-moss/30 focus-within:shadow-lg transition-all duration-300 relative"
          >
            {isListening && (
              <div className="absolute -top-16 left-0 right-0 flex justify-center">
                <div className="bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-xl animate-bounce">
                  <Radio className="w-4 h-4 animate-pulse" />
                  Bé Nhâm đang nghe...
                </div>
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhắn gì đó cho Bé Nhâm..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 py-2 text-moss-dark placeholder-moss-dark/20 font-bold"
              disabled={isLoading}
            />
            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse' : 'text-moss hover:bg-moss/5'}`}
                title={isListening ? "Đang nghe..." : "Nói với Bé Nhâm"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-3 bg-gradient-to-br from-moss to-moss-dark text-white rounded-xl hover:shadow-xl hover:shadow-moss/20 disabled:opacity-20 transition-all active:scale-90"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
