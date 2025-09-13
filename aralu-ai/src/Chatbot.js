import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";

export default function ChatbotPage({ setView }) {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi 👋 I'm your menstrual health assistant!" },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const newMessage = { sender: "user", text: input };
    setMessages([...messages, newMessage]);

    // fake bot reply for now
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Thanks for your message ❤️" },
      ]);
    }, 1000);

    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-pink-50">
      {/* Header */}
      <div className="flex items-center p-4 bg-pink-200 shadow-md">
        <button
          onClick={() => setView("dashboard")}
          className="flex items-center text-pink-700 font-semibold"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back
        </button>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2 max-w-xs shadow-md ${
                msg.sender === "user"
                  ? "bg-pink-400 text-white"
                  : "bg-white text-gray-800 border border-pink-200"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex items-center p-3 border-t bg-white shadow-md">
        <input
          type="text"
          className="flex-1 border rounded-full px-4 py-2 mr-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-pink-400 hover:bg-pink-500 text-white p-2 rounded-full shadow-md"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
