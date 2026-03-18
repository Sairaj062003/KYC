FROM node:20-alpine

# Install system deps for Tesseract OCR and PDF processing
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng poppler-utils

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/app.js"]
