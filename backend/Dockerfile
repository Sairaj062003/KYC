FROM node:20

# Install system deps for Python, OpenCV, and Tesseract OCR
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    tesseract-ocr \
    tesseract-ocr-hin \
    libglib2.0-0 libsm6 libxrender1 libxext6 poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install --no-cache-dir opencv-python-headless pillow numpy --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/app.js"]
