import re
import requests
from flask import Flask, jsonify, request, render_template_string, send_file, session
from threading import Thread
import torch
import threading
from faster_whisper import WhisperModel
import json
import io
import queue
from flask import Flask, request, jsonify
from transformers import AutoProcessor, AutoModelForVision2Seq, AutoModelForImageClassification
from PIL import Image
import numpy as np
from img2text import Predictor  # 导入你在img2text.py中定义的Predictor类
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import FileChatMessageHistory
import os
from datetime import datetime
import yaml
import config  # 添加config模块导入
from functools import wraps



app = Flask(__name__)
# 初始化 Predictor 类
predictor = Predictor()
# 设置 SECRET_KEY，用于加密 session 数据
app.secret_key = '83631363a'

# ===== 修复1：处理LangChain内存警告 =====
from langchain_core.memory import BaseMemory
memory: BaseMemory  # 类型注解避免警告


# ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
# 配置记忆存储
MEMORY_DIR = "memory"
MAX_HISTORY_TURNS = 3  # 最大记忆轮数
os.makedirs(MEMORY_DIR, exist_ok=True)

# 初始化带限制的记忆系统
def initialize_memory(character_id='anon'):
    # 为每个角色创建独立的对话历史文件
    history_file = os.path.join(MEMORY_DIR, f"chat_history_{character_id}.json")
    history = FileChatMessageHistory(file_path=history_file)
    memory = ConversationBufferMemory(
        chat_memory=history,
        return_messages=True,
        memory_key="history"
    )
    return memory, history

# 获取当前角色的记忆系统
def get_current_memory():
    # 从session获取当前角色ID
    character_id = session.get('character_settings', {}).get('name', 'anon')
    # 如果memory和history不存在或角色ID不匹配,则重新初始化
    if not hasattr(get_current_memory, 'memory') or not hasattr(get_current_memory, 'history') or get_current_memory.current_character != character_id:
        get_current_memory.memory, get_current_memory.history = initialize_memory(character_id)
        get_current_memory.current_character = character_id
    return get_current_memory.memory, get_current_memory.history

# 初始化默认角色的记忆系统
memory, history = initialize_memory()
get_current_memory.memory = memory
get_current_memory.history = history
get_current_memory.current_character = 'anon'

# 限制历史记录长度的装饰器
def limit_history(func):
    def wrapper(*args, **kwargs):
        # 获取当前角色的记忆系统
        memory, history = get_current_memory()
        # 获取当前历史记录
        current_history = memory.load_memory_variables({})["history"]
        # 如果超过最大轮数,删除最早的对话
        if len(current_history) > MAX_HISTORY_TURNS * 2:  # 每轮包含用户和AI两条消息
            # 只保留最近的N轮对话
            trimmed_history = current_history[-(MAX_HISTORY_TURNS * 2):]
            history.clear()
            for msg in trimmed_history:
                if msg.type == "human":
                    history.add_user_message(msg.content)
                else:
                    history.add_ai_message(msg.content)
        return func(*args, **kwargs)
    return wrapper

# 加载 Whisper 模型
def load_whisper_model(model_size="large-v3", precision='float32'):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model_path = f'tools/asr/models/faster-whisper-{model_size}'
    try:
        model = WhisperModel(model_path, device=device, compute_type=precision)
        return model
    except Exception as e:
        print(f"模型加载失败: {str(e)}")
        return None

# 加载默认角色设置
def load_default_character(character_id=None):
    try:
        # 优先读取上次保存的角色ID
        if character_id is None:
            last_char_path = 'config/last_character.txt'
            if os.path.exists(last_char_path):
                with open(last_char_path, 'r', encoding='utf-8') as f:
                    last_id = f.read().strip()
                    if last_id:
                        character_id = last_id
            if character_id is None:
                character_id = 'anon'
        with open('config/default_character.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            return config['characters'].get(character_id, config['characters']['anon'])
    except Exception as e:
        print(f"加载默认角色设置失败: {str(e)}")
        return {}

@limit_history
def get_ai_response(prompt, system_message=None):
    # 从session获取角色设置，如果没有则使用默认设置
    char_settings = session.get('character_settings', load_default_character())

    if system_message is None:
        system_message = f"""
    你叫【{char_settings['name']}】，{char_settings['description']}。
    请严格遵守以下规则：
    1.你是一个ai助手名字是{char_settings['name']}
    2. 永远用第一人称"我"作为ai一方对自己的称呼
    3. 说话风格：{char_settings['speech_style']}
    4. 优先回答用户最新的问题，不要与上一个对话内容搞混，特别是在回答图像内容时，不能把不同图片的标签混合在一起
    5. 回复只包含中文，如果有其他语言先翻译成中文在回复
    """

    # 获取当前角色的记忆系统
    memory, history = get_current_memory()

    # 添加用户消息到历史
    memory.chat_memory.add_user_message(prompt)

    # 获取当前历史（自动受limit_history_turns装饰器限制）
    current_history = history.messages
    
    # 构建消息列表
    messages = [{"role": "system", "content": system_message}]
    for msg in current_history:
        role = "user" if msg.type == "human" else "assistant"
        messages.append({"role": role, "content": msg.content})

    print("调试 - 发送的消息结构:", json.dumps(messages, indent=2, ensure_ascii=False))
    
    # 调用API
    response = requests.post(
        "http://127.0.0.1:11434/api/chat",
        json={
            "model": "deepseek-r1:7b",
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "max_tokens": 100
            }
        }
    )

    # 获取返回的 JSON 数据
    ai_response = response.json()

    # 打印出返回的内容进行调试
    print("API 返回的内容:", ai_response)

    # 提取生成的文本
    if 'message' in ai_response:
        raw_response = ai_response['message']['content']

        # 清理文本（去除 Unicode 编码）
        cleaned_text = re.sub(r'\\u[0-9a-fA-F]+', '', raw_response)  # 去除 Unicode 编码

        # 去除换行符
        cleaned_text = cleaned_text.replace("\\n", "")  

        # 去除 <think> 标签及其内容
        cleaned_text = re.sub(r'<think>.*?</think>', '', cleaned_text, flags=re.DOTALL)

        # 添加AI回复到历史
        memory.chat_memory.add_ai_message(cleaned_text)

        return cleaned_text.strip()  # 返回清理后的文本，去除首尾空格
    else:
        return "没有生成有效的回复"

def generate_voice(text):
    try:
        # 从session获取设置，如果没有则使用默认设置
        char_settings = session.get('character_settings', load_default_character())

        # 准备请求数据
        params = {
            "refer_wav_path": char_settings['refer_wav_path'],
            "prompt_text": char_settings['prompt_text'],
            "prompt_language": char_settings['prompt_language'],
            "text": text,
            "text_language": char_settings['text_language'],
            "cut_punc": "，。？！；",
            #"top_k": 10,
            

        }

        # 发送请求到语音生成服务
        response = requests.get("http://127.0.0.1:9880", params=params)
        
        if response.status_code == 200:
            # 返回音频内容的字节流
            return io.BytesIO(response.content)
        else:
            print(f"语音生成失败: {response.text}")
            return None
    except Exception as e:
        print(f"生成语音时发生错误: {str(e)}")
        return None

def get_ai_response_and_audio(user_input,system_message=None):
    try:
        system_message = session.get('fixed_text', None)
        # 获取 AI 回复
        ai_response = get_ai_response(user_input,system_message)
        
        # 返回 AI 回复
        return ai_response

    except Exception as e:
        print(f"处理 AI 回复时发生错误: {str(e)}")
        raise

# 语音转文本
def transcribe_audio(file_path, model):
    try:
        segments, info = model.transcribe(
            audio=file_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=700),
            language=None  # 自动检测语言
        )
        text = ''.join([segment.text for segment in segments])
        return text
    except Exception as e:
        print(f"语音识别失败: {str(e)}")
        return None


@app.route('/')
def index():
    # 返回前端页面
    return render_template_string(open("index.html", encoding="utf-8").read())
    

@app.route('/clear_history', methods=['POST'])
def clear_history():
    try:
        # 获取当前角色的记忆系统
        memory, history = get_current_memory()
        # 清空当前角色的历史记录
        history.clear()
        memory.clear()
        return jsonify({"status": "success", "message": "历史记录已清空"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/chat', methods=['GET'])
def chat():
    try:
        # 获取查询参数中的用户输入
        user_input = request.args.get('user_input', '')

        if not user_input:
            # 如果用户输入为空，尝试从 session 中获取语音转文本的内容
            user_input = session.get('user_text', 'None')
            
        if not user_input:
            return jsonify({"error": "输入不能为空"}), 400
        
        system_message = session.get('fixed_text', None)
        # 获取AI回复
        ai_response = get_ai_response_and_audio(user_input,system_message)
        session['fixed_text'] = None
        session.pop('system_message', None)
        
        # 返回文本回复和音频文件
        return jsonify({
            "text": ai_response,
            "audio_url": f"/audio?text={ai_response}"  # 只在这里生成一次音频URL
        })
    
    except Exception as e:
        print(f"请求处理失败: {str(e)}")
        return jsonify({"error": "服务器内部错误"}), 500

@app.route('/audio', methods=['GET'])
def audio():
    try:
        # 获取文本参数
        text = request.args.get('text', '')
        
        if not text:
            return jsonify({"error": "文本不能为空"}), 400
        
        # 生成语音
        audio_data = generate_voice(text)
        
        if not audio_data:
            return jsonify({"error": "语音生成失败"}), 500
        
        # 返回音频文件
        return send_file(
            audio_data,
            mimetype='audio/wav',
            as_attachment=True,
            download_name="response.wav"
        )
    
    except Exception as e:
        print(f"音频生成失败: {str(e)}")
        return jsonify({"error": "服务器内部错误"}), 500
    

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    try:
        audio = request.files['audio']
        audio_path = 'input_audio.wav'

        # 保存音频文件
        audio.save(audio_path)

        if whisper_model:
            # 步骤1: 识别用户的语音文本
            text = transcribe_audio(audio_path, whisper_model)
            print(f"识别的文本: {text}")

            # 将识别的文本保存到 session 中
            session['user_text'] = text

            # 返回文本
            return jsonify({
                "text": text,  # 用户语音转文本
            })
        else:
            return jsonify({"error": "Whisper模型未加载"}), 500
    except Exception as e:
        print(f"音频处理失败: {str(e)}")
        return jsonify({"error": "服务器内部错误"}), 500
    

@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    # 清除 session 中存储的 system_message
    session.pop('system_message', None)

    image_file = request.files['image']
    image = Image.open(image_file.stream).convert("RGB")  # 确保是 RGB 格式

    # 设置模型仓库、阈值等参数
    model_repo = "wd-vit-tagger-v3"  # 你选择的模型仓库
    general_thresh = 0.35
    general_mcut_enabled = True
    character_thresh = 0.85
    character_mcut_enabled = True

    # 调用predict方法进行图像标签预测
    general_strings, rating, character_res, general_res = predictor.predict(
        image,
        model_repo,
        general_thresh,
        general_mcut_enabled,
        character_thresh,
        character_mcut_enabled,
    )

    # 将标签生成描述并传给AI进行对话生成
    image_labels = " ".join(general_strings)  # 合并标签为文本
    image_labels = ' '.join([''.join(word.split()) for word in image_labels.split(',')])  # 合并每个标签中的字母
    print(image_labels)

    # 将标签字符串分割成列表
    labels_list = image_labels.split()
    # 获取前8个标签
    top_10_labels = labels_list[:10]
    # 将前8个标签合并成一个字符串
    top_10_labels_string = ' '.join(top_10_labels)


    #session['user_text'] = top_8_labels_string
    # 输出 session['user_text'] 以验证
    # 修改这一行，直接把标签包含在字符串中
    session['user_text'] = f"这是一幅新的图像，包含标签{top_10_labels_string}，你需要介绍这幅新图像的内容，回复只包含中文："
    print(session['user_text'])

    #session['fixed_text'] = f"这是一幅图像，包含标签，你需要介绍这幅图的内容，回复只包含中文："

    # 返回成功响应并附带 user_text
    return jsonify({
        "message": "图像处理完成，标签已存储",
        "user_text": session['user_text']  # 返回 user_text 给前端
    }), 200
    

@app.route('/save-avatar', methods=['POST'])
def save_avatar():
    try:
        if 'avatar' not in request.files:
            return jsonify({"error": "没有提供头像文件"}), 400
            
        avatar_file = request.files['avatar']
        
        # 检查文件类型
        if not avatar_file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({"error": "只支持PNG、JPG和JPEG格式"}), 400
            
        # 检查文件大小（限制为2MB）
        if avatar_file.content_length > 2 * 1024 * 1024:
            return jsonify({"error": "文件大小不能超过2MB"}), 400
            
        # 确保avatars目录存在
        os.makedirs('static/avatars', exist_ok=True)
        
        # 保存文件
        avatar_path = 'static/avatars/user_avatar.png'
        avatar_file.save(avatar_path)
        
        return jsonify({
            "message": "头像保存成功",
            "avatar_url": "/static/avatars/user_avatar.png"
        }), 200
        
    except Exception as e:
        print(f"头像保存失败: {str(e)}")
        return jsonify({"error": "服务器内部错误"}), 500

@app.route('/static/avatars/<filename>')
def serve_avatar(filename):
    try:
        # 检查文件是否存在
        avatar_path = os.path.join('static', 'avatars', filename)
        if not os.path.exists(avatar_path):
            # 如果文件不存在，返回默认头像
            return send_file('static/avatars/default_ai.png', mimetype='image/png')
        return send_file(avatar_path)
    except Exception as e:
        print(f"提供头像失败: {str(e)}")
        return send_file('static/avatars/default_ai.png', mimetype='image/png')

@app.route('/get-character-settings/<character_id>')
def get_character_settings(character_id):
    try:
        # 从默认角色配置中获取设置
        settings = load_default_character(character_id)
        print(f"加载角色设置 - ID: {character_id}, 设置: {settings}")
        
        if not settings:
            return jsonify({"error": "找不到角色设置"}), 404
            
        # 确保返回所有必要的字段
        required_fields = {
            'name': settings.get('name', ''),
            'description': settings.get('description', ''),
            'speech_style': settings.get('speech_style', ''),
            'sovits_path': settings.get('sovits_path', ''),
            'gpt_path': settings.get('gpt_path', ''),
            'refer_wav_path': settings.get('refer_wav_path', ''),
            'prompt_text': settings.get('prompt_text', ''),
            'prompt_language': settings.get('prompt_language', ''),
            'text_language': settings.get('text_language', ''),
            'enabled': settings.get('enabled', False)
        }
        
        return jsonify(required_fields)
    except Exception as e:
        print(f"加载角色设置失败: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/save-settings', methods=['POST'])
def save_settings():
    try:
        data = request.get_json()
        if not data or 'character_id' not in data or 'settings' not in data:
            return jsonify({'error': '无效的请求数据'}), 400

        character_id = data['character_id']
        settings = data['settings']

        # 更新config.py中的模型路径（仅当角色启用时）
        if settings.get('enabled', False):
            try:
                update_config_paths(settings['sovits_path'], settings['gpt_path'])
                print(f"已更新模型路径 - SoVITS: {settings['sovits_path']}, GPT: {settings['gpt_path']}")
            except Exception as e:
                print(f"更新模型路径失败: {str(e)}")
                return jsonify({'error': f'更新模型路径失败: {str(e)}'}), 500

        # 保存到session
        session['character_settings'] = settings

        # 更新YAML文件
        try:
            with open('config/default_character.yaml', 'r', encoding='utf-8') as f:
                yaml_data = yaml.safe_load(f)
            # 更新指定角色的设置
            if 'characters' in yaml_data and character_id in yaml_data['characters']:
                yaml_data['characters'][character_id].update(settings)
                # 写回文件
                with open('config/default_character.yaml', 'w', encoding='utf-8') as f:
                    yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
                print(f"已更新YAML文件中的角色设置: {character_id}")
            # 写入last_character.txt（仅当角色启用时）
            if settings.get('enabled', False):
                with open('config/last_character.txt', 'w', encoding='utf-8') as f:
                    f.write(character_id)
        except Exception as e:
            print(f"更新YAML文件失败: {str(e)}")
            return jsonify({'error': f'更新YAML文件失败: {str(e)}'}), 500

        return jsonify({'message': '设置保存成功'})
    except Exception as e:
        print(f"保存设置时发生错误: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/save-character-settings/<character_id>', methods=['POST'])
def save_character_settings(character_id):
    try:
        data = request.json
        if not data:
            return jsonify({"error": "无效的请求数据"}), 400
            
        # 保存到session
        session['character_settings'] = data
        
        # 更新config.py中的模型路径
        update_config_paths(data['sovits_path'], data['gpt_path'])
        
        return jsonify({"message": "设置保存成功"}), 200
    except Exception as e:
        print(f"保存设置时发生错误: {str(e)}")
        return jsonify({"error": str(e)}), 500

def update_config_paths(sovits_path, gpt_path):
    """更新config.py中的模型路径"""
    config_path = 'config.py'
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        with open(config_path, 'w', encoding='utf-8') as f:
            for line in lines:
                if line.startswith('sovits_path ='):
                    f.write(f'sovits_path = "{sovits_path}"\n')
                elif line.startswith('gpt_path ='):
                    f.write(f'gpt_path = "{gpt_path}"\n')
                else:
                    f.write(line)
        print(f"成功更新配置文件 - SoVITS: {sovits_path}, GPT: {gpt_path}")
    except Exception as e:
        print(f"更新配置文件失败: {str(e)}")
        raise

@app.route('/get-last-character', methods=['GET'])
def get_last_character():
    try:
        last_char_path = 'config/last_character.txt'
        if os.path.exists(last_char_path):
            with open(last_char_path, 'r', encoding='utf-8') as f:
                character_id = f.read().strip()
                if character_id:
                    return jsonify({'character_id': character_id})
        return jsonify({'character_id': 'anon'})
    except Exception as e:
        print(f"获取最后使用的角色失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/create-character', methods=['POST'])
def create_character():
    try:
        data = request.get_json()
        if not data or 'character_id' not in data:
            return jsonify({'error': '无效的请求数据'}), 400
        character_id = data['character_id']
        
        # 创建空模板
        empty_template = {
            'name': '',
            'description': '',
            'speech_style': '',
            'sovits_path': '',
            'gpt_path': '',
            'refer_wav_path': '',
            'prompt_text': '',
            'prompt_language': '',
            'text_language': '',
            'enabled': False
        }
        
        # 读取现有配置
        with open('config/default_character.yaml', 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
            
        # 确保characters字段存在
        if 'characters' not in yaml_data:
            yaml_data['characters'] = {}
            
        # 检查角色ID是否已存在
        if character_id in yaml_data['characters']:
            return jsonify({'error': '角色ID已存在'}), 400
            
        # 添加新角色（使用空模板）
        yaml_data['characters'][character_id] = empty_template
        
        # 写回文件
        with open('config/default_character.yaml', 'w', encoding='utf-8') as f:
            yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
            
        return jsonify({'message': '新角色创建成功'})
    except Exception as e:
        print(f"创建新角色失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get-characters', methods=['GET'])
def get_characters():
    try:
        with open('config/default_character.yaml', 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
        characters = []
        for char_id, char_data in yaml_data.get('characters', {}).items():
            characters.append({
                'id': char_id,
                'name': char_data.get('name', ''),
                'enabled': char_data.get('enabled', False)
            })
        return jsonify(characters)
    except Exception as e:
        print(f"获取角色列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete-character/<character_id>', methods=['DELETE'])
def delete_character(character_id):
    try:
        # 读取现有配置
        with open('config/default_character.yaml', 'r', encoding='utf-8') as f:
            yaml_data = yaml.safe_load(f)
            
        # 检查角色是否存在
        if character_id not in yaml_data.get('characters', {}):
            return jsonify({'error': '角色不存在'}), 404
            
        # 删除角色
        del yaml_data['characters'][character_id]
        
        # 写回文件
        with open('config/default_character.yaml', 'w', encoding='utf-8') as f:
            yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)
            
        return jsonify({'message': '角色删除成功'})
    except Exception as e:
        print(f"删除角色失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/restart-api', methods=['POST'])
def restart_api():
    try:
        # 发送重启命令到api服务
        requests.post("http://127.0.0.1:9880/control", json={"command": "restart"})
        # 由于api服务会立即重启，我们无法获取到正常的响应
        # 所以只要请求发送成功就认为重启成功
        return jsonify({"message": "语音合成服务重启成功"})
    except Exception as e:
        return jsonify({"error": f"重启失败: {str(e)}"}), 500

if __name__ == '__main__':
    # 启动 Whisper 模型
    whisper_model = load_whisper_model()
    
    # 加载 wd-vit-tagger-v3 模型和处理器
    tagger_model_dir = "./wd-vit-tagger-v3"  # 本地目录路径
    processor = AutoProcessor.from_pretrained(tagger_model_dir)
    model = AutoModelForImageClassification.from_pretrained(
        tagger_model_dir, 
        ignore_mismatched_sizes=True,
        torch_dtype=torch.float16  # 使用半精度
    ).half().to('cuda' if torch.cuda.is_available() else 'cpu')  # 使用GPU（如果可用）
    
    app.run(debug=True, host="127.0.0.1", port=5000)