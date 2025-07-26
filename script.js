// --- CONFIGURATION ---
// const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI';
// const DID_API_KEY = 'a2hhbm93YWlzMjU0NDMyMjJAZ21haWwuY29t:H4Da85QOc5waNJ1O0OrFo';
// const DID_AVATAR_URL = 'https://studio.d-id.com/share?id=4dfae6d9d5626d7a5f902cfc2dfb7eaf&utm_source=copy'; // The direct image link, not the share link!

// --- D-ID API Specifics ---
// --- CONFIGURATION ---
const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI'; // Paste your Gemini API Key here

// --- HTML ELEMENTS ---
const talkButton = document.getElementById('talk-button');
const statusDiv = document.getElementById('status');

// --- BROWSER API SETUP ---
// Check for browser support and create instances
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const speechSynthesis = window.speechSynthesis;

// --- MAIN LOGIC ---

// 1. Check for browser compatibility
if (!recognition) {
    statusDiv.textContent = "Sorry, your browser doesn't support Speech Recognition. Try Chrome or Edge.";
    talkButton.disabled = true;
} else {
    // Configure speech recognition
    recognition.continuous = false; // Stop listening after one phrase
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    // Add event listener to the button
    talkButton.addEventListener('click', () => {
        talkButton.disabled = true;
        recognition.start();
    });

    // Handle recognition events
    recognition.onstart = () => {
        statusDiv.textContent = 'Listening...';
        statusDiv.classList.add('listening');
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        statusDiv.textContent = `You said: "${transcript}"`;
        statusDiv.classList.remove('listening');
        
        // Send the transcript to Gemini
        await getAndSpeakGeminiResponse(transcript);
    };

    recognition.onerror = (event) => {
        statusDiv.textContent = `Error listening: ${event.error}. Please try again.`;
        statusDiv.classList.remove('listening');
        talkButton.disabled = false;
    };

    recognition.onend = () => {
        // The button will be re-enabled after the AI finishes speaking
    };
}

// 2. Function to get response from Gemini and speak it
async function getAndSpeakGeminiResponse(prompt) {
    statusDiv.textContent = 'Thinking...';
    try {
        const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Speak the response
        speak(aiResponse);

    } catch (error) {
        console.error('Error fetching Gemini response:', error);
        statusDiv.textContent = 'Sorry, I had trouble thinking. Please try again.';
        talkButton.disabled = false;
    }
}

// 3. Function to speak text using Web Speech API
function speak(text) {
    if (!speechSynthesis) {
        statusDiv.textContent = "Sorry, your browser doesn't support Speech Synthesis.";
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Configure voice, pitch, rate
    // const voices = speechSynthesis.getVoices();
    // utterance.voice = voices.find(voice => voice.name === 'Google UK English Female'); // Example
    // utterance.pitch = 1;
    // utterance.rate = 1;

    utterance.onstart = () => {
        statusDiv.textContent = 'Speaking...';
    };

    utterance.onend = () => {
        statusDiv.textContent = 'Click the button and start talking.';
        talkButton.disabled = false; // Re-enable button after speaking is done
    };

    speechSynthesis.speak(utterance);
}
