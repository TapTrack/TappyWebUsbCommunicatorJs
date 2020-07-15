/**
 * These tests currently just test the base communicator not the NativeUSB/FTDI serial port adapters. Those
 * could use more tests, but care should be taken to not make the tests overly brittle or rely on assumptions
 * about the WebUSB serial port operations that are not verified as parts of the spec (or actually observed
 * browser behaviour).
 */
var WebUSBSerialComm = require('../src/webusbserial.js');

var MockDevice = function(mockSerial) {
    this.rx = function(data) {
        if(this.disconnected) {
            throw new Error("Trying to send data to a disconnected connection");
        }
    };

    this.sendData = function(buffer) {
        mockSerial.rx(buffer);
    };
};

var MockSerial = function() {
    this.isOpen = false;
    this.dataCb = function(){};
    this.device = new MockDevice(this);
};

MockSerial.prototype.on = function(ev,cb) {
    var self = this;
    if(ev === "data") {
        self.dataCb = cb;
    }
};

MockSerial.prototype.open = function(cb) {
    var self = this;
    self.isOpen = true;
    if(typeof cb === "function") {
        cb();
    }
};

MockSerial.prototype.close = function(cb) {
    var self = this;
    self.isOpen = false;
    if(typeof cb === "function") {
        cb();
    }
};

MockSerial.prototype.flush = function(cb) {
    var self = this;
    if(typeof cb === "function") {
        cb();
    }
};

MockSerial.prototype.write = function(buffer, cb) {
    var self = this;
    self.device.rx(buffer);
    if(typeof cb === "function") {
        cb();
    }
};

MockSerial.prototype.rx = function(buffer) {
    var self = this;
    self.dataCb(buffer);
};

MockSerial.prototype.getDevice = function() {
    var self = this;
    return self.device;
};


var arrayEquals = function(a1,a2) {
    return a1.length == a2.length && a1.every(function(e,i){return e == a2[i];});
};

describe("Test connection status", function() {
    it("should report not connected while not connected",function() {
        var mockSerial = new MockSerial();
        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        expect(wrapper.isConnected()).toBe(false);
    });

    it("should report connected after connecting",function() {
        var mockSerial = new MockSerial();
        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        wrapper.connect();
        expect(wrapper.isConnected()).toBe(true);

    });

    it("should report disconnected after disconnecting",function() {
        var mockSerial = new MockSerial();
        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        wrapper.connect();
        wrapper.disconnect();
        expect(wrapper.isConnected()).toBe(false);
    });

    it("disconnect should not throw when called regardless of connection status multiple times",function() {
        var mockSerial = new MockSerial();
        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        expect(function(){
            wrapper.disconnect();}).not.toThrow();
        wrapper.connect();
        wrapper.disconnect();
        expect(function(){
            wrapper.disconnect();}).not.toThrow();
    });

    it("connect should not throw when called regardless of connection status multiple times",function() {
        var mockSerial = new MockSerial();
        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        expect(function(){
            wrapper.connect();}).not.toThrow();
        wrapper.disconnect();
        wrapper.connect();
        expect(function(){
            wrapper.connect();}).not.toThrow();
    });
});

describe("Test rx/tx operations",function() {
    it("should forward information received from the device",function() {
        var testData = [0x44,0x55,0x66,0x77,0x88];
        var mockSerial = new MockSerial();

        var wrapper = new WebUSBSerialComm({serial: mockSerial});
        var gotTestData = false;
        wrapper.setDataCallback(function(data) {
            expect(arrayEquals(data,testData)).toEqual(true);
            gotTestData = true;
        });
        wrapper.connect();
        var device= mockSerial.getDevice();
        device.sendData(Buffer.from(new Uint8Array(testData)));
        expect(gotTestData).toEqual(true);
    });
});
