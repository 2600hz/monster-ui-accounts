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
				},
				stepNames: [
					'generalSettings',
					'accountContacts',
					'servicePlan',
					'usageAndCallRestrictions',
					'creditBalanceAndFeatures',
					'appRestrictions',
					'review'
				]
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
				defaultLanguage = _.get(monster.config, 'whitelabel.language', monster.defaultLanguage),
				defaultData = {
					parentAccountId: parentAccountId,
					// General Settings defaults
					generalSettings: {
						accountInfo: {
							language: defaultLanguage,
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
						allowPerMinuteCalls: false,
						callRestrictions: {
							_all: true
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
						accessLevel: 'restricted',
						allowedAppIds: []
					}
				},
				stepNames = self.appFlags.wizard.stepNames;

			// Clean store, in case it was not empty, to avoid using old data
			self.wizardSetStore({});

			if (!_.chain(monster.config).get('whitelabel.realm_suffix').isEmpty().value()) {
				defaultData.generalSettings.accountInfo.whitelabeledAccountRealm = monster.util.randomString(7) + '.' + monster.config.whitelabel.realm_suffix;
			}

			monster.waterfall([
				function(waterfallCallback) {
					monster.ui.insertTemplate($container, function() {
						// Defer to ensure that the loading template does not replace the step template
						_.defer(waterfallCallback, null);
					});
				},
				function(waterfallCallback) {
					if (monster.util.isReseller() || monster.util.isSuperDuper()) {
						return waterfallCallback(null);
					}
					waterfallCallback({
						nonReseller: true
					});
				},
				function(waterfallCallback) {
					self.wizardGetServicePlanList({
						success: function(plans) {
							waterfallCallback(null, plans);
						},
						error: function() {
							waterfallCallback(null, []);
						}
					});
				}
			], function(err, plans) {
				if (_.isEmpty(plans)) {
					stepNames = _.without(stepNames, 'servicePlan');
				}

				monster.pub('common.navigationWizard.render', {
					thisArg: self,
					data: defaultData,
					container: $container,
					steps: _.map(stepNames, function(stepName) {
						var pascalCasedStepName = _.upperFirst(stepName);

						return {
							label: _.get(i18nSteps, [ stepName, 'label' ]),
							description: _.get(i18nSteps, [ stepName, 'description' ]),
							template: 'wizard' + pascalCasedStepName + 'Render',
							util: 'wizard' + pascalCasedStepName + 'Util'
						};
					}),
					title: i18n.title,
					cancel: 'wizardClose',
					done: 'wizardSubmit',
					doneButton: i18n.doneButton,
					validateOnStepChange: true,
					askForConfirmationBeforeExit: true
				});
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
						$countriesDropdown = $template.find('#account_info_country'),
						$timezoneDropDown = $template.find('#account_info_timezone');

					timezone.populateDropdown($timezoneDropDown, generalSettingsData.accountInfo.timezone);
					monster.ui.chosen($timezoneDropDown);

					monster.ui.countrySelector($countriesDropdown, generalSettingsData.accountInfo.country);

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
						},
						onfocusout: self.wizardValidateFormField,
						autoScrollOnInvalid: true
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
				isValid = false,
				generalSettingsData;

			// Set dynamic validations
			$form.find('.admin-user-item input[type="password"]').each(function() {
				$(this).rules('add', {
					minlength: 6
				});
			});

			isValid = monster.ui.valid($form);

			if (isValid) {
				generalSettingsData = monster.ui.getFormData($form.get(0));

				// Clean generalSettings previous data, to avoid merging the array of admin
				// users, due to the way that `lodash#merge` handles array merging, which consists
				// in combining the contents of the object and source arrays. This causes to keep
				// deleted admin users, because they are present in the old data.
				delete args.data.generalSettings;

				// Set whitelabeledAccountRealm as accountRealm, if exists
				if (_.has(generalSettingsData.accountInfo, 'whitelabeledAccountRealm')) {
					generalSettingsData.accountInfo.accountRealm = generalSettingsData.accountInfo.whitelabeledAccountRealm;
				}

				// If there are no admin users, set an empty array
				if (!_.has(generalSettingsData, 'accountAdmins')) {
					generalSettingsData.accountAdmins = [];
				}
			}

			return {
				valid: isValid,
				data: {
					generalSettings: generalSettingsData
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

					monster.ui.validate($template.find('form'), {
						rules: {
							'technicalContact.phoneNumber': {
								phoneNumber: true
							},
							'billingContact.phoneNumber': {
								phoneNumber: true
							}
						},
						messages: {
							'technicalContact.phoneNumber': {
								phoneNumber: self.i18n.active().accountsApp.wizard.steps.general.errors.phoneNumber.invalid
							},
							'billingContact.phoneNumber': {
								phoneNumber: self.i18n.active().accountsApp.wizard.steps.general.errors.phoneNumber.invalid
							}
						},
						onfocusout: self.wizardValidateFormField,
						autoScrollOnInvalid: true
					});

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
		 * @param  {Object} args.eventArgs  Event arguments
		 * @param  {Boolean} args.eventArgs.completeStep  Whether or not the current step will be
		 *                                                completed
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardAccountContactsUtil: function($template, args, eventArgs) {
			var self = this,
				$form = $template.find('form'),
				// No need to validate if step won't be completed yet
				isValid = !eventArgs.completeStep || monster.ui.valid($form),
				accountContactsData;

			if (isValid) {
				accountContactsData = monster.ui.getFormData($form.get(0));

				// Extract and store date(s)
				$form.find('input.hasDatepicker').each(function() {
					var $this = $(this),
						propertyPath = $this.attr('name'),
						selectedDate = $this.datepicker('getDate');

					if (_.isNil(selectedDate)) {
						_.unset(accountContactsData, propertyPath);
					} else {
						_.set(accountContactsData, propertyPath, selectedDate);
					}
				});

				// Replace representative's userId with its ID and full name
				if (_.isEmpty(accountContactsData.salesRep.representative)) {
					delete accountContactsData.salesRep.representative;
				} else {
					var representativeUserId = accountContactsData.salesRep.representative,
						representativeFullName = _
							.chain(self.wizardGetStore('accountUsers'))
							.find({
								id: representativeUserId
							})
							.thru(monster.util.getUserFullName)
							.value();

					accountContactsData.salesRep.representative = {
						userId: representativeUserId,
						fullName: representativeFullName
					};
				}

				// Format phone numbers
				accountContactsData.technicalContact.phoneNumber = monster.util.getFormatPhoneNumber(accountContactsData.technicalContact.phoneNumber);
				accountContactsData.billingContact.phoneNumber = monster.util.getFormatPhoneNumber(accountContactsData.billingContact.phoneNumber);

				// Clean accountContacts previous data
				delete args.data.accountContacts;
			}

			return {
				valid: isValid,
				data: {
					accountContacts: accountContactsData
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
						self.wizardToggleElementsVisibility([$template.find('.service-plan-add')], false);
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
				$planAggregateContainer = $template.find('#service_plan_aggregate'),
				$planAddLink = $template.find('.service-plan-add'),
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
				},
				enablePlanSelectorControls = function(enable) {
					$planListContainer.find('select').prop('disabled', !enable).trigger('chosen:updated');
					$planListContainer.find('button.service-plan-remove').prop('disabled', !enable);
					$planAddLink.toggleClass('disabled');
				};

			$planAddLink.on('click', function(e) {
				e.preventDefault();

				if ($(this).hasClass('disabled')) {
					return;
				}

				self.wizardToggleElementsVisibility([$planAddLink], false);

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

				enablePlanSelectorControls(false);

				var $this = $(this),
					$servicePlanItem = $this.closest('.service-plan-item'),
					$selectInput = $servicePlanItem.find('select'),
					value = $selectInput.val();

				toggleSelectedPlan($servicePlanItem, value, null);

				monster.parallel([
					function(parallelCallback) {
						if (value === '') {
							parallelCallback(null);
							return;
						}

						self.serviceItemsListingRender({
							planIds: selectedPlanIds,
							container: $planAggregateContainer,
							success: function() {
								parallelCallback(null);
							},
							error: function() {
								parallelCallback(true);
							}
						});
					},
					function(parallelCallback) {
						if ($servicePlanItem.is(':only-child')) {
							$selectInput
								.val('')
								.data('value', '');

							self.wizardToggleElementsVisibility([$this, $planAddLink], false);

							parallelCallback(null);
						} else {
							$servicePlanItem
								.addClass('remove')
								.slideUp(self.appFlags.wizard.animationTimes.planInput, function() {
									var $servicePlanItems = $servicePlanItem.siblings(),
										$firstServicePlanItem = $servicePlanItems.first(),
										selectorCount = $servicePlanItems.length;

									$servicePlanItem.remove();

									if (selectorCount === selectedCount) {
										self.wizardToggleElementsVisibility([$planAddLink], true);
									} else if ($firstServicePlanItem.find('select').val() === '') {
										self.wizardToggleElementsVisibility([$firstServicePlanItem.find('.service-plan-remove')], false);
									}

									parallelCallback(null);
								});
						}
					}
				], function() {
					enablePlanSelectorControls(true);
				});
			});

			$planListContainer.on('change', 'select', function() {
				enablePlanSelectorControls(false);

				var $this = $(this),
					$servicePlanItem = $this.closest('.service-plan-item'),
					oldValue = $this.data('value'),
					newValue = $this.val();

				toggleSelectedPlan($servicePlanItem, oldValue, newValue);

				monster.parallel([
					function(parallelCallback) {
						self.serviceItemsListingRender({
							planIds: selectedPlanIds,
							container: $planAggregateContainer,
							success: function() {
								parallelCallback(null);
							},
							error: function() {
								parallelCallback(true);
							}
						});
					},
					function(parallelCallback) {
						if (oldValue === '' && newValue !== '') {
							var elementsToShow = [];

							if (selectedCount < plansCount) {
								elementsToShow.push($planAddLink);
							}
							if ($servicePlanItem.is(':first-child')) {
								elementsToShow.push($servicePlanItem.find('.service-plan-remove'));
							}

							self.wizardToggleElementsVisibility(elementsToShow, true);
						}

						$this.data('value', newValue);

						parallelCallback(null);
					}
				], function(err) {
					enablePlanSelectorControls(true);
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
				initTemplate = function(classifierList) {
					var usageAndCallRestrictionsData = args.data.usageAndCallRestrictions,
						dataTemplate = {
							trunkTypes: [
								'inbound',
								'outbound',
								'twoway'
							],
							callRestrictionTypes: classifierList,
							data: usageAndCallRestrictionsData
						},
						$template = $(self.getTemplate({
							name: 'step-usageAndCallRestrictions',
							data: dataTemplate,
							submodule: 'wizard'
						}));

					monster.ui.numberPicker($template.find('.number-picker'), {
						min: 0
					});

					monster.ui.tooltips($template);

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					self.wizardGetPhoneNumberClassifierList({
						success: function(classifierList) {
							asyncCallback(null, classifierList);
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
		 * Utility funcion to validate Usage and Call Restrictions form and extract data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardUsageAndCallRestrictionsUtil: function($template, args) {
			var self = this,
				$form = $template.find('form');

			// Clean usageAndCallRestrictions previous data, to avoid keeping default values that
			// are not overwriten by the new data
			delete args.data.usageAndCallRestrictions;

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
						appCount: appList.length,
						template: $template
					});

					return $template;
				};

			self.wizardRenderStep({
				container: $container,
				loadData: function(asyncCallback) {
					self.wizardGetAppList({
						scope: 'account',
						success: function(appList) {
							asyncCallback(null, appList);
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
		 * Utility funcion to extract App Restrictions data
		 * @param  {jQuery} $template  Step template
		 * @param  {Object} args  Wizard's arguments
		 * @param  {Object} args.data  Wizard's data that is shared across steps
		 * @returns  {Object}  Object that contains the updated step data, and if it is valid
		 */
		wizardAppRestrictionsUtil: function($template, args) {
			var self = this,
				appRestrictionsData = monster.ui.getFormData($template.find('form').get(0));

			if (appRestrictionsData.accessLevel === 'full' || !_.has(appRestrictionsData, 'allowedAppIds')) {
				appRestrictionsData.allowedAppIds = [];
			};

			// Clean appRestrictions previous data, to avoid merging the array of allowedAppIds
			delete args.data.appRestrictions;

			return {
				valid: true,
				data: {
					appRestrictions: appRestrictionsData
				}
			};
		},

		/**
		 * Bind App Restrictions step events
		 * @param  {Object} args
		 * @param  {jQuery} args.allowedAppIds  Allowed app IDs
		 * @param  {Number} args.appCount  Total count of available apps
		 * @param  {jQuery} args.template  Step template
		 */
		wizardAppRestrictionsBindEvents: function(args) {
			var self = this,
				slideAnimationDuration = self.appFlags.wizard.animationTimes.allowedApps,
				appCount = args.appCount,
				allowedAppIds = _.clone(args.allowedAppIds),	// Create a copy of the data, in order to not to alter the original one
				$template = args.template,
				$allowedAppsSection = $template.find('#section_allowed_apps'),
				$appList = $allowedAppsSection.find('.app-list'),
				$appAdd = $allowedAppsSection.find('.app-add');

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

			$appAdd.find('.wizard-card').on('click', function() {
				monster.pub('common.appSelector.renderPopup', {
					scope: 'account',
					excludedApps: allowedAppIds,
					callbacks: {
						accept: function(selectedAppIds) {
							var $selectedAppCards = $([]);

							_.each(selectedAppIds, function(appId) {
								allowedAppIds.push(appId);
								$selectedAppCards = $selectedAppCards.add($appList.find('#app_' + appId));
							});

							$selectedAppCards.find('.app-selected').prop('checked', true);

							if (allowedAppIds.length === appCount) {
								$appAdd.removeClass('visible');
							}

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

				$appAdd.addClass('visible');

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

					// The numbering is dynamically set through jQuery
					// because some steps may be omitted from the template
					$template.find('.step-number').each(function(idx, el) {
						$(el).text(idx + 1);
					});

					self.wizardReviewBindEvents({
						template: $template
					});

					return $template;
				},
				renderStepArgs = {
					container: $container,
					initTemplate: initTemplate
				};

			if (_.has(data, 'servicePlan')) {
				renderStepArgs.loadData = function(asyncCallback) {
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
				};
			}

			self.wizardRenderStep(renderStepArgs);
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

			// Replace representative's full data with user friendly data
			formattedData.accountContacts.salesRep.representative = _.get(
				formattedData.accountContacts.salesRep,
				'representative.fullName'
			);

			if (_.has(formattedData.accountContacts.salesRep, 'contractEndDate')) {
				var contractEndDate = formattedData.accountContacts.salesRep.contractEndDate,
					// Convert to gregorian with current time zone, to prevent inconsistencies
					// due to possible diff in browser's and account's time zones
					contractEndDateGregorian = self.wizardDateToGregorianWithCurrentTimeZone(contractEndDate);

				formattedData.accountContacts.salesRep.contractEndDate = monster.util.toFriendlyDate(contractEndDateGregorian, 'date', undefined, true);
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
			formattedData.usageAndCallRestrictions.callRestrictionTypes = self.wizardGetStore('numberClassifiers');

			// Set app list
			formattedData.appRestrictions.apps = self.wizardGetStore(['apps', 'account']);

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

						var stepName = $(this).data('step_name'),
							stepId = _.indexOf(self.appFlags.wizard.stepNames, stepName);

						monster.pub('common.navigationWizard.goToStep', {
							stepId: stepId
						});
					});

			$template
				.find('.password-toggle')
					.on('change', function(e) {
						$(this)
							.closest('.password-field')
								.find('.password-value')
									.toggleClass('password-hidden');
					});

			$template
				.find('#step_print')
					.on('click', function(e) {
						e.preventDefault();

						window.print();
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
				$container = args.container,
				// This function creates a new async.js callback, to allow the parallel tasks to
				// continue regardless if one of them fail, because it packs the error as part of
				// the result, and returns a null value as error
				addErrorToResult = function(callback) {
					return function(err, result) {
						var newResult = {};

						if (err) {
							newResult.error = err;
						}

						if (result) {
							newResult.value = result;
						}

						callback(null, newResult);
					};
				};

			monster.waterfall([
				function(waterfallCallback) {
					self.wizardRequestResourceCreateOrUpdate({
						resource: 'account.create',
						accountId: wizardData.parentAccountId,
						data: self.wizardSubmitGetFormattedAccount(wizardData),
						generateError: true,
						callback: function(err, newAccount) {
							if (err) {
								waterfallCallback({
									type: 'account',
									error: err
								});
							} else {
								waterfallCallback(null, newAccount);
							}
						}
					});
				},
				function(newAccount, waterfallCallback) {
					var newAccountId = newAccount.id,
						users = self.wizardSubmitGetFormattedUsers(wizardData),
						parallelFunctions = {
							appBlacklist: function(parallelCallback) {
								self.wizardRequestAppBlacklistUpdate({
									accountId: newAccountId,
									appRestrictions: wizardData.appRestrictions,
									callback: addErrorToResult(parallelCallback)
								});
							},
							limits: function(parallelCallback) {
								self.wizardRequestLimitsUpdate({
									accountId: newAccountId,
									limits: self.wizardSubmitGetFormattedLimits(wizardData),
									callback: addErrorToResult(parallelCallback)
								});
							},
							noMatchCallflow: function(parallelCallback) {
								// Invoke method form main app
								self.createNoMatchCallflow({
									accountId: newAccountId,
									resellerId: newAccount.reseller_id
								}, function(data) {
									addErrorToResult(parallelCallback)(null, _.get(data, 'data'));
								});
							},
							plan: function(parallelCallback) {
								var plan = self.wizardSubmitGetFormattedServicePlan(wizardData);

								if (_.isNil(plan)) {
									return parallelCallback(null);
								}

								self.wizardRequestResourceCreateOrUpdate({
									resource: 'services.bulkChange',
									accountId: newAccountId,
									data: plan,
									callback: addErrorToResult(parallelCallback)
								});
							},
							credit: function(parallelCallback) {
								var creditLedger = self.wizardSubmitGetFormattedLedgerCredit(wizardData);

								if (_.isNil(creditLedger)) {
									return parallelCallback(null);
								}

								self.wizardRequestResourceCreateOrUpdate({
									resource: 'ledgers.credit',
									accountId: newAccountId,
									data: creditLedger,
									callback: addErrorToResult(parallelCallback)
								});
							}
						};

					_.each(users, function(user, index) {
						parallelFunctions['user' + index] = function(parallelCallback) {
							self.wizardRequestResourceCreateOrUpdate({
								resource: 'user.create',
								accountId: newAccountId,
								data: user,
								callback: addErrorToResult(parallelCallback)
							});
						};
					});

					monster.parallel(parallelFunctions, function(err, results) {
						var errors = _.transform(results, function(newObj, value, key) {
							if (!_.has(value, 'error')) {
								return;
							}
							newObj[key] = value.error;
						});

						if (_.isEmpty(errors)) {
							waterfallCallback(null, newAccountId);
							return;
						}

						waterfallCallback({
							type: 'features',
							error: errors
						}, newAccountId);
					});
				}
			], function(err, newAccountId) {
				if (err) {
					self.wizardSubmitNotifyErrors(err);

					if (err.type === 'account') {
						// Nor the account nor any of its related parts were created
						// So let's remain in the wizard
						return;
					}
				}

				monster.pub('accountsManager.activate', {
					container: $container,
					selectedId: newAccountId
				});
			});
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
				salesRepresentative = accountContacts.salesRep,
				controlCenterFeatures = wizardData.creditBalanceAndFeatures.controlCenterAccess.features,
				accountDocument = {
					call_restriction: _
						.mapValues(wizardData.usageAndCallRestrictions.callRestrictions, function(value) {
							return {
								action: value ? 'inherit' : 'deny'
							};
						}),
					contact: {
						billing: {
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
						}
					},
					language: accountInfo.language,
					name: accountInfo.accountName,
					timezone: accountInfo.timezone,
					ui_restrictions: {
						myaccount: _
							.chain(self.appFlags.wizard.controlCenterFeatures.tree)
							.flatMap('features')
							.keyBy('name')
							.mapValues(function(feature) {
								return _.transform(feature.features, function(object, subFeature) {
									_.set(object, 'show_' + subFeature.name, controlCenterFeatures[subFeature.name]);
								}, {
									show_tab: controlCenterFeatures[feature.name]
								});
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

			// Set optional data
			if (_.has(accountInfo, 'realm')) {
				accountDocument.realm = accountInfo.realm;
			}
			if (_.has(salesRepresentative, 'contractEndDate')) {
				var contractEndDateGregorian = self.wizardDateToGregorianWithCurrentTimeZone(salesRepresentative.contractEndDate);

				_.set(accountDocument, 'contract.end_date', contractEndDateGregorian);
			}
			if (_.has(salesRepresentative, 'representative')) {
				_.set(
					accountDocument,
					'contract.representative',
					{
						account_id: self.accountId,
						user_id: salesRepresentative.representative.userId,
						name: salesRepresentative.representative.fullName
					}
				);
			}

			return accountDocument;
		},

		/**
		 * Build the ledger credit object to submit to the API, from the wizard data
		 * @param  {Object} wizardData  Wizard's data
		 * @returns  {Object|null}  Ledger credit data. If the amount is zero, then returns null.
		 */
		wizardSubmitGetFormattedLedgerCredit: function(wizardData) {
			var self = this,
				amount = _.toNumber(wizardData.creditBalanceAndFeatures.accountCredit.initialBalance);

			if (amount === 0) {
				return null;
			}

			return {
				amount: amount,
				description: 'Credit added by administrator',
				metadata: {
					automatic_description: true,
					ui_request: true
				},
				source: {
					id: monster.util.guid(),
					service: 'adjustments'
				},
				usage: {
					quantity: 0,
					type: 'credit',
					unit: monster.config.currencyCode
				}
			};
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
					email: adminUser.email,
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
		 * @returns  {Object|null}  Object that contains the selected service plans. If no plans
		 * 							were selected, then returns null.
		 */
		wizardSubmitGetFormattedServicePlan: function(wizardData) {
			var self = this,
				selectedPlanIds = _.get(wizardData, 'servicePlan.selectedPlanIds');

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
			var self = this;

			return _.transform(wizardData.usageAndCallRestrictions.trunkLimits, function(object, value, trunkType) {
				_.set(object, trunkType + '_trunks', _.toNumber(value));
			}, {
				allow_prepay: wizardData.usageAndCallRestrictions.allowPerMinuteCalls
			});
		},

		/**
		 * Notify any errors that were raised during data submission
		 * @param  {Object} error  Main error object
		 * @param  {('account'|'features')} error.type  Error type
		 * @param  {Object} [error.error]  Error details per feature
		 */
		wizardSubmitNotifyErrors: function(error) {
			var self = this,
				errorMessageKeys = [];

			if (_.get(error, 'type') === 'account') {
				// Nor the account nor any of its related parts were created
				monster.ui.toast({
					type: 'error',
					message: self.i18n.active().toastrMessages.newAccount.accountError
				});

				return;
			}

			// If the account creation did not fail, there were errors in any of the features
			_.each(error.error, function(errorDetails, key) {
				if (_.includes(['limits', 'plan'], key) && _.get(errorDetails, 'error') === '403') {
					errorMessageKeys.push('forbidden' + _.upperFirst(key) + 'Error');
				} else if (_.get(errorDetails, 'error') !== '402') {	// Only show error if error isn't a 402, because a 402 is handled generically
					if (_.startsWith(key, 'user')) {
						if (!_.includes(errorMessageKeys, 'adminError')) {
							errorMessageKeys.push('adminError');
						}
					} else {
						errorMessageKeys.push(key + 'Error');
					}
				}
			});

			// Show collected error messages
			_.each(errorMessageKeys, function(errorKey) {
				monster.ui.toast({
					type: 'warning',
					message: monster.util.tryI18n(self.i18n.active().toastrMessages.newAccount, errorKey)
				});
			});
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
		 * Request apps blacklist update for an account
		 * @param  {Object} args
		 * @param  {String} args.accountId  Account ID
		 * @param  {Object} args.appRestrictions  App restrictions
		 * @param  {('full'|'restricted')} args.appRestrictions.accessLevel  App restrictions
		 * @param  {String[]} args.appRestrictions.allowedAppIds  Allowed app IDs
		 * @param  {Function} args.callback  Async.js callback
		 */
		wizardRequestAppBlacklistUpdate: function(args) {
			var self = this,
				accountId = args.accountId,
				appRestrictions = args.appRestrictions,
				callback = args.callback;

			monster.waterfall([
				function(waterfallCallback) {
					if (appRestrictions.accessLevel === 'full') {
						return waterfallCallback(null, []);
					}

					self.wizardGetAppList({
						scope: 'all',
						success: function(appList) {
							waterfallCallback(null, appList);
						},
						error: function(err) {
							waterfallCallback(err);
						}
					});
				},
				function(appList, waterfallCallback) {
					var blacklist = _
						.chain(appList)
						.map('id')
						.difference(appRestrictions.allowedAppIds)
						.value();

					self.wizardRequestResourceCreateOrUpdate({
						resource: 'appsStore.updateBlacklist',
						accountId: accountId,
						data: {
							blacklist: blacklist
						},
						callback: waterfallCallback
					});
				}
			], callback);
		},

		/**
		 * Request limits update for an account
		 * @param  {Object} args
		 * @param  {String} args.accountId  Account ID
		 * @param  {Object} args.limits  Limits to update
		 * @param  {Function} args.callback  Async.js callback
		 */
		wizardRequestLimitsUpdate: function(args) {
			var self = this,
				accountId = args.accountId,
				newLimits = args.limits,
				callback = args.callback;

			monster.waterfall([
				function(waterfallCallback) {
					self.callApi({
						resource: 'limits.get',
						data: {
							accountId: accountId
						},
						success: function(data) {
							waterfallCallback(null, data.data);
						},
						error: function(parsedError) {
							waterfallCallback(parsedError);
						}
					});
				},
				function(limits, waterfallCallback) {
					if (_.chain(limits).pick(_.keys(newLimits)).isEqual(newLimits).value()) {
						// New limits are equal to the default ones,
						// so there is no need for update
						return waterfallCallback(null, limits);
					}

					self.callApi({
						resource: 'limits.update',
						data: {
							accountId: accountId,
							data: _.merge(limits, newLimits),
							acceptCharges: true,
							generateError: false
						},
						success: function(data) {
							waterfallCallback(null, data.data);
						},
						error: function(parsedError) {
							waterfallCallback(parsedError);
						},
						onChargesCancelled: function() {
							waterfallCallback(null, {});
						}
					});
				}
			], callback);
		},

		/**
		 * Request the creation of a new resource document
		 * @param  {Object} args
		 * @param  {String} args.resource  Resource name
		 * @param  {String} args.accountId  Account ID
		 * @param  {Object} args.data  New user data
		 * @param  {Boolean} [args.acceptCharges=true]  Whether or not to accept charges without
		 *                                              asking the user
		 * @param  {Boolean} [args.generateError=false]  Whether or not show error dialog
		 * @param  {Function} args.callback  Async.js callback
		 */
		wizardRequestResourceCreateOrUpdate: function(args) {
			var self = this;

			self.callApi({
				resource: args.resource,
				data: {
					accountId: args.accountId,
					data: args.data,
					acceptCharges: _.get(args, 'acceptCharges', true),
					generateError: _.get(args, 'generateError', false)
				},
				success: function(data) {
					args.callback(null, data.data);
				},
				error: function(parsedError) {
					args.callback(parsedError);
				}
			});
		},

		/**
		 * Request the list of service plans for the current account
		 * @param  {Object} args
		 * @param  {String} args.resource
		 * @param  {Boolean} [args.generateError=true]  Whether or not show error dialog
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardRequestResourceList: function(args) {
			var self = this;

			self.callApi({
				resource: args.resource,
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					},
					generateError: _.get(args, 'generateError', true)
				},
				success: function(data) {
					args.success(data.data);
				},
				error: args.error
			});
		},

		/* UTILITY FUNCTIONS */

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
		 * @param  {('all'|'account'|'user')} args.scope  App list scope
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetAppList: function(args) {
			var self = this,
				scope = args.scope;

			self.wizardGetDataList(_.merge({
				storeKey: ['apps', scope],
				requestData: function(reqArgs) {
					monster.pub('apploader.getAppList', {
						scope: scope,
						success: function(appList) {
							appList = _.sortBy(appList, 'label');
							reqArgs.success(appList);
						},
						error: args.error
					});
				}
			}, args));
		},

		/**
		 * Gets a list of data saved in the local store. If the list is not stored, then it is
		 * requested to the API, for which either the resource name or the request data
		 * function should be provided.
		 * @param  {Object} args
		 * @param  {('accountUsers'|'apps'|'numberClassifiers'|'servicePlans')} args.storeKey  Key used to save/retrieve the data in the store
		 * @param  {String} [args.resource]  Resource name to request the data from the API
		 * @param  {Function} [args.requestData]  Function to be used to request the data, if a
		 *                                        resource name is not provided
		 * @param  {Boolean} [args.generateError=true]  Whether or not show error dialog, if there
		 *                                              is an error while requesting the data
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetDataList: function(args) {
			var self = this,
				storeKey = args.storeKey,
				requestData = args.requestData,
				dataList = self.wizardGetStore(storeKey),
				successCallback = function(dataList) {
					self.wizardSetStore(storeKey, dataList);
					args.success(dataList);
				};

			if (!_.isUndefined(dataList)) {
				args.success(dataList);
				return;
			}

			if (_.has(args, 'resource')) {
				var requestResourceArgs = _
					.chain(args)
					.pick('resource', 'error', 'generateError')
					.merge({
						success: successCallback
					})
					.value();

				self.wizardRequestResourceList(requestResourceArgs);
			} else {
				requestData({
					success: successCallback,
					error: args.error
				});
			}
		},

		/**
		 * Gets the stored list of phone number classifiers available for the current account.
		 * If the list is not stored, then it is requested to the API.
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetPhoneNumberClassifierList: function(args) {
			var self = this,
				requestData = function(reqArgs) {
					self.wizardRequestResourceList({
						resource: 'numbers.listClassifiers',
						success: function(classifierList) {
							var formattedClassifierList = _
								.chain(classifierList)
								.map(function(classifier, type) {
									return {
										type: type,
										label: _.get(
											self.i18n.active().accountsApp.wizard,
											'steps.usageAndCallRestrictions.callRestrictions.labels.' + type,
											classifier.friendly_name)
									};
								})
								.sortBy('label')
								.value();

							reqArgs.success(formattedClassifierList);
						},
						error: reqArgs.error
					});
				};

			self.wizardGetDataList(_.merge({
				storeKey: 'numberClassifiers',
				requestData: requestData
			}, args));
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
				errorCallback = function(data, error, globalHandler) {
					if (error.status !== 404) {
						globalHandler(data, { generateError: true });
					}
					_.has(args, 'error') && args.error(data);
				},
				getDataListArgs = _.merge({}, args, {
					storeKey: 'servicePlans',
					resource: 'servicePlan.list',
					generateError: false,
					error: errorCallback
				});

			self.wizardGetDataList(getDataListArgs);
		},

		/**
		 * Gets the stored list of users for the current account. If the list is not stored, then
		 * it is requested to the API.
		 * @param  {Object} args
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		wizardGetUserList: function(args) {
			var self = this;

			self.wizardGetDataList(_.merge({
				storeKey: 'accountUsers',
				resource: 'user.list'
			}, args));
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

				// Deferred, to ensure that the loading template does not replace the step template
				_.defer(insertTemplateCallback, initTemplate(data), self.wizardScrollToTop);
			});
		},

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

		/**
		 * Validates a form input field
		 * @param  {Element} element  Input element
		 */
		wizardValidateFormField: function(element) {
			$(element).valid();
		},

		/**
		 * Converts the date part of a Javascript Date to gregorian time,
		 * using the current time zone
		 * @param  {Date} date  Date to convert
		 * @returns  {Number}  Gregorian time
		 */
		wizardDateToGregorianWithCurrentTimeZone: function(date) {
			return monster.util.dateToBeginningOfGregorianDay(
				date,
				monster.util.getCurrentTimeZone()
			);
		},

		/* STORE FUNCTIONS */

		/**
		 * Store getter
		 * @param  {('accountUsers'|'numberClassifiers'|'servicePlans'|String[])} [path]
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
		 * @param  {('accountUsers'|'numberClassifiers'|'servicePlans'|String[])} path|value
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
