var vsms   = require("./vsms"),
		config = require("./phoneConfig.json"),
		when   = require('when'),
		readline   = require('readline');

var Messenger = vsms.messenger;

var iphone = new Messenger(config);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


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
	.then(function(convos) {
		var firstConvo = convos[0];

		return iphone.listMessages(firstConvo.phone,firstConvo.latestMessageUid)
	}).then(function(response) {
		var msg = response[0];
		console.log(msg);
		return iphone.fetchMessage(msg.messageUid);
	}).then(function(msg) {
		console.log(msg.getRawData());
	})