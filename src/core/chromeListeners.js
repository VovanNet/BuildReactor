import Rx from 'rx';
import chromeApi from 'common/chromeApi';
import events from 'core/events';
import logger from 'core/logger';
import serviceConfiguration from 'core/config/serviceConfiguration';
import serviceTypes from 'core/services/serviceTypes';
import viewConfiguration from 'core/config/viewConfiguration';

const stateUpdated = new Rx.BehaviorSubject([]);

const onMessage = (request, sender, sendResponse) => {
		try {
			return onMessageHandler(request, sender, sendResponse);
		} catch (ex) {
			logger.messages.onNext({
				name: 'error',
				errorType: ex.name,
				message: ex.message,
				stack: ex.stack
			});
		}
		return false;
};

function onMessageHandler(request, sender, sendResponse) {
	switch (request.name) {
	case 'availableServices':
		availableServices(sendResponse);
		break;
	case 'availableProjects':
		availableProjects(sendResponse, request.serviceSettings);
		return true;
	case 'setOrder':
		serviceConfiguration.setOrder(request.order);
		break;
	case 'setBuildOrder':
		serviceConfiguration.setBuildOrder(request.serviceName, request.order);
		break;
	case 'enableService':
		serviceConfiguration.enableService(request.serviceName);
		break;
	case 'disableService':
		serviceConfiguration.disableService(request.serviceName);
		break;
	case 'removeService':
		serviceConfiguration.removeService(request.serviceName);
		break;
	case 'renameService':
		serviceConfiguration.renameService(request.oldName, request.newName);
		break;
	case 'saveService':
		serviceConfiguration.saveService(request.settings);
		break;
	case 'saveConfig':
		serviceConfiguration.save(request.config);
		break;
	case 'setViews':
		viewConfiguration.save(request.views);
		break;
	default:
		break;
	}
	return false;
}

const availableServices = (sendResponse) => {
	const types = serviceTypes.getAll();
	const settingList = Object.keys(types).map((k) => types[k]).map((t) => t.settings());
	return sendResponse(settingList);
};

const availableProjects = (sendResponse, settings) => {
	const Service = serviceTypes.getAll()[settings.baseUrl];
	new Service(settings).availableBuilds().subscribe(function(projects) {
		projects.selected = settings.projects;
		sendResponse({ projects });
	}, function(error) {
		sendResponse({ error });
	});
};

const onConnect = (port) => {
	switch (port.name) {
	case 'state':
		var stateSubscription = stateUpdated.subscribe((state) => {
			port.postMessage(state.details);
		});
		port.onDisconnect.addListener(() => {
			stateSubscription.dispose();
		});
		break;
	case 'configuration':
		var configSubscription = serviceConfiguration.changes.subscribe(function(config) {
			port.postMessage(config);
		});
		port.onDisconnect.addListener(function(port) {
			configSubscription.dispose();
		});
		break;
	case 'views':
		var viewSubscription = viewConfiguration.changes.subscribe(function(config) {
			port.postMessage(config);
		});
		port.onDisconnect.addListener(function(port) {
			viewSubscription.dispose();
		});
		break;
	case 'logs':
		var logsSubscription = logger.messages.subscribe((message) => {
			port.postMessage(message);
		});
		port.onDisconnect.addListener((port) => {
			logsSubscription.dispose();
		});
		break;
	}
};

export default {
	init() {
		chromeApi.addConnectListener(onConnect);
		chromeApi.addMessageListener(onMessage);
		events.getByName('stateUpdated').subscribe(stateUpdated);
	}
};
