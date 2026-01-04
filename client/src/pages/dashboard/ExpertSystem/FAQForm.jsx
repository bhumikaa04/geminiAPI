import { useState } from "react";
import API from "../../../services/api";

export default function FAQForm() {
  const [form, setForm] = useState({ 
    question: "", 
    answer: "", 
    keywords: "", 
    priority: 1 
  });

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      keywords: form.keywords.split(",").map(k => k.trim()), // Convert string to array
      systemId: "6596...your_actual_system_id" // Usually handled by auth on backend
    };
    
    await API.post("/faqs", payload);
    setForm({ question: "", answer: "", keywords: "", priority: 1 });
    alert("FAQ added successfully!");
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Train your AI</h2>
      <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow-sm space-y-4 border border-gray-100">
        <input
          name="question"
          placeholder="Common Question"
          value={form.question}
          onChange={(e) => setForm({...form, question: e.target.value})}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <textarea
          name="answer"
          placeholder="AI Answer"
          value={form.answer}
          onChange={(e) => setForm({...form, answer: e.target.value})}
          className="w-full border rounded-lg px-3 py-2 h-32 outline-none"
        />
        <input
          name="keywords"
          placeholder="Keywords (comma separated: price, cost, pay)"
          value={form.keywords}
          onChange={(e) => setForm({...form, keywords: e.target.value})}
          className="w-full border rounded-lg px-3 py-2 outline-none"
        />
        <div>
          <label className="text-sm text-gray-500">Priority (1-20): {form.priority}</label>
          <input
            type="range" min="1" max="20"
            value={form.priority}
            onChange={(e) => setForm({...form, priority: e.target.value})}
            className="w-full accent-indigo-600"
          />
        </div>
        <button className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition">
          Save Knowledge Entry
        </button>
      </form>
    </div>
  );
}