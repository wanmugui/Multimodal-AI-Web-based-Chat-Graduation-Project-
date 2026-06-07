function resizeTextarea() {
    const textarea = document.getElementById('user_input');
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

let isRecording = false;
let mediaRecorder;
let audioChunks = [];

function toggleRecording() {
    // if (isRecording) {
    //     mediaRecorder.stop();
    //     document.getElementById('record-btn').classList.remove('recording');
    //     document.getElementById('record-btn').innerText = '录音';
    // } else {
    //     startRecording();
    //     document.getElementById('record-btn').classList.add('recording');
    //     document.getElementById('record-btn').innerText = '停止录音';
    // }
    // isRecording = !isRecording;
    const recordBtn = document.querySelector("#voice-button");
        if (isRecording) {
            mediaRecorder.stop();
            recordBtn.classList.remove("recording");
            recordBtn.innerHTML = "🎤";
        } else {
            startRecording();
            recordBtn.classList.add("recording");
            recordBtn.innerHTML = "⏹"; // 停止按钮
        }
        isRecording = !isRecording;
}

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                sendAudioToServer(audioBlob);
            };
            mediaRecorder.start();
        })
        .catch(error => {
            console.error("无法访问麦克风:", error);
        });
}

function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    addMessage("waiting...", 'user');

    fetch('/upload-audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        removeLastMessage();
        addMessage(data.text, 'user');
        addMessage("waiting...", 'ai');
        return fetch(`/chat?user_input=${encodeURIComponent(data.text)}`);
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        removeLastMessage();
        const aiResponse = data.text;
        setTimeout(() => {
            const audio = new Audio(data.audio_url);
            audio.play();
            addMessage(aiResponse, 'ai');
        }, 0);
    })
    .catch(error => {
        addMessage("发生错误：" + error.message, 'ai');
    });
}

function handleImageUpload() {
    const imageInput = document.getElementById('image-input');
    const imageFile = imageInput.files[0];
    if (!imageFile) return;

    const formData = new FormData();
    formData.append('image', imageFile);
    addMessage("waiting...", 'user');

    fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        removeLastMessage();
        const imageElement = document.createElement('img');
        imageElement.src = URL.createObjectURL(imageFile);
        imageElement.alt = "上传的图像";
        document.getElementById('chat-container').appendChild(imageElement);
        sendImgToServer(data.user_text);
    })
    .catch(error => {
        addMessage("发生错误：" + error.message, 'ai');
    });
}

function sendImgToServer(userText) {
    addMessage("waiting...", 'ai');
    fetch(`/chat?user_input=${encodeURIComponent(userText)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            removeLastMessage();
            const aiResponse = data.text;
            const audio = new Audio(data.audio_url);
            addMessage(aiResponse, 'ai');
            audio.play();
        })
        .catch(error => {
            addMessage("发生错误：" + error.message, 'ai');
        });
}

function sendMessage() {
    const userInput = document.getElementById('user_input').value;
    if (!userInput.trim()) {
        alert("请输入文本！");
        return;
    }

    addMessage(userInput, 'user');
    document.getElementById('user_input').value = '';
    resizeTextarea();
    addMessage("waiting...", 'ai');

    fetch(`/chat?user_input=${encodeURIComponent(userInput)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            removeLastMessage();
            const aiResponse = data.text;
            const audio = new Audio(data.audio_url);
            addMessage(aiResponse, 'ai');
            audio.play();
        })
        .catch(error => {
            addMessage("发生错误：" + error.message, 'ai');
        });
}

function removeLastMessage() {
    const chatContainer = document.getElementById('chat-container');
    const lastMessage = chatContainer.lastElementChild;
    if (lastMessage) chatContainer.removeChild(lastMessage);
}

function addMessage(message, sender) {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-bubble', sender);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    let i = 0;
    const interval = setInterval(() => {
        messageDiv.innerText += message[i];
        i++;
        if (i === message.length) clearInterval(interval);
    }, 200);
}