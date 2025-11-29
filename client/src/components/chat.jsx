/* ==============================================================
  UPDATED APP FILE (chat.jsx)
  
  FIX: Re-implemented client-side filter (where('creatorId', '==', googleUID))
  in the chat loading useEffect to ensure only the user's chats are read.
  
  Note: This fix assumes the Firestore composite index (creatorId, createdAt) 
  has been successfully created in your Firebase project.
==============================================================
*/

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
    where // <-- IMPORTANT: ADDED 'where' IMPORT HERE
} from 'firebase/firestore';
import { Send, LogOut, MessageSquare, Plus, Zap, MoreVertical, Trash2, AlertCircle } from 'lucide-react';

/* ==============================================================
  GLOBAL CONFIG (same as before)
==============================================================
*/

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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
            const config = JSON.parse(__firebase_config);
            if (Object.keys(config).length > 0) return config;
        } catch {}
    }
    return FALLBACK_FIREBASE_CONFIG;
})();

const initialAuthToken =
    typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

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

const NEW_CHAT_ID = 'new-draft';

/* ==============================================================
  COMPONENT
==============================================================
*/

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

    const [newMessageText, setNewMessageText] = useState('');
    const [loadingState, setLoadingState] = useState('Initializing...');
    const [localError, setLocalError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hoveredChatId, setHoveredChatId] = useState(null);
    const [showDeleteMenu, setShowDeleteMenu] = useState(null);

    const messagesEndRef = useRef(null);

    // Changed endpoint back to generic /api/content for external hosting compatibility
    const GEMINI_API_ENDPOINT = 'http://localhost:3000/api/content'; 

    /* ==============================================================
      INIT FIREBASE 
    ==============================================================
    */

    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                setLoadingState('Initializing Firebase...');
                
                let app;
                try {
                    app = initializeApp(firebaseConfig);
                } catch (error) {
                    if (error.code === 'app/duplicate-app') {
                        app = getApp();
                    } else {
                        throw error;
                    }
                }

                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestore);
                setAuth(firebaseAuth);

                if (!googleUID) {
                    await withRetry(async () => {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    });
                }
                
                onAuthStateChanged(firebaseAuth, (user) => {
                    setIsAuthReady(true);
                    setLoadingState(null);
                    // Clear data if user logs out or changes
                    if (!user) {
                        setChats([]);
                        setMessages([]);
                        setSelectedChatId(NEW_CHAT_ID);
                    }
                });

            } catch (error) {
                console.error("Firebase init error:", error);
                setLocalError(`Firebase Error: ${error.message}`);
                setLoadingState(`Initialization Error: ${error.message}`);
            }
        };

        initializeFirebase();
    }, [googleUID]);

    /* ==============================================================
      LOAD CHATS & MESSAGES (FIX APPLIED HERE)
    ==============================================================
    */

    useEffect(() => {
        // Only attempt to load chats if authentication is ready AND we have a UID
        if (!isAuthReady || !db || !googleUID) {
            if (isAuthReady && !googleUID) {
                 // This case should not happen if user object is passed correctly, but handled defensively
                setLocalError("Cannot load chats: User ID not available.");
            }
            return;
        }

        const chatsRef = collection(db, `${PUBLIC_DATA_ROOT}/chats`);
        
        // --- FIX: Filter chats by the current user's creatorId ---
        const q = query(
            chatsRef, 
            where('creatorId', '==', googleUID), // <-- The crucial filter
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const userChats = snapshot.docs.map((d) => ({ 
                    id: d.id, 
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate?.() || null
                }));
                setChats(userChats);
                setLocalError(null);
            },
            (error) => {
                console.error("Error loading chats:", error.code, error.message);
                if (error.code === 'permission-denied' || error.code === 'unavailable') {
                    setLocalError(`Failed to load chats: ${error.message}. Ensure your database rules and composite index (creatorId, createdAt) are correct.`);
                } else {
                    setLocalError(`Failed to load chats: ${error.message}`);
                }
                setChats([]);
            }
        );
        return unsubscribe;
    }, [isAuthReady, db, googleUID]); // Depend on googleUID to re-run when user changes

    useEffect(() => {
        if (!selectedChatId || selectedChatId === NEW_CHAT_ID || !db) {
            setMessages([]);
            return;
        }

        const msgRef = collection(db, `${PUBLIC_DATA_ROOT}/chats/${selectedChatId}/messages`);
        const q = query(msgRef, orderBy("timestamp"));

        return onSnapshot(q, (snap) => {
            setMessages(
                snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                    timestamp: d.data().timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }))
            );
        });
    }, [selectedChatId, db]);

    // Autoscroll effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    /* ==============================================================
      CHAT ACTIONS (NO CHANGES)
    ==============================================================
    */

    const handleNewChat = () => {
        setSelectedChatId(NEW_CHAT_ID);
        setMessages([]); 
        setLocalError(null);
        setShowDeleteMenu(null); // Clear delete menu
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessageText.trim() || !db || !googleUID) {
            setLocalError("Message or connection invalid.");
            return;
        }

        const userText = newMessageText.trim();
        setNewMessageText('');
        setLocalError(null);
        setIsGenerating(true);

        let currentChatId = selectedChatId;

        try {
            if (currentChatId === NEW_CHAT_ID) {
                const newId = `chat-${crypto.randomUUID().substring(0, 8)}`;
                
                const chatDoc = doc(db, `${PUBLIC_DATA_ROOT}/chats/${newId}`);
                await setDoc(chatDoc, {
                    name: userText.substring(0, 40) + (userText.length > 40 ? '...' : ''),
                    creatorId: googleUID, // Critical: Set creatorId
                    creatorName: googleName,
                    creatorPhoto: googlePhoto,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                
                currentChatId = newId; 
                setSelectedChatId(newId); 
            }

            const messagesRef = collection(db, `${PUBLIC_DATA_ROOT}/chats/${currentChatId}/messages`);

            // 1. Add user message
            await addDoc(messagesRef, {
                text: userText,
                senderId: googleUID,
                senderName: googleName,
                senderPhoto: googlePhoto, 
                timestamp: Timestamp.now(),
            });
            
            // 2. Get AI response
            let aiResponse;
            try {
                const res = await fetch(GEMINI_API_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: userText })
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`API error ${res.status}: ${errorText}`);
                }
                
                const data = await res.json();
                aiResponse = data.result || "No response content received";
                
            } catch (apiError) {
                console.error("AI API failed:", apiError);
                aiResponse = `I'm currently unavailable. Error: ${apiError.message}`;
            }

            // 3. Add AI response
            await addDoc(messagesRef, {
                text: aiResponse,
                senderId: "gemini", 
                senderName: "ChatBot AI",
                timestamp: Timestamp.now(),
            });

        } catch (error) {
            console.error("Send message error:", error);
            setLocalError(`Failed to send message: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteChat = async (chatId) => {
        try {
            await deleteDoc(doc(db, `${PUBLIC_DATA_ROOT}/chats/${chatId}`));
            setLocalError(null);
            setShowDeleteMenu(null);
            
            if (chatId === selectedChatId) {
                setSelectedChatId(NEW_CHAT_ID);
            }
        } catch (error) {
            console.error("Failed to delete chat:", error);
            setLocalError(`Failed to delete chat: ${error.message}`);
        }
    };

    /* ==============================================================
      MESSAGE BUBBLE (STYLING AS PROVIDED)
    ==============================================================
    */

    const MessageBubble = ({ message }) => {
        const isMe = message.senderId === googleUID;
        const isBot = message.senderId === 'gemini';
        
        const avatarElement = (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 ${isMe ? 'bg-purple-500 border-purple-300' : 'bg-blue-600 border-blue-300'}`}>
                {isBot ? <Zap className="w-4 h-4" /> : 
                   (isMe && googlePhoto ? <img src={googlePhoto} alt={message.senderName} className="w-full h-full rounded-full" /> : 
                   message.senderName[0])
                }
            </div>
        );

        return (
            <div className={`flex mb-4 ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-start max-w-3/4 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* Avatar */}
                    <div className={`${isMe ? 'ml-3' : 'mr-3'} mt-1`}>
                        {avatarElement}
                    </div>
                    
                    {/* Message Content */}
                    <div className={`
                        p-3 rounded-xl shadow-md transition-all duration-300 max-w-md
                        ${isMe 
                            ? "bg-purple-600 text-white rounded-br-none" 
                            : "bg-gray-200 text-gray-800 rounded-tl-none border border-gray-300"}
                    `}
                    >
                        
                        {!isMe && (
                            <div className="font-bold text-xs mb-1 flex items-center text-blue-800">
                                {isBot ? 'ChatBot AI' : message.senderName}
                            </div>
                        )}
                        
                        <div className="text-sm whitespace-pre-wrap">{message.text}</div>
                        
                        <div className={`text-[10px] mt-1 text-right ${isMe ? 'opacity-80' : 'text-gray-500'}`}>
                            {message.timestamp}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    /* ==============================================================
      CHAT ITEM COMPONENT (STYLING AS PROVIDED)
    ==============================================================
    */

const ChatItem = ({ chat }) => {
  const isSelected = chat.id === selectedChatId;
  const isHovered = chat.id === hoveredChatId;
  const isNewChatButton = chat.id === NEW_CHAT_ID;

  return (
    <div
      className={`
        relative cursor-pointer transition-all duration-200 rounded-lg overflow-visible
        ${isSelected ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
      `}
      onMouseEnter={() => setHoveredChatId(chat.id)}
      onMouseLeave={() => setHoveredChatId(null)}
    >

      {/* Main area */}
      <button
        onClick={() => {
          setSelectedChatId(chat.id);
          setShowDeleteMenu(null); // Close menu when chat is selected
        }}
        className="flex items-center justify-between p-3 text-left w-full"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isNewChatButton && <Plus size={16} />}
            <span className="font-medium truncate">{chat.name}</span>
          </div>

          {!isNewChatButton && (
            <div className="text-xs opacity-70 mt-1">
              {chat.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}
            </div>
          )}
        </div>

        {/* 3-dot button */}
        {!isNewChatButton && (isHovered || showDeleteMenu === chat.id) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowDeleteMenu(showDeleteMenu === chat.id ? null : chat.id);
            }}
            className={`
              ml-2 p-2 rounded transition-colors flex-shrink-0
              ${isSelected ? 'hover:bg-purple-700' : 'hover:bg-gray-500'}
            `}
          >
            <MoreVertical size={16} />
          </button>
        )}
      </button>

      {/* Dropdown menu - FIXED: Changed overflow-visible and better positioning */}
      {showDeleteMenu === chat.id && (
        <div
          className="absolute right-2 top-12 bg-gray-800 text-white shadow-lg rounded-md z-50 py-1 min-w-32"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteChat(chat.id);
              setShowDeleteMenu(null);
            }}
            className="px-4 py-2 text-sm hover:bg-red-600 w-full text-left flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};


    /* ==============================================================
      UI RENDER (NO CHANGES)
    ==============================================================
    */

    const isNewChat = selectedChatId === NEW_CHAT_ID;
    
    const newChatPseudoItem = { 
        id: NEW_CHAT_ID, 
        name: "New Chat", 
        createdAt: null 
    };

    if (!isAuthReady || !db) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="text-center p-8 bg-white rounded-xl shadow-2xl">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold text-gray-800">Initializing Chat...</h2>
                    <p className="text-gray-600 mt-2">{loadingState}</p>
                    {localError && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
                            {localError}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100">

            {/* TOP NAV */}
            <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center space-x-3">
                    {googlePhoto && <img src={googlePhoto} alt="User Profile"
                        className="w-10 h-10 rounded-full border-2 border-white" />}
                    <span className="font-bold text-4xl">Public Chat Hub</span>
                </div>

                <div className="text-purple-200 font-medium">Welcome, {googleName}!</div>

                <button
                    onClick={onSignOut}
                    className="flex items-center bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors shadow-md"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                </button>
            </header>

            {/* DEBUG INFO */}
            {localError && (
                <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-lg m-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <div>
                        <strong>Error:</strong> {localError}
                    </div>
                </div>
            )}

            {/* LAYOUT */}
            <div className="flex flex-1 overflow-hidden">

                {/* SIDEBAR */}
                <div className={`
                    bg-gray-800 text-white transition-all border-r border-gray-700
                    ${isSidebarOpen ? "w-64" : "w-0"}
                `}>
                    <div className="h-full flex flex-col py-4">
                        
                        {/* New Chat Button */}
                        <div className="px-4">
                            <ChatItem chat={newChatPseudoItem} />
                        </div>

                        {/* Chat List */}
                        <div className="flex-1 overflow-hidden flex flex-col mt-4">
                            <h2 className="text-sm uppercase text-gray-400 border-t border-gray-700 pt-4 pb-2 px-4">
                                Your Chats ({chats.length})
                            </h2>
                            
                            {/* Scrollable chat list */}
                            <div className="flex-1 overflow-y-auto space-y-1 px-4 scrollbar-custom">
                                <style jsx>{`
                                    .scrollbar-custom::-webkit-scrollbar {
                                        width: 6px;
                                    }
                                    .scrollbar-custom::-webkit-scrollbar-track {
                                        background: #374151;
                                        border-radius: 3px;
                                    }
                                    .scrollbar-custom::-webkit-scrollbar-thumb {
                                        background: #6B7280;
                                        border-radius: 3px;
                                    }
                                    .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                                        background: #9CA3AF;
                                    }
                                `}</style>
                                
                                {chats.map((chat) => (
                                    <ChatItem key={chat.id} chat={chat} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MAIN CHAT */}
                <div className="flex-1 flex flex-col">
                    
                    {/* MESSAGES */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-blue-50">
                        {isNewChat && messages.length === 0 ? (
                            <div className="text-center text-gray-500 mt-8">
                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">Start a New Conversation</p>
                                <p className="text-sm text-gray-400">Your chat will be saved after the first message.</p>
                            </div>
                        ) : messages.length === 0 && !isNewChat ? (
                            <div className="text-center text-gray-500 mt-8">
                                <p className="text-lg font-medium">Loading chat history...</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <MessageBubble key={msg.id} message={msg} />
                            ))
                        )}

                        {isGenerating && (
                            <div className="flex justify-start mb-4">
                                <div className="flex items-start max-w-3/4">
                                    <div className="mr-3 mt-1">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 border-2 border-blue-300">
                                            <Zap className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                    <div className="bg-gray-200 text-gray-800 p-3 rounded-xl rounded-tl-none shadow-md border border-gray-300">
                                        <div className="flex items-center">
                                            <div className="animate-pulse flex space-x-1">
                                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                            </div>
                                            <span className="ml-2 text-sm text-gray-600">AI is thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef}></div>
                    </div>

                    {/* INPUT */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-300 flex space-x-3 shadow-lg">
                        <input
                            value={newMessageText}
                            onChange={(e) => setNewMessageText(e.target.value)}
                            className="flex-1 p-3 border-2 border-gray-300 text-black rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-colors"
                            placeholder={isNewChat ? "Type your first message to start this chat..." : "Type your message..."}
                            disabled={isGenerating}
                        />
                        <button 
                            type="submit"
                            disabled={isGenerating || !newMessageText.trim()}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 rounded-xl flex items-center justify-center transition-all shadow-md"
                        >
                            <Send className="w-4 h-4"/>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default App;