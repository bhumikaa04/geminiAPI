import { useEffect, useState } from "react";
import API from "../../services/api";

export default function AIControl() {
  const [fallback, setFallback] = useState("");

  useEffect(() => {
    API.get("/expert-system/me").then(res => setFallback(res.data.fallbackType));
  }, []);

  async function save() {
    await API.patch("/expert-system/fallback", { fallbackType: fallback });
    alert("AI behavior updated");
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">AI Control</h1>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <p className="text-gray-600 text-sm">
          Choose how your assistant should respond when no FAQ matches.
        </p>

        <select
          value={fallback}
          onChange={e => setFallback(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="faq_only">Only use FAQs</option>
          <option value="gpt">Use FAQs + AI</option>
        </select>

        <button
          onClick={save}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg"
        >
          Save AI Settings
        </button>
      </div>
    </div>
  );
}
