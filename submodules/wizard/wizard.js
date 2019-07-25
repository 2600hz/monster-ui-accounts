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

		appFlags: {
			wizard: {
				animationTimes: {
					adminUser: 500,
					planInput: 150,
					allowedApps: 500,
					toggleAppCards: 400
				},
				callRestrictionTypes: [
					'tollfree_us',
					'toll_us',
					'emergency',
					'caribbean',
					'did_us',
					'international',
					'unknowkn'
				],
				controlCenterFeatures: {
					tree: [
						{
							category: 'settings',
							features: [
								{
									name: 'user',
									icon: 'user'
								},
								{
									name: 'account',
									icon: 'avatar--badge'
								}
							]
						},
						{
							category: 'billing',
							features: [
								{
									name: 'billing',
									icon: 'credit-card'
								},
								{
									name: 'balance',
									icon: 'list',
									features: [
										{
											name: 'credit',
											icon: 'available-balance'
										},
										{
											name: 'minutes',
											icon: 'clock'
										}
									]
								},
								{
									name: 'service_plan',
									icon: 'service-plan'
								},
								{
									name: 'transactions',
									icon: 'billing'
								}
							]
						},
						{
							category: 'misc',
							features: [
								{
									name: 'error_tracker',
									icon: 'bug'
								}
							]
						}
					]
				}
			}
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
					},
					// Usage and Call Restrictions defaults
					usageAndCallRestrictions: {
						trunkLimits: {
							inbound: 0,
							outbound: 0,
							twoway: 0
						},
						callRestrictions: {
							tollfree_us: true,
							toll_us: true,
							emergency: true,
							caribbean: true,
							did_us: true,
							international: true,
							unknowkn: true
						}
					},
					// Credit Balance and Features defaults
					creditBalanceAndFeatures: {
						controlCenterAccess: {
							features: {
								user: true,
								account: true,
								billing: true,
								balance: true,
								credit: true,
								minutes: true,
								service_plan: true,
								transactions: true,
								error_tracker: true
							}
						}
					},
					// App Restrictions defaults
					appRestrictions: {
						accessLevel: 'full',
						allowedAppIds: []
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
				done: 'wizardSubmit',
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
					.slideUp(self.appFlags.wizard.animationTimes.adminUser, function() {
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
				animationDuration: animate ? self.appFlags.wizard.animationTimes.adminUser : 0
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
								//showSalesRepSection: true
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
					errors[fieldName] = self.i18n.active().accountsApp.wizard.steps.general.errors.phoneNumber.invalid;
				}
			});

			if (!_.isEmpty(errors)) {
				isValid = false;

				// Merge new errors with existing ones, in order to display all of them
				validateForm.showErrors(_.merge(errors, validateForm.errorMap));
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
				selectedPlanIds = _.get(args.data, 'servicePlan.selectedPlanIds', []),
				$container = args.container,
				$template = $(self.getTemplate({
					name: 'step-servicePlan',
					submodule: 'wizard'
				})),
				formatPlansData = function(planList) {
					return {
						categories: _
							.chain(planList)
							.groupBy('category')
							.map(function(plans, category) {
								return {
									name: category,
									plans: _.sortBy(plans, 'name')
								};
							})
							.sortBy('name')
							.value(),
						count: planList.length
					};
				},
				initTemplate = function(planList) {
					var formattedPlanData = formatPlansData(planList),
						selectedPlansCount = selectedPlanIds.length,
						selectedPlanIdsToRender = _.clone(selectedPlanIds),
						$planListContainer = $template.find('#form_service_plan');

					if (_.isEmpty(selectedPlanIdsToRender)) {
						selectedPlanIdsToRender.push('');
					}

					_.each(selectedPlanIdsToRender, function(planId, index) {
						self.wizardServicePlanAddPlan({
							index: index,
							planCategories: formattedPlanData.categories,
							planListContainer: $planListContainer,
							disabledPlanIds: selectedPlanIds,
							selectedPlanId: planId
						});
					});

					if (selectedPlansCount === 0 || selectedPlansCount >= formattedPlanData.count) {
						self.wizardToggleElementsVisibility([ $template.find('.service-plan-add') ], false);
					}

					self.wizardServicePlanBindEvents({
						selectedPlanIds: selectedPlanIds,
						planData: formattedPlanData,
						planListArgs: {
							container: $planListContainer,
							lastIndex: selectedPlanIds.length - 1
						},
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					monster.parallel({
						servicePlanList: function(parallelCallback) {
							self.wizardGetServicePlanList({
								success: function(servicePlanList) {
									parallelCallback(null, servicePlanList);
								},
								error: function() {
									parallelCallback(null, []);
								}
							});
						},
						serviceItemsListingRender: function(parallelCallback) {
							self.serviceItemsListingRender({
								planIds: selectedPlanIds,
								container: $template.find('#service_plan_aggregate'),
								showProgressPanel: false,
								success: function() {
									parallelCallback(null);
								},
								error: function() {
									parallelCallback(null);
								}
							});
						}
					}, function(err, results) {
						asyncCallback(null, _.get(results, 'servicePlanList'));
					});
				},
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to validate Service Plan form and extract data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardServicePlanUtil: function($template, args) {
			var self = this,
				servicePlan = monster.ui.getFormData($template.find('form').get(0));

			// Remove any empty planId, due to a clean input
			_.pull(servicePlan.selectedPlanIds, '');

			// Clean servicePlan previous data
			delete args.data.servicePlan;

			return {
				valid: true,
				data: {
					servicePlan: servicePlan
				}
			};
		},

		/**
		 * Bind Service Plan step events
		 * @param  {Object} args
		 * @param  {String[]} args.selectedplanIds  Selected plan IDs
		 * @param  {Object} args.planData  Service plans data
		 * @param  {Array} args.planData.categories  Service plans grouped by categories
		 * @param  {Array} args.planData.count  Service plans count
		 * @param  {Object} args.planListArgs  Args specific to the plan list
		 * @param  {jQuery} args.planListArgs.container  Plan list container element
		 * @param  {Number} args.planListArgs.lastIndex  Initial index for service plans
		 * @param  {Number} args.planListArgs.selectedCount  Count of already selected plans
		 * @param  {jQuery} args.template  Step template
		 */
		wizardServicePlanBindEvents: function(args) {
			var self = this,
				selectedPlanIds = args.selectedPlanIds,
				selectedCount = selectedPlanIds.length,
				lastIndex = args.planListArgs.lastIndex,
				planData = args.planData,
				planCategories = planData.categories,
				plansCount = planData.count,
				$template = args.template,
				$planListContainer = args.planListArgs.container,
				$planAddLink = $template.find('.service-plan-add'),
				$planRemoveFirst = $planListContainer.find('.service-plan-item:first-child .service-plan-remove'),
				toggleSelectedPlan = function($servicePlanItem, oldPlanId, newPlanId) {
					var $otherInputs = $servicePlanItem.siblings('.service-plan-item').find('select');

					if (!_.isEmpty(oldPlanId)) {
						_.pull(selectedPlanIds, oldPlanId);
						selectedCount -= 1;
						$otherInputs.find('option[value="' + oldPlanId + '"]').removeAttr('disabled');
					}

					if (!_.isEmpty(newPlanId)) {
						selectedPlanIds.push(newPlanId);
						selectedCount += 1;
						$otherInputs.find('option[value="' + newPlanId + '"]').attr('disabled', '');
					}
				};

			$planAddLink.on('click', function(e) {
				e.preventDefault();

				if ($(this).hasClass('disabled')) {
					return;
				}

				self.wizardToggleElementsVisibility([$planRemoveFirst, $planAddLink], false);

				lastIndex += 1;

				self.wizardServicePlanAddPlan({
					index: lastIndex,
					planCategories: planCategories,
					planListContainer: $planListContainer,
					disabledPlanIds: selectedPlanIds,
					animate: true
				});
			});

			$planListContainer.on('click', '.service-plan-remove', function(e) {
				e.preventDefault();

				var $servicePlanItem = $(this).closest('.service-plan-item'),
					$selectInput = $servicePlanItem.find('select'),
					value = $selectInput.val();

				toggleSelectedPlan($servicePlanItem, value, null);

				monster.series([
					function(seriesCallback) {
						if (value === '') {
							seriesCallback(null);
							return;
						}

						self.wizardServicePlanGenerateListing({
							planIds: selectedPlanIds,
							template: $template,
							planAddLink: $planAddLink,
							planListContainer: $planListContainer,
							callback: function() {
								seriesCallback(null);
							}
						});
					}
				], function() {
					if ($servicePlanItem.is(':first-child')) {
						$selectInput
							.val('')
							.data('value', '');

						self.wizardToggleElementsVisibility([$planRemoveFirst, $planAddLink], false);
					} else {
						$servicePlanItem
							.addClass('remove')
							.slideUp(self.appFlags.wizard.animationTimes.planInput, function() {
								var selectorCount = $planListContainer.find('.service-plan-item').length - 1;

								$servicePlanItem.remove();

								if (selectorCount === 1) {
									self.wizardToggleElementsVisibility([$planRemoveFirst, $planAddLink], true);
								} else if (selectorCount === selectedCount) {
									self.wizardToggleElementsVisibility([$planAddLink], true);
								}
							});
					}
				});
			});

			$planListContainer.on('change', 'select', function() {
				var $this = $(this),
					$servicePlanItem = $this.closest('.service-plan-item'),
					oldValue = $this.data('value'),
					newValue = $this.val();

				toggleSelectedPlan($servicePlanItem, oldValue, newValue);

				self.wizardServicePlanGenerateListing({
					planIds: selectedPlanIds,
					template: $template,
					planAddLink: $planAddLink,
					planListContainer: $planListContainer,
					callback: function() {
						if ($servicePlanItem.is(':first-child')) {
							if (oldValue === '' && newValue !== '') {
								if (selectedCount < plansCount) {
									self.wizardToggleElementsVisibility([$planRemoveFirst, $planAddLink], true);
								} else {
									self.wizardToggleElementsVisibility([$planRemoveFirst], true);
								}
							}
						} else if (newValue !== '' && selectedCount < plansCount) {
							self.wizardToggleElementsVisibility([$planAddLink], true);
						}

						$this.data('value', newValue);
					}
				});
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
						disabledPlanIds: args.disabledPlanIds,
						selectedPlanId: args.selectedPlanId
					}
				}));

			monster.ui.chosen($planSelectorTemplate.find('select'));

			self.wizardAppendListItem({
				item: $planSelectorTemplate,
				listContainer: args.planListContainer,
				animationDuration: _.get(args, 'animate', false) ? self.appFlags.wizard.animationTimes.planInput : 0
			});
		},

		/**
		 * Generate and render the plan listing
		 * @param  {Object} args
		 * @param  {String[]} args.planIds  List of selected plan IDs
		 * @param  {jQuery} args.template  Step template
		 * @param  {jQuery} args.planListContainer  Plan list container element
		 * @param  {jQuery} args.planAddLink  Plan add link
		 * @param  {Function} args.callback  Callback function
		 */
		wizardServicePlanGenerateListing: function(args) {
			var self = this,
				planIds = args.planIds,
				callback = args.callback,
				$template = args.template,
				$planAddLink = args.planAddLink,
				$planListContainer = args.planListContainer,
				$selectors = $planListContainer.find('select'),
				$removeButtons = $planListContainer.find('button.service-plan-remove'),
				enablePlanSelectorControls = function(enable) {
					$selectors.prop('disabled', !enable).trigger('chosen:updated');
					$removeButtons.prop('disabled', !enable);
					$planAddLink.toggleClass('disabled');
				};

			enablePlanSelectorControls(false);

			monster.parallel([
				function(parallelCallback) {
					callback();
					parallelCallback(null);
				},
				function(parallelCallback) {
					self.serviceItemsListingRender({
						planIds: planIds,
						container: $template.find('#service_plan_aggregate'),
						success: function() {
							parallelCallback(null);
						},
						error: function() {
							parallelCallback(true);
						}
					});
				}
			], function() {
				enablePlanSelectorControls(true);
			});
		},

		/* USAGE AND CALL RESTRICTIONS */

		/**
		 * Render Usage and Call Restrictions step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {Object} [args.data.usageAndCallRestrictions]  Data specific for the current step
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardUsageAndCallRestrictionsRender: function(args) {
			var self = this,
				$container = args.container,
				initTemplate = function() {
					var usageAndCallRestrictionsData = args.data.usageAndCallRestrictions,
						dataTemplate = {
							trunkTypes: [
								'inbound',
								'outbound',
								'twoway'
							],
							callRestrictionTypes: self.appFlags.wizard.callRestrictionTypes,
							data: usageAndCallRestrictionsData
						},
						$template = $(self.getTemplate({
							name: 'step-usageAndCallRestrictions',
							data: dataTemplate,
							submodule: 'wizard'
						}));

					monster.ui.spinner($template.find('.spinner'), {
						min: 0
					});

					monster.ui.tooltips($template);

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to validate Usage and Call Restrictions form and extract data
		 * @param  {jQuery} $template  Step template
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardUsageAndCallRestrictionsUtil: function($template) {
			var self = this,
				$form = $template.find('form');

			return {
				valid: true,
				data: {
					usageAndCallRestrictions: monster.ui.getFormData($form.get(0))
				}
			};
		},

		/* CREDIT BALANCE AND FEATURES */

		/**
		 * Render Credit Balance + Features step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {Object} args.data.usageAndCallRestrictions  Data specific for the current step
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardCreditBalanceAndFeaturesRender: function(args) {
			var self = this,
				$container = args.container,
				initTemplate = function() {
					var creditBalanceAndFeaturesData = args.data.creditBalanceAndFeatures,
						$template = $(self.getTemplate({
							name: 'step-creditBalanceAndFeatures',
							data: {
								currencySymbol: monster.util.getCurrencySymbol(),
								controlCenter: {
									featureTree: self.appFlags.wizard.controlCenterFeatures.tree
								},
								data: creditBalanceAndFeaturesData
							},
							submodule: 'wizard'
						}));

					$template
						.find('input#account_credit_initial_balance')
							.mask('#0.00', {
								reverse: true
							});

					monster.ui.tooltips($template);

					self.wizardCreditBalanceAndFeaturesBindEvents({
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to validate Usage and Call Restrictions form and extract data
		 * @param  {jQuery} $template  Step template
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardCreditBalanceAndFeaturesUtil: function($template) {
			var self = this,
				$form = $template.find('form');

			return {
				valid: true,
				data: {
					creditBalanceAndFeatures: monster.ui.getFormData($form.get(0))
				}
			};
		},

		/**
		 * Bind Credit Balance and features step events
		 * @param  {Object} args
		 * @param  {jQuery} args.template  Step template
		 */
		wizardCreditBalanceAndFeaturesBindEvents: function(args) {
			var self = this,
				$template = args.template,
				$featureItemsWithSubFeatures = $template.find('.features').closest('.feature-item');

			// Tick parent feature
			$featureItemsWithSubFeatures
				.find('.features input[type="checkbox"]')
					.on('change', function() {
						var $this = $(this),
							isChecked = $this.is(':checked');

						if (!isChecked) {
							return;
						}

						$this
							.closest('.features')
								.siblings('.feature-item-link')
									.find('input[type="checkbox"]:not(:checked)')
										.prop('checked', isChecked);
					});

			// Tick/untick children features
			$featureItemsWithSubFeatures
				.find('input[type="checkbox"]')
					.on('change', function() {
						var $this = $(this),
							isChecked = $this.is(':checked');

						$this
							.closest('.feature-item')
								.find('.features input[type="checkbox"]')
									.prop('checked', isChecked);
					});
		},

		/* APP RESTRICTIONS */

		/**
		 * Render App Restrictions step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {Object} args.data.appRestrictions  Data specific for the current step
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardAppRestrictionsRender: function(args) {
			var self = this,
				$container = args.container,
				initTemplate = function(appList) {
					var appRestrictionsData = args.data.appRestrictions,
						$template = $(self.getTemplate({
							name: 'step-appRestrictions',
							data: {
								apps: appList,
								anyAppToSelect: (appList.length - appRestrictionsData.allowedAppIds.length) > 0,
								data: appRestrictionsData
							},
							submodule: 'wizard'
						}));

					monster.ui.tooltips($template);

					self.wizardAppRestrictionsBindEvents({
						allowedAppIds: appRestrictionsData.allowedAppIds,
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					self.wizardGetAppList({
						success: function(appList) {
							asyncCallback(null, appList);
						}
					});
				},
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to extract App Restrictions data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardAppRestrictionsUtil: function($template, args) {
			var self = this,
				formData = monster.ui.getFormData($template.find('form').get(0));

			if (formData.accessLevel === 'full' || !_.has(formData, 'allowedAppIds')) {
				formData.allowedAppIds = [];
			};

			// Clean appRestrictions previous data, to avoid merging the array of allowedAppIds
			delete args.data.appRestrictions;

			return {
				valid: true,
				data: {
					appRestrictions: formData
				}
			};
		},

		/**
		 * Bind App Restrictions step events
		 * @param  {Object} args
		 * @param  {jQuery} args.allowedAppIds  Allowed app IDs
		 * @param  {jQuery} args.template  Step template
		 */
		wizardAppRestrictionsBindEvents: function(args) {
			var self = this,
				slideAnimationDuration = self.appFlags.wizard.animationTimes.allowedApps,
				allowedAppIds = _.clone(args.allowedAppIds),	// Create a copy of the data, in order to not to alter the original one
				$template = args.template,
				$allowedAppsSection = $template.find('#section_allowed_apps'),
				$appList = $allowedAppsSection.find('.app-list');

			$template.find('#access_level .radio-button').on('change', function() {
				if (this.value === 'full') {
					$allowedAppsSection
						.fadeOut({
							duration: slideAnimationDuration,
							queue: false
						})
						.slideUp(slideAnimationDuration);
				} else {
					$allowedAppsSection
						.fadeIn({
							duration: slideAnimationDuration,
							queue: false
						})
						.slideDown(slideAnimationDuration);
				}
			});

			$template.find('.app-add .wizard-card').on('click', function() {
				monster.pub('common.appSelector.renderPopup', {
					scope: 'all',
					excludedApps: allowedAppIds,
					callbacks: {
						accept: function(selectedAppIds) {
							var $selectedAppCards = $([]);

							_.each(selectedAppIds, function(appId) {
								allowedAppIds.push(appId);
								$selectedAppCards = $selectedAppCards.add($appList.find('#app_' + appId));
							});

							$selectedAppCards.find('.app-selected').prop('checked', true);

							self.wizardToggleAppCard({
								action: 'show',
								container: $appList,
								itemsToToggle: $selectedAppCards
							});
						}
					}
				});
			});

			$appList.find('.app-remove').on('click', function(e) {
				e.preventDefault();

				var $this = $(this),
					$appSelectedInput = $this.find('.app-selected'),
					$appItem = $this.closest('.app-item');

				_.pull(allowedAppIds, $appItem.data('id'));

				$appSelectedInput.prop('checked', false);

				self.wizardToggleAppCard({
					action: 'hide',
					container: $appList,
					itemsToToggle: $appItem
				});
			});
		},

		/* REVIEW */

		/**
		 * Render Review step
		 * @param  {Object} args
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @param  {jQuery} args.container  Step container element
		 */
		wizardReviewRender: function(args) {
			var self = this,
				data = args.data,
				$container = args.container,
				dataTemplate = self.wizardReviewFormatData(data),
				$template = $(self.getTemplate({
					name: 'step-review',
					data: dataTemplate,
					submodule: 'wizard'
				})),
				initTemplate = function() {
					monster.ui.tooltips($template);

					self.wizardReviewBindEvents({
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					self.serviceItemsListingRender({
						planIds: data.servicePlan.selectedPlanIds,
						container: $template.find('#service_plan_aggregate'),
						showProgressPanel: false,
						success: function() {
							asyncCallback(null);
						},
						error: function(err) {
							asyncCallback(null);
						}
					});
				},
				initTemplate: initTemplate
			});
		},

		/**
		 * Utility funcion to extract Review data. Not used, as this is only a review step, so it
		 * does not provide any new data.
		 * @param  {jQuery} $template  Step template
		 * @returns  {Object}  Object that contains a `valid` flag value
		 */
		wizardReviewUtil: function($template) {
			return {
				valid: true
			};
		},

		/**
		 * Fomat the wizard data to be rendered for review
		 * @param  {Object} data  Wizard data
		 */
		wizardReviewFormatData: function(data) {
			var self = this,
				wizardAppFlags = self.appFlags.wizard,
				formattedData = _
					.chain(data)
					.cloneDeep()	// To not to alter data to save
					.merge({
						generalSettings: {
							accountInfo: {
								// Set formatted address line 3
								addressLine3: self.getTemplate({
									name: '!' + self.i18n.active().accountsApp.wizard.steps.review.generalSettings.formats.addressLine3,
									data: data.generalSettings.accountInfo
								})
							}
						}
					})
					.value(),
				featureTreeToList = function(features) {
					return _.flatMap(features, function(feature) {
						var flattenedFeatures = _.concat([ feature ], featureTreeToList(feature.features));
						return flattenedFeatures;
					});
				};

			// Replace language code with language name
			formattedData.generalSettings.accountInfo.language = monster.util.tryI18n(monster.apps.core.i18n.active().monsterLanguages, formattedData.generalSettings.accountInfo.language);

			// Set full name for account admins
			_.each(formattedData.generalSettings.accountAdmins, function(admin) {
				admin.fullName = monster.util.getUserFullName({
					first_name: admin.firstName,
					last_name: admin.lastName
				});
				delete admin.firstName;
				delete admin.lastName;
			});

			// Replace representative's userId with its full name
			if (_.has(formattedData.accountContacts, 'salesRep.representative')) {
				formattedData.accountContacts.salesRep.representative = _
					.chain(self.wizardGetStore('accountUsers'))	// At this point all the required data has been stored, so we can get it directly
					.find({
						id: formattedData.accountContacts.salesRep.representative
					})
					.thru(monster.util.getUserFullName)
					.value();
			}

			// Get plan names and quote
			if (_.has(formattedData, 'servicePlan.selectedPlanIds')) {
				var	selectedPlanIds = formattedData.servicePlan.selectedPlanIds,
					servicePlanList = self.wizardGetStore('servicePlans');

				formattedData.servicePlan = {
					selectedPlans: _
						.chain(selectedPlanIds)
						.map(function(planId) {
							return _
								.chain(servicePlanList)
								.find({ id: planId })
								.get('name')
								.value();
						})
						.sortBy()
						.join(', ')
						.value()
				};
			}

			// Add static data from appFlags
			if (!_.has(wizardAppFlags.controlCenterFeatures, 'list')) {
				wizardAppFlags.controlCenterFeatures.list = _
					.chain(wizardAppFlags.controlCenterFeatures.tree)
					.flatMap('features')
					.thru(featureTreeToList)
					.value();
			}
			formattedData.creditBalanceAndFeatures.controlCenterAccess.featureList = wizardAppFlags.controlCenterFeatures.list;
			formattedData.usageAndCallRestrictions.callRestrictionTypes = wizardAppFlags.callRestrictionTypes;

			// Set app list
			formattedData.appRestrictions.apps = self.wizardGetStore('apps');

			return formattedData;
		},

		/**
		 * Bind Review step events
		 * @param  {Object} args
		 * @param  {jQuery} args.template  Step template
		 */
		wizardReviewBindEvents: function(args) {
			var self = this,
				$template = args.template;

			$template
				.find('.edit-step')
					.on('click', function(e) {
						e.preventDefault();

						var stepId = $(this).data('step_id');

						monster.pub('common.navigationWizard.goToStep', {
							stepId: stepId
						});
					});
		},

		/* SUBMIT */

		/**
		 * Submit all the collected data to the API, to create the account and all of its
		 * components
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that was stored across steps
		 */
		wizardSubmit: function(args) {
			var self = this,
				wizardData = args.data,
				account = self.wizardSubmitGetFormattedAccount(wizardData),
				users = self.wizardSubmitGetFormattedUsers(wizardData),
				plan = self.wizardSubmitGetFormattedServicePlan(wizardData),
				limits = self.wizardSubmitGetFormattedLimits(wizardData);

			console.log('account', account);
			console.log('users', users);
			console.log('plan', plan);
			console.log('limits', limits);

			self.wizardClose(args);
		},

		/**
		 * Build the account document to submit to the API, from the wizard data
		 * @param  {Object} wizardData  Wizard's data
		 * @returns  {Object}  Account document
		 */
		wizardSubmitGetFormattedAccount: function(wizardData) {
			var self = this,
				accountInfo = wizardData.generalSettings.accountInfo,
				accountContacts = wizardData.accountContacts,
				billingContact = accountContacts.billingContact,
				technicalContact = accountContacts.technicalContact,
				controlCenterFeatures = wizardData.creditBalanceAndFeatures.controlCenterAccess.features,
				accountDocument = {
					blacklist: _
						.chain(self.wizardGetStore('apps'))
						.map('id')
						.difference(wizardData.appRestrictions.allowedAppIds)
						.value(),
					call_restriction: _
						.mapValues(wizardData.usageAndCallRestrictions.callRestrictions, function(value) {
							return {
								action: value ? 'inherit' : 'deny'
							};
						}),
					contact: {
						country: accountInfo.country,
						region: accountInfo.state,
						locality: accountInfo.city,
						postal_code: accountInfo.zip,
						street_address: accountInfo.addressLine1,
						street_address_extra: accountInfo.addressLine2,
						email: billingContact.email,
						name: billingContact.fullName,
						number: billingContact.phoneNumber.e164Number
					},
					technical: {
						email: technicalContact.email,
						name: technicalContact.fullName,
						number: technicalContact.phoneNumber.e164Number
					},
					language: accountInfo.language,
					name: accountInfo.accountName,
					realm: accountInfo.realm,
					timezone: accountInfo.timezone,
					ui_restrictions: {
						myaccount: _
							.chain(self.appFlags.wizard.controlCenterFeatures.tree)
							.flatMap('features')
							.keyBy('name')
							.mapValues(function(feature) {
								var restriction = {
									show_tab: controlCenterFeatures[feature.name]
								};

								if (_.has(feature, 'features')) {
									_.each(feature.features, function(subFeature) {
										restriction['show_' + subFeature.name] = controlCenterFeatures[subFeature.name];
									});
								}

								return restriction;
							})
							// Merge trunk features with default values, as they were not set in the wizard
							.merge({
								inbound: {
									show_tab: true
								},
								outbound: {
									show_tab: true
								},
								twoway: {
									show_tab: true
								}
							})
							.value()
					}
				};

			// Clean empty data
			if (_.isEmpty(accountDocument.realm)) {
				delete accountDocument.realm;
			}

			return accountDocument;
		},

		/**
		 * Build an array with the user documents to submit to the API, from the wizard data
		 * @param  {Object} wizardData  Wizard's data
		 * @returns  {Array}  Array of user documents
		 */
		wizardSubmitGetFormattedUsers: function(wizardData) {
			var self = this;

			return _.map(wizardData.generalSettings.accountAdmins, function(adminUser) {
				return {
					first_name: adminUser.firstName,
					last_name: adminUser.lastName,
					username: adminUser.email,
					password: adminUser.password,
					priv_level: 'admin',
					send_email_on_creation: adminUser.sendMail
				};
			});
		},

		/**
		 * Build an object that contain the selected service plans that will compose the plan
		 * for the new account, from the wizard data, to submit to the API
		 * @param  {Object} wizardData  Wizard's data
		 * @returns  {Object}  Object that contains the selected service plans
		 */
		wizardSubmitGetFormattedServicePlan: function(wizardData) {
			var self = this,
				selectedPlanIds = wizardData.servicePlan.selectedPlanIds;

			if (_.isEmpty(selectedPlanIds)) {
				return null;
			}

			return {
				add: selectedPlanIds
			};
		},

		/**
		 * Build an object that contain the account limits to submit to the API, from the wizard data
		 * @param  {Object} wizardData  Wizard's data
		 * @returns  {Object}  Plan limits
		 */
		wizardSubmitGetFormattedLimits: function(wizardData) {
			var self = this,
				limits = {
					allow_prepay: true
				};

			_.each(wizardData.usageAndCallRestrictions.trunkLimits, function(value, trunkType) {
				limits[trunkType + '_trunks'] = value;
			});

			return limits;
		},

		/* CLOSE WIZARD */

		/**
		 * Loads the account manager, to replace the wizard view
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Main view container
		 * @param  {String} args.parentAccountId  Parent Account ID
		 */
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
		 * Toggles the display of one or more application cards, in an animated way.
		 * The animation is similar to Isotope, but without having to worry about responsiveness
		 * thanks to flexbox.
		 * The animation uses the FLEX technique.
		 * @param  {Object} args
		 * @param  {('show'|'hide')} args.action  Show or hide the elements
		 * @param  {jQuery} args.container  Items container
		 * @param  {jQuery} args.itemsToToggle  Items to toggle
		 */
		wizardToggleAppCard: function(args) {
			var self = this,
				animationMillis = self.appFlags.wizard.animationTimes.toggleAppCards,
				action = args.action,
				$container = args.container,
				$parentContainer = $container.parent(),
				parentDiffHeight = $parentContainer.height() - $container.height(),
				$itemsToToggle = args.itemsToToggle,
				$siblings = $itemsToToggle.siblings('.visible'),
				firstBounds = $siblings.map(function() {
					// FIRST: Get the original bounds for following siblings
					return this.getBoundingClientRect();
				}).toArray();

			// Set final values at the end of the animation
			setTimeout(function() {
				$parentContainer.css({
					maxHeight: '',
					height: ''
				});

				$siblings.css({
					maxHeight: '',
					minHeight: '',
					alignSelf: ''
				});

				if (action !== 'hide') {
					return;
				}

				$itemsToToggle
					.hide()
					.css({
						top: '',
						left: ''
					});
			}, animationMillis);

			// Animate step by step using the FLEX technique
			monster.series([
				function(callback) {
					// Fix container height
					$parentContainer.css({
						height: $parentContainer.height() + 'px',
						maxHeight: $parentContainer.height() + 'px'
					});

					self.wizardForceElementsReflow({
						elements: $parentContainer
					});

					callback(null);
				},
				function(callback) {
					// Hide/show app items
					if (action === 'hide') {
						$itemsToToggle
							.each(function() {
								$(this)
									.css({
										top: this.offsetTop + 'px',
										left: this.offsetLeft + 'px'
									})
									.removeClass('visible');
							});

						// No need to reflow here because of offsetTop and offsetLeft were
						// requested for each item to toggle

						callback(null);

						return;
					}

					$itemsToToggle.css({
						display: ''
					});

					self.wizardForceElementsReflow({
						elements: $itemsToToggle
					});

					$itemsToToggle
						.addClass('visible');

					self.wizardForceElementsReflow({
						elements: $itemsToToggle
					});

					callback(null);
				},
				function(callback) {
					// Update parent height
					var parentContainerHeight = ((action === 'show') ? $parentContainer.get(0).scrollHeight : $container.height() + parentDiffHeight) + 'px';
					$parentContainer.css({
						maxHeight: parentContainerHeight,
						height: parentContainerHeight
					});

					// Calculate deltas for siblings, and set transformation/size
					$siblings.each(function(index, element) {
						var first = firstBounds[index],
							$element = $(element),
							// LAST: get the final bounds
							last = element.getBoundingClientRect(),
							// INVERT: determine the delta between the
							// first and last bounds to invert the element
							deltaX = first.left - last.left,
							deltaY = first.top - last.top;

						if (action === 'hide' && deltaY < 0) {
							deltaY = 0;
						}

						// PLAY: animate the final element from its first bounds
						// to its last bounds (which is no transform)
						$element.css({
							transition: 'all 0s ease 0s',
							transform: 'translate(' + deltaX + 'px, ' + deltaY + 'px)',
							maxHeight: first.height + 'px',
							minHeight: first.height + 'px',
							alignSelf: 'flex-start'
						});
						$element.data('last_height', last.height);
					});

					// Defer to wait for style updates in siblings
					_.defer(callback, null);
				}
			], function() {
				// Update CSS to trigger delta transitions
				$siblings.each(function() {
					var $this = $(this);
					$this.css({
						transition: '',
						transform: '',
						maxHeight: $this.data('last_height') + 'px',
						minHeight: $this.data('last_height') + 'px'
					});
				});
			});
		},

		/**
		 * Append a list item element to a list container, optionally with a slide-down effect
		 * @param  {Object} args
		 * @param  {jQuery} args.item  Item element to append
		 * @param  {jQuery} args.listContainer  Element that contains the item list
		 * @param  {Boolean} [args.animationDuration=0]  Duration of the slide-down animation
		 *                                               effect, in milliseconds. If set to zero,
		 *                                               the item is appended without animation.
		 */
		wizardAppendListItem: function(args) {
			var self = this,
				$item = args.item,
				$listContainer = args.listContainer,
				animationDuration = _.get(args, 'animationDuration', 0);

			if (animationDuration === 0) {
				$item.appendTo($listContainer);
			} else {
				$item
					.css({ display: 'none' })
					.appendTo($listContainer)
					.slideDown(animationDuration);
			}
		},

		/**
		 * Forces the browser to synchronously calculate layout (also known as reflow/layout thrashing)
		 *
		 * References:
		 * https://gist.github.com/paulirish/5d52fb081b3570c81e3a
		 * https://kellegous.com/j/2013/01/26/layout-performance/
		 *
		 * @param  {Object} args
		 * @param  {jQuery} args.elements
		 */
		wizardForceElementsReflow: function(args) {
			var offsetHeight;
			args.elements.each(function() {
				offsetHeight = this.offsetHeight;	// Save the offsetHeight, to try to avoid any optimization
			});
			return offsetHeight;
		},

		/**
		 * Gets the stored list of apps available. If the list is not stored, then it is
		 * requested to the API.
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 */
		wizardGetAppList: function(args) {
			var self = this,
				appList = self.wizardGetStore('apps');

			if (_.isUndefined(appList)) {
				monster.pub('apploader.getAppList', {
					scope: 'all',
					callback: function(appList) {
						appList = _.sortBy(appList, 'label');
						self.wizardSetStore('apps', appList);
						args.success(appList);
					}
				});
			} else {
				args.success(appList);
			}
		},

		/**
		 * Gets the stored list of plans available for the current account. If the list is not
		 * stored, then it is requested to the API.
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetServicePlanList: function(args) {
			var self = this,
				servicePlanList = self.wizardGetStore('servicePlans');

			if (_.isUndefined(servicePlanList)) {
				self.wizardRequestServicePlanList({
					success: function(servicePlanList) {
						self.wizardSetStore('servicePlans', servicePlanList);
						args.success(servicePlanList);
					},
					error: args.error
				});
			} else {
				args.success(servicePlanList);
			}
		},

		/**
		 * Gets the stored list of users for the current account. If the list is not stored, then
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

				_.defer(function() {
					// Deferred, to ensure that the loading template does not replace the step template
					insertTemplateCallback(initTemplate(data), self.wizardScrollToTop);
				});
			});
		},

		/**
		 * Toggle the visibility of one or more elements
		 * @param  {jQuery[]} elements  Elements to be manipulated
		 * @param  {Boolean} visible  Whether or not set the elements visible
		 */
		wizardToggleElementsVisibility: function(elements, visible) {
			var visbility = visible ? 'visible' : 'hidden';

			// The `visibility` property is used instead of `display` so that the element
			// still occupies a place in the container's space
			_.each(elements, function($element) {
				$element.css({
					visibility: visbility
				});
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
		 * @param  {('accountUsers'|'apps'|'servicePlans')} [path]
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
		 * @param  {('accountUsers'|'apps'|'servicePlans')} path|value
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
