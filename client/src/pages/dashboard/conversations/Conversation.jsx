import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../../services/api";

export default function Conversation() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    API.get("/conversations").then(res => setUsers(res.data));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Conversations</h1>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {users.map(user => (
          <Link
            key={user._id}
            to={`/dashboard/conversations/${user._id}`}
            className="block p-4 hover:bg-gray-50"
          >
            <p className="font-medium">{user.phone}</p>
            <p className="text-sm text-gray-500">{user.firstMessage}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
