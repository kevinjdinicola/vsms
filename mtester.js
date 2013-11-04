var vsms   = require("./vsms");
		config = require("./phoneConfig.json")

var Messenger = vsms.messenger;

var iphone = new Messenger(config);

iphone.login()
	.then(function() {
		console.log("logged in!");
	}, function(error) {
		console.log("failed",error);
	})
	.then(function() {
		console.log("selecting inbox...");
		return iphone.select('INBOX');
	})
	.then(function() {
		console.log("listing conversations...");
		return iphone.listConversations();
	})