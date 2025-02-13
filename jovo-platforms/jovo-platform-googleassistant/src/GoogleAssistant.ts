import _set = require('lodash.set');
import _get = require('lodash.get');
import _merge = require('lodash.merge');
import {
	ActionSet,
	BaseApp,
	Extensible,
	ExtensibleConfig,
	HandleRequest,
	Jovo,
	Platform,
	TestSuite
} from 'jovo-core';

import { GoogleAction } from './core/GoogleAction';
import { GoogleAssistantCore } from './modules/GoogleAssistantCore';
import { Cards } from './modules/Cards';
import { AskFor } from './modules/AskFor';
import { UpdatesPlugin } from './modules/Updates';
import { MediaResponsePlugin } from './modules/MediaResponse';
import { GoogleAssistantRequestBuilder } from './core/GoogleAssistantRequestBuilder';
import { GoogleAssistantResponseBuilder } from './core/GoogleAssistantResponseBuilder';
import { GoogleAssistantTestSuite } from './core/Interfaces';

import { TransactionsPlugin } from './modules/Transaction';
import { DialogflowPlugin } from 'jovo-platform-dialogflow';
import { GoogleAssistantDialogflowFactory } from './dialogflow/GoogleAssistantDialogflowFactory';
import { InteractiveCanvas } from './modules/InteractiveCanvas';
import { NewSurface } from './modules/NewSurface';

export interface Config extends ExtensibleConfig {
	handlers?: any; //tslint:disable-line

	transactions?: {
		androidPackageName?: string;
		keyFile?: object;
	};
}

export class GoogleAssistant extends Extensible implements Platform {
    config: Config = {
        enabled: true,
        plugin: {},

    };

    requestBuilder = new GoogleAssistantRequestBuilder();
    responseBuilder = new GoogleAssistantResponseBuilder();

    constructor(config?: Config) {
        super(config);

        if (config) {
            this.config = _merge(this.config, config);
        }

        this.actionSet = new ActionSet([
            '$init',
            '$request',
            '$session',
            '$user',
            '$type',
            '$nlu',
            '$inputs',
            '$output',
            '$response'
        ], this);

    }

    getAppType(): string {
        return 'GoogleAction';
    }


    install(app: BaseApp) {

        app.$platform.set(this.constructor.name, this);
        app.middleware('platform.init')!.use(this.initialize.bind(this));
        app.middleware('platform.nlu')!.use(this.nlu.bind(this));
        app.middleware('platform.output')!.use(this.output.bind(this));
        app.middleware('response')!.use(this.response.bind(this));
        this.use(
            new GoogleAssistantCore(),
            new Cards(),
            new AskFor(),
            new MediaResponsePlugin(),
            new UpdatesPlugin(),
            new TransactionsPlugin(),
            new InteractiveCanvas(),
            new NewSurface()
        );

        Jovo.prototype.$googleAction = undefined;

        /**
         * Returns googleAction instance
         * @returns {GoogleAction}
         */
        Jovo.prototype.googleAction = function() {
            if (this.constructor.name !== 'GoogleAction') {
                throw Error(`Can't handle request. Please use this.isGoogleAction()`);
            }
            return this as GoogleAction;
        };

        /**
         * Type of platform is Google Action
         * @public
         * @return {boolean} isGoogleAction
         */
        Jovo.prototype.isGoogleAction = function() {
            return this.constructor.name === 'GoogleAction';
        };

        /**
         * Sets alexa handlers
         * @public
         * @param {*} handler
         */
        BaseApp.prototype.setGoogleAssistantHandler = function(...handlers: any[]) { // tslint:disable-line
            for (const obj of handlers) { // eslint-disable-line
                if (typeof obj !== 'object') {
                    throw new Error('Handler must be of type object.');
                }
               const sourceHandler = _get(this.config.plugin,'GoogleAssistant.handlers');
               _set(this.config.plugin, 'GoogleAssistant.handlers', _merge(sourceHandler,obj));
            }
            return this;
        };

        this.initDialogflow();

    }

    makeTestSuite(): GoogleAssistantTestSuite {
        this.remove('DialogflowPlugin');
        this.initDialogflow();
        return new TestSuite(this.requestBuilder, this.responseBuilder);
    }

    initDialogflow() {
        this.use(
            new DialogflowPlugin(
                {},
                new GoogleAssistantDialogflowFactory()
            )
        );
    }

    async initialize(handleRequest: HandleRequest) {
        await this.middleware('$init')!.run(handleRequest);


        if (!handleRequest.jovo || handleRequest.jovo.constructor.name !== 'GoogleAction') {
            return Promise.resolve();
        }

        await this.middleware('$request')!.run(handleRequest.jovo);


        await this.middleware('$type')!.run(handleRequest.jovo);

        await this.middleware('$session')!.run(handleRequest.jovo);
        if (this.config.handlers) {
            _set(handleRequest.app, 'config.handlers', _merge(_get(handleRequest.app, 'config.handlers'), this.config.handlers));
        }
    }

    async nlu(handleRequest: HandleRequest) {
        if (!handleRequest.jovo || handleRequest.jovo.constructor.name !== 'GoogleAction') {
            return Promise.resolve();
        }

        await this.middleware('$nlu')!.run(handleRequest.jovo);
        await this.middleware('$inputs')!.run(handleRequest.jovo);
    }

    async output(handleRequest: HandleRequest) {
        if (!handleRequest.jovo || handleRequest.jovo.constructor.name !== 'GoogleAction') {
            return Promise.resolve();
        }
        await this.middleware('$output')!.run(handleRequest.jovo);
    }

    async response(handleRequest: HandleRequest) {
        if (!handleRequest.jovo || handleRequest.jovo.constructor.name !== 'GoogleAction') {
            return Promise.resolve();
        }
        await this.middleware('$response')!.run(handleRequest.jovo);

        handleRequest.jovo.$response = handleRequest.jovo.$rawResponseJson ?
            this.responseBuilder.create(handleRequest.jovo.$rawResponseJson) : handleRequest.jovo.$response;
        await handleRequest.host.setResponse(handleRequest.jovo.$response);
    }

    uninstall(app: BaseApp) {

    }
}
