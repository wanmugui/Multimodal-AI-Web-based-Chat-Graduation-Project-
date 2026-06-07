# 模型下载与放置说明

本项目的 GitHub 仓库只保留网页、业务代码、配置模板和必要脚本，不包含体积较大的模型权重文件。运行完整功能前，请按下面说明自行下载并放置模型文件。

## 1. GPT-SoVITS 语音合成相关模型

GPT-SoVITS 的预训练模型、ASR 模型、UVR5 模型以及训练得到的 GPT/SoVITS 权重文件体积较大，不建议直接提交到 GitHub。

请参考 GPT-SoVITS 官方仓库的模型下载说明：

[RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)

### 需要恢复的常见目录

根据官方说明下载模型后，请将文件放回项目对应目录：

```text
D:\GPT-SoVITS-main\GPT_SoVITS\pretrained_models
D:\GPT-SoVITS-main\GPT_SoVITS\text\G2PWModel
D:\GPT-SoVITS-main\tools\asr\models\faster-whisper-large-v3
D:\GPT-SoVITS-main\tools\uvr5\uvr5_weights
```

如果需要使用自己训练过的音色模型，请将 GPT 和 SoVITS 权重分别放入：

```text
D:\GPT-SoVITS-main\GPT_weights_v2
D:\GPT-SoVITS-main\SoVITS_weights_v2
```

常见权重文件格式包括：

```text
*.ckpt
*.pth
```

这些文件通常较大，请不要上传到 GitHub。

## 2. Whisper / Faster-Whisper 语音识别模型

本项目曾使用：

```text
D:\GPT-SoVITS-main\tools\asr\models\faster-whisper-large-v3
```

该模型属于语音识别模块，体积较大。请按照 GPT-SoVITS 官方仓库中的 ASR / Faster-Whisper 相关说明重新下载，并放置到上述目录。

## 3. WD ViT Tagger 图像识别模型

视觉识别模型使用：

[SmilingWolf/wd-vit-tagger-v3](https://huggingface.co/SmilingWolf/wd-vit-tagger-v3)

下载 Hugging Face 页面中的模型文件后，请放置到：

```text
D:\GPT-SoVITS-main\wd-vit-tagger-v3
```

常见文件可能包括：

```text
model.onnx
selected_tags.csv
*.safetensors
*.json
```

实际文件名以 Hugging Face 页面提供的内容为准。
