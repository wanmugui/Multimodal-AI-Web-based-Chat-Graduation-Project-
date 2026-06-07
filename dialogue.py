import requests
import json
from playsound import playsound

# 调用 Ollama 生成回复
def get_ai_response(prompt):
    response = requests.post(
        "http://127.0.0.1:11434/api/generate",
        json={
            "model": "deepseek-r1-distill-qwen-32b",
            "prompt": prompt,
            "stream": False
        }
    )
    return response.json()["response"]

# 调用 GPT-SoVITS 生成语音
def generate_voice(text):
    params = {
        "refer_wav_path": "anon1.wav",
        "prompt_text": "今の私、すごくなかった?お客さんの注目浴びまくりじゃない?",
        "prompt_language": "日文",
        "text": text,
        "text_language": "中文"
    }
    response = requests.get("http://127.0.0.1:9880", params=params)
    if response.status_code == 200:
        with open("output.wav", "wb") as f:
            f.write(response.content)
        playsound("output.wav")
    else:
        print("语音生成失败:", response.text)

# 对话循环
while True:
    user_input = input("请输入你的问题（输入 exit 退出）: ")
    if user_input.lower() in ["exit", "quit"]:
        break
    try:
        ai_response = get_ai_response(user_input)
        print("AI 回复:", ai_response)
        generate_voice(ai_response)
    except Exception as e:
        print("发生错误:", str(e))