define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var wizard = {

		requests: {
		},

		subscribe: {
			'accounts.wizard.render': 'wizardRender'
		},

		shortcuts: {
			'a': 'accounts.wizard.render'
		},

		/**
		 * Renders the trunking limits view
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the new account wizard
		 * @param  {String} args.parentAccountId  Parent Account ID
		 */
		wizardRender: function(args) {
			var self = this,
				$container = args.container,
				parentAccountId = args.parentAccountId,
				i18n = self.i18n.active().accountsApp.wizard,
				i18nSteps = i18n.steps;

			monster.pub('common.navigationWizard.render', {
				thisArg: self,
				data: {
					parentAccountId: parentAccountId
				},
				container: $container,
				steps: [
					{
						label: i18nSteps.generalSettings.label,
						description: i18nSteps.generalSettings.description,
						template: 'wizardGeneralSettingsRender',
						util: 'wizardGeneralSettingsUtil'
					},
					{
						label: i18nSteps.accountContacts.label,
						description: i18nSteps.accountContacts.description,
						template: 'wizardAccountContactsRender',
						util: 'wizardAccountContactsUtil'
					},
					{
						label: i18nSteps.servicePlan.label,
						description: i18nSteps.servicePlan.description,
						template: 'wizardServicePlanRender',
						util: 'wizardServicePlanUtil'
					},
					{
						label: i18nSteps.usageAndCallRestrictions.label,
						description: i18nSteps.usageAndCallRestrictions.description,
						template: 'wizardUsageAndCallRestrictionsRender',
						util: 'wizardUsageAndCallRestrictionsUtil'
					},
					{
						label: i18nSteps.creditBalanceAndFeatures.label,
						description: i18nSteps.creditBalanceAndFeatures.description,
						template: 'wizardCreditBalanceAndFeaturesRender',
						util: 'wizardCreditBalanceAndFeaturesUtil'
					},
					{
						label: i18nSteps.appRestrictions.label,
						description: i18nSteps.appRestrictions.description,
						template: 'wizardAppRestrictionsRender',
						util: 'wizardAppRestrictionsUtil'
					},
					{
						label: i18nSteps.review.label,
						description: i18nSteps.review.description,
						template: 'wizardReviewRender',
						util: 'wizardReviewUtil'
					}
				],
				title: i18n.title,
				cancel: 'wizardClose',
				done: 'wizardClose',
				doneButton: i18n.doneButton
			});
		},

		wizardGeneralSettingsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardGeneralSettingsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardAccountContactsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardAccountContactsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardServicePlanRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardServicePlanUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardUsageAndCallRestrictionsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardUsageAndCallRestrictionsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardCreditBalanceAndFeaturesRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardCreditBalanceAndFeaturesUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardAppRestrictionsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardAppRestrictionsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardReviewRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		wizardReviewUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		wizardClose: function(args) {
			var self = this,
				$container = args.container,
				parentAccountId = args.parentAccountId;

			monster.pub('accountsManager.activate', {
				container: $container,
				parentId: parentAccountId
			});
		}
	};

	return wizard;
});
