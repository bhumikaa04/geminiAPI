import { useEffect, useState } from "react";
import API from "../../services/api";

export default function Overview() {
  const [system, setSystem] = useState(null);

  useEffect(() => {
    API.get("/expert-system/me").then(res => setSystem(res.data));
  }, []);

  if (!system) return <p className="text-gray-500">Loading overview...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="System Name" value={system.name} />
        <Card title="Domain" value={system.domain} />
        <Card title="Fallback Mode" value={system.fallbackType} />
        <Card title="Owner Phone" value={system.ownerPhone} />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
