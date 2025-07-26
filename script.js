// --- CONFIGURATION ---
const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI';
const DID_API_KEY = 'a2hhbm93YWlzMjU0NDMyMjJAZ21haWwuY29t:H4Da85QOc5waNJ1O0OrFo';
const DID_AVATAR_URL = 'https://studio.d-id.com/share?id=4dfae6d9d5626d7a5f902cfc2dfb7eaf&utm_source=copy'; // The direct image link, not the share link!

// --- D-ID API Specifics ---
const DID_VOICE_ID = 'en-US-JennyNeural'; 

// --- HTML Elements ---
const sendButton = document.getElementById('send-button');
const userInput = document.getElementById('user-input');
const videoWrapper = document.getElementById('video-wrapper');
const statusText = document.getElementById('status-text');

// --- Event Listener ---
sendButton.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSend();
    }
});

async function handleSend() {
    const prompt = userInput.value;
    if (!prompt.trim()) return;

    setLoadingState(true, "Thinking...");
    userInput.value = '';

    try {
        const aiTextResponse = await getGeminiResponse(prompt);
        statusText.textContent = "Generating video...";

        const videoUrl = await getDidVideo(aiTextResponse);
        statusText.textContent = "Playing response...";

        playVideo(videoUrl);

    } catch (error) {
        console.error("An error occurred:", error);
        statusText.textContent = "Sorry, an error occurred. Please try again.";
        setLoadingState(false);
    }
}

function setLoadingState(isLoading, message = "") {
    sendButton.disabled = isLoading;
    statusText.textContent = message;
    userInput.disabled = isLoading;
    if (!isLoading) {
        userInput.focus();
    }
}

async function getGeminiResponse(prompt) {
    // This URL has been updated to a current working model
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        // This line correctly pointed to the error
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function getDidVideo(text) {
    const createTalkUrl = 'https://api.d-id.com/talks';
    const headers = {
        'Authorization': `Basic ${btoa(DID_API_KEY + ':')}`,
        'Content-Type': 'application/json'
    };

    const payload = {
        script: {
            type: 'text',
            input: text,
            provider: { type: 'microsoft', voice_id: DID_VOICE_ID }
        },
        source_url: DID_AVATAR_URL,
        config: { result_format: 'mp4' }
    };

    const createResponse = await fetch(createTalkUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(`D-ID API (create) error: ${error.description || 'Unknown error'}`);
    }

    const createData = await createResponse.json();
    const talkId = createData.id;

    while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

        const getTalkUrl = `${createTalkUrl}/${talkId}`;
        const getResponse = await fetch(getTalkUrl, { method: 'GET', headers: headers });
        const getData = await getResponse.json();

        if (getData.status === 'done') {
            return getData.result_url;
        } else if (getData.status === 'error') {
            throw new Error(`D-ID API (get) error: ${getData.error}`);
        }
    }
}

function playVideo(url) {
    videoWrapper.innerHTML = '';
    const videoElement = document.createElement('video');
    videoElement.src = url;
    videoElement.autoplay = true;

    videoElement.addEventListener('ended', () => {
        setLoadingState(false, "Ask me anything...");
        videoWrapper.innerHTML = '';
    });
    
    videoWrapper.appendChild(videoElement);
}

setLoadingState(false, "Ask me anything...");
