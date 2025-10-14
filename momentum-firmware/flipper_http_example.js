// Description: FlipperHTTP Example - WiFi and HTTP requests with Flipper Zero
// Requires: FlipperHTTP firmware flashed on Flipper Zero
// Hardware: WiFi Devboard connected to USART pins (13 TX, 14 RX)
// Global: fhttp object with all HTTP and WiFi functions
// License: MIT
// Author: JBlanked
// File: flipper_http_example.js

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
    // list available commands
    list_commands: function () {
        serial.write("[LIST]");
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
    },
    // Allow the LED to display while processing
    led_on: function () {
        serial.write("[LED/ON]");
    },
    // Disable the LED from displaying while processing
    led_off: function () {
        serial.write("[LED/OFF]");
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
    // parse JSON array
    parse_json_array: function (key, index, data) {
        serial.write('[PARSE/ARRAY]{"key":"' + key + '","index":' + index + ',"data":' + data + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
    },
    // Get Wifi network list
    scan_wifi: function () {
        serial.write("[WIFI/SCAN]");
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
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
    // Get the IP address of the WiFi Devboard
    ip_address: function () {
        serial.write("[IP/ADDRESS]");
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
    },
    // Get the IP address of the connected WiFi network
    ip_wifi: function () {
        serial.write("[WIFI/IP]");
        let response = this.read_data(500);
        if (response === undefined) {
            return "";
        }
        return this.to_string(response);
    },
    // Send a GET request to the board
    get_request: function (url) {
        serial.write('[GET]' + url);
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
    // POST request with headers and payload
    post_request_with_headers: function (url, headers, data) {
        serial.write('[POST/HTTP]{"url":"' + url + '","headers":' + headers + ',"payload":' + data + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
        let sresponse = this.to_string(response);
        if (this.includes(sresponse, "[POST/SUCCESS]")) {
            while (true) {
                let line = this.read_data(500);
                if (line === "[POST/END]") {
                    break;
                }
                if (line !== undefined) {
                    this.clear_buffer(false); // Clear the buffer
                    return line;
                }
            }
        }
        else {
            print("POST request failed");
        }
        this.clear_buffer(); // Clear the buffer
        return "";
    },
    // PUT request with headers and payload
    put_request_with_headers: function (url, headers, data) {
        serial.write('[PUT/HTTP]{"url":"' + url + '","headers":' + headers + ',"payload":' + data + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
        let sresponse = this.to_string(response);
        if (this.includes(sresponse, "[PUT/SUCCESS]")) {
            while (true) {
                let line = this.read_data(500);
                if (line === "[PUT/END]") {
                    break;
                }
                if (line !== undefined) {
                    this.clear_buffer(false); // Clear the buffer
                    return line;
                }
            }
        }
        else {
            print("PUT request failed");
        }
        this.clear_buffer(); // Clear the buffer
        return "";
    },
    // DELETE request with headers and payload
    delete_request_with_headers: function (url, headers, data) {
        serial.write('[DELETE/HTTP]{"url":"' + url + '","headers":' + headers + ',"payload":' + data + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            this.clear_buffer(false); // Clear the buffer
            return false;
        }
        let sresponse = this.to_string(response);
        if (this.includes(sresponse, "[DELETE/SUCCESS]")) {
            while (true) {
                let line = this.read_data(500);
                if (line === "[DELETE/END]") {
                    break;
                }
                if (line !== undefined) {
                    this.clear_buffer(false); // Clear the buffer
                    return line;
                }
            }
        }
        else {
            print("DELETE request failed");
        }
        this.clear_buffer(); // Clear the buffer
        return "";
    },
    // WebSocket functions
    websocket_start: function (url, port, headers) {
        serial.write('[WS/START]{"url":"' + url + '","port":' + port + ',"headers":' + headers + '}');
        let response = this.read_data(500);
        if (response === undefined) {
            return false;
        }
        let sresponse = this.to_string(response);
        this.clear_buffer(true);
        return this.includes(sresponse, "[SUCCESS]") || this.includes(sresponse, "[WS/STARTED]");
    },
    websocket_stop: function () {
        serial.write("[WS/STOP]");
        let response = this.read_data(500);
        if (response === undefined) {
            return false;
        }
        let sresponse = this.to_string(response);
        this.clear_buffer(true);
        return this.includes(sresponse, "[SUCCESS]") || this.includes(sresponse, "[WS/STOPPED]");
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
let textInputView = require("gui/text_input");

let views = {
    dialog: dialogView.makeWith({
        header: "FlipperHTTP Demo",
        text: "Press OK to start",
        center: "Start Demo"
    }),
    textInput: textInputView.makeWith({
        header: "Enter WiFi SSID:",
        minLength: 0,
        maxLength: 32,
        defaultText: "MyWiFi",
        defaultTextClear: true
    })
};

// Initialize FlipperHTTP
fhttp.init();

// Check if FlipperHTTP is responding
let pingResult = fhttp.ping();

if (!pingResult) {
    views.dialog.set("header", "Error");
    views.dialog.set("text", "FlipperHTTP not responding!\nMake sure FlipperHTTP firmware is flashed.");
    gui.viewDispatcher.switchTo(views.dialog);
    delay(5000);
    fhttp.deinit();
    eventLoop.stop();
    return;
}

views.dialog.set("text", "FlipperHTTP connected!\nStarting demo...");
gui.viewDispatcher.switchTo(views.dialog);
delay(2000);

// Demo 1: List available commands
views.dialog.set("text", "Listing commands...");
let commands = fhttp.list_commands();
if (commands !== "") {
    let textBox = textBoxView.makeWith({
        text: "Available Commands:\n" + commands
    });
    gui.viewDispatcher.switchTo(textBox);
    delay(3000);
}

// Demo 2: WiFi scan
views.dialog.set("text", "Scanning WiFi networks...");
let wifiNetworks = fhttp.scan_wifi();
if (wifiNetworks !== "") {
    let textBox = textBoxView.makeWith({
        text: "WiFi Networks:\n" + wifiNetworks
    });
    gui.viewDispatcher.switchTo(textBox);
    delay(3000);
}

// Demo 3: Get IP addresses
views.dialog.set("text", "Getting IP addresses...");
let boardIP = fhttp.ip_address();
let wifiIP = fhttp.ip_wifi();

let ipInfo = "Board IP: " + boardIP + "\nWiFi IP: " + wifiIP;
let textBox = textBoxView.makeWith({
    text: ipInfo
});
gui.viewDispatcher.switchTo(textBox);
delay(3000);

// Demo 4: Simple HTTP request (if connected to WiFi)
views.dialog.set("text", "Testing HTTP request...");
let testUrl = "https://httpbin.org/get";
let response = fhttp.get_request(testUrl);

if (response !== "" && response !== false) {
    let textBox = textBoxView.makeWith({
        text: "HTTP Response:\n" + response
    });
    gui.viewDispatcher.switchTo(textBox);
    delay(5000);
} else {
    views.dialog.set("text", "HTTP request failed.\nMake sure WiFi is connected.");
    gui.viewDispatcher.switchTo(views.dialog);
    delay(3000);
}

// Demo 5: JSON API request
views.dialog.set("text", "Testing JSON API...");
let apiUrl = "https://catfact.ninja/fact";
let headers = '{"Content-Type":"application/json"}';
let apiResponse = fhttp.get_request_with_headers(apiUrl, headers);

if (apiResponse !== "" && apiResponse !== false) {
    // Try to parse the fact from JSON
    let fact = fhttp.parse_json("fact", apiResponse);
    let displayText = "Cat Fact API Response:\n" + apiResponse + "\n\nParsed Fact: " + fact;
    
    let textBox = textBoxView.makeWith({
        text: displayText
    });
    gui.viewDispatcher.switchTo(textBox);
    delay(5000);
} else {
    views.dialog.set("text", "JSON API request failed.");
    gui.viewDispatcher.switchTo(views.dialog);
    delay(3000);
}

// Demo 6: WebSocket test (if supported)
views.dialog.set("text", "Testing WebSocket...");
let wsUrl = "echo.websocket.org";
let wsPort = 80;
let wsHeaders = '{"Origin":"http://localhost"}';

let wsStarted = fhttp.websocket_start(wsUrl, wsPort, wsHeaders);
if (wsStarted) {
    views.dialog.set("text", "WebSocket started successfully!");
    delay(2000);
    fhttp.websocket_stop();
    views.dialog.set("text", "WebSocket stopped.");
} else {
    views.dialog.set("text", "WebSocket test failed.");
}
delay(2000);

// Cleanup
views.dialog.set("text", "Demo completed!\nCleaning up...");
gui.viewDispatcher.switchTo(views.dialog);
delay(2000);

fhttp.deinit();
views.dialog.set("text", "Goodbye!");
delay(2000);

eventLoop.stop();