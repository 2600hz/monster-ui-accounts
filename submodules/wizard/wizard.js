define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		moment = require('moment'),
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
		 * Renders the new account wizard
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the new account wizard
		 * @param  {String} args.parentAccountId  Parent Account ID
		 */
		wizardRender: function(args) {
			var self = this,
				$container = _.get(args, 'container', $('#monster_content')),
				parentAccountId = args.parentAccountId,
				i18n = self.i18n.active().accountsApp.wizard,
				i18nSteps = i18n.steps,
				defaultLanguage = _.get(monster, 'config.whitelabel.language', monster.defaultLanguage),
				isoFormattedDefaultLanguage = defaultLanguage.substr(0, 3).concat(defaultLanguage.substr(defaultLanguage.length - 2, 2).toUpperCase());

			monster.pub('common.navigationWizard.render', {
				thisArg: self,
				data: {
					parentAccountId: parentAccountId,
					// General Settings defaults
					generalSettings: {
						accountInfo: {
							language: isoFormattedDefaultLanguage,
							timezone: monster.apps.auth.currentAccount.timezone
						}
					}
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

		/* GENERAL SETTINGS STEP */

		/**
		 * Render General Settings step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardGeneralSettingsRender: function(args) {
			var self = this,
				data = args.data,
				$container = args.container,
				adminUserCounters = {
					index: 0,
					correlative: 1
				},
				generalSettingsData = data.generalSettings,
				initTemplate = function() {
					var $template = $(self.getTemplate({
						name: 'step-generalSettings',
						data: {
							data: generalSettingsData
						},
						submodule: 'wizard'
					}));

					timezone.populateDropdown($template.find('#accountInfo\\.timezone'), generalSettingsData.accountInfo.timezone);
					monster.ui.chosen($template.find('#accountInfo\\.timezone'));

					monster.ui.tooltips($template);

					// Append admin users
					_.chain(data)
						.get('generalSettings.accountAdmins', [])
						.each(function(admin) {
							self.wizardGeneralSettingsAddAdminUser({
								listContainer: $template.find('.admin-user-list'),
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

			self.wizardRenderStep({
				container: $container,
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to validate General Settings form and extract data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardGeneralSettingsUtil: function($template, args) {
			var self = this,
				$form = $template.find('form'),
				isValid = false;

			// Set dynamic validations
			$form.find('.admin-user-item input[type="password"]').each(function() {
				$(this).rules('add', {
					minlength: 6
				});
			});

			isValid = monster.ui.valid($form);

			if (isValid) {
				// Clean generalSettings previous data, to avoid merging the array of admin
				// users, due to the way that `lodash#merge` handles array merging, which consists
				// in combining the contents of the object and source arrays. This causes to keep
				// deleted admin users, because they are present in the old data.
				delete args.data.generalSettings;
			}

			return {
				valid: isValid,
				data: {
					generalSettings: monster.ui.getFormData($form.get(0))
				}
			};
		},

		/**
		 * Bind General Settings step events
		 * @param  {Object} args
		 * @param  {jQuery} args.template  Step template
		 * @param  {Object} args.adminUserCounters  Counter values to track admin users
		 * @param  {Number} args.adminUserCounters.correlative  Next admin user correlative
		 * @param  {Number} args.adminUserCounters.index  Next admin user index
		 */
		wizardGeneralSettingsBindEvents: function(args) {
			var self = this,
				$template = args.template,
				counters = args.admiUserCounters;

			$template.find('.admin-user-add').on('click', function(e) {
				e.preventDefault();

				self.wizardGeneralSettingsAddAdminUser({
					listContainer: $template.find('.admin-user-list'),
					animate: true,
					counters: counters,
					data: {
						password: monster.util.randomString(8, 'safe')
					}
				});
			});
		},

		/**
		 * Add an user to the list of admin users
		 * @param  {Object} args
		 * @param  {Boolean} args.animate  Display the new admin user with a slideDown effect
		 * @param  {Object} args.counters  Counter values to track admin users
		 * @param  {Number} args.counters.correlative  Next admin user correlative
		 * @param  {Number} args.counters.index  Next admin user index
		 * @param  {Object} args.data  Admin user data
		 * @param  {jQuery} args.listContainer  Admin user list container
		 */
		wizardGeneralSettingsAddAdminUser: function(args) {
			var self = this,
				animate = _.get(args, 'animate', false),
				counters = args.counters,
				data = args.data,
				listContainer = args.listContainer,
				$adminItemTemplate = $(self.getTemplate({
					name: 'adminForm',
					data: _.merge({
						data: data
					}, counters),
					submodule: 'wizard'
				}));

			counters.correlative += 1;
			counters.index += 1;

			$adminItemTemplate.find('.admin-user-remove').on('click', function(e) {
				e.preventDefault();

				$adminItemTemplate
					.addClass('remove')
					.slideUp(500, function() {
						$adminItemTemplate.remove();

						// Update view correlatives
						listContainer
							.find('.admin-user-correlative')
								.each(function(idx, el) {
									$(el).text(idx + 1);
								});
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
					.appendTo(listContainer)
					.slideDown(500);
			} else {
				$adminItemTemplate.appendTo(listContainer);
			}
		},

		/* ACCOUNT CONTACTS STEP */

		/**
		 * Render Account Contacts step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardAccountContactsRender: function(args) {
			var self = this,
				data = args.data,
				$container = args.container,
				getFormattedData = function() {
					return _.cloneDeepWith(data.accountContacts, function(value, key) {
						if (key === 'phoneNumber' && _.isPlainObject(value)) {
							return value.originalNumber;
						}
					});
				},
				initTemplate = function(userList) {
					var formattedData = getFormattedData(),
						$template = $(self.getTemplate({
							name: 'step-accountContacts',
							data: {
								data: formattedData,
								users: userList
							},
							submodule: 'wizard'
						})),
						$contractEndDatepicker = monster.ui.datepicker($template.find('#salesRep\\.contractEndDate'), {
							minDate: moment().toDate()
						});

					if (_.has(formattedData, 'salesRep.contractEndDate')) {
						$contractEndDatepicker.datepicker('setDate', formattedData.salesRep.contractEndDate);
					}

					monster.ui.chosen($template.find('#salesRep\\.representative'));

					$template.find('input[data-mask]').each(function() {
						var $this = $(this);
						monster.ui.mask($this, $this.data('mask'));
					});

					monster.ui.tooltips($template);

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					self.wizardRequestUserList({
						success: function(userList) {
							asyncCallback(null, userList);
						},
						error: function() {
							asyncCallback(null, []);
						}
					});
				},
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to validate Account Contacts form and extract data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardAccountContactsUtil: function($template, args) {
			var self = this,
				$form = $template.find('form'),
				validateForm = monster.ui.validate($template.find('form')),
				isValid = monster.ui.valid($form),
				data = {},
				errors = {};

			// Extract and store date(s)
			$form.find('input.hasDatePicker').each(function() {
				var $this = $(this);

				_.set(data, $this.attr('name'), $this.datepicker('getDate'));
			});

			// Validate and extract phone numbers
			$form.find('input.phone-number').each(function() {
				var $this = $(this),
					fieldName = $this.attr('name'),
					number = $this.val(),
					formattedNumber = monster.util.getFormatPhoneNumber(number);

				if (_.has(formattedNumber, 'e164Number')) {
					_.set(data, fieldName, formattedNumber);
				} else {
					errors[fieldName] = self.i18n.active().accountsApp.wizard.steps.general.phoneNumber.invalid;
				}
			});

			if (!_.isEmpty(errors)) {
				isValid = false;
				validateForm.showErrors(errors);
			}

			data = _.merge(monster.ui.getFormData($form.get(0)), data);

			if (isValid) {
				// Clean accountContacts previous data
				delete args.data.accountContacts;
			}

			return {
				valid: isValid,
				data: {
					accountContacts: data
				}
			};
		},

		/* SERVICE PLAN STEP */

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

		/* API REQUESTS */

		/**
		 * Request the list of users for the current account
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardRequestUserList: function(args) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		},

		/* UTILITY FUNCTIONS */

		/**
		 * Render a step view
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Wizard container element
		 * @param  {Function}  [args.loadData]  Optional load callback, which can be used to load
		 *                                      data for the template before its initialization
		 * @param  {Function}  args.initTemplate  Template initialization callback
		 */
		wizardRenderStep: function(args) {
			var self = this,
				loadData = args.loadData,
				initTemplate = args.initTemplate,
				$container = args.container,
				seriesFunctions = [
					function(seriesCallback) {
						monster.ui.insertTemplate($container.find('.right-content'), function(insertTemplateCallback) {
							seriesCallback(null, insertTemplateCallback);
						});
					}
				];

			if (_.isFunction(loadData)) {
				seriesFunctions.push(loadData);
			}

			monster.series(seriesFunctions, function(err, results) {
				if (err) {
					return;
				}

				var insertTemplateCallback = results[0],
					data = _.get(results, 1);

				insertTemplateCallback(initTemplate(data), self.wizardScrollToTop);
			});
		},

		/**
		 * Scroll window to top
		 */
		wizardScrollToTop: function() {
			window.scrollTo(0, 0);
		}
	};

	return wizard;
});
