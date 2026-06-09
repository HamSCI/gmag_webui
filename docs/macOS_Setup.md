# Setting up the HamSCI Ground Magnetometer on macOS

This guide will help you set up and run all components of the ground magnetometer on macOS using Docker.

Running the project on macOS has the advantage of being able to host the
magnetometer and serve the web dashboard on a single computer.

## Prerequisites

* Computer running macOS with USB-C support
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [socat](https://formulae.brew.sh/formula/socat) (Install with Homebrew:
  `brew install socat`)
* Pololu Isolated USB-to-I²C Adapter (products 5396 or 5397)
* RM3100-based magnetometer board
* I²C cable
* Male-to-Male USB-C cable

## Hardware Setup

1. In Terminal, run the command `ls -l /dev/cu.*` before *and* after plugging
   in your Pololu USB-to-I²C adapter. The adapter will typically appear as
   "/dev/cu.usbmodem14n01".
     * If the device list is the same both times, check the physical cables to
       make sure everything is connected properly.
2. Upon plugging in your adapter, the blue and green LEDs should stay lit. If
   they are not lit or they are blinking, verify that all cables are properly
   connected.
3. Wire SDA/SCL/GND (and 5V if required) between the adapter and the sensor
   board.

## Software Setup

1. In Terminal, run the following command, substituting **\<DEVICE>** for the
   name of the adapter as verified during hardware setup:
   ```bash
   socat -d -d TCP-LISTEN:1234,reuseaddr,fork FILE:<DEVICE>,raw,echo=0 &
   ```
2. Open Docker Desktop to ensure the Docker daemon is running.
3. In a separate Terminal, navigate to this project's root directory and run
   `docker compose up -d` to start a shared container. The dashboard is
   accessible on `localhost:8000`.
4. In the same Terminal, run `docker ps` to get all containers running on your
   computer. Look for the image "gmag_webui-backend" and copy its container ID.
   This is the container running mag-usb.
5. Substituting **\<ID>** for the container ID in the last step, run the command
   `docker exec -it <ID> bash` to enter the container's shell.
6. Inside the container, use socat to establish a virtual bridge between the
   container and your physical adapter:
   ```bash
   socat PTY,link=/dev/ttyACM0,raw,echo=0 TCP:host.docker.internal:${HW_PORT} &
   ```
7. Run this command to start mag-usb as a background process:
   ```bash
   cd mag-usb/src && ./../build/mag-usb &
   ```
8. If mag-usb is running properly, you can `exit` the shell. mag-usb will
   continue to run in the background until the container is stopped.
9. In the web dashboard, connect to the magnetometer at `ws://localhost:8765`.
   If set up correctly, the dashboard should immediately connect to it.