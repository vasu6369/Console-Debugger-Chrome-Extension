const GEMINI_API_KEY = "AIzaSyAGpwwPvKd5eQr59oNKd9MXQKtcPbW5vUw";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
let errorLogs = [];
let chatHistory = []; 

window.onerror = function (message, source, lineno, colno, error) {
    let errorMsg = `Global Error: ${message} at ${source}:${lineno}:${colno}`;
    errorLogs.push(errorMsg);
    console.log("Captured Global Error:", errorMsg);
};
const originalConsoleError = console.error;
console.error = function (...args) {
    let errorMsg = `Console Error: ${args.join(" ")}`;
    errorLogs.push(errorMsg);
    console.log("Captured Console Error:", errorMsg);
    originalConsoleError.apply(console, args);
};
window.addEventListener("unhandledrejection", function (event) {
    let errorMsg = `Unhandled Promise Rejection: ${event.reason}`;
    errorLogs.push(errorMsg);
    console.log("Captured Unhandled Promise Rejection:", errorMsg);
});

async function handleDebugRequest() {
    if (errorLogs.length > 0) {
        await sendErrorsToAPI();
    } else {
        console.log("No errors detected in the console.");
    }
}

if (!document.getElementById("chatbot-button")) {
    let chatbotButton = document.createElement("button");
    chatbotButton.id = "chatbot-button";
    chatbotButton.innerHTML = '<img src="https://cdn-icons-png.freepik.com/256/9884/9884885.png?uid=R147455405&ga=GA1.1.1409561897.1729397420&semt=ais_hybrid" alt="chatbot" />';
    document.body.appendChild(chatbotButton);
    let chatbotContainer = document.createElement("div");
    chatbotContainer.id = "chatbot-container";
    chatbotContainer.style.display = "none";
    chatbotContainer.innerHTML = `
    <div id="chatbot-header">
        <p>Console Debugger</p>
        <div>
        <button id="download-chat">Download</button>
        <button id="delete-chat">Delete</button>
        <button id="close-chatbot">Close</button>
        </div>
    </div>
    <div id="chatbot-body"></div>
    <div id="chatbot-footer">
        <input type="text" id="chatbot-input" placeholder="Type a message...">
        <button id="send-message">Send</button>
    </div>
    </div>
    `;
    document.body.appendChild(chatbotContainer);
    document.getElementById("delete-chat").addEventListener("click", () => {
        let chatBody = document.getElementById("chatbot-body");
        if (confirm("Are you sure you want to delete all chat messages?")) {
            chatBody.innerHTML = "";
            chatHistory = [];
            localStorage.removeItem("chatHistory");
            console.log("Chat history deleted.");
                let text = {"candidates": [{"content": {"parts": [{"text": "👋 Hi! I can help you debug console errors. Try commands like:\n-fix the errors\n-fix my errors\n-analyze the errors"}]}}]}
             botmessage(text);
        }
    });

    const exportChat = () => {
        if (chatHistory.length === 0) {
            alert("No chat history to export.");
            return;
        }
        let chatText = chatHistory.map(entry => `${entry.role === "user" ? "User" : "Chatbot"}: ${entry.text}`).join("\n");
        let blob = new Blob([chatText], { type: "text/plain" });
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "chat_history.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    document.getElementById("download-chat").addEventListener("click", exportChat);

    chatbotButton.addEventListener("click", () => {
        chatbotContainer.style.display = chatbotContainer.style.display === "none" ? "flex" : "none";
    });

    document.getElementById("close-chatbot").addEventListener("click", () => {
        chatbotContainer.style.display = "none";
    });

    document.getElementById("send-message").addEventListener("click", async () => {
        let inputField = document.getElementById("chatbot-input");
        let message = inputField.value.trim();
        if (message) {
            let chatBody = document.getElementById("chatbot-body");
            let userMessage = document.createElement("div");
            userMessage.classList.add("chat-message", "user");
            userMessage.innerText = message;
            chatBody.appendChild(userMessage);
            chatBody.scrollTop = chatBody.scrollHeight;
            inputField.value = "";
            chatHistory.push({ role: "user", text: message });
            updateLocalStorage();
            let isErrorRelated = /(error|bug|debug|fix|issue|troubleshoot|exception|console|syntax|runtime|crash)/i.test(message);
            if (isErrorRelated) {
                handleDebugRequest();
            } else {
                await sendMessageToAPI();
            }
        }
    });
}

const sendMessageToAPI = async () => {
    try {
        let response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: chatHistory.slice(-10).map(entry => ({ role: entry.role, parts: [{ text: entry.text }] }))
            })
        });
        let data = await response.json();
        botmessage(data);
    } catch (error) {
        console.error("Gemini API Error:", error);
    }
};

const sendErrorsToAPI = async () => {
    try {
        if (errorLogs.length === 0) return;
        let historyWithErrors = [...chatHistory.slice(-10), { role: "user", parts: [{ text: `Debug these console errors and add 2 reference links:\n${errorLogs.join("\n")}` }] }];
        let formattedHistory = historyWithErrors.map(msg => ({ role: msg.role, parts: [{ text: msg.text || (msg.parts ? msg.parts[0].text : "") }] }));
        let requestBody = { contents: formattedHistory };
        let response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });
        let data = await response.json();
        botmessage(data);
    } catch (err) {
        console.error("Gemini API Request Failed:", err);
    }
};

const botmessage = (data) => {
    let chatBody = document.getElementById("chatbot-body");
    let botMessage = document.createElement("div");
    botMessage.classList.add("chat-message", "bot");
    let text = "⚠️ Error: No response from Gemini AI.";
    if(data){
         text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    let isErrorRelated = /(error|bug|debug|fix|issue|troubleshoot|exception|console|syntax|runtime|crash)/i.test(text);
    if (!isErrorRelated) {
        text = "Hello, I'm specialized in debugging. Please ask about errors or troubleshooting issues.";
    }
    botMessage.innerHTML = formatChatMessage(text);
    chatBody.appendChild(botMessage);
    chatHistory.push({ role: "assistant", text: text });
    updateLocalStorage();
    chatBody.scrollTop = chatBody.scrollHeight;
};

const updateLocalStorage = () => {
    if (chatHistory.length > 0) {
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }
};

const displayChatHistory = () => {
    let chatBody = document.getElementById("chatbot-body");
    if (!chatBody) {
        console.error("Chatbot body not found!");
        return;
    }
    chatBody.innerHTML = "";
    chatHistory.forEach((message, index) => {
        let msgDiv = document.createElement("div");
        if (message.role === "user") {
            msgDiv.classList.add("chat-message", "user");
            
        } else {
            msgDiv.classList.add("chat-message", "bot");
        }
        msgDiv.innerHTML = formatChatMessage(message.text);
        chatBody.appendChild(msgDiv);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
};

const loadChatHistory = () => {
    let storedHistory = localStorage.getItem("chatHistory");
    if (storedHistory) {
        try {
            chatHistory = JSON.parse(storedHistory);
            displayChatHistory();
        } catch (error) {
            console.error("Error parsing chat history:", error);
        }
    } else {
        console.warn("No chat history found in localStorage.");
    }
};

window.onload = () => {
    setTimeout(() => {
        let chatbotBody = document.getElementById("chatbot-body");
        if (chatbotBody) {
            loadChatHistory();
            if(chatHistory.length===0){
                let text = {"candidates": [{"content": {"parts": [{"text": "👋 Hi! I can help you debug console errors. Try commands like:\n-fix the errors\n-fix my errors\n-analyze the errors"}]}}]}
                botmessage(text);
            }
        } else {
            console.error("Chatbot body not found! Cannot load chat history.");
        }
    }, 500);
};

const formatChatMessage = (text) => {
    if (typeof text !== "string") {
        console.error("formatChatMessage received non-string data:", text);
        return "<em>Response format error. Please check the console.</em>";
    }
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/```javascript([\s\S]*?)```/g, `<pre><code class="language-javascript">$1</code></pre>`) // Code block
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
};





const generatingErrormesages=()=>{
    try {
        console.log(sample);
    } catch (err) {
        console.error("Manually Created Error in content.js",err);
    }
}
generatingErrormesages();