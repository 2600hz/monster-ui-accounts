define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

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
				$container = _.get(args, 'container', $('#monster_content')),
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
				data = args.data,
				$container = args.container,
				adminUserCounters = {
					index: 0,
					correlative: 1
				},
				initTemplate = function() {
					var $template = $(self.getTemplate({
						name: 'step-generalSettings',
						data: {
							data: _.get(data, 'generalSettings', {})
						},
						submodule: 'wizard'
					}));

					timezone.populateDropdown($template.find('#accountInfo\\.timezone'), monster.apps.auth.currentAccount.timezone);
					monster.ui.chosen($template.find('#accountInfo\\.timezone'));

					monster.ui.tooltips($template);

					// Append admin users
					_.chain(data)
						.get('generalSettings.accountAdmins', [])
						.each(function(admin) {
							self.wizardGeneralSettingsAddAdminUser({
								adminUserList: $template.find('.admin-user-list'),
								counters: adminUserCounters,
								data: admin
							});
						})
						.value();

					self.wizardGeneralSettingsBindEvents({
						admiUserCounters: adminUserCounters,
						template: $template
					});

					// Set static validations
					monster.ui.validate($template.find('form'), {
						rules: {
							'accountInfo.accountRealm': {
								realm: true
							}
						}
					});

					return $template;
				};

			console.log(args.data);

			monster.ui.insertTemplate($container.find('.right-content'), function(insertTemplateCallback) {
				insertTemplateCallback(initTemplate(), self.wizardScrollToTop);
			});
		},

		wizardGeneralSettingsAddAdminUser: function(args) {
			var self = this,
				animate = _.get(args, 'animate', false),
				counters = args.counters,
				data = args.data,
				$adminUserList = args.adminUserList,
				$adminItemTemplate = $(self.getTemplate({
					name: 'adminForm',
					data: _.merge({
						data: data
					}, counters),
					submodule: 'wizard'
				})),
				updateUserCorrelatives = function() {
					$adminUserList
						.find('.admin-user-correlative')
							.each(function(idx, el) {
								$(el).text(idx + 1);
							});
				};

			console.log(counters);

			counters.correlative += 1;
			counters.index += 1;

			$adminItemTemplate.find('.admin-user-remove').on('click', function(e) {
				e.preventDefault();

				$adminItemTemplate
					.addClass('remove')
					.slideUp(500, function() {
						$adminItemTemplate.remove();
						updateUserCorrelatives();
					});

				// Notice that the index is not decremented, because its sole purpose is to
				// guarantee a unique and ordered index of the rows, to allow the admin users
				// to be sorted in the same way as they are displayed in the editor when the
				// values are retrieved as an array via monster.ui.getFormData()
				counters.correlative -= 1;
			});

			if (animate) {
				$adminItemTemplate
					.css({ display: 'none' })
					.appendTo($adminUserList)
					.slideDown(500);
			} else {
				$adminItemTemplate.appendTo($adminUserList);
			}
		},

		wizardGeneralSettingsBindEvents: function(args) {
			var self = this,
				$template = args.template,
				counters = args.admiUserCounters;

			$template.find('.admin-user-add').on('click', function(e) {
				e.preventDefault();

				self.wizardGeneralSettingsAddAdminUser({
					adminUserList: $template.find('.admin-user-list'),
					animate: true,
					counters: counters,
					data: {
						password: monster.util.randomString(8, 'safe')
					}
				});
			});
		},

		wizardGeneralSettingsUtil: function($template) {
			var self = this,
				$form = $template.find('form');

			// Set dynamic validations
			$form.find('.admin-user-item input[type="password"]').each(function() {
				$(this).rules('add', {
					minlength: 6
				});
			});

			return {
				valid: monster.ui.valid($form),
				data: {
					generalSettings: monster.ui.getFormData($form.get(0))
				}
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
		},

		/* Utility functions */
		wizardScrollToTop: function() {
			window.scrollTo(0, 0);
		}
	};

	return wizard;
});
