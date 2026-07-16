# gmag_webui

A Web User Interface for the HamSCI Ground Magnetometer.

## Project Management

Development is tracked on the
[gmag_webui project board](https://github.com/orgs/HamSCI/projects/7/views/1).
Issues and pull requests are organized there.

## Installation

To install this repository, simply `git clone` to your local machine or you can
download the repository as a zip archive and extract the files.

This project vendors the following dependencies:
* Font Awesome
* Plotly.js
* mqtt.js

## Prerequisites

### Hardware

This repository is designed to be used alongside the HamSCI ground magnetometer.
Instructions for setting up the magnetometer are available
[here](https://hamsci.org/mag_install).

A computer running Linux or macOS is required to host the magnetometer. The
dashboard can be hosted on the same computer as the magnetometer or a separate
client.
* If using Linux, Ubuntu is recommended, but other distributions should also
  work.
* If using macOS, Docker Desktop is required to run mag-usb.
* Windows is unsupported.

### Software

[Mag-usb](https://github.com/wittend/mag-usb) must be installed on the host
machine with WebSocket mode enabled.

[Deno](https://deno.com) is used to serve the dashboard. Installing Deno is
preferred for Linux clients.

[Docker Desktop](https://www.docker.com/products/docker-desktop/) is preferred
for Windows or macOS clients. The project is run through a Deno container.

## Usage

In the project's vendor folder, unzip the archive containing Font Awesome.

In a CLI, navigate to the project's root directory. Start the dashboard with
Deno:

```bash
deno task dev
```

Or use `docker compose` to create a container:

```bash
docker compose up -d frontend
```

By default, the dashboard will be available at `localhost:8000`. However, the
hostname and port can be changed as needed through a .env file. A .env.example
file is included to demonstrate how to configure the environment.

The dashboard must be given a host to connect to before any data is displayed.
The host is the IP address of the computer running mag-usb. A simple `ifconfig`
should help you find the local IP if you are unsure. Click the save button next
to the host field and the dashboard should display a "Connecting" status.

If your dashboard does not show a "Connected" status within a few seconds or
switches to a "Failed" status, check that you entered the host correctly, then
check mag-usb to make sure it is configured correctly.

The dashboard will autoscroll with the most recently collected data. You can
zoom in/pan on specific regions of the plots to disable the autoscroll behavior.
The behavior can be re-enabled by double clicking on the plots.

## Features

* Real-Time data streaming via WebSocket protocol or MQTT
* .log file uploading for historical data viewing
* Tabbed interface for tracking multiple sources
* Baseline post-processing and rate of change
* Rotation post-processing
* Moving average to smooth noisy data
* Export live data in JSONL or CSV format (up to 1 hour continuous)
* Light/dark theme support