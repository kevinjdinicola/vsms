var vsms = require('./vsms'),
		when = require('when'),
		readline   = require('readline');


//define a configuration object
var config = {
	phone      : '',
	deviceName : '',
	deviceId   : '',
	loginToken : '',
	uID        : ''
};




//say whats up
console.log("VSMS 0.0.1 Tester.\nThis will take you through the creation and destruction of an account of access messages");

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//super awesome when based terminal question asker
var whenQ = function(question) {
	var d = when.defer();
	rl.question(question, function(answer) {
		d.resolve(answer);
	});
	return d.promise;
};

//who cares what the device name is, just hard code it
config.deviceName = "VSMS Library Tester"
//dont ever use underscores in this deviceId, it breaks things.
config.deviceId   = "someid";

whenQ("Phone #: ")
	.then(function(phone) {
		//Step 1: get the phone number and send a pin
		config.phone = phone;
		console.log("Generating pin...");
		return vsms.webAuth.generatePin(config.phone,config.deviceName );
	})
	.then(function() {
		//Step 2: wait for the pin
		return whenQ("Pin: ");
	})
	.then(function(pin) {
		//Step 3: Send the pin and get the login token
		console.log("Pin accepted!");
		console.log("Generating login token...");
		return vsms.webAuth.loginPinToken(config.phone,pin,config.deviceId);
	})
	.then(function(results) {
		//Step 4: Save the login token, do a vma_user_query to check if
		//this user is provisioned to have vma access
		config.loginToken = results.loginToken;
		console.log("Received login token!");
		console.log("Running vma_user_query...");
		return vsms.webAuth.vma_user_query(config.phone, config.loginToken);
	})
	.then(null, function(response) {
		//Step 4b: User wasn't provisioned, provision and continue
		if (response == "NO") {
		console.log("Account wasn't provisioned!")
		console.log("Attempting to provision account...")
			return vsms.webAuth.vmaProvisioning(config.phone, config.loginToken);
		}
	})
	.then(function() {
		//Step 5: Now lets push this id?  Dunno why...
		console.log("Success!");
		console.log("Pushing Id...");
		return vsms.webAuth.pushId(config.phone, config.loginToken);
	})
	.then(function(results) {
		//Step 6: Save whatever this uID is, it could be useful?  Now verify it
		config.uID = results.uID;

		console.log("Success!");
		console.log("Verifying phone#/loginToken is valid...")
		return vsms.webAuth.assistantQuery(config.phone, config.loginToken);
	})
	.then(function() {
		//Step 7: The account created was verified, here's the config options for it.
		console.log("Successfully authorized!");
		console.log(config);
	})
	.then(function() {
		//Step 8: Should i delete it since this is just a demo?
		return whenQ("Would you like to keep this new account? y/n: ")
	})
	.then(function(response) {
		//Step 8b: yeah, delete it
		if (response == "y") {
			return when.resolve();			
		} else {
			console.log("Deleting account...");
			return vsms.webAuth.removeDevice(config.phone, config.loginToken, config.deviceId);
		}
	})
	.then(function() {
		//End!
		console.log("Demonstration complete.");
		rl.close();
	}, function(data) {
		console.log("Error",data);
	});

