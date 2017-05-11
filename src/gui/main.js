var electron = require('electron');

var app = electron.app;
var BrowserWindow = electron.BrowserWindow;

var mainWindow;

var options = {
	debug: false
};

process.argv.forEach(function(val) {
	console.log(val);
	if (val == '--debug') {
		options.debug = true;
	}
});

app.on('window-all-closed', function() {
    if (process.platform != 'darwin') {
        app.quit();
    }
});

app.on('ready', function() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600
    });

    if (!options.debug) {
	    mainWindow.setMenu(null);
    }

    mainWindow.loadURL('file://' + __dirname + '/main.html');

    mainWindow.on('closed', function() {
        mainWindow = null;
    });
});