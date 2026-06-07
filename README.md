# 多模态 AI 网页聊天毕业设计

这是一个面向毕业设计展示的多模态 AI 网页项目，围绕“文字对话、语音合成、语音识别、图像识别”等能力构建交互式 Web 应用。项目基于 GPT-SoVITS 相关语音能力，并结合视觉识别模型实现多模态输入与反馈。

> 说明：本仓库仅保留项目代码、网页资源、配置与说明文档，不包含大体积模型权重文件。模型下载与放置方式请查看 [MODEL_DOWNLOAD.md](./MODEL_DOWNLOAD.md)。

## 项目功能

- 文本聊天：支持用户通过网页输入文本并获得 AI 回复。
- 语音合成：集成 GPT-SoVITS 相关能力，将文本回复转换为语音。
- 语音识别：通过 Whisper / Faster-Whisper 相关模型处理语音输入。
- 图像识别：使用 WD ViT Tagger 视觉模型识别图片内容或标签。
- 网页交互：以 Web 页面作为主要操作入口，适合毕业设计演示与答辩展示。

## 技术组成

项目中涉及的主要能力包括：

- 前端网页界面
- Python 后端服务
- GPT-SoVITS 语音合成模块
- Whisper / Faster-Whisper 语音识别模块
- WD ViT Tagger 图像识别模块

由于模型文件体积较大，相关模型目录已从仓库中移除，避免 GitHub 仓库过大或上传失败。

## 模型下载

运行完整功能前，需要自行下载并放置模型文件。

GPT-SoVITS 语音相关模型请参考官方仓库：

[RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)

视觉识别模型请参考 Hugging Face：

[SmilingWolf/wd-vit-tagger-v3](https://huggingface.co/SmilingWolf/wd-vit-tagger-v3)

详细目录说明见：

[MODEL_DOWNLOAD.md](./MODEL_DOWNLOAD.md)

## 被移除的大文件目录

为了便于上传 GitHub，以下模型、训练权重和日志文件不会包含在仓库中：

```text
GPT_SoVITS/text/G2PWModel
GPT_SoVITS/pretrained_models
tools/asr/models/faster-whisper-large-v3
tools/uvr5/uvr5_weights
GPT_weights_v2/*.ckpt
SoVITS_weights_v2/*.pth
wd-vit-tagger-v3
logs/
logs.tar.gz
```

如果需要恢复完整运行环境，请根据 [MODEL_DOWNLOAD.md](./MODEL_DOWNLOAD.md) 重新下载并放回对应目录。

## 运行前准备

1. 克隆本仓库。
2. 按照 [MODEL_DOWNLOAD.md](./MODEL_DOWNLOAD.md) 下载语音与视觉模型。
3. 安装项目依赖。
4. 根据本地环境配置模型路径、端口和启动参数。
5. 启动后端服务与网页界面。

由于本项目是在 GPT-SoVITS 相关工程基础上进行毕业设计开发，不同机器上的依赖环境可能存在差异。若运行过程中缺少模型或依赖，请优先检查模型目录是否完整。


```

## 项目用途

本项目主要用于毕业设计展示，重点体现多模态 AI 在网页应用中的集成方式，包括文本、语音和图像能力的组合使用。

## 参考项目

- [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)
- [SmilingWolf/wd-vit-tagger-v3](https://huggingface.co/SmilingWolf/wd-vit-tagger-v3)

## 免责声明

本项目仅用于学习、研究与毕业设计展示。相关模型与开源项目版权归原作者所有，使用时请遵守对应项目的开源协议和模型许可。
