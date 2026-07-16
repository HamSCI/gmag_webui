# Magnetometer Dashboard Configuration Settings

This page is intended to document all configuration options on the magnetometer
dashboard. Settings are accessible from the hamburger menu icon in the top-left
corner of the page.

Settings are persisted through local storage.

## Connection

* **Source Name**: The title displayed in the source's tab. Will automatically
  update the tab's contents.
* **Source Type**: Can be either "WebSocket", "MQTT", or "File". Depending on
  the type, different settings are exposed.
  * WebSocket
    * **WebSocket URL**: The host's URL in the form ws://IP:PORT or
      wss://IP:PORT.
  * MQTT
    * **Broker URL**: The MQTT broker URL, similar in form to a WebSocket URL.
    * **Topic**: The MQTT feed to subscribe to.
    * **Username** and **Password**: Optional credentials for secure brokers.
  * File
    * **Log File**: The file to upload and display on the dashboard.

A file source's contents will not persist between refreshes to save memory. It
must be reuploaded to the dashboard each refresh.

## Processing

* **Rotation**: A set of 3 sliders that can rotate the output HEZ vector in
  90-degree increments in each of the X, Y, and Z axes. By default, these are
  all set to 0.

* Delta-B
  * **Calculation Method**: Can be either "Constant dB" or "Moving Average".
    Different settings are exposed depending on the selection.
    * **Constant dB** exposes 3 fields for each of the H, E, and Z components.
      These fields can then be filled in with manual values.
    * **Moving Average** will take a snapshot of the current moving average
      filter window and use the snapshot as the baseline vector.

The order of operations these are applied in is rotations first using right
hand rule, then subtract delta-B from the result.

Processing settings are saved per source.

## Display

* **Time Window**: The time range to display on the main plots. Options are
  1 minute, 5 minutes, 15 minutes, and 1 hour. Default is 1 hour.
* **Show dB/dt**: Shows an extra field in the Current Reading and Spreadsheet
  indicating the rate of change. By default, this is disabled.
* **Moving Average**: Displays a denoised average line over the raw data.
  The time window can be set as 10 seconds, 30 seconds, or 60 seconds. A high
  time window increases the intensity of the denoising.

Display settings are saved globally per browser.