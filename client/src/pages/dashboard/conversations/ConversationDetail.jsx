import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import API from "../../../services/api";

export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");

  useEffect(() => {
    // Fetch User details and Message History
    API.get(`/conversations/${id}`).then(res => {
      setData(res.data.user);
      setMessages(res.data.messages || []); // Assuming backend returns {user, messages}
    });
  }, [id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;

    // Backend route should handle sending via WhatsApp API + saving to DB
    const res = await API.post(`/conversations/${id}/reply`, { text: reply });
    setMessages([...messages, res.data]);
    setReply("");
  };

  if (!data) return <div className="p-6 text-gray-500">Loading conversation...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-indigo-600">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        <div className="text-right">
          <h2 className="font-bold text-lg">{data.name || "Unknown User"}</h2>
          <p className="text-sm text-gray-500">{data.phone}</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => {
          const isFromUser = msg.sender === "user";
          return (
            <div key={idx} className={`flex ${isFromUser ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[70%] p-3 rounded-2xl ${
                isFromUser 
                  ? 'bg-gray-100 text-gray-800 rounded-bl-none' 
                  : 'bg-indigo-600 text-white rounded-br-none'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-[10px] mt-1 opacity-70 ${isFromUser ? 'text-gray-500' : 'text-indigo-100'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a manual reply..."
          className="flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        <button className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition shadow-md">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}