/** ==============================================================
  FIXED APP FILE (chat.jsx)
============================================================== */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    addDoc,
    collection,
    query,
    onSnapshot,
    Timestamp,
    setDoc,
    deleteDoc,
    orderBy,
    where
} from 'firebase/firestore';

import {
    Send,
    LogOut,
    MessageSquare,
    Plus,
    Zap,
    MoreVertical,
    Trash2,
    AlertCircle,
} from 'lucide-react';

/* ============================================================== */

const appId =
    typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const FALLBACK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA0x1DbzFdErh5PAeg9sequydSaT8QVrwg",
    authDomain: "multi-chatiing.firebaseapp.com",
    projectId: "multi-chatiing",
    storageBucket: "multi-chatiing.firebasestorage.app",
    messagingSenderId: "279820353236",
    appId: "1:279820353236:web:684c07fae198cc8cd0c541",
};

const firebaseConfig = (() => {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        try {
            const cfg = JSON.parse(__firebase_config);
            if (Object.keys(cfg).length > 0) return cfg;
        } catch {}
    }
    return FALLBACK_FIREBASE_CONFIG;
})();

const initialAuthToken =
    typeof __initial_auth_token !== 'undefined'
        ? __initial_auth_token
        : null;

const PUBLIC_DATA_ROOT = `artifacts/${appId}/public/data`;

const withRetry = async (fn, maxRetries = 5, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2;
        }
    }
};

const NEW_CHAT_ID = "new-draft";

/* ============================================================== */

const App = ({ user, onSignOut }) => {
    const googleName = user?.displayName || "User";
    const googleUID = user?.uid;
    const googlePhoto = user?.photoURL || null;

    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [chats, setChats] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState(NEW_CHAT_ID);
    const [messages, setMessages] = useState([]);

    const [newMessageText, setNewMessageText] = useState("");
    const [loadingState, setLoadingState] = useState("Initializing...");
    const [localError, setLocalError] = useState(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const [hoveredChatId, setHoveredChatId] = useState(null);
    const [showDeleteMenu, setShowDeleteMenu] = useState(null);

    const messagesEndRef = useRef(null);

    const GEMINI_API_ENDPOINT = "http://localhost:3000/api/content";

    /* ============================================================== */
    /* INIT FIREBASE */
    /* ============================================================== */

    useEffect(() => {
        const initFirebase = async () => {
            try {
                setLoadingState("Initializing Firebase...");
                let app;

                try {
                    app = initializeApp(firebaseConfig);
                } catch (err) {
                    if (err.code === "app/duplicate-app") app = getApp();
                    else throw err;
                }

                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                if (!googleUID) {
                    await withRetry(async () => {
                        if (initialAuthToken)
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        else await signInAnonymously(firebaseAuth);
                    });
                }

                onAuthStateChanged(firebaseAuth, () => {
                    setIsAuthReady(true);
                    setLoadingState(null);
                });
            } catch (err) {
                console.error("Firebase init error:", err);
                setLocalError(err.message);
            }
        };

        initFirebase();
    }, [googleUID]);

    /* ============================================================== */
    /* LOAD CHAT LIST */
    /* ============================================================== */

    useEffect(() => {
        if (!isAuthReady || !db || !googleUID) return;

        const chatsRef = collection(db, `${PUBLIC_DATA_ROOT}/chats`);
        const q = query(
            chatsRef,
            where("creatorId", "==", googleUID),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate?.() || null,
                }));
                setChats(data);
            },
            (err) => {
                console.error("Load chats error:", err);
                setLocalError(err.message);
            }
        );

        return unsub;
    }, [isAuthReady, db, googleUID]);

    /* ============================================================== */
    /* LOAD MESSAGES */
    /* ============================================================== */

    useEffect(() => {
        if (!db || !selectedChatId || selectedChatId === NEW_CHAT_ID) {
            setMessages([]);
            return;
        }

        const msgRef = collection(
            db,
            `${PUBLIC_DATA_ROOT}/chats/${selectedChatId}/messages`
        );

        const q = query(msgRef, orderBy("timestamp"));

        return onSnapshot(q, (snap) => {
            setMessages(
                snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                    timestamp: d.data().timestamp
                        ?.toDate()
                        ?.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                }))
            );
        });
    }, [selectedChatId, db]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* ============================================================== */
    /* SEND MESSAGE */
    /* ============================================================== */

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = newMessageText.trim();
        if (!text || !db || !googleUID) return;

        setNewMessageText("");
        setIsGenerating(true);

        let chatId = selectedChatId;

        try {
            if (chatId === NEW_CHAT_ID) {
                chatId = `chat-${crypto.randomUUID().slice(0, 8)}`;

                await setDoc(
                    doc(db, `${PUBLIC_DATA_ROOT}/chats/${chatId}`),
                    {
                        name: text.slice(0, 40),
                        creatorId: googleUID,
                        creatorName: googleName,
                        creatorPhoto: googlePhoto,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    }
                );

                setSelectedChatId(chatId);
            }

            const msgRef = collection(db, `${PUBLIC_DATA_ROOT}/chats/${chatId}/messages`);
            await addDoc(msgRef, {
                text,
                senderId: googleUID,
                senderName: googleName,
                senderPhoto: googlePhoto,
                timestamp: Timestamp.now(),
            });

            let aiText = "No response";

            try {
                const res = await fetch(GEMINI_API_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: text }),
                });

                const data = await res.json();
                aiText = data.result || "No content";
            } catch (err) {
                aiText = "AI error: " + err.message;
            }

            await addDoc(msgRef, {
                text: aiText,
                senderId: "gemini",
                senderName: "ChatBot AI",
                timestamp: Timestamp.now(),
            });
        } catch (err) {
            console.error("Send error:", err);
            setLocalError(err.message);
        }

        setIsGenerating(false);
    };

    /* ============================================================== */
    /* DELETE CHAT */
    /* ============================================================== */

    const handleDeleteChat = async (chatId) => {
        try {
            await deleteDoc(doc(db, `${PUBLIC_DATA_ROOT}/chats/${chatId}`));
            if (chatId === selectedChatId) {
                setSelectedChatId(NEW_CHAT_ID);
            }
        } catch (err) {
            console.error(err);
        }
    };

    /* ============================================================== */
    /* MESSAGE BUBBLE */
    /* ============================================================== */

    const MessageBubble = ({ message }) => {
        const isMe = message.senderId === googleUID;
        const isBot = message.senderId === "gemini";

        return (
            <div className={`flex mb-4 ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                    className={`flex items-start max-w-3/4 ${
                        isMe ? "flex-row-reverse" : "flex-row"
                    }`}
                >
                    <div className={`${isMe ? "ml-3" : "mr-3"} mt-1`}>
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow">
                            {isBot ? (
                                <div className="bg-blue-600 w-full h-full flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-white" />
                                </div>
                            ) : googlePhoto && isMe ? (
                                <img src={googlePhoto} className="w-full h-full object-cover" />
                            ) : (
                                <div className="bg-purple-600 text-white flex items-center justify-center w-full h-full">
                                    {message.senderName?.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className={`p-3 rounded-xl shadow max-w-md ${
                            isMe
                                ? "bg-purple-600 text-white rounded-br-none"
                                : "bg-gray-200 text-gray-800 rounded-tl-none border"
                        }`}
                    >
                        {!isMe && (
                            <div className="text-xs font-bold mb-1">
                                {isBot ? "ChatBot AI" : message.senderName}
                            </div>
                        )}

                        <div className="text-sm whitespace-pre-wrap">{message.text}</div>

                        <div className="text-[10px] mt-1 opacity-70 text-right">
                            {message.timestamp}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    /* ============================================================== */
    /* FIXED CHAT ITEM (NO NESTED BUTTONS) */
    /* ============================================================== */

    const ChatItem = ({ chat }) => {
        const isSelected = selectedChatId === chat.id;
        const isHovered = hoveredChatId === chat.id;
        const isNewChatButton = chat.id === NEW_CHAT_ID;

        return (
            <div
                className={`
                relative cursor-pointer rounded-lg transition-all
                ${isSelected ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}
                `}
                onMouseEnter={() => setHoveredChatId(chat.id)}
                onMouseLeave={() => setHoveredChatId(null)}
            >
                {/* Entire row is a button */}
                <button
                    onClick={() => {
                        setSelectedChatId(chat.id);
                        setShowDeleteMenu(null);
                    }}
                    className="flex items-center justify-between p-3 w-full text-left"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {isNewChatButton && <Plus size={16} />}
                            <span className="truncate">{chat.name}</span>
                        </div>

                        {!isNewChatButton && (
                            <div className="text-xs opacity-70 mt-1">
                                {chat.createdAt?.toLocaleDateString?.() || "Recent"}
                            </div>
                        )}
                    </div>

                    {/* FIXED — inner action is NOT a <button> */}
                    {!isNewChatButton && (isHovered || showDeleteMenu === chat.id) && (
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteMenu(showDeleteMenu === chat.id ? null : chat.id);
                            }}
                            className={`ml-2 p-2 rounded ${
                                isSelected ? "hover:bg-purple-700" : "hover:bg-gray-500"
                            }`}
                        >
                            <MoreVertical size={16} />
                        </div>
                    )}
                </button>

                {/* Dropdown */}
                {showDeleteMenu === chat.id && (
                    <div
                        className="absolute right-2 top-12 bg-gray-800 text-white rounded shadow-lg z-50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            role="button"
                            className="px-4 py-2 text-sm hover:bg-red-600 flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                handleDeleteChat(chat.id);
                                setShowDeleteMenu(null);
                            }}
                        >
                            <Trash2 size={14} />
                            Delete
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ============================================================== */
    /* RENDER */
    /* ============================================================== */

    const newChatItem = { id: NEW_CHAT_ID, name: "New Chat", createdAt: null };

    if (!isAuthReady || !db) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-6 rounded shadow">
                    <p>{loadingState}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100">

            {/* Header */}
            <header className="bg-purple-600 text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {googlePhoto && (
                        <img
                            src={googlePhoto}
                            className="w-10 h-10 rounded-full border-2 border-white object-cover"
                        />
                    )}
                    <span className="font-bold text-xl">Public Chat Hub</span>
                </div>

                <div className="opacity-80">Welcome, {googleName}!</div>

                <button
                    onClick={onSignOut}
                    className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded flex items-center gap-2"
                >
                    <LogOut size={16} />
                    Logout
                </button>
            </header>

            {/* Body Layout */}
            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar */}
                <aside className="w-64 bg-gray-800 text-white border-r border-gray-700 flex flex-col py-4">

                    <div className="px-4">
                        <ChatItem chat={newChatItem} />
                    </div>

                    <h2 className="text-sm uppercase text-gray-400 mt-6 px-4">Your Chats</h2>

                    <div className="flex-1 overflow-y-auto px-4 mt-2 space-y-1 scrollbar-custom">
                        <style>{`
                            .scrollbar-custom::-webkit-scrollbar {
                                width: 6px;
                            }
                            .scrollbar-custom::-webkit-scrollbar-track {
                                background: #374151;
                            }
                            .scrollbar-custom::-webkit-scrollbar-thumb {
                                background: #6B7280;
                            }
                            .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                                background: #9CA3AF;
                            }
                        `}</style>

                        {chats.map((c) => (
                            <ChatItem key={c.id} chat={c} />
                        ))}
                    </div>
                </aside>

                {/* Main Chat */}
                <main className="flex-1 flex flex-col">

                    <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-blue-50">

                        {selectedChatId === NEW_CHAT_ID && messages.length === 0 ? (
                            <div className="text-center text-gray-500 mt-8">
                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Start a New Conversation</p>
                                <p className="text-sm text-gray-400">
                                    Your chat will be saved after your first message.
                                </p>
                            </div>
                        ) : (
                            messages.map((m) => (
                                <MessageBubble key={m.id} message={m} />
                            ))
                        )}

                        {isGenerating && (
                            <div className="flex items-center gap-2 text-gray-500">
                                <Zap className="animate-pulse" />
                                AI is thinking...
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={handleSendMessage}
                        className="p-4 bg-white border-t flex gap-3"
                    >
                        <input
                            value={newMessageText}
                            onChange={(e) => setNewMessageText(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 border p-3 rounded-xl text-black"
                        />

                        <button
                            type="submit"
                            disabled={!newMessageText.trim()}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-xl flex items-center"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default App;
