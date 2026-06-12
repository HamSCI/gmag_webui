FROM ubuntu:noble

RUN apt-get update -q && \
    apt-get install -y build-essential cmake git nano socat && \
    rm -rf /var/lib/apt/lists/*

ENV HW_PORT=1234
ENV TERM=xterm-256color

EXPOSE 8765

WORKDIR /app

RUN git clone https://github.com/wittend/mag-usb

COPY logs /app/mag-usb/logs
COPY config.toml /etc/mag-usb/

RUN cd mag-usb && \
    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DENABLE_WEBSOCKET=ON && \
    cmake --build build --target mag-usb

CMD ["bash"]
