import argparse
import numpy as np
import onnxruntime as rt
import pandas as pd
from PIL import Image
# 检查模型和标签文件是否存在
import os
 # Dataset v3 series of models:
SWINV2_MODEL_DSV3_REPO = "wd-swinv2-tagger-v3"
CONV_MODEL_DSV3_REPO = "wd-convnext-tagger-v3"
VIT_MODEL_DSV3_REPO = "wd-vit-tagger-v3"
VIT_LARGE_MODEL_DSV3_REPO = "wd-vit-large-tagger-v3"
EVA02_LARGE_MODEL_DSV3_REPO = "wd-eva02-large-tagger-v3"



# Files to download from the repos
MODEL_FILENAME = "model.onnx"
LABEL_FILENAME = "selected_tags.csv"

# https://github.com/toriato/stable-diffusion-webui-wd14-tagger/blob/a9eacb1eff904552d3012babfa28b57e1d3e295c/tagger/ui.py#L368
kaomojis = [
    "0_0",
    "(o)_(o)",
    "+_+",
    "+_-",
    "._.",
    "<o>_<o>",
    "<|>_<|>",
    "=_=",
    ">_<",
    "3_3",
    "6_9",
    ">_o",
    "@_@",
    "^_^",
    "o_o",
    "u_u",
    "x_x",
    "|_|",
    "||_||",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--score-slider-step", type=float, default=0.05)
    parser.add_argument("--score-general-threshold", type=float, default=0.35)
    parser.add_argument("--score-character-threshold", type=float, default=0.85)
    return parser.parse_args()


def load_labels(dataframe) -> list[str]:
    name_series = dataframe["name"]
    name_series = name_series.map(
        lambda x: x.replace("_", " ") if x not in kaomojis else x
    )
    tag_names = name_series.tolist()

    rating_indexes = list(np.where(dataframe["category"] == 9)[0])
    general_indexes = list(np.where(dataframe["category"] == 0)[0])
    character_indexes = list(np.where(dataframe["category"] == 4)[0])
    return tag_names, rating_indexes, general_indexes, character_indexes


def mcut_threshold(probs):
    """
    Maximum Cut Thresholding (MCut)
    Largeron, C., Moulin, C., & Gery, M. (2012). MCut: A Thresholding Strategy
     for Multi-label Classification. In 11th International Symposium, IDA 2012
     (pp. 172-183).
    """
    sorted_probs = probs[probs.argsort()[::-1]]
    difs = sorted_probs[:-1] - sorted_probs[1:]
    t = difs.argmax()
    thresh = (sorted_probs[t] + sorted_probs[t + 1]) / 2
    return thresh


class Predictor:
    def __init__(self):
        self.model_target_size = None
        self.last_loaded_repo = None

    

    def load_model(self, model_repo):
        

        # 检查文件是否存在
        model_path = os.path.join(model_repo, 'model.onnx')
        csv_path = os.path.join(model_repo, 'selected_tags.csv')

        if not os.path.exists(model_path) or not os.path.exists(csv_path):
            raise FileNotFoundError(f"模型文件或标签文件未找到: {model_repo}")

        

        # 加载标签
        tags_df = pd.read_csv(csv_path)
        sep_tags = load_labels(tags_df)

        self.tag_names = sep_tags[0]
        self.rating_indexes = sep_tags[1]
        self.general_indexes = sep_tags[2]
        self.character_indexes = sep_tags[3]

        # 加载 ONNX 模型
        model = rt.InferenceSession(model_path)
        _, height, width, _ = model.get_inputs()[0].shape
        self.model_target_size = height

        self.last_loaded_repo = model_repo
        self.model = model

    def prepare_image(self, image):
        target_size = self.model_target_size

        # 如果图像是RGB，转为RGBA以便支持透明通道
        if image.mode != 'RGBA':
            image = image.convert('RGBA')

        # 创建透明的画布，并合成原图像
        canvas = Image.new("RGBA", image.size, (255, 255, 255, 0))  # 背景透明
        canvas.alpha_composite(image)

        # 转换为RGB
        image = canvas.convert("RGB")

        # 填充图像为正方形
        image_shape = image.size
        max_dim = max(image_shape)
        pad_left = (max_dim - image_shape[0]) // 2
        pad_top = (max_dim - image_shape[1]) // 2

        padded_image = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
        padded_image.paste(image, (pad_left, pad_top))

        # 如果需要，调整图像大小
        if max_dim != target_size:
            padded_image = padded_image.resize(
                (target_size, target_size),
                Image.BICUBIC,
            )

        # 转换为NumPy数组
        image_array = np.asarray(padded_image, dtype=np.float32)

        # 转换从RGB到BGR
        image_array = image_array[:, :, ::-1]

        return np.expand_dims(image_array, axis=0)

    def predict(
        self,
        image,
        model_repo,
        general_thresh,
        general_mcut_enabled,
        character_thresh,
        character_mcut_enabled,
    ):
        self.load_model(model_repo)

        image = self.prepare_image(image)

        input_name = self.model.get_inputs()[0].name
        label_name = self.model.get_outputs()[0].name
        preds = self.model.run([label_name], {input_name: image})[0]

        labels = list(zip(self.tag_names, preds[0].astype(float)))

        # First 4 labels are actually ratings: pick one with argmax
        ratings_names = [labels[i] for i in self.rating_indexes]
        rating = dict(ratings_names)

        # Then we have general tags: pick any where prediction confidence > threshold
        general_names = [labels[i] for i in self.general_indexes]

        if general_mcut_enabled:
            general_probs = np.array([x[1] for x in general_names])
            general_thresh = mcut_threshold(general_probs)

        general_res = [x for x in general_names if x[1] > general_thresh]
        general_res = dict(general_res)

        # Everything else is characters: pick any where prediction confidence > threshold
        character_names = [labels[i] for i in self.character_indexes]

        if character_mcut_enabled:
            character_probs = np.array([x[1] for x in character_names])
            character_thresh = mcut_threshold(character_probs)
            character_thresh = max(0.15, character_thresh)

        character_res = [x for x in character_names if x[1] > character_thresh]
        character_res = dict(character_res)

        sorted_general_strings = sorted(
            general_res.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        sorted_general_strings = [x[0] for x in sorted_general_strings]
        sorted_general_strings = (
            ", ".join(sorted_general_strings).replace("(", r"\(").replace(")", r"\)")
        )

        return sorted_general_strings, rating, character_res, general_res
