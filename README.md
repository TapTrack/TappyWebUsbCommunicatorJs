Communicator for accessing a Tappy over WebUSB. This communicator
supports the current FTDI USB serial-based Tappies and 
also provides experimental support for next-generation Native USB
Tappies. 

## Installation
NPM
```
npm install @taptrack/tappy-webusbcommunicator
```

## Usage
Note that this communicator is not intended to be used directly, rather
it is to be used to back a Tappy object in order to provide an 
abstraction from the underlying communication method.

```javascript
var WebUSBCommuncatpr = require("@taptrack/tappy-webusbcommunicator");
var Tappy = require("@taptrack/tappy");
var SystemFamily = require("@taptrack/tappy-systemfamily");

/**
 * First, we have to scan for the Tappy, see
 * the WebUSB documentation for more information
 */
navigator.usb.requestDevice({filters: WebUSBSerialCommunicator.DEFAULT_FILTERS })
.then((device) => {
    connectToTappy(device);
    console.log('Device handled successfully');
})
.catch(function(err){
    console.log('Error caught in WebUsbSerialPort');
});


function connectToTappy(peripheral) {
    var comm = new WebUSBSerialCommuncator({device: device});
    var tappy = new Tappy({communicator: comm});

    tappy.setMessageListener(function(msg) {
        console.log("Received Message:");
        console.log("Command Family: "+msg.getCommandFamily());
        console.log("Command Code: "+msg.getCommandCode().toString());
        console.log("Payload: "+msg.getPayload().toString()+"\n");
    });

    tappy.connect(function() {
        var cmd = new SystemFamily.Commands.Ping();
        tappy.sendMessage(cmd);
    });
}
```

# Note
For Tappies using the FTDI USB adapter, it will be necessary to unload the FTDI
drivers to make use of this communicator on both the Windows and Linux platforms.
