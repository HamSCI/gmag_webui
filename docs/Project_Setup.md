# Setting Up the HamSCI Ground Magnetometer Web Dashboard

The purpose of this guide is to explain how to set up and run the HamSCI ground
magnetometer web dashboard.

## Terminology and Assumptions

These terms will be used throughout this guide for consistency:

* **Client:** The computer running the dashboard.
* **Host:** The computer the magnetometer is physically connected to.

Certain variations in setup may require sone steps to be done in a different
way. This matters more for the host machine than the client. For this guide, we
will be assuming the hardware used is a traditional setup, meaning:

* The host and client are different computers.
* The host is running a Linux distribution.

## Prerequisites

For the host (and hardware):

* The host's operating system can be any Linux distribution or macOS.
  * Windows is unsupported. Raspberry Pis are unsupported.
  * For this guide, we will assume the host is running Linux.
    * A separate, but comprehensive guide for running on macOS can be found
      [here](/docs/macOS_Setup.md).
* MagPi Remote Board and Sensor Kit
  * This can be purchased from [TAPR](https://tapr.org/product/tangerine-sdr-magnetometer/).
* RM3100-based magnetometer board
* Pololu Isolated USB-to-I²C Adapter (products 5396 or 5397)
  * The recommended adapter is the Pi Eliminator, which can be purchased from
    [TAPR](https://tapr.org/product/pi-eliminator/).
* I²C cable
  * A small length cable is fine for testing connections, but generally, a
    longer cable is more suitable in practical application (~100 meters)
* Male-to-Male USB-C cable

For the client:

* The client can run any operating system.
  * Docker Desktop is recommended for running the dashboard.

## Host Setup

On the host, run `apt-get` to install all necessary packages needed to build
and run the collection software:

```bash
sudo apt-get install -y build-essential cmake git
```

If your Linux distribution is exclusively CLI, a text editor such as nano, vi,
or vim is also required.

Ensure the host is connected to the internet. Check with `nmcli` or `ifconfig`
for the host's IP address, as it will be needed for the client to connect to
the host from the dashboard.

On the host computer, clone the mag-usb data collection software with `git`,
then `cd` into the local clone:

```bash
git clone https://github.com/wittend/mag-usb
cd mag-usb
```

Create the CMake build files for mag-usb. WebSocket mode must be enabled so the
dashboard can connect to the host. Then, build mag-usb with CMake:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DENABLE_WEBSOCKET=ON
cmake --build build --target mag-usb
```

Copy the "config.toml" file in mag-usb's "src" directory to "/etc/mag-usb/"
(this requires root privileges). Then, open the file in your preferred editor:

```bash
sudo mkdir -p -v /etc/mag-usb
sudo cp src/config.toml /etc/mag-usb/
sudo nano /etc/mag-usb/config.toml
```

Under "[websocket]", make sure the value for "enable" is set to `true`:

```toml
[websocket]
# Enable WebSocket output server.
enable = true
# Bind address and port for WebSocket clients.
bind_address = "0.0.0.0"
port = 8765
```

Connect the Pololu adapter along with the RM3100 sensor board to the host. The
green and blue LEDs should light up and hold steady. If the LEDs are blinking,
it is likely that your computer cannot find the adapter.

Run mag-usb:

```bash
./mag-usb/build/mag-usb
```

## Client Setup

Clone this repository with `git`:

```bash
git clone https://github.com/HamSCI/gmag_webui
```

Navigate to the project's root directory. Run the project by creating a Docker
container:

```bash
docker compose up -d frontend
```

The dashboard is accessible at `localhost:8000`. Connect to the Linux host by
accessing the config sidebar from the top left of the page. In the Host URL
field, enter `ws://<HOST_IP>:<PORT>`, substituting values as appropriate. For
example, `ws://127.0.0.1:8765`. Click save and wait for the dashboard to
connect to the host.

If the dashboard cannot find the host and you've verified the host's IP and
the port being accessed are correct, check your system permissions and make
sure your computer can find devices on your local network.