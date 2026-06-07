// 历史记录管理器
const ChatHistory = {
    currentChatId: null,
    chats: [],

    init() {
        // 从localStorage加载
        const saved = localStorage.getItem('chatHistory');
        if (saved) this.chats = JSON.parse(saved);
        if (this.chats.length === 0) this.createNewChat();
        this.currentChatId = this.chats[0].id;
        this.renderChatList();
    },

    // 在创建新对话时确保时间戳正确
    createNewChat() {
        const newChat = {
            id: Date.now().toString(), // 确保id是字符串
            title: "新对话", // 初始标题
            messages: [],
            thumbnail: null,
            timestamp: new Date().toISOString() // 使用标准ISO格式
        };
        this.chats.unshift(newChat);
        this.currentChatId = newChat.id;
        this.save();
        this.renderChatList();
        this.loadChat(newChat.id);
        return newChat;
    },

    getCurrentChat() {
        return this.chats.find(c => c.id === this.currentChatId);
    },

    addMessage(message) {
        const chat = this.getCurrentChat();
        chat.messages.push(message);
        
        // 如果是AI的第一条回复，更新对话标题
        if (message.sender === 'ai' && chat.messages.length === 2) {
            if (message.type === 'text') {
                const title = message.content.length > 20 
                    ? message.content.substring(0, 20) + '...' 
                    : message.content;
                chat.title = title;
                this.save();
                this.renderChatList();
            }
        }
        
        // 自动更新缩略图（最新图片）
        if (message.type === 'image') {
            chat.thumbnail = message.content;
            if (!chat.title) {
                chat.title = "新对话";
            }
        }
        this.save();
        this.renderChatList();
    },

    save() {
        localStorage.setItem('chatHistory', JSON.stringify(this.chats));
    },

    // 修改后的 renderChatList 方法
    renderChatList() {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';
        
        this.chats.forEach(chat => {
            const li = document.createElement('li');
            li.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            li.dataset.chatId = chat.id;
            li.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    this.loadChat(chat.id);
                }
            };

            // 缩略图
            if (chat.thumbnail) {
                const img = document.createElement('img');
                img.className = 'chat-thumbnail';
                img.src = chat.thumbnail;
                img.style.maxWidth = '50px';  // 限制缩略图大小
                img.style.maxHeight = '50px';
                img.style.objectFit = 'cover';
                li.appendChild(img);
            }

            // 预览信息
            const preview = document.createElement('div');
            preview.className = 'chat-preview';
            
            // 可编辑的标题
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'chat-title-edit';
            titleInput.value = chat.title;
            titleInput.addEventListener('blur', (e) => {
                chat.title = e.target.value;
                this.save();
            });
            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });

            const timeElement = document.createElement('small');
            timeElement.textContent = this.formatTime(chat.timestamp);
            
            preview.appendChild(titleInput);
            preview.appendChild(timeElement);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            };

            li.appendChild(preview);
            li.appendChild(deleteBtn);
            list.appendChild(li);
        });
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 24小时内显示具体时间
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        // 一周内显示星期几
        else if (diff < 7 * 24 * 60 * 60 * 1000) {
            return `${['周日','周一','周二','周三','周四','周五','周六'][date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        }
        // 其他显示具体日期
        return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    deleteChat(chatId) {
        if (!confirm('确定要删除这个对话吗？')) return;
        
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index === -1) return;
        
        this.chats.splice(index, 1);
        
        // 如果删除的是当前对话，切换到第一个对话
        if (chatId === this.currentChatId) {
            if (this.chats.length > 0) {
                this.currentChatId = this.chats[0].id;
                this.loadChat(this.currentChatId);
            } else {
                this.createNewChat();
            }
        }
        
        this.save();
        this.renderChatList();
    },

    loadChat(chatId) {
        // 移除之前的活动状态
        const prevActive = document.querySelector('.chat-item.active');
        if (prevActive) prevActive.classList.remove('active');
        
        // 设置新的活动状态
        const newActive = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (newActive) newActive.classList.add('active');
        
        this.currentChatId = chatId;
        const chat = this.getCurrentChat();
        this.renderMessages(chat.messages);
        
        // 滚动到底部
        const container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    },

    renderMessages(messages) {
        const container = document.getElementById('chat-container');
        container.innerHTML = '';
        
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-bubble ${msg.sender}`;
            
            // 创建头像
            const avatar = document.createElement('img');
            avatar.className = 'avatar';
            
            // 预加载头像
            const preloadImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(src);
                    img.onerror = () => resolve('/static/avatars/default_ai.png');
                    img.src = src;
                });
            };

            // 设置头像源
            if (msg.sender === 'user') {
                const userAvatar = document.getElementById('avatar-img').src;
                avatar.src = userAvatar;
            } else {
                const charName = localStorage.getItem('character_settings') 
                    ? JSON.parse(localStorage.getItem('character_settings')).name 
                    : '千早爱音';
                const aiAvatarSrc = `/static/avatars/${charName}.png`;
                avatar.src = aiAvatarSrc;
                // 添加错误处理
                avatar.onerror = function() {
                    this.src = '/static/avatars/default_ai.png';
                };
            }
            
            div.appendChild(avatar);
            
            // 创建消息内容
            const content = document.createElement('div');
            content.className = 'message-content';
            
            switch(msg.type) {
                case 'image':
                    const img = document.createElement('img');
                    img.src = msg.content;
                    img.style.maxWidth = '200px';
                    content.appendChild(img);
                    break;
                case 'audio':
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = msg.content;
                    content.appendChild(audio);
                    break;
                default:
                    content.textContent = msg.content;
            }
            
            div.appendChild(content);
            container.appendChild(div);
        });
    }
};

// 初始化历史记录
ChatHistory.init();

function resizeTextarea() {
    const textarea = document.getElementById('user_input');
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

let isRecording = false;
let mediaRecorder;
let audioChunks = [];

document.addEventListener("DOMContentLoaded", function () {
    const userInput = document.getElementById("user_input");

    userInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault(); // 阻止换行
            sendMessage();
        }
    });
});

function toggleRecording() {
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
        scrollToBottom();
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
        // 保存对话历史
        ChatHistory.addMessage({ type: 'text', content: data.text, sender: 'user' });
        ChatHistory.addMessage({ type: 'text', content: aiResponse, sender: 'ai' });
    })
    .catch(error => {
        addMessage("发生错误：" + error.message, 'ai');
    });
}

function handleImageUpload() {
    const imageInput = document.getElementById('image-input');
    const imageFile = imageInput.files[0];
    if (!imageFile) return;

    // 创建图片压缩函数
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 设置最大尺寸
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 转换为base64，质量0.7
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // 压缩并保存图片
    compressImage(imageFile).then(compressedBase64 => {
        // 将压缩后的图片保存到历史记录
        ChatHistory.addMessage({ 
            type: 'image', 
            content: compressedBase64,
            sender: 'user'
        });

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
            imageElement.src = compressedBase64;
            imageElement.alt = "上传的图像";
            document.getElementById('chat-container').appendChild(imageElement);
            sendImgToServer(data.user_text);
        })
        .catch(error => {
            addMessage("发生错误：" + error.message, 'ai');
        });
    });
}

function sendImgToServer(userText) {
    addMessage("waiting...", 'ai');
    scrollToBottom();
    
    fetch(`/chat?user_input=${encodeURIComponent(userText)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            removeLastMessage();
            
            const aiResponse = data.text;
            const audio = new Audio(data.audio_url);
            audio.play();
            
            // 保存AI的回复到历史记录
            ChatHistory.addMessage({ 
                type: 'text', 
                content: aiResponse, 
                sender: 'ai' 
            });
            
            addMessage(aiResponse, 'ai');
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
    scrollToBottom(); //  滚动到底部

    fetch(`/chat?user_input=${encodeURIComponent(userInput)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            removeLastMessage();
            const aiResponse = data.text;
            const audio = new Audio(data.audio_url);
            addMessage(aiResponse, 'ai');
            audio.play();
            ChatHistory.addMessage({ type: 'text', content: userInput, sender: 'user' });
            ChatHistory.addMessage({ type: 'text', content: aiResponse, sender: 'ai' });
        })
        .catch(error => {
            addMessage("发生错误：" + error.message, 'ai');
        });
}

// 封装滚动到底部的函数
function scrollToBottom() {
    let chatContainer = document.getElementById("chat-container");
    chatContainer.scrollTop = chatContainer.scrollHeight;
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

let chatCount = 1;

// 从 localStorage 加载历史记录
window.onload = () => {
    const storedChats = JSON.parse(localStorage.getItem('chatHistory')) || [];
    chatCount = storedChats.length + 1;

    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) {
        console.error('找不到chat-history元素');
        return;
    }

    // 显示历史对话
    storedChats.forEach((chat, index) => {
        const li = document.createElement('li');
        li.onclick = () => loadChat(chat);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.textContent = chat.chatName;

        // 如果有图像，显示图像
        if (chat.image) {
            const img = document.createElement('img');
            img.src = chat.image;
            img.className = 'chat-image';
            li.appendChild(img);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // 防止触发 li 的 onclick
            deleteChat(e, chat.chatName);
        };

        li.appendChild(titleSpan);
        li.appendChild(deleteBtn);
        chatHistory.appendChild(li);
    });

    // 仅当无历史记录时创建初始对话
    if (storedChats.length === 0) {
        startNewChat();
    }
};

// 添加新对话
function startNewChat() {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) {
        console.error('找不到chat-history元素');
        return;
    }

    const newChatName = `对话 ${chatCount++}`;

    const li = document.createElement('li');
    li.onclick = () => loadChat(newChatName);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-title';
    titleSpan.textContent = newChatName;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = (e) => {
        e.stopPropagation(); // 防止触发 li 的 onclick
        deleteChat(e, newChatName);
    };

    li.appendChild(titleSpan);
    li.appendChild(deleteBtn);
    chatHistory.appendChild(li);

    // 保存到 localStorage
    saveChatHistory();
}

// 删除对话
function deleteChat(event, chatName) {
    const li = event.target.closest('li');
    if (confirm(`确认删除 ${chatName} 吗？`)) {
        li.remove();
        saveChatHistory();
    }
}

// 保存聊天记录到 localStorage
function saveChatHistory() {
    const chatHistory = document.querySelectorAll('#chat-history li');
    const chatData = Array.from(chatHistory).map(item => {
        const chatName = item.querySelector('.chat-title').textContent;
        const img = item.querySelector('.chat-image');
        return {
            chatName,
            image: img ? img.src : null  // 保存图像的 Base64 数据（如果有）
        };
    });
    localStorage.setItem('chatHistory', JSON.stringify(chatData));
}

function updateChatCount() {
    const titles = Array.from(document.querySelectorAll('.chat-title'))
                       .map(t => parseInt(t.textContent.replace('对话 ', '')));
    chatCount = titles.length ? Math.max(...titles) + 1 : 1;
}
// 在删除或新增时调用此函数

// 加载指定的聊天
function loadChat(chat) {
    const messages = JSON.parse(localStorage.getItem(chat.chatName)) || [];
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = ''; // 清空当前内容

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.textContent = `${msg.sender}: ${msg.text}`;
        chatContainer.appendChild(div);
    });
}

// 初始化时可以自动创建一个对话（可选）
startNewChat();

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const inputContainer = document.querySelector('.input-container');
    
    sidebar.classList.toggle('collapsed');
    
    // 更新主内容区域和输入框的位置
    if (sidebar.classList.contains('collapsed')) {
        mainContent.style.marginLeft = '0';
        // 重新计算输入框位置
        const mainContentWidth = mainContent.offsetWidth;
        inputContainer.style.left = '50%';
        inputContainer.style.width = '50%';
        inputContainer.style.maxWidth = '600px';
    } else {
        mainContent.style.marginLeft = '280px';
        // 重新计算输入框位置
        const mainContentWidth = mainContent.offsetWidth;
        inputContainer.style.left = 'calc(50% + 140px)';
        inputContainer.style.width = '50%';
        inputContainer.style.maxWidth = '600px';
    }
}

// 确保在页面加载时正确初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化侧边栏状态
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const inputContainer = document.querySelector('.input-container');
    
    if (sidebar.classList.contains('collapsed')) {
        mainContent.style.marginLeft = '0';
        inputContainer.style.left = '50%';
    } else {
        mainContent.style.marginLeft = '280px';
        inputContainer.style.left = 'calc(50% + 140px)';
    }
    
    // 初始化历史记录
    ChatHistory.init();
});

// 设置相关功能
function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        // 加载当前设置
        loadSettings();
    }
}

function loadSettings() {
    // 获取当前选中的角色ID
    const activeCharacter = document.querySelector('.character-item.active');
    if (!activeCharacter) {
        console.error('没有选中的角色');
        return;
    }
    const characterId = activeCharacter.dataset.characterId;

    // 从服务器获取角色设置
    fetch(`/get-character-settings/${characterId}`)
        .then(response => response.json())
        .then(settings => {
            if (!settings) {
                throw new Error('未找到角色设置');
            }

            // 设置表单值
            const elements = {
                'char-name': settings.name || '',
                'char-description': settings.description || '',
                'char-speech-style': settings.speech_style || '',
                'sovits-path': settings.sovits_path || '',
                'gpt-path': settings.gpt_path || '',
                'refer-wav-path': settings.refer_wav_path || '',
                'prompt-text': settings.prompt_text || '',
                'prompt-language': settings.prompt_language || '',
                'text-language': settings.text_language || ''
            };

            // 遍历并设置每个元素的值
            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value;
                    console.log(`设置 ${id}:`, value);
                } else {
                    console.error(`找不到元素: ${id}`);
                }
            }

            // 保存到localStorage
            localStorage.setItem('character_settings', JSON.stringify(settings));
        })
        .catch(error => {
            console.error('加载设置失败:', error);
            alert('加载设置失败: ' + error.message);
        });
}

async function saveSettings() {
    // 获取当前选中的角色ID
    const activeCharacter = document.querySelector('.character-item.active');
    if (!activeCharacter) {
        alert('请先选择一个角色');
        return;
    }
    const characterId = activeCharacter.dataset.characterId;

    const settings = {
        name: document.getElementById('char-name').value,
        description: document.getElementById('char-description').value,
        speech_style: document.getElementById('char-speech-style').value,
        sovits_path: document.getElementById('sovits-path').value,
        gpt_path: document.getElementById('gpt-path').value,
        refer_wav_path: document.getElementById('refer-wav-path').value,
        prompt_text: document.getElementById('prompt-text').value,
        prompt_language: document.getElementById('prompt-language').value,
        text_language: document.getElementById('text-language').value,
        enabled: false  // 默认不启用
    };

    try {
        // 保存到localStorage
        localStorage.setItem('character_settings', JSON.stringify(settings));

        // 发送到服务器
        const response = await fetch('/save-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                character_id: characterId,
                settings: settings
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '保存设置失败');
        }

        // 更新角色列表中的显示名称
        const characterName = document.getElementById('char-name').value || '新角色';
        const nameElement = activeCharacter.querySelector('.character-name');
        if (nameElement) {
            nameElement.textContent = characterName;
        }

        alert('设置保存成功！');
        toggleSettings();
        // 更新当前设置显示
        updateSettingsDisplay();
        
        // 重新加载角色设置以确保同步
        await loadCharacterSettings(characterId);
        
    } catch (error) {
        console.error('Error:', error);
        alert('保存设置时发生错误：' + error.message);
    }
}

function updateSettingsDisplay() {
    const settings = JSON.parse(localStorage.getItem('character_settings') || '{}');
    document.getElementById('char-name').value = settings.name || '千早爱音';
    document.getElementById('char-description').value = settings.description || '';
    document.getElementById('char-speech-style').value = settings.speech_style || '';
    document.getElementById('sovits-path').value = settings.sovits_path || 'SoVITS_weights_v2/爱音_e20_s1480.pth';
    document.getElementById('gpt-path').value = settings.gpt_path || 'GPT_weights_v2/爱音-e25.ckpt';
    document.getElementById('refer-wav-path').value = settings.refer_wav_path || 'anon1.wav';
    document.getElementById('prompt-text').value = settings.prompt_text || '今の私、すごくなかった?お客さんの注目浴びまくりじゃない?';
    document.getElementById('prompt-language').value = settings.prompt_language || '日文';
    document.getElementById('text-language').value = settings.text_language || '中文';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 先获取上次启用的角色
        const response = await fetch('/get-last-character');
        const data = await response.json();
        if (data.character_id) {
            currentCharacterId = data.character_id;
        }
        
        // 加载角色列表
        await loadCharacters();
        
        // 如果有上次启用的角色，选中它
        if (currentCharacterId) {
            const activeItem = document.querySelector(`.character-item[data-character-id="${currentCharacterId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
                loadCharacterSettings(currentCharacterId);
            }
        }
        
        // 初始化历史记录
        ChatHistory.init();
        
        // 加载设置
        loadSettings();
        
        // 初始化头像
        initAvatar();
    } catch (error) {
        console.error('初始化失败:', error);
    }
});

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
        alert('只支持PNG、JPG和JPEG格式的图片');
        return;
    }

    // 检查文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
        alert('文件大小不能超过2MB');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/save-avatar', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
            // 更新头像显示
            const avatarImg = document.getElementById('avatar-img');
            if (avatarImg) {
                avatarImg.src = data.avatar_url;
            }
            // 重新渲染当前聊天消息
            const currentChat = ChatHistory.getCurrentChat();
            if (currentChat) {
                ChatHistory.renderMessages(currentChat.messages);
            }
            alert('头像更换成功');
        } else {
            alert(data.error || '头像更换失败');
        }
    } catch (error) {
        console.error('头像上传错误:', error);
        alert('头像上传失败，请重试');
    }
}

// 初始化头像
function initAvatar() {
    const avatarImg = document.getElementById('avatar-img');
    if (avatarImg) {
        // 直接使用服务器上的头像文件
        avatarImg.src = '/static/avatars/user_avatar.png';
    }
}

// 角色管理相关功能
let currentCharacterId = 'anon'; // 默认角色

// 修改加载角色设置函数
async function loadCharacterSettings(characterId) {
    try {
        console.log('开始加载角色设置:', characterId);
        const response = await fetch(`/get-character-settings/${characterId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const settings = await response.json();
        console.log('获取到的设置:', settings);
        
        if (!settings) {
            throw new Error('未找到角色设置');
        }
        
        // 更新UI显示
        document.querySelectorAll('.character-item').forEach(item => {
            const btn = item.querySelector('.enable-btn');
            const id = item.dataset.characterId;
            
            if (id === characterId) {
                item.classList.add('active');
                // 根据实际启用状态设置按钮
                if (settings.enabled) {
                    btn.textContent = '已启用';
                    btn.classList.add('disabled');
                    // 更新当前角色ID
                    currentCharacterId = characterId;
                } else {
                    btn.textContent = '启用';
                    btn.classList.remove('disabled');
                }
            } else {
                item.classList.remove('active');
                // 确保其他角色的按钮状态正确
                if (btn) {
                    btn.textContent = '启用';
                    btn.classList.remove('disabled');
                }
            }
        });
        
        // 设置表单值
        const elements = {
            'char-name': settings.name || '',
            'char-description': settings.description || '',
            'char-speech-style': settings.speech_style || '',
            'sovits-path': settings.sovits_path || '',
            'gpt-path': settings.gpt_path || '',
            'refer-wav-path': settings.refer_wav_path || '',
            'prompt-text': settings.prompt_text || '',
            'prompt-language': settings.prompt_language || '',
            'text-language': settings.text_language || ''
        };
        
        // 设置表单值
        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
                console.log(`设置 ${id} 的值为:`, value);
            } else {
                console.error(`未找到元素: ${id}`);
            }
        }
        
        // 保存到localStorage
        localStorage.setItem('character_settings', JSON.stringify(settings));
        
    } catch (error) {
        console.error('加载角色设置失败:', error);
        alert('加载角色设置失败: ' + error.message);
    }
}

// 启用角色功能
async function enableCharacter(characterId) {
    try {
        // 获取当前角色的设置
        const response = await fetch(`/get-character-settings/${characterId}`);
        if (!response.ok) {
            throw new Error('获取角色设置失败');
        }
        const settings = await response.json();
        
        // 如果角色已经启用，则禁用它
        if (settings.enabled) {
            settings.enabled = false;
        } else {
            // 获取所有角色列表
            const charsResponse = await fetch('/get-characters');
            if (!charsResponse.ok) {
                throw new Error('获取角色列表失败');
            }
            const characters = await charsResponse.json();

            // 禁用所有其他角色
            for (const character of characters) {
                if (character.id !== characterId) {
                    const charResponse = await fetch(`/get-character-settings/${character.id}`);
                    if (charResponse.ok) {
                        const charSettings = await charResponse.json();
                        charSettings.enabled = false;
                        
                        // 保存禁用状态
                        await fetch('/save-settings', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                character_id: character.id,
                                settings: charSettings
                            })
                        });
                    }
                }
            }
            
            // 启用当前角色
            settings.enabled = true;
        }
        
        // 保存更新后的设置
        const saveResponse = await fetch('/save-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                character_id: characterId,
                settings: settings
            })
        });
        
        if (!saveResponse.ok) {
            throw new Error('保存角色设置失败');
        }
        
        // 重新加载角色列表以更新所有角色的状态
        await loadCharacters();
        
        // 如果启用了新角色，重启api服务
        if (settings.enabled) {
            try {
                // 发送重启请求
                await fetch('/restart-api', {
                    method: 'POST'
                });
                // 等待一小段时间确保服务重启
                await new Promise(resolve => setTimeout(resolve, 10000));
                alert('角色已启用，语音合成服务已重启');
            } catch (error) {
                console.error('重启语音合成服务失败:', error);
                alert('角色已启用，但重启语音合成服务失败，请手动重启服务');
            }
        } else {
            alert('角色已禁用');
        }
        
    } catch (error) {
        console.error('更新角色状态失败:', error);
        alert('更新角色状态失败: ' + error.message);
    }
}

// 初始化角色列表
function initCharacterList() {
    const characterItems = document.querySelectorAll('.character-item');
    characterItems.forEach(item => {
        item.addEventListener('click', () => {
            // 移除其他角色的active类
            characterItems.forEach(i => i.classList.remove('active'));
            // 添加当前角色的active类
            item.classList.add('active');
            // 更新当前角色ID
            currentCharacterId = item.dataset.characterId;
            // 加载角色设置
            loadCharacterSettings(currentCharacterId);
        });
    });

    // 添加新角色按钮事件
    const addCharacterBtn = document.querySelector('.add-character');
    if (addCharacterBtn) {
        addCharacterBtn.addEventListener('click', createNewCharacter);
    }

    // 默认选中第一个角色
    if (characterItems.length > 0) {
        characterItems[0].classList.add('active');
        loadCharacterSettings(currentCharacterId);
    }
}

// 创建新角色
async function createNewCharacter() {
    try {
        // 生成新的角色ID
        const newCharacterId = 'character_' + Date.now();
        
        // 发送创建请求到后端
        const response = await fetch('/create-character', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                character_id: newCharacterId
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '创建角色失败');
        }
        
        // 创建新的角色项
        const characterList = document.querySelector('.character-list');
        const newCharacterItem = document.createElement('div');
        newCharacterItem.className = 'character-item';
        newCharacterItem.dataset.characterId = newCharacterId;
        
        // 创建角色内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'character-content';
        
        // 创建头像
        const avatar = document.createElement('img');
        avatar.src = '/static/avatars/default_ai.png';
        avatar.className = 'character-avatar';
        avatar.alt = '新角色';
        
        // 创建名称
        const name = document.createElement('span');
        name.className = 'character-name';
        name.textContent = '新角色';
        
        // 创建按钮容器
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'character-buttons';
        
        // 创建启用按钮
        const enableBtn = document.createElement('button');
        enableBtn.className = 'enable-btn';
        enableBtn.textContent = '启用';
        enableBtn.onclick = (e) => {
            e.stopPropagation();
            enableCharacter(newCharacterId);
        };
        
        // 创建删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteCharacter(newCharacterId);
        };
        
        // 组装角色项
        contentDiv.appendChild(avatar);
        contentDiv.appendChild(name);
        buttonsDiv.appendChild(enableBtn);
        buttonsDiv.appendChild(deleteBtn);
        newCharacterItem.appendChild(contentDiv);
        newCharacterItem.appendChild(buttonsDiv);
        
        // 插入到添加按钮之前
        const addCharacter = document.querySelector('.add-character');
        characterList.insertBefore(newCharacterItem, addCharacter);
        
        // 添加点击事件
        newCharacterItem.addEventListener('click', () => {
            document.querySelectorAll('.character-item').forEach(item => item.classList.remove('active'));
            newCharacterItem.classList.add('active');
            currentCharacterId = newCharacterId;
            loadCharacterSettings(newCharacterId);
        });
        
        // 自动选中新角色
        newCharacterItem.click();
        
        // 打开设置模态框
        toggleSettings();
        
    } catch (error) {
        console.error('创建新角色失败:', error);
        alert('创建新角色失败: ' + error.message);
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    initCharacterList();
    // ... 其他初始化代码 ...
});

// 加载角色列表
async function loadCharacters() {
    try {
        const response = await fetch('/get-characters');
        if (!response.ok) {
            throw new Error('获取角色列表失败');
        }
        const characters = await response.json();
        
        // 获取角色列表容器
        const characterList = document.querySelector('.character-list');
        if (!characterList) {
            throw new Error('找不到角色列表容器');
        }
        
        // 清空现有列表（保留"添加新角色"按钮）
        const addCharacterBtn = characterList.querySelector('.add-character');
        characterList.innerHTML = '';
        if (addCharacterBtn) {
            characterList.appendChild(addCharacterBtn);
        }
        
        // 添加每个角色
        characters.forEach(character => {
            const characterItem = document.createElement('div');
            characterItem.className = 'character-item';
            characterItem.dataset.characterId = character.id;
            
            // 创建角色内容容器
            const contentDiv = document.createElement('div');
            contentDiv.className = 'character-content';
            
            // 添加头像
            const avatar = document.createElement('img');
            avatar.src = `/static/avatars/${character.name}.png`;
            avatar.className = 'character-avatar';
            avatar.alt = character.name;
            avatar.onerror = function() {
                this.src = '/static/avatars/default_ai.png';
            };
            
            // 添加名称
            const name = document.createElement('span');
            name.className = 'character-name';
            name.textContent = character.name;
            
            // 添加按钮容器
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'character-buttons';
            
            // 添加启用按钮
            const enableBtn = document.createElement('button');
            enableBtn.className = 'enable-btn';
            enableBtn.textContent = character.enabled ? '已启用' : '启用';
            if (character.enabled) {
                enableBtn.classList.add('disabled');
                // 如果角色已启用，设置为当前角色
                currentCharacterId = character.id;
                characterItem.classList.add('active');
            }
            enableBtn.onclick = (e) => {
                e.stopPropagation();
                enableCharacter(character.id);
            };
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteCharacter(character.id);
            };
            
            // 组装角色项
            contentDiv.appendChild(avatar);
            contentDiv.appendChild(name);
            buttonsDiv.appendChild(enableBtn);
            buttonsDiv.appendChild(deleteBtn);
            characterItem.appendChild(contentDiv);
            characterItem.appendChild(buttonsDiv);
            
            // 添加点击事件
            characterItem.addEventListener('click', () => {
                document.querySelectorAll('.character-item').forEach(item => item.classList.remove('active'));
                characterItem.classList.add('active');
                currentCharacterId = character.id;
                loadCharacterSettings(character.id);
            });
            
            // 插入到添加按钮之前
            characterList.insertBefore(characterItem, addCharacterBtn);
        });
        
        // 如果有当前选中的角色，加载其设置
        if (currentCharacterId) {
            await loadCharacterSettings(currentCharacterId);
        }
        
    } catch (error) {
        console.error('加载角色列表失败:', error);
        alert('加载角色列表失败: ' + error.message);
    }
}

// 删除角色功能
async function deleteCharacter(characterId) {
    if (!characterId) {
        alert('请先选择一个角色');
        return;
    }

    if (!confirm('确定要删除这个角色吗？此操作不可恢复。')) {
        return;
    }

    fetch(`/delete-character/${characterId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        // 关闭设置模态框
        toggleSettings();
        // 重新加载角色列表
        loadCharacters();
        alert('角色删除成功');
    })
    .catch(error => {
        console.error('删除角色失败:', error);
        alert('删除角色失败: ' + error.message);
    });
}

// 在页面加载时初始化角色列表
document.addEventListener('DOMContentLoaded', function() {
    loadCharacters();
    // ... 其他初始化代码 ...
});
