# gmag_webui

A Web User Interface for the HamSCI Ground Magnetometer.

## Installation

To install this repository, simply `git clone` to your local machine or you can
download the repository as a zip archive and extract the files.

This project vendors the following dependencies:
* Font Awesome
* Plotly.js

## Prerequisites

### Hardware

This repository is designed to be used alongside the HamSCI ground magnetometer.
Instructions for setting up the magnetometer are available
[here](https://hamsci.org/mag_install).

An additional computer running Linux or macOS is required to host the
magnetometer.
* If using Linux, Ubuntu is recommended, but other distributions should also
  work.
* If using macOS, Docker Desktop is required to run mag-usb.
* Raspberry Pis and Windows are unsupported.

### Software

[Mag-usb](https://github.com/wittend/mag-usb) must be installed on the host
machine with WebSocket mode enabled.

[Docker Desktop](https://www.docker.com/products/docker-desktop/) is preferred
for running the project. The dashboard is served via a Deno container.

## Usage

In the vendor folder, unzip the archive containing fontawesome.

In a CLI, navigate to the project's root directory. Use `docker compose` to
create a container:

```bash
docker compose up -d frontend
```

By default, the dashboard will be available at `localhost:8000`. However, the
hostname and port can be changed as needed.

The dashboard must be given a host to connect to before any data is displayed.
The host is the IP address of the computer running mag-usb. A simple `ifconfig`
should help you find the local IP if you are unsure. Click the save button next
to the host field and the dashboard should display a "Connecting" status.

If your dashboard does not show a "Connected" status within a few seconds or
switches to a "Failed" status, check that you entered the host correctly, then
check mag-usb to make sure it is configured correctly.

The dashboard is currently limited to one host at a time. This can be mitigated
by opening a duplicate dashboard in another tab.

The dashboard will autoscroll with the most recently collected data. You can
zoom in/pan on specific regions of the plots to disable the autoscroll behavior.
The behavior can be re-enabled by double clicking on the plots.