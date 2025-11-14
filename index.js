import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signInWithRedirect,
    getRedirectResult,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    updateProfile
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    onSnapshot, 
    serverTimestamp,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    orderBy
} from 'firebase/firestore';


// =================================================================================
// Firebase Configuration
// IMPORTANT: You must replace this with your own Firebase project configuration.
// The authentication errors you are seeing are because this configuration is a
// placeholder. The app will not work until you provide your own credentials.
//
// To fix this:
// 1. Go to the Firebase Console (https://console.firebase.google.com/).
// 2. Create a new project or select an existing one.
// 3. Go to Project settings (click the gear icon ⚙️).
// 4. In the "Your apps" card, click the web icon (</>) to create a new web app or select your existing one.
// 5. Copy the entire firebaseConfig object and paste it here.
// 6. Go to Authentication -> Sign-in method tab.
// 7. Enable both "Email/Password" and "Google" as sign-in providers.
// 8. Go to Authentication -> Settings tab -> Authorized domains.
// 9. Make sure the domain where you are running this app is listed.
// =================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDXUJ2ooY5S_pR2liDGe-afRZhNo0RI8Zs",
  authDomain: "latinfroggame.firebaseapp.com",
  databaseURL: "https://latinfroggame-default-rtdb.firebaseio.com",
  projectId: "latinfroggame",
  storageBucket: "latinfroggame.firebasestorage.app",
  messagingSenderId: "196302891263",
  appId: "1:196302891263:web:0b2fd634738f890580c4ca",
  measurementId: "G-S5H91BQYMB"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// =================================================================================
// Constants
// =================================================================================
const DEFAULT_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2372767d'/%3E%3C/svg%3E";
const HANGUP_SVG = `<svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.218,2.282a1.042,1.042,0,0,0-1.474,0l-1.7,1.7-2.31-2.31a3.03,3.03,0,0,0-4.286,0L2.282,6.839a3.03,3.03,0,0,0,0,4.286l3.3,3.3-2.24,2.24a1.042,1.042,0,0,0,0,1.474l3.78,3.78a1.042,1.042,0,0,0,1.474,0l2.24-2.24,3.3,3.3a3.03,3.03,0,0,0,4.286,0l4.834-4.834a3.03,3.03,0,0,0,0-4.286L17.218,2.282Z"></path></svg>`;
const CHAT_SVG = `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>`;
const SHARE_SCREEN_SVG = `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
const STOP_SHARE_SVG = `<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`;

// =================================================================================
// App State
// =================================================================================
let currentUser = null;
let roomUnsubscribe = () => {};
let messagesUnsubscribe = () => {};

// WebRTC State
let peerConnection;
let localStream;
let remoteStream = new MediaStream();
let activeRoomId = null;
let isSharing = false;
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};


// =================================================================================
// Global Error Handling
// =================================================================================
const showGlobalError = (title, message) => {
    document.getElementById('global-error-title').textContent = title;
    document.getElementById('global-error-message').textContent = message;
    document.getElementById('global-error-overlay').classList.remove('hidden');
};

const hideGlobalError = () => {
    document.getElementById('global-error-overlay').classList.add('hidden');
};


// =================================================================================
// Authentication
// =================================================================================

const showRedirectLoader = () => {
    document.getElementById('redirect-loader').classList.remove('hidden');
};
const hideRedirectLoader = () => {
    document.getElementById('redirect-loader').classList.add('hidden');
};

const handleRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log('Successfully authenticated via Google redirect.');
        } else {
            try {
                await getDoc(doc(db, 'healthcheck', 'status'));
            } catch (error) {
                 if (error.code === 'unavailable' || error.message.includes('Failed to fetch') || error.code === 'permission-denied') {
                    showGlobalError(
                        'Connection Failed', 
                        'Could not connect to the server. This is often caused by an ad-blocker, firewall, or network issue. Please check your setup, then refresh the page.'
                    );
                }
            }
        }
    } catch (error) {
        hideRedirectLoader();
        console.error("Google Sign-In Redirect Result Error:", error);
        switch (error.code) {
            case 'auth/account-exists-with-different-credential':
                showLoginError('Sign-In Failed', 'An account already exists with this email but using a different sign-in method (e.g., password).', error.code);
                break;
            default:
                showLoginError("Google Sign-In Error", error.message || "An unknown error occurred.", error.code);
        }
    }
};
handleRedirectResult();

onAuthStateChanged(auth, async (user) => {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  if (user) {
      hideGlobalError();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const displayName = user.displayName || user.email.split('@')[0];
        const photoURL = user.photoURL || `https://i.pravatar.cc/64?u=${user.uid}`;

        if (!user.displayName || !user.photoURL) {
          await updateProfile(user, { displayName, photoURL });
        }
        
        await setDoc(userDocRef, { displayName, photoURL });
        currentUser = { uid: user.uid, displayName, photoURL, email: user.email };
      } else {
        const userData = userDoc.data();
        currentUser = { uid: user.uid, displayName: userData.displayName, photoURL: userData.photoURL, email: user.email };
      }
      
      loginView.classList.add('hidden');
      appView.classList.remove('hidden');
      renderUserInfo();
      showLobby();
  } else {
    currentUser = null;
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
    await hangUp();
  }
});

const showLoginError = (title, message, code = '') => {
    const loginErrorContainer = document.getElementById('login-error-container');
    const codeHTML = code ? `<span class="block mt-1 text-gray-500 text-xs">(Code: ${code})</span>` : '';
    loginErrorContainer.innerHTML = `
        <p class="font-semibold text-red-200">${title}</p>
        <p class="text-sm">${message}</p>
        ${codeHTML}
    `;
    loginErrorContainer.classList.remove('hidden');
};

const clearLoginError = () => {
    const loginErrorContainer = document.getElementById('login-error-container');
    loginErrorContainer.innerHTML = '';
    loginErrorContainer.classList.add('hidden');
};

const signInWithGoogle = () => {
    clearLoginError();
    showRedirectLoader();
    signInWithRedirect(auth, provider).catch((error) => {
        hideRedirectLoader();
        console.error("Google Sign-In Redirect Error:", error);
        switch (error.code) {
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                break;
            case 'auth/invalid-api-key':
                showLoginError('Configuration Error', 'Invalid Firebase API Key. Check your `firebaseConfig` in index.js.', error.code);
                break;
            case 'auth/operation-not-allowed':
                 showLoginError('Configuration Error', 'Google Sign-In is not enabled. Go to your Firebase console > Authentication > Sign-in method and enable it.', error.code);
                 break;
            case 'auth/unauthorized-domain':
                 showLoginError('Configuration Error', 'This domain is not authorized for your Firebase project. Go to Authentication > Settings > Authorized domains and add it.', error.code);
                 break;
            default:
                showLoginError("Google Sign-In Error", error.message || "An unknown error occurred.", error.code);
        }
    });
};

const handleSignUp = async (e) => {
    e.preventDefault();
    clearLoginError();

    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Sign-Up Error:", error);
        switch (error.code) {
            case 'auth/email-already-in-use': 
                showLoginError('Sign-Up Failed', 'An account with this email already exists. Try signing in instead.', error.code); 
                break;
            case 'auth/invalid-email': 
                showLoginError('Invalid Input', 'Please enter a valid email address.', error.code); 
                break;
            case 'auth/weak-password': 
                showLoginError('Invalid Input', 'Password must be at least 6 characters long.', error.code); 
                break;
            case 'auth/operation-not-allowed': 
                showLoginError('Configuration Error', 'Email/Password sign-up is not enabled in your Firebase project.', error.code); 
                break;
            case 'auth/invalid-api-key':
                showLoginError('Configuration Error', 'The provided Firebase API Key is invalid. Please check your `firebaseConfig` in index.js.', error.code);
                break;
            default:
                showLoginError("Sign-Up Error", error.message || "An unknown error occurred during sign-up.", error.code);
        }
    }
};

const handleSignIn = async (e) => {
    e.preventDefault();
    clearLoginError();
    const signinEmailInput = document.getElementById('signin-email');
    const signinPasswordInput = document.getElementById('signin-password');
    const email = signinEmailInput.value;
    const password = signinPasswordInput.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Sign-In Error:", error);
        switch(error.code) {
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials':
                showLoginError('Login Failed', 'The email or password you entered is incorrect. Please double-check and try again.', error.code);
                break;
            case 'auth/invalid-email': 
                showLoginError('Invalid Input', 'Please enter a valid email address.', error.code);
                break;
            case 'auth/operation-not-allowed': 
                showLoginError('Configuration Error', 'Email/Password sign-in is not enabled in your Firebase project.', error.code);
                break;
            case 'auth/invalid-api-key':
                showLoginError('Configuration Error', 'The provided Firebase API Key is invalid. Please check your `firebaseConfig` in index.js.', error.code);
                break;
            default:
                showLoginError('Sign-In Error', error.message || "An unknown error occurred during sign-in.", error.code);
        }
    }
};

const handleSignOut = () => signOut(auth).catch((error) => console.error("Sign out error", error));

// =================================================================================
// UI Rendering Functions
// =================================================================================
const isValidHttpUrl = (string) => {
    if (!string) return false;
    try {
        const newUrl = new URL(string);
        return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
    } catch (_) {
        return false;
    }
};

const renderUserInfo = () => {
  if (!currentUser) return;
  const userInfoPanels = document.querySelectorAll('.user-info-panel');
  const avatarUrl = isValidHttpUrl(currentUser.photoURL) ? currentUser.photoURL : DEFAULT_AVATAR_SVG;

  const userInfoHTML = `
    <img src="${avatarUrl}" alt="${currentUser.displayName}" class="w-10 h-10 rounded-full object-cover mr-2"/>
    <div class="truncate">
        <p class="text-sm font-semibold text-white truncate">${currentUser.displayName}</p>
    </div>
  `;
  userInfoPanels.forEach(panel => panel.innerHTML = userInfoHTML);
};

const showLobby = () => {
    document.getElementById('room-lobby-view').style.display = 'flex';
    document.getElementById('video-call-view').classList.add('hidden');
    document.getElementById('join-error').textContent = '';
    document.getElementById('room-code-input').value = '';
};

const toggleChatPanel = () => {
    const chatPanel = document.getElementById('chat-panel');
    chatPanel.classList.toggle('translate-x-full');
};

const showRoomUI = (state) => {
    const lobbyView = document.getElementById('room-lobby-view');
    const videoCallView = document.getElementById('video-call-view');
    const status = document.getElementById('video-call-status');
    const controls = document.getElementById('video-call-controls');
    const localVideoContainer = document.getElementById('local-video-container');
    const roomCodeText = document.getElementById('room-code-text');

    lobbyView.style.display = 'none';
    videoCallView.classList.remove('hidden');
    roomCodeText.textContent = `CODE: ${activeRoomId}`;

    const controlsHTML = `
        <button id="share-screen-button" class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600" aria-label="Toggle Screen Share">
            ${isSharing ? STOP_SHARE_SVG : SHARE_SCREEN_SVG}
        </button>
        <button id="chat-toggle-button" class="w-12 h-12 bg-gray-600/50 rounded-full flex items-center justify-center hover:bg-gray-500/50" aria-label="Toggle Chat">${CHAT_SVG}</button>
        <button id="hang-up-button" class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600" aria-label="Leave Room">${HANGUP_SVG}</button>
    `;
    controls.innerHTML = controlsHTML;
    document.getElementById('hang-up-button').onclick = hangUp;
    document.getElementById('chat-toggle-button').onclick = toggleChatPanel;
    document.getElementById('share-screen-button').onclick = toggleScreenShare;
    
    localVideoContainer.style.display = isSharing ? 'block' : 'none';

    if (state === 'waiting') {
        status.innerHTML = `
            <h3 class="text-2xl font-semibold">Waiting for someone to join...</h3>
            <p class="text-gray-300 mt-2">Share the room code with a friend.</p>
        `;
        status.style.display = 'flex';
        controls.style.display = 'flex';
    } else if (state === 'connected') {
        status.style.display = 'none';
        controls.style.display = 'flex';
    }
};


// =================================================================================
// WebRTC & Chat Functions
// =================================================================================
const toggleScreenShare = async () => {
    if (isSharing) {
        await stopScreenShare();
    } else {
        await startScreenShare();
    }
};

const startScreenShare = async () => {
    const statusEl = document.getElementById('video-call-status');
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (error) {
        console.error("Could not get display media.", error);
        if (error.name === 'NotAllowedError') {
            statusEl.innerHTML = `<h3 class="text-xl font-semibold text-red-400">Permission Denied</h3><p class="mt-2">You need to grant screen sharing permission to continue.</p>`;
            statusEl.style.display = 'flex';
            setTimeout(() => {
                const remoteVideo = document.getElementById('remote-video');
                const isConnected = remoteVideo.srcObject && remoteVideo.srcObject.getTracks().length > 0;
                showRoomUI(isConnected ? 'connected' : 'waiting');
            }, 4000);
        }
        return;
    }

    isSharing = true;
    document.getElementById('local-video').srcObject = localStream;
    document.getElementById('local-video-container').style.display = 'block';

    const shareButton = document.getElementById('share-screen-button');
    if (shareButton) shareButton.innerHTML = STOP_SHARE_SVG;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.onended = () => {
            console.log("Screen sharing ended by user via browser UI.");
            stopScreenShare();
        };
    }

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    try {
        const roomRef = doc(db, 'rooms', activeRoomId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await updateDoc(roomRef, { 
            offer: { type: offer.type, sdp: offer.sdp } 
        });
    } catch (error) {
        console.error("Error during screen share renegotiation:", error);
    }
};

const stopScreenShare = async () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localStream = null;
    isSharing = false;

    document.getElementById('local-video').srcObject = null;
    document.getElementById('local-video-container').style.display = 'none';

    const shareButton = document.getElementById('share-screen-button');
    if (shareButton) shareButton.innerHTML = SHARE_SCREEN_SVG;

    if (peerConnection && peerConnection.connectionState !== 'closed') {
        try {
            for (const sender of peerConnection.getSenders()) {
                if (sender.track) {
                    peerConnection.removeTrack(sender);
                }
            }
            
            const roomRef = doc(db, 'rooms', activeRoomId);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            await updateDoc(roomRef, { 
                offer: { type: offer.type, sdp: offer.sdp } 
            });
        } catch(error) {
            console.error("Error stopping screen share and renegotiating:", error);
        }
    }
};

const createPeerConnection = (roomId) => {
    peerConnection = new RTCPeerConnection(iceServers);
    remoteStream.getTracks().forEach(track => remoteStream.removeTrack(track));
    document.getElementById('remote-video').srcObject = remoteStream;

    peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };
};

const handleCreateRoom = async () => {
    if (activeRoomId) return;

    const roomCollection = collection(db, 'rooms');
    const roomRef = doc(roomCollection);
    activeRoomId = roomRef.id;

    createPeerConnection(activeRoomId);

    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            addDoc(callerCandidatesCollection, event.candidate.toJSON());
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const roomWithOffer = {
        creatorId: currentUser.uid,
        createdAt: serverTimestamp(),
        offer: { type: offer.type, sdp: offer.sdp },
    };
    await setDoc(roomRef, roomWithOffer);
    
    listenForMessages(activeRoomId);
    isSharing = false;
    showRoomUI('waiting');

    roomUnsubscribe = onSnapshot(roomRef, 
        async (snapshot) => {
            hideGlobalError();
            if (!snapshot.exists()) {
                hangUp();
                return;
            }
            const data = snapshot.data();
            if (data.answer) {
                const isNewAnswer = !peerConnection.currentRemoteDescription || 
                                    peerConnection.currentRemoteDescription.sdp !== data.answer.sdp;
                if (isNewAnswer) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    showRoomUI('connected');
                }
            }
        },
        (error) => {
            console.error("Room listener failed:", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showGlobalError('Connection Interrupted', 'Lost connection to the room. This might be due to an ad-blocker or network issue. Please refresh the page.');
            }
        }
    );

    onSnapshot(collection(roomRef, 'calleeCandidates'), snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    });
};

const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (activeRoomId) return;
    
    const roomId = document.getElementById('room-code-input').value;
    const roomRef = doc(db, 'rooms', roomId);
    const joinError = document.getElementById('join-error');
    
    try {
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) {
            joinError.textContent = 'Room not found.'; return;
        }
        if (roomDoc.data().joinerId) {
            joinError.textContent = 'Room is full.'; return;
        }
        if (roomDoc.data().creatorId === currentUser.uid) {
            joinError.textContent = "You can't join your own room."; return;
        }
        
        joinError.textContent = '';
        activeRoomId = roomId;

        createPeerConnection(roomId);
        
        const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                addDoc(calleeCandidatesCollection, event.candidate.toJSON());
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(roomDoc.data().offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(roomRef, {
            joinerId: currentUser.uid,
            answer: { type: answer.type, sdp: answer.sdp },
        });
        
        listenForMessages(activeRoomId);
        isSharing = false;
        showRoomUI('connected');

        roomUnsubscribe = onSnapshot(roomRef, 
            async (snapshot) => {
                hideGlobalError();
                if (!snapshot.exists()) {
                    hangUp(); return;
                }
                const data = snapshot.data();
                if (data.offer && peerConnection.remoteDescription && data.offer.sdp !== peerConnection.remoteDescription.sdp) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const newAnswer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(newAnswer);
                    await updateDoc(roomRef, { answer: { type: newAnswer.type, sdp: newAnswer.sdp } });
                }
            },
            (error) => {
                console.error("Room listener failed:", error);
                if (error.code === 'unavailable' || error.code === 'permission-denied') {
                    showGlobalError('Connection Interrupted', 'Lost connection to the room. This might be due to an ad-blocker or network issue. Please refresh the page.');
                }
            }
        );

        onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                }
            });
        });
    } catch (error) {
        console.error("Failed to join room:", error);
        joinError.textContent = "Error joining room.";
    }
};

const listenForMessages = (roomId) => {
    const messagesCollection = collection(db, 'rooms', roomId, 'messages');
    const q = query(messagesCollection, orderBy('timestamp', 'asc'));

    messagesUnsubscribe = onSnapshot(q, 
        (snapshot) => {
            hideGlobalError();
            const chatMessagesContainer = document.getElementById('chat-messages');
            if (snapshot.empty) {
                chatMessagesContainer.innerHTML = '<p class="text-center text-sm text-gray-500">No messages yet. Say hi!</p>';
                return;
            }
            chatMessagesContainer.innerHTML = ''; 
            snapshot.forEach(doc => {
                const message = doc.data();
                const messageEl = createMessageElement(message);
                chatMessagesContainer.appendChild(messageEl);
            });
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        },
        (error) => {
            console.error("Message listener failed:", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showGlobalError('Connection Interrupted', 'Could not load chat messages. Check your connection or ad-blocker settings and refresh.');
            }
        }
    );
};

const createMessageElement = (message) => {
    const messageWrapper = document.createElement('div');
    const isCurrentUser = message.senderId === currentUser.uid;
    
    const avatarUrl = isValidHttpUrl(message.senderAvatar) ? message.senderAvatar : DEFAULT_AVATAR_SVG;
    
    const textNode = document.createTextNode(message.text);
    const p = document.createElement('p');
    p.className = 'text-sm break-words';
    p.appendChild(textNode);
    
    messageWrapper.className = `flex items-start gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`;
    
    messageWrapper.innerHTML = `
        <img src="${avatarUrl}" alt="${message.senderName}" class="w-8 h-8 rounded-full object-cover mt-1 flex-shrink-0">
        <div class="flex flex-col max-w-[80%]">
            <div class="px-3 py-2 rounded-lg ${isCurrentUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-700 text-gray-300 rounded-bl-none'}">
                <p class="text-sm font-semibold mb-1 ${isCurrentUser ? 'hidden' : ''}">${message.senderName}</p>
                <div class="message-content-container"></div>
            </div>
        </div>
    `;
    
    messageWrapper.querySelector('.message-content-container').appendChild(p);

    return messageWrapper;
};

const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activeRoomId || !currentUser) return;

    const chatInput = document.getElementById('chat-input');
    const messageText = chatInput.value.trim();

    if (messageText) {
        const messagesCollection = collection(db, 'rooms', activeRoomId, 'messages');
        try {
            chatInput.value = '';
            await addDoc(messagesCollection, {
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                senderAvatar: currentUser.photoURL,
                text: messageText,
                timestamp: serverTimestamp(),
            });
            chatInput.focus();
        } catch (error) {
            console.error("Error sending message:", error);
            chatInput.value = messageText; // Restore text on failure
        }
    }
};


const hangUp = async () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    
    if (roomUnsubscribe) roomUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();

    if (activeRoomId && currentUser) {
        try {
            const roomRef = doc(db, 'rooms', activeRoomId);
            const roomDoc = await getDoc(roomRef);
            if (roomDoc.exists() && roomDoc.data().creatorId === currentUser.uid) {
                const subcollections = ['callerCandidates', 'calleeCandidates', 'messages'];
                for (const sub of subcollections) {
                    const snapshot = await getDocs(collection(roomRef, sub));
                    snapshot.forEach(d => deleteDoc(d.ref));
                }
                await deleteDoc(roomRef);
            }
        } catch(error) {
            console.error("Error cleaning up room:", error);
        }
    }
    
    // Reset state
    peerConnection = null;
    localStream = null;
    remoteStream = new MediaStream();
    activeRoomId = null;
    isSharing = false;
    roomUnsubscribe = () => {};
    messagesUnsubscribe = () => {};
    
    document.getElementById('remote-video').srcObject = null;
    document.getElementById('local-video').srcObject = null;
    
    // Reset UI
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-panel').classList.add('translate-x-full');
    const localVideoContainer = document.getElementById('local-video-container');
    if(localVideoContainer) {
        localVideoContainer.style.top = '1rem';
        localVideoContainer.style.right = '1rem';
        localVideoContainer.style.left = 'auto';
        localVideoContainer.style.bottom = 'auto';
    }

    showLobby();
};

// =================================================================================
// Event Listeners
// =================================================================================

// Login/Auth
document.getElementById('login-button').addEventListener('click', signInWithGoogle);
document.getElementById('signup-form').addEventListener('submit', handleSignUp);
document.getElementById('signin-form').addEventListener('submit', handleSignIn);
document.getElementById('show-signin-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('signin-form').classList.remove('hidden');
    clearLoginError();
});
document.getElementById('show-signup-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signin-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
    clearLoginError();
});
document.querySelectorAll('.signout-button').forEach(btn => btn.addEventListener('click', handleSignOut));

// Room Lobby
document.getElementById('create-room-button').addEventListener('click', handleCreateRoom);
document.getElementById('join-room-form').addEventListener('submit', handleJoinRoom);

// Video Call View
document.getElementById('chat-form').addEventListener('submit', handleSendMessage);
document.getElementById('close-chat-button').addEventListener('click', toggleChatPanel);

// Copy Room Code
document.getElementById('room-code-display').addEventListener('click', () => {
    if (activeRoomId) {
        navigator.clipboard.writeText(activeRoomId)
            .then(() => {
                const roomCodeText = document.getElementById('room-code-text');
                const originalText = roomCodeText.textContent;
                roomCodeText.textContent = 'COPIED!';
                setTimeout(() => { roomCodeText.textContent = originalText; }, 1500);
            })
            .catch(err => console.error('Failed to copy text: ', err));
    }
});


// Draggable local video
const localVideoContainer = document.getElementById('local-video-container');
let isDragging = false;
let offsetX, offsetY;

localVideoContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - localVideoContainer.offsetLeft;
    offsetY = e.clientY - localVideoContainer.offsetTop;
    localVideoContainer.style.transition = 'none';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        const parentRect = localVideoContainer.parentElement.getBoundingClientRect();
        const elRect = localVideoContainer.getBoundingClientRect();
        
        x = Math.max(0, Math.min(x, parentRect.width - elRect.width));
        y = Math.max(0, Math.min(y, parentRect.height - elRect.height));

        localVideoContainer.style.left = `${x}px`;
        localVideoContainer.style.top = `${y}px`;
        localVideoContainer.style.right = 'auto';
        localVideoContainer.style.bottom = 'auto';
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    localVideoContainer.style.transition = 'all 0.3s ease';
});