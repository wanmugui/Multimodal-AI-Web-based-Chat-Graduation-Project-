#!/bin/bash
conda install -c conda-forge gcc
conda install -c conda-forge gxx
conda install ffmpeg cmake
conda install pytorch==2.0.1 torchvision torchaudio==2.0.1 pytorch-cuda=11.8 -c pytorch -c nvidia
pip install -r requirements.txt
