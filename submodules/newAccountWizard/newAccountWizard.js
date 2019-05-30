define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var newAccountWizard = {

		requests: {
		},

		subscribe: {
			'accounts.newAccountWizard.render': 'newAccountWizardRender'
		},

		appFlags: {
			newAccountWizard: {
			}
		},

		/**
		 * Renders the trunking limits view
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the new account wizard
		 * @param  {String} args.parentAccountId  Parent Account ID
		 */
		newAccountWizardRender: function(args) {
			var self = this,
				$container = args.container,
				parentAccountId = args.parentAccountId,
				i18n = self.i18n.active().newAccountWizardRender,
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
						template: 'newAccountWizardGeneralSettingsRender',
						util: 'newAccountWizardGeneralSettingsUtil'
					},
					{
						label: i18nSteps.accountContacts.label,
						description: i18nSteps.accountContacts.description,
						template: 'newAccountWizardAccountContactsRender',
						util: 'newAccountWizardAccountContactsUtil'
					},
					{
						label: i18nSteps.servicePlan.label,
						description: i18nSteps.servicePlan.description,
						template: 'newAccountWizardServicePlanRender',
						util: 'newAccountWizardServicePlanUtil'
					},
					{
						label: i18nSteps.usageAndCallRestrictions.label,
						description: i18nSteps.usageAndCallRestrictions.description,
						template: 'newAccountWizardUsageAndCallRestrictionsRender',
						util: 'newAccountWizardUsageAndCallRestrictionsUtil'
					},
					{
						label: i18nSteps.creditBalanceAndFeatures.label,
						description: i18nSteps.creditBalanceAndFeatures.description,
						template: 'newAccountWizardCreditBalanceAndFeaturesRender',
						util: 'newAccountWizardCreditBalanceAndFeaturesUtil'
					},
					{
						label: i18nSteps.appRestrictions.label,
						description: i18nSteps.appRestrictions.description,
						template: 'newAccountWizardAppRestrictionsRender',
						util: 'newAccountWizardAppRestrictionsUtil'
					},
					{
						label: i18nSteps.review.label,
						description: i18nSteps.review.description,
						template: 'newAccountWizardReviewRender',
						util: 'newAccountWizardReviewUtil'
					}
				],
				title: i18n.title,
				cancel: 'newAccountWizardClose',
				done: 'newAccountWizardClose',
				doneButton: i18n.doneButton
			});
		},

		newAccountWizardGeneralSettingsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardGeneralSettingsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardAccountContactsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardAccountContactsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardServicePlanRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardServicePlanUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardUsageAndCallRestrictionsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardUsageAndCallRestrictionsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardCreditBalanceAndFeaturesRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardCreditBalanceAndFeaturesUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardAppRestrictionsRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardAppRestrictionsUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardReviewRender: function(args) {
			var self = this,
				$container = args.container;

			// TODO: Not implemented
		},

		newAccountWizardReviewUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		newAccountWizardClose: function(args) {
			var self = this,
				$container = args.container,
				parentAccountId = args.parentAccountId;

			monster.pub('accountsManager.activate', {
				container: $container,
				parentId: parentAccountId
			});
		}
	};

	return newAccountWizard;
});
