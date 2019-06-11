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
					/*{
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
					},*/
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
		 * @param  {Object} [args.data.generalSettings]  Data specific for the current step
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
						})),
						$timezoneDropDown = $template.find('#account_info_timezone');

					timezone.populateDropdown($timezoneDropDown, generalSettingsData.accountInfo.timezone);
					monster.ui.chosen($timezoneDropDown);

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
						adminUserCounters: adminUserCounters,
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
				counters = args.adminUserCounters,
				$template = args.template,
				$adminUserListContainer = $template.find('.admin-user-list');

			$template.find('.admin-user-add').on('click', function(e) {
				e.preventDefault();

				self.wizardGeneralSettingsAddAdminUser({
					listContainer: $adminUserListContainer,
					animate: true,
					counters: counters,
					data: {
						password: monster.util.randomString(8, 'safe')
					}
				});
			});

			$adminUserListContainer.on('click', '.admin-user-remove', function(e) {
				var $adminUserItem = $(this).closest('.admin-user-item');

				$adminUserItem
					.addClass('remove')
					.slideUp(500, function() {
						$adminUserItem.remove();

						// Update view correlatives
						$adminUserListContainer
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
		},

		/**
		 * Add an user to the list of admin users
		 * @param  {Object} args
		 * @param  {Object} args.counters  Counter values to track admin users
		 * @param  {Number} args.counters.correlative  Next admin user correlative
		 * @param  {Number} args.counters.index  Next admin user index
		 * @param  {Object} args.data  Admin user data
		 * @param  {jQuery} args.listContainer  Admin user list container
		 * @param  {Boolean} [args.animate=false]  Display the new admin user with a slide-down effect
		 */
		wizardGeneralSettingsAddAdminUser: function(args) {
			var self = this,
				animate = args.animate,
				counters = args.counters,
				data = args.data,
				$listContainer = args.listContainer,
				$adminItemTemplate = $(self.getTemplate({
					name: 'adminForm',
					data: _.merge({
						data: data
					}, counters),
					submodule: 'wizard'
				}));

			counters.correlative += 1;
			counters.index += 1;

			self.wizardAppendListItem({
				item: $adminItemTemplate,
				listContainer: $listContainer,
				animate: animate
			});
		},

		/* ACCOUNT CONTACTS STEP */

		/**
		 * Render Account Contacts step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {Object} [args.data.accountContacts]  Data specific for the current step
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
						$contractEndDatepicker = monster.ui.datepicker($template.find('#sales_rep_contract_end_date'), {
							minDate: moment().toDate()
						});

					if (_.has(formattedData, 'salesRep.contractEndDate')) {
						$contractEndDatepicker.datepicker('setDate', formattedData.salesRep.contractEndDate);
					}

					monster.ui.chosen($template.find('#sales_rep_representative'));

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
					self.wizardGetUserList({
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
				validateForm = monster.ui.validate($form),
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

		/**
		 * Render Account Contacts step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {Object} [args.data.servicePlan]  Data specific for the current step
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardServicePlanRender: function(args) {
			var self = this,
				$container = args.container,
				formatPlansData = function(planList) {
					return _
						.chain(planList)
						.groupBy('category')
						.map(function(plans, category) {
							return {
								name: category,
								plans: _.sortBy(plans, 'name')
							};
						})
						.sortBy('name')
						.value();
				},
				initTemplate = function(planList) {
					var planCategories = formatPlansData(planList),
						selectedPlanIds = _.get(args.data, 'servicePlan.selectedPlanIds', []),
						$template = $(self.getTemplate({
							name: 'step-servicePlan',
							submodule: 'wizard',
							data: {
								showAddLink: selectedPlanIds.length > 0
							}
						})),
						$planListContainer = $template.find('#form_service_plan');

					if (_.isEmpty(selectedPlanIds)) {
						selectedPlanIds.push('');
					}

					_.each(selectedPlanIds, function(planId, index) {
						self.wizardServicePlanAddPlan({
							index: index,
							planCategories: planCategories,
							planListContainer: $planListContainer,
							selectedPlanId: planId
						});
					});

					self.wizardServicePlanBindEvents({
						planCategories: planCategories,
						planListContainer: $planListContainer,
						planListLastIndex: selectedPlanIds.length - 1,
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				load: function(loadCallback) {
					self.wizardRequestServicePlanList({
						success: function(servicePlanList) {
							loadCallback(null, servicePlanList);
						},
						error: function(parsedError) {
							loadCallback(null, []);
						}
					});
				},
				initialize: initTemplate
			});
		},

		wizardServicePlanUtil: function($template) {
			var self = this;

			// TODO: Not implemented

			return {
				valid: true,
				data: {}
			};
		},

		/**
		 * Bind Service Plan step events
		 * @param  {Object} args
		 * @param  {Array} args.planCategories  Service plans, grouped by categories
		 * @param  {jQuery} args.planListContainer  Plan list container element
		 * @param  {Object} args.planListLastIndex  Initial index for service plans
		 * @param  {jQuery} args.template  Step template
		 */
		wizardServicePlanBindEvents: function(args) {
			var self = this,
				lastIndex = args.planListLastIndex,
				planCategories = args.planCategories,
				$template = args.template,
				$planListContainer = args.planListContainer,
				$planAddLink = $template.find('.service-plan-add'),
				$planRemoveFirst = $planListContainer.find('.service-plan-item:first-child .service-plan-remove'),
				toggleElementVisibility = function(elements, visible) {
					// The `visibility` property is used instead of `display` so that the element
					// still occupies a place in the container's space
					_.each(elements, function($element) {
						$element.css({
							visibility: visible ? 'visible' : 'hidden'
						});
					});
				};

			$planAddLink.on('click', function(e) {
				e.preventDefault();

				toggleElementVisibility([$planRemoveFirst, $planAddLink], false);

				lastIndex += 1;

				self.wizardServicePlanAddPlan({
					index: lastIndex,
					planCategories: planCategories,
					planListContainer: $planListContainer,
					animate: true
				});
			});

			$planListContainer.on('click', '.service-plan-remove', function(e) {
				e.preventDefault();

				var $servicePlanItem = $(this).closest('.service-plan-item'),
					$selectInput = $servicePlanItem.find('select');

				if ($servicePlanItem.is(':first-child')) {
					$selectInput
						.val('')
						.data('value', '')
						.trigger('chosen:updated');

					toggleElementVisibility([$planRemoveFirst, $planAddLink], false);
				} else {
					$servicePlanItem
						.addClass('remove')
						.slideUp(500, function() {
							$servicePlanItem.remove();

							if ($planListContainer.find('.service-plan-item').length === 1) {
								toggleElementVisibility([$planRemoveFirst, $planAddLink], true);
							} else if ($selectInput.val() === '') {
								toggleElementVisibility([$planAddLink], true);
							}
						});
				}
			});

			$planListContainer.on('change', 'select', function() {
				var $this = $(this),
					$servicePlanItem = $this.closest('.service-plan-item'),
					oldValue = $this.data('value'),
					newValue = $this.val();

				if ($servicePlanItem.is(':first-child')) {
					if (oldValue === '' && newValue !== '') {
						toggleElementVisibility([$planRemoveFirst, $planAddLink], true);
					}
				} else if (newValue !== '') {
					toggleElementVisibility([$planAddLink], true);
				}

				$this.data('value', newValue);
			});
		},

		/**
		 * Add a service plan field
		 * @param  {Object} args
		 * @param  {Number} args.index  Item plan index
		 * @param  {Array} args.planCategories  Service plans, grouped by categories
		 * @param  {jQuery} args.planListContainer  Plan list container element
		 * @param  {Boolean} [args.animate=false]  Display the new plan field with a slide-down effect
		 * @param  {String} [args.selectedPlanId]  Selected plan ID
		 */
		wizardServicePlanAddPlan: function(args) {
			var self = this,
				$planSelectorTemplate = $(self.getTemplate({
					name: 'servicePlanSelector',
					submodule: 'wizard',
					data: {
						index: args.index,
						planCategories: args.planCategories,
						selectedPlanId: args.selectedPlanId
					}
				}));

			monster.ui.chosen($planSelectorTemplate.find('select'));

			self.wizardAppendListItem({
				item: $planSelectorTemplate,
				listContainer: args.planListContainer,
				animate: args.animate
			});
		},

		/* USAGE AND CALL RESTRICTIONS */

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
		 * Request the list of service plans for the current account
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardRequestServicePlanList: function(args) {
			var self = this;

			self.callApi({
				resource: 'servicePlan.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
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
		 * Append a list item element to a list container, optionally with a slide-down effect
		 * @param  {Object} args
		 * @param  {jQuery} args.item  Item element to append
		 * @param  {jQuery} args.listContainer  Element that contains the item list
		 * @param  {Boolean} [args.animate=false]  Append the new item with a slide-down effect
		 */
		wizardAppendListItem: function(args) {
			var self = this,
				$item = args.item,
				$listContainer = args.listContainer,
				animate = _.get(args, 'animate', false);

			if (animate) {
				$item
					.css({ display: 'none' })
					.appendTo($listContainer)
					.slideDown(500);
			} else {
				$item.appendTo($listContainer);
			}
		},

		/**
		 * Gets the cached list of users for the current account. If the list is not cached, then
		 * it is requested to the API.
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetUserList: function(args) {
			var self = this,
				userList = self.wizardGetStore('accountUsers');

			if (_.isUndefined(userList)) {
				self.wizardRequestUserList({
					success: function(userList) {
						self.wizardSetStore('accountUsers', userList);
						args.success(userList);
					},
					error: args.error
				});
			} else {
				args.success(userList);
			}
		},

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
		},

		/* STORE FUNCTIONS */

		/**
		 * Store getter
		 * @param  {Array|String} [path]
		 * @param  {*} [defaultValue]
		 * @return {*}
		 */
		wizardGetStore: function(path, defaultValue) {
			var self = this,
				store = ['_store', 'wizard'];
			return _.get(
				self,
				_.isUndefined(path)
					? store
					: _.flatten([store, _.isString(path) ? path.split('.') : path]),
				defaultValue
			);
		},

		/**
		 * Store setter
		 * @param  {Array|String|*} path|value
		 * @param  {*} [value]
		 */
		wizardSetStore: function(path, value) {
			var self = this,
				hasValue = _.toArray(arguments).length === 2,
				store = ['_store', 'wizard'];
			_.set(
				self,
				hasValue
					? _.flatten([store, _.isString(path) ? path.split('.') : path])
					: store,
				hasValue ? value : path
			);
		}
	};

	return wizard;
});
