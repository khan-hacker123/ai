// --- CONFIGURATION ---
const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI'; // Replace with your Google AI Studio API Key
const DID_API_KEY = 'a2hhbm93YWlzMjU0NDMyMjJAZ21haWwuY29t:H4Da85QOc5waNJ1O0OrFo'; // Replace with your D-ID API Key

// --- HTML Elements ---
const sendButton = document.getElementById('send-button');
const userInput = document.getElementById('user-input');
const videoWrapper = document.getElementById('video-wrapper');
const statusText = document.getElementById('status-text');

// --- D-ID API Specifics ---
// You can get the voice ID from D-ID's documentation or by trying them in the studio
const DID_VOICE_ID = 'en-US-JennyNeural'; // Example: A standard female voice
// Use a pre-made avatar URL from D-ID or upload your own and get its URL
const DID_AVATAR_URL = 'https://d-id-public-bucket.s3.amazonaws.com/or-tools/valid_inputs/toucan.png'; // IMPORTANT: Replace with your chosen avatar's image URL from D-ID studio

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
        // 1. Get text response from Gemini
        const aiTextResponse = await getGeminiResponse(prompt);
        statusText.textContent = "Generating video...";

        // 2. Generate video from D-ID using the AI's text
        const videoUrl = await getDidVideo(aiTextResponse);
        statusText.textContent = "Playing response...";

        // 3. Play the video
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
    if (isLoading) {
        userInput.disabled = true;
    } else {
        userInput.disabled = false;
        userInput.focus();
    }
}

async function getGeminiResponse(prompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}


// D-ID has a two-step process: 1. Create a "talk" (job). 2. Get the result.
async function getDidVideo(text) {
    const createTalkUrl = 'https://api.d-id.com/talks';
    const headers = {
        'Authorization': `Basic ${btoa(DID_API_KEY + ':')}`, // D-ID uses Basic Auth with the API key as username
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

    // 1. Create the talk
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

    // 2. Poll for the result
    while (true) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before checking again

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
    videoWrapper.innerHTML = ''; // Clear previous video
    const videoElement = document.createElement('video');
    videoElement.src = url;
    videoElement.autoplay = true;

    videoElement.addEventListener('ended', () => {
        setLoadingState(false, "Ask me anything...");
        videoWrapper.innerHTML = ''; // Clear video after it finishes
    });
    
    videoWrapper.appendChild(videoElement);
}

// Initial state
setLoadingState(false, "Ask me anything...");