FROM ubuntu:noble AS builder

RUN apt-get update -q && \
    apt-get install -y build-essential cmake git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /local

RUN git clone https://github.com/wittend/mag-usb

RUN cd mag-usb && \
    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DENABLE_WEBSOCKET=ON && \
    cmake --build build --target mag-usb

FROM ubuntu:noble

ENV HW_PORT=1234
ENV TERM=xterm-256color

EXPOSE 8765

RUN apt-get update -q && \
    apt-get install -y nano socat && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY logs /app/logs
COPY config.toml /etc/mag-usb/
COPY --from=builder /local/mag-usb/build/mag-usb /app/mag-usb

CMD ["bash"]
