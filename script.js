// --- CONFIGURATION ---
// const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI';
// const DID_API_KEY = 'a2hhbm93YWlzMjU0NDMyMjJAZ21haWwuY29t:H4Da85QOc5waNJ1O0OrFo';
// const DID_AVATAR_URL = 'https://studio.d-id.com/share?id=4dfae6d9d5626d7a5f902cfc2dfb7eaf&utm_source=copy'; // The direct image link, not the share link!

// --- D-ID API Specifics ---
// --- CONFIGURATION ---
const GEMINI_API_KEY = 'AIzaSyBIDZdxWQgVb8g_Q7VcUl1BGbzmrOfz9YI'; // Paste your Gemini API Key here

// --- DOM ELEMENTS ---
const startButton = document.getElementById('start-button');
const statusDiv = document.getElementById('status');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

// --- BROWSER API SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const speechSynthesis = window.speechSynthesis;

// --- STATE MANAGEMENT ---
let silenceTimer;
let finalTranscript = '';
let isListening = false;
let audioContext, analyser, dataArray, source, rafId;

// --- INITIALIZATION ---
if (!recognition || !navigator.mediaDevices) {
    statusDiv.textContent = "Sorry, your browser doesn't support the required APIs. Please use Chrome or Edge.";
    startButton.disabled = true;
} else {
    startButton.addEventListener('click', startSession);
}

// --- CORE FUNCTIONS ---

/**
 * Starts the entire session: gets microphone access, starts visualization, and begins speech recognition.
 */
async function startSession() {
    if (isListening) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isListening = true;
        startButton.disabled = true;
        startButton.textContent = 'Session Active';
        statusDiv.textContent = 'Listening...';

        setupAudioVisualizer(stream);
        setupSpeechRecognition();
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        statusDiv.textContent = 'Could not access microphone. Please grant permission.';
    }
}

/**
 * Sets up the Web Audio API to analyze microphone input and draw the histogram.
 * @param {MediaStream} stream The audio stream from the microphone.
 */
function setupAudioVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    drawVisualizer();
}

/**
 * The animation loop for drawing the voice histogram on the canvas.
 */
function drawVisualizer() {
    rafId = requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.fillStyle = '#1a1a1a'; // Background color
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) * 1.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = `rgb(50, ${barHeight + 100}, 50)`; // Greenish bars
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

/**
 * Configures and starts the Web Speech API for continuous transcription and silence detection.
 */
function setupSpeechRecognition() {
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        // Reset the silence timer on any speech recognition result
        clearTimeout(silenceTimer);

        let interimTranscript = '';
        finalTranscript = ''; // Reset final transcript to rebuild it

        for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Display interim results for better UX
        statusDiv.textContent = finalTranscript || interimTranscript;

        // Set a timer to process the transcript after 1.5 seconds of silence
        silenceTimer = setTimeout(() => {
            if (finalTranscript) {
                processTranscript(finalTranscript);
            }
        }, 1500); // 1.5 seconds of silence
    };

    recognition.onend = () => {
        // If the session is still supposed to be active, restart recognition
        if (isListening) {
            recognition.start();
        }
    };
    
    recognition.start();
}

/**
 * Processes the final transcript by sending it to Gemini.
 * @param {string} transcript The final text captured from the user.
 */
function processTranscript(transcript) {
    finalTranscript = ''; // Clear transcript after processing
    recognition.stop(); // Temporarily stop listening
    getAndSpeakGeminiResponse(transcript);
}

/**
 * Fetches a response from the Gemini API and speaks it out loud.
 * @param {string} prompt The user's transcribed text.
 */
async function getAndSpeakGeminiResponse(prompt) {
    statusDiv.textContent = '🤔 Thinking...';
    cancelAnimationFrame(rafId); // Pause visualizer while thinking
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    try {
        const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        speak(aiResponse);

    } catch (error) {
        console.error('Error fetching Gemini response:', error);
        statusDiv.textContent = 'Sorry, an error occurred. Listening again...';
        recognition.start(); // Restart listening on error
        drawVisualizer(); // Resume visualizer
    }
}

/**
 * Speaks the given text using the Web Speech API.
 * @param {string} text The text for the AI to speak.
 */
function speak(text) {
    if (!speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onstart = () => {
        statusDiv.textContent = '🔊 Speaking...';
    };

    utterance.onend = () => {
        statusDiv.textContent = 'Listening...';
        recognition.start(); // IMPORTANT: Resume listening after speaking
        drawVisualizer(); // Resume visualizer
    };

    speechSynthesis.speak(utterance);
}
