function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === 'object') {
    // Node, CommonJS-like
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.WebUSBSerialCommunicator = factory();
  }
})(this, function () {
  var FTDI_USB_VENDOR_ID = 0x0403;
  var FTDI_USB_PRODUCT_ID = 0x6001;
  var NATIVE_USB_VENDOR_ID = 0x04d8;
  var NATIVE_USB_PRODUCT_ID = 0x0053;
  var DEFAULT_FILTERS = [{
    'vendorId': FTDI_USB_VENDOR_ID,
    'productId': FTDI_USB_PRODUCT_ID
  }, // TapTrack TappyUSB
  {
    'vendorId': NATIVE_USB_VENDOR_ID,
    'productId': NATIVE_USB_PRODUCT_ID
  } // TapTrack TappyUSB
  ];
  var FTDI_SIO_RESET = 0x00;
  var FTDI_SIO_SET_DATA = 0x04;
  var FTDI_SET_DATA_DEFAULT = 0x0008;
  var FTDI_SIO_MODEM_CTRL = 0x01;
  var FTDI_SET_MODEM_CTRL_DEFAULT1 = 0x0101;
  var FTDI_SET_MODEM_CTRL_DEFAULT2 = 0x0202;
  var FTDI_SET_MODEM_CTRL_DEFAULT3 = 0x0100;
  var FTDI_SET_MODEM_CTRL_DEFAULT4 = 0x0200;
  var FTDI_SIO_SET_FLOW_CTRL = 0x02;
  var FTDI_SET_FLOW_CTRL_DEFAULT = 0x0000;
  var FTDI_SIO_SET_BAUD_RATE = 0x03;
  var FTDI_BAUDRATE_9600 = 0x4138;
  var FTDI_BAUDRATE_115200 = 0x001a;

  function FTDIReadHead(device, host, debugLogger) {
    var self = this;
    self.host = host;
    self.device = device;
    self.cancelled = false;
    self.debugLogger = debugLogger;
  }

  FTDIReadHead.prototype.cancel = function () {
    var self = this;
    self.cancelled = true;
  };

  FTDIReadHead.prototype.readLoop = function () {
    var self = this;

    if (!self.cancelled) {
      self.device.transferIn(1, 64).then(function (result) {
        var arr = new Uint8Array(result.data.buffer);

        if (arr.length > 2 && arr[0] === 0x01 && arr[1] === 0x60) {
          self.debugLogger("emitted");
          var subarr = arr.slice(2);
          self.host.emit('data', subarr);
        }

        setTimeout(function () {
          self.readLoop();
        }, arr.length === 2 ? 50 : 0);
      }, function (error) {
        if (!self.cancelled) {
          self.debugLogger("recd error ", error);
          self.host.emit('error', error);
        }
      })["catch"](function (e) {
        if (!self.cancelled) {
          self.debugLogger("recd error ", e);
          self.host.emit('error', e);
        }
      });
    }
  };

  function WebFTDIUSBSerialPort(params) {
    var self = this;

    if (typeof params !== "undefined" && params !== null && _typeof(params.device) === "object") {
      self.device = params.device;
    } else {
      throw new Error("Must specify a device");
    }

    if (typeof params !== "undefined" && params !== null && typeof params.debug === "boolean" && params.debug) {
      self.debugLog = function () {
        console.log.apply(this, arguments);
      };
    } else {
      self.debugLog = function () {};
    }

    self.isOpen = false;
    self.isChangingConfiguration = false;
    self.interfaceIdx = 0;
    self.currentSioSetData = 0x0000;
    self.listeners = {};

    self.setControlCommand = function (request, value, index, data) {
      return self.device.controlTransferOut({
        'requestType': 'vendor',
        'recipient': 'device',
        'request': request,
        'value': value,
        'index': index + self.interfaceIdx + 0
      });
    };

    self.readHead = null;
  }

  WebFTDIUSBSerialPort.prototype.emit = function (channel, data) {
    var self = this;

    if (_typeof(self.listeners[channel]) === "object") {
      for (var i = 0; i < self.listeners[channel].length; i++) {
        var listener = self.listeners[channel][i];

        if (typeof listener === "function") {
          listener(data);
        }
      }
    }
  };

  WebFTDIUSBSerialPort.prototype.on = function (channel, listener) {
    var self = this;

    if (typeof listener === "function") {
      if (_typeof(self.listeners[channel]) !== "object") {
        self.listeners[channel] = [];
      }

      self.listeners[channel].push(listener);
    }
  };

  WebFTDIUSBSerialPort.prototype.open = function (callback) {
    var self = this;

    if (self.isChangingConfiguration) {
      var err = new Error("already changing device configuration");
      self.emit('error', err);
      callback(err);
    } else if (!self.isOpen) {
      if (typeof self.device !== "undefined" && self.device !== null) {
        self.isChangingConfiguration = true;

        var handleError = function handleError(e) {
          self.debugLog(e);
          self.isOpen = false;
          self.isChangingConfiguration = false;
          self.emit('error', e);
          callback(e);
        };

        self.device.open().then(function () {
          if (self.device.configuration.configurationValue === 1) {
            self.debugLog("configuration value was 1");
            return {};
          } else {
            self.debugLog("configuration value needed to be set");
            return self.device.setConfiguration(1);
          }
        }).then(function () {
          self.debugLog("claiming interface");
          return self.device.claimInterface(0);
        }).then(function (s) {
          self.debugLog("send SIO_RESET");
          return self.setControlCommand(FTDI_SIO_RESET, 0x00, 0, null);
        }).then(function (s) {
          self.debugLog("send SIO_SET_DATA");
          return self.setControlCommand(FTDI_SIO_SET_DATA, FTDI_SET_DATA_DEFAULT, 0, null);
        }).then(function (s) {
          self.debugLog("send SIO_MODEL_CONTROL DEFAULT_1");
          return self.setControlCommand(FTDI_SIO_MODEM_CTRL, FTDI_SET_MODEM_CTRL_DEFAULT1, 0, null);
        }).then(function (s) {
          self.debugLog("send SIO_MODEM_CONTROL DEFAULT_2");
          return self.setControlCommand(FTDI_SIO_MODEM_CTRL, FTDI_SET_MODEM_CTRL_DEFAULT2, 0, null);
        }).then(function (s) {
          self.debugLog("send SIO_SET_FLOW_CONTROL");
          return self.setControlCommand(FTDI_SIO_SET_FLOW_CTRL, FTDI_SET_FLOW_CTRL_DEFAULT, 0, null);
        }).then(function (s) {
          self.debugLog("setting baud to 9600");
          return self.setControlCommand(FTDI_SIO_SET_BAUD_RATE, FTDI_BAUDRATE_9600, 0, null);
        }).then(function (s) {
          self.debugLog("setting baud to 115200");
          return self.setControlCommand(FTDI_SIO_SET_BAUD_RATE, FTDI_BAUDRATE_115200, 0, null);
        }).then(function (s) {
          self.debugLog("setting data bits"); //data bits

          self.currentSioSetData &= ~1;
          self.currentSioSetData &= ~(1 << 1);
          self.currentSioSetData &= ~(1 << 2);
          self.currentSioSetData |= 1 << 3;
          return self.setControlCommand(FTDI_SIO_SET_DATA, self.currentSioSetData, 0, null);
        }).then(function (s) {
          self.debugLog("setting parity setting"); // parity off

          self.currentSioSetData &= ~(1 << 8);
          self.currentSioSetData &= ~(1 << 9);
          self.currentSioSetData &= ~(1 << 10);
          return self.setControlCommand(FTDI_SIO_SET_DATA, self.currentSioSetData, 0, null);
        }).then(function (s) {
          self.debugLog("setting stop bit setting"); // stop bits

          self.currentSioSetData &= ~(1 << 11);
          self.currentSioSetData &= ~(1 << 12);
          self.currentSioSetData &= ~(1 << 13);
          return self.setControlCommand(FTDI_SIO_SET_DATA, self.currentSioSetData, 0, null);
        })["catch"](function (reason) {
          self.debugLog("unable to configure device");
          handleError(reason);
        }).then(function (result) {
          // console.log(result);
          self.emit('open');
          self.isOpen = true;
          self.isChangingConfiguration = false;
          self.readHead = new FTDIReadHead(self.device, self, self.debugLog);
          self.readHead.readLoop();
          callback();
        })["catch"](function (reason) {
          console.log("unable to read");
          handleError(reason);
        });
      } else {
        var _err = new Error("no device");

        self.emit('error', _err);
        callback(_err);
      }
    } else {
      var _err2 = new Error("serial port already open");

      self.emit('error', _err2);
      callback(_err2);
    }
  };

  WebFTDIUSBSerialPort.prototype.write = function (data, callback) {
    var self = this;
    self.device.transferOut(2, data).then(function (result) {
      if (callback) {
        callback(null);
      }
    })["catch"](function (error) {
      if (callback) {
        callback(error);
      }

      self.emit('error', error);
    });
  };

  WebFTDIUSBSerialPort.prototype.close = function (callback) {
    var self = this;

    if (self.isChangingConfiguration) {
      var err = new Error("device configuration is currently changing");
      self.emit('error', err);
      callback(err);
    } else if (self.isOpen) {
      self.isChangingConfiguration = true;

      if (self.readHead !== null) {
        self.readHead.cancel();
        self.readHead = null;
      }

      self.device.close().then(function (x) {
        self.currentSioSetData = 0x0000;
        self.isOpen = false;
        self.isChangingConfiguration = false;
        self.device = null;

        if (callback) {
          callback();
        }
      })["catch"](function (e) {
        self.currentSioSetData = 0x0000;
        self.isOpen = false;
        self.isChangingConfiguration = false;
        self.device = null;
        self.emit('error', e);

        if (callback) {
          callback(e);
        }
      });
    } else {
      var _err3 = new Error("serial port is not open");

      self.emit('error', _err3);
      callback(_err3);
    }
  };

  WebFTDIUSBSerialPort.prototype.flush = function (callback) {
    if (callback) {
      callback();
    }
  };

  WebFTDIUSBSerialPort.prototype.drain = function (callback) {
    if (callback) {
      callback();
    }
  };

  function NativeUSBReadHead(device, host, debugLogger) {
    var self = this;
    self.host = host;
    self.device = device;
    self.cancelled = false;
    self.debugLogger = debugLogger;
  }

  NativeUSBReadHead.prototype.cancel = function () {
    var self = this;
    self.cancelled = true;
  };

  NativeUSBReadHead.prototype.readLoop = function () {
    var self = this;

    if (!self.cancelled) {
      self.device.transferIn(1, 64).then(function (result) {
        var arr = new Uint8Array(result.data.buffer);
        self.host.emit('data', arr);
        setTimeout(function () {
          self.readLoop();
        }, arr.length > 0 ? 0 : 5);
      }, function (error) {
        if (!self.cancelled) {
          self.debugLogger(error);
          self.host.emit('error', error);
        }
      })["catch"](function (e) {
        if (!self.cancelled) {
          self.debugLogger(e);
          self.host.emit('error', e);
        }
      });
    }
  };

  function WebNativeUSBSerialPort(params) {
    var self = this;

    if (typeof params !== "undefined" && params !== null && _typeof(params.device) === "object") {
      self.device = params.device;
    } else {
      throw new Error("Must specify a device");
    }

    if (typeof params !== "undefined" && params !== null && typeof params.debug === "boolean" && params.debug) {
      self.debugLog = function () {
        console.log.apply(this, arguments);
      };
    } else {
      self.debugLog = function () {};
    }

    self.isOpen = false;
    self.isChangingConfiguration = false;
    self.listeners = {};
    self.readHead = null;
  }

  WebNativeUSBSerialPort.prototype.emit = function (channel, data) {
    var self = this;

    if (_typeof(self.listeners[channel]) === "object") {
      for (var i = 0; i < self.listeners[channel].length; i++) {
        var listener = self.listeners[channel][i];

        if (typeof listener === "function") {
          listener(data);
        }
      }
    }
  };

  WebNativeUSBSerialPort.prototype.on = function (channel, listener) {
    var self = this;

    if (typeof listener === "function") {
      if (_typeof(self.listeners[channel]) !== "object") {
        self.listeners[channel] = [];
      }

      self.listeners[channel].push(listener);
    }
  };

  WebNativeUSBSerialPort.prototype.open = function (callback) {
    var self = this;

    if (self.isChangingConfiguration) {
      var err = new Error("already changing device configuration");
      self.emit('error', err);
      callback(err);
    } else if (!self.isOpen) {
      if (typeof self.device !== "undefined" && self.device !== null) {
        self.isChangingConfiguration = true;

        var handleError = function handleError(e) {
          self.debugLog(e);
          self.isOpen = false;
          self.isChangingConfiguration = false;
          self.emit('error', e);
          callback(e);
        };

        self.device.open().then(function () {
          return self.device.selectConfiguration(1);
        }).then(function () {
          return self.device.claimInterface(0);
        }).then(function (result) {
          // console.log(result);
          self.emit('open');
          self.isOpen = true;
          self.isChangingConfiguration = false;
          self.readHead = new NativeUSBReadHead(self.device, self, self.debugLog);
          self.readHead.readLoop();
          callback();
        })["catch"](function (reason) {
          console.log("unable to read");
          handleError(reason);
        });
      } else {
        var _err4 = new Error("no device");

        self.emit('error', _err4);
        callback(_err4);
      }
    } else {
      var _err5 = new Error("serial port already open");

      self.emit('error', _err5);
      callback(_err5);
    }
  };

  WebNativeUSBSerialPort.prototype.write = function (data, callback) {
    var self = this;
    self.device.transferOut(1, data).then(function (result) {
      if (callback) {
        callback(null);
      }
    })["catch"](function (error) {
      if (callback) {
        callback(error);
      }

      self.emit('error', error);
    });
  };

  WebNativeUSBSerialPort.prototype.close = function (callback) {
    var self = this;

    if (self.isChangingConfiguration) {
      var err = new Error("device configuration is currently changing");
      self.emit('error', err);
      callback(err);
    } else if (self.isOpen) {
      self.isChangingConfiguration = true;

      if (self.readHead !== null) {
        self.readHead.cancel();
        self.readHead = null;
      }

      self.device.releaseInterface(0).then(function () {
        return self.device.close();
      }).then(function (x) {
        self.isOpen = false;
        self.isChangingConfiguration = false;
        self.device = null;

        if (callback) {
          callback();
        }
      })["catch"](function (e) {
        self.isOpen = false;
        self.isChangingConfiguration = false;
        self.device = null;
        self.emit('error', e);

        if (callback) {
          callback(e);
        }
      });
    } else {
      var _err6 = new Error("serial port is not open");

      self.emit('error', _err6);
      callback(_err6);
    }
  };

  WebNativeUSBSerialPort.prototype.flush = function (callback) {
    if (callback) {
      callback();
    }
  };

  WebNativeUSBSerialPort.prototype.drain = function (callback) {
    if (callback) {
      callback();
    }
  }; // this repeats the code from the node serial communicator
  // so that we aren't stuck bringing in the serialport dependency


  function WebUSBSerialCommunicator(params) {
    var self = this;
    self.debugMode = false;

    if (typeof params !== "undefined" && params !== null && typeof params.debug === "boolean") {
      self.debugMode = params.debug;
    }

    if (typeof params !== "undefined" && params !== null && _typeof(params.device) === "object") {
      if (params.device.vendorId === FTDI_USB_VENDOR_ID && params.device.productId === FTDI_USB_PRODUCT_ID) {
        this.serial = new WebFTDIUSBSerialPort({
          device: params.device,
          debug: self.debugMode
        });
      } else if (params.device.vendorId === NATIVE_USB_VENDOR_ID && params.device.productId === NATIVE_USB_PRODUCT_ID) {
        this.serial = new WebNativeUSBSerialPort({
          device: params.device,
          debug: self.debugMode
        });
      } else {
        throw new Error("Device's vendor ID and product ID do not match a TappyUSB");
      }
    } else if (typeof params !== "undefined" && params !== null && _typeof(params.serial) === "object") {
      // this is just for testing and should not be used
      this.serial = params.serial;
    } else {
      throw new Error("Must specify a TappyUSB device");
    }

    this.isConnecting = false;
    this.hasAttached = false;
    this.disconnectImmediately = false;

    this.disconnectCb = function () {};

    this.dataReceivedCallback = function (bytes) {};

    this.errorCallback = function (data) {};

    this.readCallback = function (buff) {
      self.dataReceivedCallback(new Uint8Array(buff));
    };
  }

  WebUSBSerialCommunicator.DEFAULT_FILTERS = DEFAULT_FILTERS;
  WebUSBSerialCommunicator.prototype = {
    attachReadWrite: function attachReadWrite() {
      var self = this;

      if (!self.hasAttached) {
        self.hasAttached = true;
        self.serial.on('data', self.readCallback);
      }
    },
    connect: function connect(cb) {
      var self = this;

      if (!self.isConnecting && !self.isConnected()) {
        self.isConnecting = true;
        self.serial.open(function (err) {
          self.isConnecting = false;
          self.attachReadWrite();

          if (typeof cb === "function") {
            cb(err);
          }

          if (self.disconnectImmediately) {
            self.disconnectUnsafe();
          }
        });
      }
    },
    flush: function flush(cb) {
      var self = this;
      cb();
    },
    isConnected: function isConnected() {
      var self = this;
      return self.serial.isOpen;
    },
    disconnectUnsafe: function disconnectUnsafe() {
      var self = this;

      if (self.isConnecting) {
        throw "Connection still in the process of being established";
      }

      if (self.isConnected()) {
        self.serial.close(function (result) {
          if (typeof self.disconnectCb === "function") {
            self.disconnectCb(result);
          }
        });
      }
    },

    /**
     * This usage of disconnectImmediately may not be necessary depending on
     * how race conditions are handled in node serialport
     */
    disconnect: function disconnect(cb) {
      var self = this;
      self.disconnectImmediately = true;

      if (typeof cb === "function") {
        self.disconnectCb = cb;
      }

      if (!self.isConnecting && self.isConnected()) {
        self.disconnectUnsafe();
      }
    },
    send: function send(buffer) {
      var self = this;
      self.serial.write(buffer, function (err) {
        if (err) {
          if (typeof self.errorCallback === 'function') {
            var data = {
              buffer: buffer,
              nodeError: err
            };
            self.errorCallback(data);
          }
        }
      });
    },
    setDataCallback: function setDataCallback(cb) {
      var self = this;
      self.dataReceivedCallback = cb;
    },
    setErrorCallback: function setErrorCallback(cb) {
      var self = this;
      self.errorCallback = cb;
    }
  };
  return WebUSBSerialCommunicator;
});