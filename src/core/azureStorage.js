var service = {};

function executeAzureCliCmd(cmd, onDataCallback) {
	return new Promise(function(resolve, reject) {
		var path = require('path');
		var cmdRoot = path.join(__dirname, 'node_modules', 'azure-cli', 'bin', 'azure.js');
		var cmdArray = cmd.split(' ');

		const spawn = require('child_process').spawn;
		const azureCliCmd = spawn('node', [cmdRoot].concat(cmdArray));

		azureCliCmd.stdout.on('data', function(data) {
			if (!!onDataCallback) {
				onDataCallback(data.toString('utf8'));
			}
		});

		azureCliCmd.stderr.on('data', function(data) {
			// console.error(cmd);
			// console.error(data.toString('utf8'));
			reject(data.toString('utf8'));
		});

		azureCliCmd.on('close', function(code) {
			resolve(code);
		});
	});
}

service.context = {};

service.context.authenticate = function() {
	return new Promise(function(resolve, reject) {
		return executeAzureCliCmd('login', function(data) {
			var re = /code (\w{9}\1) to authenticate/ig;
			var res = re.exec(data);
			if (res != null) {
				console.log('code: ' + res[1]);
				return;
			}
		}).then(function() {
			resolve();
		});
	});
};

service.context.getEnabledSubscriptions = function () {
	return new Promise(function(resolve, reject) {
		var subscriptions = [];

		return executeAzureCliCmd('account list --json', function(data) {
			subscriptions.push(data);
		}).then(function() {
			subscriptions = JSON
				.parse(subscriptions.join(''))
				.filter(function(item) {
					return item.state == 'Enabled';
				});
			resolve(subscriptions);
		});
	});
};

service.context.getStorageAccountsBySubscriptionId = function(subscriptionId, mode) {
	return new Promise(function(resolve, reject){
		var storageAccounts = [];

		executeAzureCliCmd('account set ' + subscriptionId)
			.then(function () {
				return executeAzureCliCmd('config set mode ' + mode);
			})
			.then(function() {
				return executeAzureCliCmd('storage account list --json', function(data) {
					storageAccounts.push(data);
				})
			}).then(function () {
				storageAccounts = JSON
					.parse(storageAccounts.join(''))
					.map(function (item) {
						item.mode = mode;
						return item;
					});

				resolve(storageAccounts);
			}, function () {
				// 1. DreamSpark subscriptions do not have Azure Storage
				// 2. ASM mode can fail if access was granted only for resource group
				resolve([]);
			});
	});
};

service.context.authenticate()
	.then(function () {
		return service.context.getEnabledSubscriptions();
	})
	.then(function (subscriptions) {
		var storageAccounts = [];

		enumerateSubscriptions(subscriptions, 0, function (subscription) {
			return new Promise(function (resolve, reject) {
				service.context.getStorageAccountsBySubscriptionId(subscription.id, 'arm')
					.then(function (accounts) {
						storageAccounts = storageAccounts.concat(accounts.map(function (item) {
							item.subscription = subscription;
							return item;
						}));
						return service.context.getStorageAccountsBySubscriptionId(subscription.id, 'asm');
					})
					.then(function (accounts) {
						storageAccounts = storageAccounts.concat(accounts.map(function (item) {
							item.subscription = subscription;
							return item;
						}));
						resolve();
					})
			});
		}).then(function () {
			for (var i = 0; i < storageAccounts.length; i++) {
				console.log(storageAccounts[i].name + ' at ' + storageAccounts[i].subscription.name);
			}
		})
	});

function enumerateSubscriptions(subscriptions, index, subscriptionPromise) {
	return new Promise(function (resolve, reject) {
		if (index >= subscriptions.length) {
			resolve();
		} else {
			subscriptionPromise(subscriptions[index])
				.then(function () {
					return enumerateSubscriptions(subscriptions, index + 1, subscriptionPromise);
				})
				.then(function () {
					resolve();
				});
		}
	});
}

module.exports = service;