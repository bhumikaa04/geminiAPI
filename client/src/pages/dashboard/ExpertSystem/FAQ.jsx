import { useEffect, useState } from "react";
import API from "../../../services/api";

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    API.get("/faqs").then(res => setFaqs(res.data));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">FAQs</h1>

      {faqs.length === 0 && (
        <p className="text-gray-500">No FAQs added yet.</p>
      )}

      <div className="space-y-4">
        {faqs.map(faq => (
          <div key={faq._id} className="bg-white p-5 rounded-xl shadow-sm">
            <p className="font-medium">Q: {faq.question}</p>
            <p className="mt-2 text-gray-600">A: {faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
