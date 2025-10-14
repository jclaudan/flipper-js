// Description: FlipperHTTP Cat Fact API Example
// Requires: FlipperHTTP firmware flashed on Flipper Zero
// Hardware: WiFi Devboard connected to USART pins (13 TX, 14 RX)
// License: MIT
// Author: JBlanked
// File: flipper_http_cat_fact.js

let serial = require("serial");

// Define the global `fhttp` object with all the functions
let fhttp = {
    // Constructor
    init: function () {
        serial.setup("usart", 115200);
    },
    // Deconstructor
    deinit: function () {
        serial.end();
    },
    // Read data from the serial port and return it line by line
    read_data: function (delay_ms) {
        let line = serial.readln(delay_ms);
        let i = 5;
        while (line === undefined && i > 0) {
            line = serial.readln(delay_ms);
            i--;
        }
        return line;
    },
    // Send data to the serial port
    send_data: function (data) {
        if (data === "") {
            return;
        }
        serial.write(data);
    },
    // Clear the incoming serial by up to 10 lines
    clear_buffer: function (search_for_success) {
        let data = this.read_data(100);
        let sdata = this.to_string(data);
        let i = 0;
        // clear all data until we get an expected response
        while (i < 5 &&
            (data !== undefined &&
                (!search_for_success || (search_for_success && !this.includes(sdata, "[SUCCESS]"))) &&
                !this.includes(sdata, "[ERROR]") &&
                !this.includes(sdata, "[INFO]") &&
                !this.includes(sdata, "[PONG]") &&
                !this.includes(sdata, "[DISCONNECTED]") &&
                !this.includes(sdata, "[CONNECTED]") &&
                !this.includes(sdata, "[GET/STARTED]") &&
                !this.includes(sdata, "[GET/END]"))) {
            data = this.read_data(100);
            sdata = this.to_string(data);
            i++;
        }
    },
    // Connect to wifi
    connect_wifi: function () {
        serial.write("[WIFI/CONNECT]");
        let response = this.read_data(500);
        if (response === undefined) {
            return false;
        }
        let sresponse = this.to_string(response);
        this.clear_buffer(true); // Clear the buffer
        return this.includes(sresponse, "[SUCCESS]") || this.includes(sresponse, "[CONNECTED]") || this.includes(sresponse, "[INFO]");
    },
    // Disconnect from wifi
    disconnect_wifi: function () {
        serial.write("[WIFI/DISCONNECT]");
        let response = this.read_data(500);
        if (response === undefined) {
            return false;
        }
        let sresponse = this.to_string(response);
        this.clear_buffer(true); // Clear the buffer
        return this.includes(sresponse, "[DISCONNECTED]") || this.includes(sresponse, "WiFi stop");
    },
    // Send a ping to the board
    ping: function () {
        serial.write("[PING]");
        let response = this.read_data(100);
        if (response === undefined) {
            return false;
        }
        this.clear_buffer(true); // Clear the buffer
        return this.includes(this.to_string(response), "[PONG]");
    },
    // Save wifi settings
    save_wifi: function (ssid, password) {
        if (ssid === "" || password === "") {
            return false;
        }
        let command = '[WIFI/SAVE]{"ssid":"' + ssid + '","password":"' + password + '"}';
        serial.write(command);
        let response = this.read_data(500);
        if (response === undefined) {
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
        let sresponse = this.to_string(response);
        if (this.includes(sresponse, "[SUCCESS]")) {
            this.clear_buffer(false); // Clear the buffer
            this.clear_buffer(false); // Clear the buffer
            return true;
        }
        else {
            print("Failed to save: " + response);
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
    },
    // GET request with headers
    get_request_with_headers: function (url, headers) {
        serial.write('[GET/HTTP]{url:"' + url + '",headers:' + headers + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
        let sresponse = this.to_string(response);
        if (this.includes(sresponse, "[GET/SUCCESS]")) {
            while (true) {
                let line = this.read_data(500);
                if (line === "[GET/END]") {
                    break;
                }
                if (line !== undefined) {
                    this.clear_buffer(false); // Clear the buffer
                    return line;
                }
            }
        }
        else {
            print("GET request failed");
        }
        this.clear_buffer(); // Clear the buffer
        return "";
    },
    // parse JSON data
    parse_json: function (key, data) {
        serial.write('[PARSE]{"key":"' + key + '","data":' + data + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
    },
    // Helper function to check if a string contains another string
    includes: function (text, search) {
        let stringLength = text.length;
        let searchLength = search.length;
        if (stringLength < searchLength) {
            return false;
        }
        for (let i = 0; i < stringLength; i++) {
            if (text[i] === search[0]) {
                let found = true;
                for (let j = 1; j < searchLength; j++) {
                    if (text[i + j] !== search[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return true;
                }
            }
        }
    },
    // Convert an array of characters to a string
    to_string: function (text) {
        if (text === undefined) {
            return "";
        }
        let return_text = "";
        for (let i = 0; i < text.length; i++) {
            return_text += text[i];
        }
        return return_text;
    }
};

// GUI setup
let eventLoop = require("event_loop");
let gui = require("gui");
let dialogView = require("gui/dialog");
let textBoxView = require("gui/text_box");
let dialog = dialogView.make();
let url = "https://catfact.ninja/fact";

dialog.set("header", "FlipperHTTP");
dialog.set("text", "JavaScript Example");
gui.viewDispatcher.switchTo(dialog);
delay(2000);

// Initialize
fhttp.init();
dialog.set("text", "Initialized!");
delay(500);

// Ping the board
let response = fhttp.ping();

// Connect to WiFi and get a random cat fact from catfact.ninja
if (response) {
    dialog.set("text", "Saving wifi settings...");
    delay(500);
    let success = fhttp.save_wifi("your_ssid", "your_password");
    if (success) {
        dialog.set("text", "Sending GET request...");
        delay(500);
        let data = fhttp.get_request_with_headers(url, '{"Content-Type":"application/json"}');
        if (data !== undefined && data !== "") {
            let textBox = textBoxView.makeWith({
                text: data,
            });
            gui.viewDispatcher.switchTo(textBox);
            delay(10000); // delay for user to read
            gui.viewDispatcher.switchTo(dialog);
            fhttp.disconnect_wifi();
        }
        else {
            dialog.set("text", "Failed to get data.");
            fhttp.disconnect_wifi();
            delay(1000);
        }
    }
    else {
        dialog.set("text", "Failed to save wifi settings.");
        delay(1000);
    }
}
else {
    dialog.set("text", "Ping failed.");
    delay(1000);
}
fhttp.deinit();
dialog.set("text", "Goodbye!");
delay(5000);

eventLoop.stop();