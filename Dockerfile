# Usa la imagen oficial de Node.js
FROM node:20-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Instala Piper TTS
RUN apk add --no-cache curl tar gcompat && \
    curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz -o piper_amd64.tar.gz && \
    tar -xzf piper_amd64.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/piper/piper && \
    rm piper_amd64.tar.gz && \
    mkdir -p /app/models && \
    curl -L https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx -o /app/models/es_ES-mls_9972-low.onnx && \
    curl -L https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx.json -o /app/models/es_ES-mls_9972-low.onnx.json

# Copia el código fuente
COPY src/ ./src/

# Copia el README y otros archivos necesarios
COPY README.md ./

# Comando para ejecutar la aplicación
CMD ["npm", "start"]