import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged, 
    signOut 
} from "firebase/auth";
import Chat from "./chat";
import { Loader2, LogIn } from "lucide-react";

const LoginPage = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        console.log("Setting up auth listener...");
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("Auth state changed:", user ? `UID: ${user.uid}, Name: ${user.displayName}` : "no user");
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoggingIn(true);
        
        const provider = new GoogleAuthProvider();
        // Add these to ensure we get profile data
        provider.addScope('profile');
        provider.addScope('email');

        try {
            console.log("Initiating Google login popup...");
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            console.log("Login successful:", {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            });
            
            // Force update the user state immediately
            setUser(user);
            
        } catch (err) {
            console.error("Login error:", err);
            
            let errorMessage = "Login failed. Please try again.";
            if (err.code === 'auth/popup-closed-by-user') {
                errorMessage = "Login was cancelled. Please try again.";
            } else if (err.code === 'auth/popup-blocked') {
                errorMessage = "Popup was blocked by your browser. Please allow popups for this site.";
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection.";
            }
            
            setError(errorMessage);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log("User logged out");
        } catch (err) {
            console.error("Logout error:", err);
            setError("Failed to sign out. Please try again.");
        }
    };

    // Show loading spinner while checking initial authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Checking authentication...</p>
                </div>
            </div>
        );
    }

    // If user exists, show chat - but ensure user has necessary data
    if (user && user.uid) {
        return <Chat user={user} onSignOut={handleLogout} />;
    }

    // No user found, show login page
    console.log("Rendering login page - no user found");
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-sm text-center">
                <div className="mb-6">
                    <h1 className="text-2xl text-black font-bold mb-2">Secure Login</h1>
                    <p className="text-gray-600 text-sm">Sign in to continue to the chat</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white w-full font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors duration-200"
                >
                    {isLoggingIn ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <LogIn className="w-5 h-5 mr-2" />
                            Sign In with Google
                        </>
                    )}
                </button>

                <div className="mt-6 text-xs text-gray-500">
                    <p>A popup will open for Google authentication</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;