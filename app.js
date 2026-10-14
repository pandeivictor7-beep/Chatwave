import { initializeApp } from "https://gstatic.com";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut 
} from "https://gstatic.com";
import { 
  getFirestore, doc, setDoc, collection, addDoc, query, orderBy, onSnapshot 
} from "https://gstatic.com";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://gstatic.com";

// --- PASTE YOUR ACTUAL COPIED CONFIGURATION STRINGS HERE ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements Mapping
const authSection = document.getElementById("auth");
const workspace = document.getElementById("workspace");
const logoutBtn = document.getElementById("logout");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const nameInput = document.getElementById("displayName");
const signupBtn = document.getElementById("signup");
const loginBtn = document.getElementById("login");
const authMessage = document.getElementById("authMessage");
const peopleList = document.getElementById("people");
const messagesContainer = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("send");
const photoButton = document.getElementById("photoButton");
const photoInput = document.getElementById("photo");
const chatAvatar = document.getElementById("chatAvatar");
const chatName = document.getElementById("chatName");

// Application State
let currentUser = null;
let activeChatUserId = null;
let unsubscribeMessages = null;

// Create Account Handler
signupBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  if (!email || !password || !name) return alert("Please fill all fields.");
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    await setDoc(doc(db, "users", userCredential.user.uid), {
      uid: userCredential.user.uid,
      displayName: name,
      email: email
    });
  } catch (error) { 
    authMessage.textContent = error.message; 
  }
});

// Sign In Handler
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  try { 
    await signInWithEmailAndPassword(auth, email, password); 
  } catch (error) { 
    authMessage.textContent = error.message; 
  }
});

// Log Out Handler
logoutBtn.addEventListener("click", () => signOut(auth));

// Handle Authentication State Toggles
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authSection.classList.add("hidden");
    workspace.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loadUsersList();
  } else {
    currentUser = null;
    activeChatUserId = null;
    authSection.classList.remove("hidden");
    workspace.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
});

// Load Active Chat Users List
async function loadUsersList() {
  const q = query(collection(db, "users"));
  onSnapshot(q, (snapshot) => {
    peopleList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const user = docSnap.data();
      if (user.uid === currentUser.uid) return;
      const personEl = document.createElement("div");
      personEl.className = `person ${activeChatUserId === user.uid ? 'active' : ''}`;
      personEl.innerHTML = `
        <div class="avatar">${user.displayName.charAt(0).toUpperCase()}</div>
        <div class="details"><strong>${user.displayName}</strong><small>Click to chat</small></div>
      `;
      personEl.addEventListener("click", () => selectUser(user));
      peopleList.appendChild(personEl);
    });
  });
}

// Select a Chat Target User
function selectUser(targetUser) {
  activeChatUserId = targetUser.uid;
  chatName.textContent = targetUser.displayName;
  chatAvatar.textContent = targetUser.displayName.charAt(0).toUpperCase();
  document.querySelectorAll('.person').forEach(el => el.classList.remove('active'));
  loadMessages();
}

// Load Conversation Realtime Messages Stream
function loadMessages() {
  if (unsubscribeMessages) unsubscribeMessages();
  messagesContainer.innerHTML = '<div class="empty">Loading chat history...</div>';
  const chatRoomId = [currentUser.uid, activeChatUserId].sort().join("_");
  const q = query(collection(db, "chats", chatRoomId, "messages"), orderBy("timestamp", "asc"));
  
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    if(snapshot.empty) {
      messagesContainer.innerHTML = `<div class="empty">👋<h3>Start a conversation</h3>Send your first message!</div>`;
    }
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isMine = msg.senderId === currentUser.uid;
      const bubble = document.createElement("div");
      bubble.className = `bubble ${isMine ? 'mine' : ''}`;
      
      let messageContent = '';
      if (msg.imageUrl) messageContent += `<img src="${msg.imageUrl}" alt="Shared image" />`;
      if (msg.text) messageContent += `<div>${msg.text}</div>`;
      
      const timeStr = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';
      messageContent += `<div class="time">${timeStr}</div>`;
      
      bubble.innerHTML = messageContent;
      messagesContainer.appendChild(bubble);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// Submit Message Event Handler
async function sendMessage() {
  const text = messageInput.value.trim();
  const files = photoInput.files;
  const file = files.length > 0 ? files[0] : null;

  if (!text && !file) return;
  if (!activeChatUserId) return alert("Select a user to chat with first!");

  messageInput.value = "";
  photoInput.value = "";
  messageInput.placeholder = "Write a message...";
  
  const chatRoomId = [currentUser.uid, activeChatUserId].sort().join("_");
  let imageUrl = null;
  
  try {
    if (file) {
      const storageRef = ref(storage, `chat_photos/${chatRoomId}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(uploadResult.ref);
    }
    await addDoc(collection(db, "chats", chatRoomId, "messages"), {
      senderId: currentUser.uid,
      text: text,
      imageUrl: imageUrl,
      timestamp: new Date()
    });
  } catch(err) { 
    console.error("Error sending message:", err); 
  }
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
photoButton.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", () => {
  if (photoInput.files.length > 0) {
    messageInput.placeholder = `📷 Ready: ${photoInput.files[0].name}`;
  }
});
https://gstatic.com
