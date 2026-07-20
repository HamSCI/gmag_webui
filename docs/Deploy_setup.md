# HamSCI Magnetometer Deployment Guide

This guide demonstrates how to set up the gmag_webui project on a deployable
magnetometer unit. This does not cover mag-usb installation.

## Architecture

The magnetometer suite is deployed on a BeeLink computer running Ubuntu Noble.
Mag-usb must be installed on the BeeLinks for the magnetometer portion.
Optionally, WSPRDaemon can be installed if your setup includes an RX-888.
(Mag-usb and gmag_webui do not conflict with WSPRDaemon)

The magnetometer is wired to the BeeLink computer via USB-C and RJ45.

## Guide

1. Ensure the following packages are installed:
   ```bash
   sudo apt-get install -y curl git unzip
   ```
2. Install the Deno runtime via curl. When it prompts you to add deno to $PATH,
   type Y and press enter twice. Restart your computer after Deno installs.
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   sudo reboot
   ```
3. Clone this repository to your computer:
   ```bash
   git clone https://github.com/HamSCI/gmag_webui
   ```
4. cd into the local clone's vendor folder and unzip the archive containing
   Font Awesome:
   ```bash
   cd gmag_webui/vendor
   unzip fontawesome-free-7.1.0-web.zip
   ```
5. cd back to the project's root. Run the deploy installation script to set up
   start on boot and automatic updates:
   ```bash
   cd ..
   sudo ./deploy/install.sh
   ```
   The dashboard should be accessible on localhost:8000. You can change the
   port by setting it in a .env file in the project's root directory.