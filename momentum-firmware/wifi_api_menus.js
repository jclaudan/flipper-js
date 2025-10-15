// Description: Menus WiFi et API CRUD pour Flipper Zero - Fichier autonome
// Auteur: Assistant IA
// Fonctionnalités: 
// - Menu WiFi: Connexion, scan, sauvegarde des points d'accès
// - Menu API: Interface CRUD avec FlipperHTTP pour les appels GET/POST/PUT/DELETE
// Licence: MIT
// Fichier: wifi_api_menus.js

// Import des modules Momentum firmware
let eventLoop = require("event_loop");
let gui = require("gui");
let loadingView = require("gui/loading");
let submenuView = require("gui/submenu");
let textInputView = require("gui/text_input");
let textBoxView = require("gui/text_box");
let dialogView = require("gui/dialog");
let storage = require("storage");
let serial = require("serial");
let flipper = require("flipper");

// ============================================================================
// FLIPPERHTTP LIBRARY - Intégrée directement dans le fichier
// ============================================================================

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

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let wifiNetworks = [];
let savedNetworks = [];
let currentApiUrl = "";
let currentApiHeaders = '{"Content-Type":"application/json"}';
let currentApiData = "{}";

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

// Fonction pour sauvegarder les réseaux WiFi
function saveWifiNetwork(ssid, password) {
    try {
        let networks = storage.read("wifi_networks");
        if (networks) {
            savedNetworks = JSON.parse(networks);
        }
        
        // Vérifier si le réseau existe déjà
        let exists = false;
        for (let i = 0; i < savedNetworks.length; i++) {
            if (savedNetworks[i].ssid === ssid) {
                savedNetworks[i].password = password;
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            savedNetworks.push({ssid: ssid, password: password});
        }
        
        storage.write("wifi_networks", JSON.stringify(savedNetworks));
        return true;
    } catch (e) {
        return false;
    }
}

// Fonction pour charger les réseaux WiFi sauvegardés
function loadWifiNetworks() {
    try {
        let networks = storage.read("wifi_networks");
        if (networks) {
            savedNetworks = JSON.parse(networks);
        }
    } catch (e) {
        savedNetworks = [];
    }
}

// Fonction pour scanner les réseaux WiFi
function scanWifiNetworks() {
    let scanResult = fhttp.scan_wifi();
    if (scanResult && scanResult !== "") {
        // Parser les résultats du scan (format dépend du firmware)
        wifiNetworks = scanResult.split('\n').filter(network => network.trim() !== "");
        return true;
    }
    return false;
}

// Fonction pour se connecter à un réseau WiFi
function connectToWifi(ssid, password) {
    // Sauvegarder d'abord le réseau
    if (password) {
        saveWifiNetwork(ssid, password);
    }
    
    // Tenter la connexion
    return fhttp.connect_wifi();
}

// Fonction pour effectuer un appel API
function makeApiCall(method, url, headers, data) {
    let response = "";
    
    switch(method) {
        case "GET":
            if (headers && headers !== '{}') {
                response = fhttp.get_request_with_headers(url, headers);
            } else {
                response = fhttp.get_request(url);
            }
            break;
        case "POST":
            response = fhttp.post_request_with_headers(url, headers, data);
            break;
        case "PUT":
            response = fhttp.put_request_with_headers(url, headers, data);
            break;
        case "DELETE":
            response = fhttp.delete_request_with_headers(url, headers, data);
            break;
    }
    
    return response;
}

// ============================================================================
// DÉCLARATION DES VUES
// ============================================================================

let views = {
    // Menu principal
    mainMenu: submenuView.makeWith({
        header: "FlipperHTTP Menus",
        items: [
            "📶 Gestion WiFi",
            "🌐 Appels API CRUD",
            "ℹ️ Informations",
            "❌ Quitter"
        ]
    }),
    
    // Menu WiFi
    wifiMenu: submenuView.makeWith({
        header: "Gestion WiFi",
        items: [
            "🔍 Scanner réseaux",
            "💾 Réseaux sauvegardés",
            "🔌 Se connecter",
            "💾 Sauvegarder réseau",
            "📊 Statut connexion",
            "🔌 Déconnecter",
            "⬅️ Retour"
        ]
    }),
    
    // Menu API
    apiMenu: submenuView.makeWith({
        header: "Appels API CRUD",
        items: [
            "🌐 GET Request",
            "📝 POST Request", 
            "✏️ PUT Request",
            "🗑️ DELETE Request",
            "⚙️ Configuration",
            "📋 Historique",
            "⬅️ Retour"
        ]
    }),
    
    // Configuration API
    apiConfigMenu: submenuView.makeWith({
        header: "Configuration API",
        items: [
            "🔗 URL de base",
            "📋 Headers",
            "📄 Données JSON",
            "⬅️ Retour"
        ]
    }),
    
    // Dialogues et vues
    dialog: dialogView.make(),
    loading: loadingView.make(),
    
    // Saisie de texte
    textInput: textInputView.makeWith({
        header: "Saisie",
        minLength: 0,
        maxLength: 200,
        defaultText: "",
        defaultTextClear: true
    }),
    
    // Affichage de texte long
    textBox: textBoxView.makeWith({
        text: ""
    }),
    
    // Saisie de données JSON
    jsonInput: textInputView.makeWith({
        header: "Données JSON",
        minLength: 0,
        maxLength: 500,
        defaultText: "{}",
        defaultTextClear: true
    })
};

// ============================================================================
// FONCTIONS WIFI
// ============================================================================

function scanWifi() {
    views.loading.set("text", "Scan en cours...");
    gui.viewDispatcher.switchTo(views.loading);
    
    if (scanWifiNetworks()) {
        let networkList = "Réseaux trouvés:\n\n";
        for (let i = 0; i < wifiNetworks.length; i++) {
            networkList += (i + 1) + ". " + wifiNetworks[i] + "\n";
        }
        
        views.textBox.set("text", networkList);
        gui.viewDispatcher.switchTo(views.textBox);
    } else {
        views.dialog.set("text", "Erreur lors du scan WiFi");
        gui.viewDispatcher.switchTo(views.dialog);
    }
}

function showSavedNetworks() {
    loadWifiNetworks();
    
    if (savedNetworks.length === 0) {
        views.dialog.set("text", "Aucun réseau sauvegardé");
        gui.viewDispatcher.switchTo(views.dialog);
        return;
    }
    
    let networkList = "Réseaux sauvegardés:\n\n";
    for (let i = 0; i < savedNetworks.length; i++) {
        networkList += (i + 1) + ". " + savedNetworks[i].ssid + "\n";
    }
    
    views.textBox.set("text", networkList);
    gui.viewDispatcher.switchTo(views.textBox);
}

function connectToWifiMenu() {
    views.textInput.set("header", "Nom du réseau (SSID):");
    views.textInput.set("defaultText", "");
    gui.viewDispatcher.switchTo(views.textInput);
    
    eventLoop.subscribe(views.textInput.input, function (_sub, ssid, gui, views) {
        if (ssid && ssid.trim() !== "") {
            // Demander le mot de passe
            views.textInput.set("header", "Mot de passe WiFi:");
            views.textInput.set("defaultText", "");
            gui.viewDispatcher.switchTo(views.textInput);
            
            eventLoop.subscribe(views.textInput.input, function (_sub, password, gui, views) {
                connectToWifi(ssid, password);
                views.dialog.set("text", "Tentative de connexion...");
                gui.viewDispatcher.switchTo(views.dialog);
                delay(2000);
                gui.viewDispatcher.switchTo(views.wifiMenu);
            }, gui, views);
        } else {
            gui.viewDispatcher.switchTo(views.wifiMenu);
        }
    }, gui, views);
}

function saveWifiMenu() {
    views.textInput.set("header", "Nom du réseau (SSID):");
    views.textInput.set("defaultText", "");
    gui.viewDispatcher.switchTo(views.textInput);
    
    eventLoop.subscribe(views.textInput.input, function (_sub, ssid, gui, views) {
        if (ssid && ssid.trim() !== "") {
            views.textInput.set("header", "Mot de passe WiFi:");
            views.textInput.set("defaultText", "");
            gui.viewDispatcher.switchTo(views.textInput);
            
            eventLoop.subscribe(views.textInput.input, function (_sub, password, gui, views) {
                if (saveWifiNetwork(ssid, password)) {
                    views.dialog.set("text", "Réseau sauvegardé avec succès!");
                } else {
                    views.dialog.set("text", "Erreur lors de la sauvegarde");
                }
                gui.viewDispatcher.switchTo(views.dialog);
                delay(2000);
                gui.viewDispatcher.switchTo(views.wifiMenu);
            }, gui, views);
        } else {
            gui.viewDispatcher.switchTo(views.wifiMenu);
        }
    }, gui, views);
}

function showWifiStatus() {
    let ip = fhttp.ip_wifi();
    let boardIp = fhttp.ip_address();
    
    let status = "Statut WiFi:\n\n";
    status += "IP WiFi: " + (ip || "Non connecté") + "\n";
    status += "IP Board: " + (boardIp || "Inconnue") + "\n";
    
    if (fhttp.connect_wifi()) {
        status += "État: Connecté";
    } else {
        status += "État: Déconnecté";
    }
    
    views.textBox.set("text", status);
    gui.viewDispatcher.switchTo(views.textBox);
}

function disconnectWifi() {
    if (fhttp.disconnect_wifi()) {
        views.dialog.set("text", "Déconnecté du WiFi");
    } else {
        views.dialog.set("text", "Erreur lors de la déconnexion");
    }
    gui.viewDispatcher.switchTo(views.dialog);
    delay(2000);
    gui.viewDispatcher.switchTo(views.wifiMenu);
}

// ============================================================================
// FONCTIONS API
// ============================================================================

function makeGetRequest() {
    if (!currentApiUrl) {
        configureApiUrl();
        return;
    }
    
    views.loading.set("text", "Envoi GET...");
    gui.viewDispatcher.switchTo(views.loading);
    
    let response = makeApiCall("GET", currentApiUrl, currentApiHeaders, "");
    
    if (response && response !== "") {
        views.textBox.set("text", "Réponse GET:\n\n" + response);
        gui.viewDispatcher.switchTo(views.textBox);
    } else {
        views.dialog.set("text", "Erreur lors de la requête GET");
        gui.viewDispatcher.switchTo(views.dialog);
    }
}

function makePostRequest() {
    if (!currentApiUrl) {
        configureApiUrl();
        return;
    }
    
    views.loading.set("text", "Envoi POST...");
    gui.viewDispatcher.switchTo(views.loading);
    
    let response = makeApiCall("POST", currentApiUrl, currentApiHeaders, currentApiData);
    
    if (response && response !== "") {
        views.textBox.set("text", "Réponse POST:\n\n" + response);
        gui.viewDispatcher.switchTo(views.textBox);
    } else {
        views.dialog.set("text", "Erreur lors de la requête POST");
        gui.viewDispatcher.switchTo(views.dialog);
    }
}

function makePutRequest() {
    if (!currentApiUrl) {
        configureApiUrl();
        return;
    }
    
    views.loading.set("text", "Envoi PUT...");
    gui.viewDispatcher.switchTo(views.loading);
    
    let response = makeApiCall("PUT", currentApiUrl, currentApiHeaders, currentApiData);
    
    if (response && response !== "") {
        views.textBox.set("text", "Réponse PUT:\n\n" + response);
        gui.viewDispatcher.switchTo(views.textBox);
    } else {
        views.dialog.set("text", "Erreur lors de la requête PUT");
        gui.viewDispatcher.switchTo(views.dialog);
    }
}

function makeDeleteRequest() {
    if (!currentApiUrl) {
        configureApiUrl();
        return;
    }
    
    views.loading.set("text", "Envoi DELETE...");
    gui.viewDispatcher.switchTo(views.loading);
    
    let response = makeApiCall("DELETE", currentApiUrl, currentApiHeaders, currentApiData);
    
    if (response && response !== "") {
        views.textBox.set("text", "Réponse DELETE:\n\n" + response);
        gui.viewDispatcher.switchTo(views.textBox);
    } else {
        views.dialog.set("text", "Erreur lors de la requête DELETE");
        gui.viewDispatcher.switchTo(views.dialog);
    }
}

function configureApiUrl() {
    views.textInput.set("header", "URL de l'API:");
    views.textInput.set("defaultText", currentApiUrl || "https://api.example.com/endpoint");
    gui.viewDispatcher.switchTo(views.textInput);
    
    eventLoop.subscribe(views.textInput.input, function (_sub, url, gui, views) {
        if (url && url.trim() !== "") {
            currentApiUrl = url.trim();
            views.dialog.set("text", "URL configurée: " + currentApiUrl);
            gui.viewDispatcher.switchTo(views.dialog);
            delay(2000);
        }
        gui.viewDispatcher.switchTo(views.apiConfigMenu);
    }, gui, views);
}

function configureApiHeaders() {
    views.textInput.set("header", "Headers JSON:");
    views.textInput.set("defaultText", currentApiHeaders);
    gui.viewDispatcher.switchTo(views.textInput);
    
    eventLoop.subscribe(views.textInput.input, function (_sub, headers, gui, views) {
        if (headers && headers.trim() !== "") {
            currentApiHeaders = headers.trim();
            views.dialog.set("text", "Headers configurés");
            gui.viewDispatcher.switchTo(views.dialog);
            delay(2000);
        }
        gui.viewDispatcher.switchTo(views.apiConfigMenu);
    }, gui, views);
}

function configureApiData() {
    views.jsonInput.set("header", "Données JSON:");
    views.jsonInput.set("defaultText", currentApiData || "{}");
    gui.viewDispatcher.switchTo(views.jsonInput);
    
    eventLoop.subscribe(views.jsonInput.input, function (_sub, data, gui, views) {
        if (data && data.trim() !== "") {
            currentApiData = data.trim();
            views.dialog.set("text", "Données configurées");
            gui.viewDispatcher.switchTo(views.dialog);
            delay(2000);
        }
        gui.viewDispatcher.switchTo(views.apiConfigMenu);
    }, gui, views);
}

function showApiHistory() {
    // Cette fonction pourrait être étendue pour sauvegarder l'historique des appels
    views.dialog.set("text", "Fonctionnalité en développement");
    gui.viewDispatcher.switchTo(views.dialog);
    delay(2000);
    gui.viewDispatcher.switchTo(views.apiMenu);
}

function showSystemInfo() {
    let info = "Informations système:\n\n";
    info += "FlipperHTTP: " + (fhttp.ping() ? "Connecté" : "Déconnecté") + "\n";
    info += "WiFi: " + (fhttp.connect_wifi() ? "Connecté" : "Déconnecté") + "\n";
    info += "IP WiFi: " + fhttp.ip_wifi() + "\n";
    info += "IP Board: " + fhttp.ip_address() + "\n";
    
    views.textBox.set("text", info);
    gui.viewDispatcher.switchTo(views.textBox);
}

function cleanup() {
    fhttp.deinit();
}

// ============================================================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// ============================================================================

// Gestionnaire du menu principal
eventLoop.subscribe(views.mainMenu.chosen, function (_sub, index, gui, eventLoop, views) {
    if (index === 0) {
        // Menu WiFi
        gui.viewDispatcher.switchTo(views.wifiMenu);
    } else if (index === 1) {
        // Menu API
        gui.viewDispatcher.switchTo(views.apiMenu);
    } else if (index === 2) {
        // Informations
        showSystemInfo();
    } else if (index === 3) {
        // Quitter
        cleanup();
        eventLoop.stop();
    }
}, gui, eventLoop, views);

// Gestionnaire du menu WiFi
eventLoop.subscribe(views.wifiMenu.chosen, function (_sub, index, gui, eventLoop, views) {
    if (index === 0) {
        // Scanner réseaux
        scanWifi();
    } else if (index === 1) {
        // Réseaux sauvegardés
        showSavedNetworks();
    } else if (index === 2) {
        // Se connecter
        connectToWifiMenu();
    } else if (index === 3) {
        // Sauvegarder réseau
        saveWifiMenu();
    } else if (index === 4) {
        // Statut connexion
        showWifiStatus();
    } else if (index === 5) {
        // Déconnecter
        disconnectWifi();
    } else if (index === 6) {
        // Retour
        gui.viewDispatcher.switchTo(views.mainMenu);
    }
}, gui, eventLoop, views);

// Gestionnaire du menu API
eventLoop.subscribe(views.apiMenu.chosen, function (_sub, index, gui, eventLoop, views) {
    if (index === 0) {
        // GET Request
        makeGetRequest();
    } else if (index === 1) {
        // POST Request
        makePostRequest();
    } else if (index === 2) {
        // PUT Request
        makePutRequest();
    } else if (index === 3) {
        // DELETE Request
        makeDeleteRequest();
    } else if (index === 4) {
        // Configuration
        gui.viewDispatcher.switchTo(views.apiConfigMenu);
    } else if (index === 5) {
        // Historique
        showApiHistory();
    } else if (index === 6) {
        // Retour
        gui.viewDispatcher.switchTo(views.mainMenu);
    }
}, gui, eventLoop, views);

// Gestionnaire du menu configuration API
eventLoop.subscribe(views.apiConfigMenu.chosen, function (_sub, index, gui, eventLoop, views) {
    if (index === 0) {
        // URL de base
        configureApiUrl();
    } else if (index === 1) {
        // Headers
        configureApiHeaders();
    } else if (index === 2) {
        // Données JSON
        configureApiData();
    } else if (index === 3) {
        // Retour
        gui.viewDispatcher.switchTo(views.apiMenu);
    }
}, gui, eventLoop, views);

// Navigation de retour
eventLoop.subscribe(gui.viewDispatcher.navigation, function (_sub, _, gui, views, eventLoop) {
    if (gui.viewDispatcher.currentView === views.mainMenu) {
        cleanup();
        eventLoop.stop();
        return;
    }
    gui.viewDispatcher.switchTo(views.mainMenu);
}, gui, views, eventLoop);

// ============================================================================
// INITIALISATION ET DÉMARRAGE
// ============================================================================

function start() {
    // Initialiser FlipperHTTP
    fhttp.init();
    
    if (!fhttp.ping()) {
        views.dialog.set("header", "Erreur");
        views.dialog.set("text", "Impossible de se connecter à FlipperHTTP!\nVérifiez que le firmware est installé.");
        gui.viewDispatcher.switchTo(views.dialog);
        delay(5000);
        eventLoop.stop();
        return;
    }
    
    // Charger les réseaux sauvegardés
    loadWifiNetworks();
    
    // Démarrer l'interface
    gui.viewDispatcher.switchTo(views.mainMenu);
}

// Démarrer l'application
start();
eventLoop.run();