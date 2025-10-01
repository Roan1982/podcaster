# Usa la imagen oficial de Node.js
FROM node:20-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Instala Piper TTS
RUN apk add --no-cache curl tar && \
    curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz -o piper_amd64.tar.gz && \
    tar -xzf piper_amd64.tar.gz -C /tmp && \
    mv /tmp/piper/piper /usr/local/bin/piper && \
    chmod +x /usr/local/bin/piper && \
    rm -rf /tmp/piper piper_amd64.tar.gz && \
    mkdir -p /app/models && \
    curl -L https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_9972/medium/es_ES-mls_9972-medium.onnx -o /app/models/es_ES-mls_9972-medium.onnx && \
    curl -L https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/mls_9972/medium/es_ES-mls_9972-medium.onnx.json -o /app/models/es_ES-mls_9972-medium.onnx.json

# Copia el código fuente
COPY src/ ./src/

# Copia el README y otros archivos necesarios
COPY README.md ./

# Comando para ejecutar la aplicación
CMD ["npm", "start"]