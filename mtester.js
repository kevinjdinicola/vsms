var vsms   = require("./vsms");
		config = require("./phoneConfig.json")

var Messenger = vsms.messenger;

var iphone = new Messenger(config);

iphone.on('explode', function() {
	console.log('holy shit!');
});
iphone.login();