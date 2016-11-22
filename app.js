define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		chosen = require('chosen'),
		monster = require('monster'),
		toastr = require('toastr'),
		timezone = require('monster-timezone');

	var app = {
		name: 'accounts',

		css: [ 'app' ],

		i18n: { 
			'en-US': { customCss: false },
			'fr-FR': { customCss: false },
			'ru-RU': { customCss: false },
			'es-ES': { customCss: false }
		},

		requests: {},

		subscribe: {
			'accountsManager.activate': '_render',
			'accountsManager.renderNewAccount': 'renderNewAccountWizard'
		},

		shortcuts: {
			'a': 'accountsManager.renderNewAccount'
		},

		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		/* Available args *
		 * `container`: Container of the App, defaults to $('#monster-content')
		 * `parentId`: ID of the parent account used to display the list
		 * `selectedId`: ID of the account to show as selected in the list
		 * `callback`: callback to be executed after the rendering
		 */
		render: function(args){
			var self = this;

			self._render(args);
		},

		// subscription handlers
		_render: function(pArgs) {
			var self = this,
				args = pArgs || {},
				container = args.container,
				accountsManager = $(monster.template(self, 'accountsManager')),
				accountsManagerLanding = $(monster.template(self, 'accountsManagerLanding')),
				parent = container || $('#monster-content');

				accountsManager.find('.main-content')
							   .append(accountsManagerLanding);

			parent.empty()
				  .append(accountsManager);

			self.renderAccountsManager({
				container: accountsManager,
				selectedId: args.selectedId,
				selectedTab: args.selectedTab,
				callback: args.callback
			});
		},

		renderAccountsManager: function(args) {
			var self = this,
				parent = args.container,
				selectedId = args.selectedId,
				selectedTab = args.selectedTab,
				callback = args.callback;

			monster.pub('common.accountBrowser.render', {
				container: parent.find('.edition-view .left-menu'),
				selectedId: selectedId,
				addBackButton: true,
				noFocus: true,
				onNewAccountClick: function(parentAccountId, breadcrumbs) {
					self.renderNewAccountWizard({
						parent: parent,
						accountId: parentAccountId || self.accountId
					});
				},
				onAccountClick: function(accountId) {
					parent.find('.main-content').empty();
					self.edit({
						accountId: accountId,
						parent: parent
					});
				},
				callback: selectedId ? function() {
					self.edit({
						accountId: selectedId,
						selectedTab: selectedTab,
						parent: parent
					});
					callback && callback();
				} : callback
			});

			// Clicking on link in breadcrumbs should edit that account
			parent.find('.top-bar').on('click', '.account-browser-breadcrumb a', function() {
				parent.find('.main-content').empty();
				self.edit({
					accountId: $(this).data('id'),
					parent: parent
				});
			});

			// give time to the DOM to load all the elements before the resize happens
			setTimeout(function() {
				// Adjusting the layout divs height to always fit the window's size
				$(window).resize(function(e) {
					var $accountListContainer = parent.find('.account-list-container'),
						$mainContent = parent.find('.main-content'),
						listHeight = this.innerHeight-$accountListContainer.position().top+'px'; //
					$accountListContainer.css('height', listHeight);
					$mainContent.css('height', this.innerHeight-$mainContent.position().top+'px');
				});
				$(window).resize();
			}, 100);
		},

		formatAccountCreationData: function(newAccountWizard, formData) {
			var self = this;

			formData.account.call_restriction = {}; // Can't use form data for this since unchecked checkboxes are not retrieved by form2object

			$.each(newAccountWizard.find('.call-restrictions-element input[type="checkbox"]'), function() {
				var $this = $(this);
				formData.account.call_restriction[$this.data('id')] = {
					action: $this.is(':checked') ? 'inherit' : 'deny'
				};
			});

			return formData;
		},

		renderNewAccountWizard: function(params) {
			var self = this,
				parent = params.parent || $('#accounts_manager_view'),
				parentAccountId = params.accountId || self.accountId,
				dataTemplate = {};

			if(monster.config.whitelabel.hasOwnProperty('realm_suffix') && monster.config.whitelabel.realm_suffix.length) {
				dataTemplate.whitelabeledRealm = monster.util.randomString(7) + '.' + monster.config.whitelabel.realm_suffix;
			}

			var newAccountWizard = $(monster.template(self, 'newAccountWizard', dataTemplate)),
				maxStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('max_step')),
				newAccountWizardForm = newAccountWizard.find('#accountsmanager_new_account_form');

			newAccountWizard.find('.wizard-top-bar').data('active_step', '1');

			newAccountWizard.find('.wizard-content-step').hide();
			newAccountWizard.find('.wizard-content-step[data-step="1"]').show();

			if(!monster.apps.auth.isReseller) {
				newAccountWizard.find('.wizard-top-bar .step[data-step="2"]').hide();
			}

			if(maxStep > 1) {
				newAccountWizard.find('.submit-btn').hide();
			}
			else {
				newAccountWizard.find('.next-step').hide();
			}

			newAccountWizard.find('.prev-step').hide();

			newAccountWizard.find('.step').on('click', function() {
				var currentStep = newAccountWizard.find('.wizard-top-bar').data('active_step'),
					newStep = $(this).data('step');
				if($(this).hasClass('completed') && currentStep !== newStep) {
					if(newStep < currentStep) {
						if(!monster.ui.valid(newAccountWizardForm)) {
							newAccountWizard.find('.step:gt('+newStep+')').removeClass('completed');
						}
						self.changeStep(newStep, maxStep, newAccountWizard);
					} else if(monster.ui.valid(newAccountWizardForm)) {
						self.changeStep(newStep, maxStep, newAccountWizard);
					}
				}
			});

			newAccountWizard.find('.next-step').on('click', function(ev) {
				ev.preventDefault();

				var currentStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step')),
					newStep = currentStep+1;
				if(newStep === 2 && !monster.apps.auth.isReseller) {
					newStep++;
				}
				if(monster.ui.valid(newAccountWizardForm)) {
					self.changeStep(newStep, maxStep, newAccountWizard);
				}
			});

			newAccountWizard.find('.prev-step').on('click', function(ev) {
				ev.preventDefault();

				var newStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step'))-1;
				if(newStep === 2 && !monster.apps.auth.isReseller) {
					newStep--;
				}
				if(!monster.ui.valid(newAccountWizardForm)) {
					newAccountWizard.find('.step:gt('+newStep+')').removeClass('completed');
				}
				self.changeStep(newStep, maxStep, newAccountWizard);
			});

			newAccountWizard.find('.cancel').on('click', function(ev) {
				ev.preventDefault();

				parent.find('.edition-view').show();

				parent.find('.creation-view').empty();
			});

			newAccountWizard.find('.submit-btn').on('click', function(ev) {
				ev.preventDefault();

				var currentStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step')),
					toggleProcessing = function(show) {
						var stepsDiv = newAccountWizard.find('#accountsmanager_new_account_form'),
							processingDiv = newAccountWizard.find('.processing-div');

						if(show) {
							stepsDiv.hide();
							processingDiv.show();
							processingDiv.find('i.fa-spinner').addClass('fa-spin');
							newAccountWizard.find('.step').removeClass('completed');
						} else {
							stepsDiv.show();
							processingDiv.hide();
							processingDiv.find('i.fa-spinner').removeClass('fa-spin');
							newAccountWizard.find('.step').addClass('completed');
						}
					};

				if(monster.ui.valid(newAccountWizardForm)) {
					var formData = monster.ui.getFormData('accountsmanager_new_account_form');

					formData = self.formatAccountCreationData(newAccountWizardForm, formData);

					toggleProcessing(true);

					self.callApi({
						resource: 'account.create',
						data: {
							accountId: parentAccountId,
							data: formData.account
						},
						success: function(data, status) {
							var newAccountId = data.data.id;
							monster.parallel({
								admin: function(callback) {
									if(formData.user.email) {
										if(formData.extra.autogenPassword) {
											formData.user.password = self.autoGeneratePassword();
											formData.user.send_email_on_creation = true;
										}
										formData.user.username = formData.user.email;
										formData.user.priv_level = "admin";
										self.callApi({
											resource: 'user.create',
											data: {
												accountId: newAccountId,
												data: formData.user
											},
											success: function(data, status) {
												callback(null, data.data);
												if(formData.user.send_email_on_creation) {
													var popupContent = monster.template(self, '!' + self.i18n.active().sentEmailPopup, { email: data.data.email });
													monster.ui.alert('info', popupContent);
												}
											},
											error: function(data, status) {
												toastr.error(self.i18n.active().toastrMessages.newAccount.adminError, '', {"timeOut": 10000});
												callback(null, {});
											}
										});
									} else {
										callback();
									}
								},
								noMatch: function(callback) {
									self.createNoMatchCallflow({ accountId: newAccountId, resellerId: data.data.reseller_id }, function(data) {
										callback(null, data);
									});
								},
								limits: function(callback) {
									self.callApi({
										resource: 'limits.get',
										data: {
											accountId: newAccountId
										},
										success: function(data, status) {
											var newLimits = {
												allow_prepay: formData.limits.allow_prepay,
												inbound_trunks: parseInt(formData.limits.inbound_trunks, 10),
												outbound_trunks: parseInt(formData.limits.outbound_trunks, 10),
												twoway_trunks: parseInt(formData.limits.twoway_trunks, 10)
											};
											self.callApi({
												resource: 'limits.update',
												data: {
													accountId: newAccountId,
													data: $.extend(true, {}, data.data, newLimits),
													generateError: false
												},
												success: function(data, status) {
													callback(null, data.data);
												},
												error: function(data, status) {
													if(data.error === 403) {
														toastr.info(self.i18n.active().toastrMessages.newAccount.forbiddenLimitsError, '', {"timeOut": 10000});
														callback(null, {});
													}
													// Only show error if error isn't a 402, because a 402 is handled generically
													else if(data.error !== 402) {
														toastr.info(self.i18n.active().toastrMessages.newAccount.limitsError, '', {"timeOut": 10000});
														callback(null, {});
													}
												},
												onChargesCancelled: function() {
													callback(null, {});
												}
											});
										},
										error: function(data, status) {
											callback(null, {});
										}
									});
								},
								credit: function(callback) {
									if(formData.addCreditBalance) {
										self.addCredit(newAccountId, formData.addCreditBalance, function(data, status) {
											callback(null, data.data);
										},
										function(data, status) {
											callback(null, {});
											toastr.info(self.i18n.active().toastrMessages.newAccount.creditError, '', {"timeOut": 10000});
										});
									} else {
										callback();
									}
								},
								servicePlans: function(callback) {
									if(monster.util.isSuperDuper()) {
										monster.pub('common.servicePlanDetails.customizeSave', {
											container: newAccountWizardForm.find('.common-container'),
											accountId: newAccountId,
											callback: function() {
												callback();
											}
										});
									}
									else {
										callback();
									}
								}
							},
							function(err, results) {
								self.render({
									selectedId: newAccountId
								});
							});
						},
						error: function(data, status) {
							toastr.error(self.i18n.active().toastrMessages.newAccount.accountError, '', {"timeOut": 5000});
							toggleProcessing(false);
						}
					});
				}
			});

			self.renderWizardSteps(newAccountWizard);
			monster.ui.validate(newAccountWizard.find('#accountsmanager_new_account_form'), {
				rules: {
					'user.password': {
						minlength: 6
					},
					'extra.confirmPassword': {
						equalTo: 'input[name="user.password"]'
					},
					'addCreditBalance': {
						number: true,
						min: 5
					}
				}
			});
			monster.ui.showPasswordStrength(newAccountWizard.find('input[name="user.password"]'));

			parent.find('.edition-view').hide();
			parent.find('.creation-view').empty().append(newAccountWizard);
		},

		renderWizardSteps: function(parent) {
			var self = this;

			monster.parallel({
					classifiers: function(callback) {
						self.callApi({
							resource: 'numbers.listClassifiers',
							data: {
								accountId: self.accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							},
							error: function(data, status) {
								callback(null, {});
							}
						});
					}
				},
				function(err, results) {
					self.renderAccountInfoStep({
						parent: parent.find('.wizard-content-step[data-step="1"]')
					});

					self.renderServicePlanStep({
						parent: parent.find('.wizard-content-step[data-step="2"]')
					});

					self.renderLimitsStep({
						parent: parent.find('.wizard-content-step[data-step="3"]'),
						classifiers: results.classifiers
					});

					self.renderRestrictionsStep({
						parent: parent.find('.wizard-content-step[data-step="4"]')
					});
				}
			);
		},

		renderAccountInfoStep: function(params) {
			var self = this,
				parent = params.parent,
				newAdminDiv = parent.find('.new-admin-div'),
				autogenBtn = newAdminDiv.find('.autogen-button'),
				manualBtn = newAdminDiv.find('.manual-button'),
				autogenCheckbox = newAdminDiv.find('.autogen-ckb'),
				pwdToggleDiv = newAdminDiv.find('.password-toggle-div');

			timezone.populateDropdown(parent.find('#accountsmanager_new_account_timezone'));

			parent.find('.change-realm').on('click', function(e) {
				parent.find('.generated-realm').hide();
				parent.find('.manual-realm')
					.show()
					.find('input')
					.focus();
			});

			parent.find('.cancel-edition').on('click', function(e) {
				parent.find('.manual-realm').hide();
				parent.find('.generated-realm').show();
			});

			parent.find('.add-admin-toggle > a').on('click', function(e) {
				e.preventDefault();
				var $this = $(this);
				if(newAdminDiv.hasClass('active')) {
					newAdminDiv.slideUp();
					newAdminDiv.removeClass('active');
					newAdminDiv.find('input[type="text"], input[type="email"]').val('');
					autogenBtn.click();
					$this.html(self.i18n.active().addAdminLink.toggleOn);
					$this.next('i').show();
				} else {
					newAdminDiv.slideDown();
					newAdminDiv.addClass('active');
					$this.html(self.i18n.active().addAdminLink.toggleOff);
					$this.next('i').hide();
				}
			});

			manualBtn.on('click', function(e) {
				autogenCheckbox.prop('checked', false);
				pwdToggleDiv.slideDown();
				manualBtn
					.removeClass('monster-button-secondary')
					.addClass('monster-button-primary');
				autogenBtn
					.removeClass('monster-button-primary')
					.addClass('monster-button-secondary');
			});

			autogenBtn.on('click', function(e) {
				autogenCheckbox.prop('checked', true);
				pwdToggleDiv.find('input[type=password]').val('');
				pwdToggleDiv.slideUp();
				autogenBtn
					.removeClass('monster-button-secondary')
					.addClass('monster-button-primary');
				manualBtn
					.removeClass('monster-button-primary')
					.addClass('monster-button-secondary');
			});

			monster.ui.tooltips(parent);
		},

		renderServicePlanStep: function(params) {
			var self = this,
				parent = params.parent,
				stepTemplate = $(monster.template(self, 'servicePlanWizardStep', {
					isReseller: monster.apps.auth.isReseller
				}));

			monster.pub('common.servicePlanDetails.getServicePlanTemplate', {
				mode: 'new',
				useOwnPlans: monster.apps.auth.isReseller,
				afterRender: function(template, data) {
					stepTemplate.find('.common-container')
								.append(template);

					parent.append(stepTemplate);
				}
			});
		},

		servicePlanGet: function(servicePlanId, callback) {
			var self = this;

			self.callApi({
				resource: 'servicePlan.get',
				data: {
					accountId: self.accountId,
					planId: servicePlanId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		servicePlanAdd: function(accountId, newPlanId, success, error) {
			var self = this;

			self.callApi({
				resource: 'servicePlan.add',
				data: {
					accountId: accountId,
					planId: newPlanId,
					data: {}
				},
				success: function(data, status) {
					success && success(data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		},

		servicePlanRemove: function(accountId, planId, success, error) {
			var self = this;

			self.callApi({
				resource: 'servicePlan.remove',
				data: {
					accountId: accountId,
					planId: planId,
					data: {}
				},
				success: function(data, status) {
					success && success(data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		},

		renderLimitsStep: function(params) {
			var self = this,
				parent = params.parent,
				formattedClassifiers = $.map(params.classifiers, function(val, key) {
					return {
						id: key,
						name: (self.i18n.active().classifiers[key] || {}).name || val.friendly_name,
						help: (self.i18n.active().classifiers[key] || {}).help,
						checked: true
					};
				}),
				stepTemplate = self.getLimitsTabContent({
					parent: parent,
					formattedClassifiers: formattedClassifiers
				});

			parent.append(stepTemplate);
		},

		renderRestrictionsStep: function(params) {
			var self = this,
				parent = params.parent,
				stepTemplate = self.getRestrictionsTabContent({
					parent: parent
				});

			parent.append(stepTemplate);

			monster.ui.tooltips(parent);
		},

		// If a service plan has a rate for one of the limits, we should display the my account category,
		// so this function checks that and returns a map of limits type with a boolean telling whether it should be shown or not
		getUIRestrictionForServicePlan: function(servicePlan) {
			var self = this,
				hasLimits = servicePlan.hasOwnProperty('data') && servicePlan.data.hasOwnProperty('plan') && servicePlan.data.plan.hasOwnProperty('limits'),
				limits = hasLimits ? servicePlan.data.plan.limits : {},
				formattedData = {},
				getUIRestrictionValue = function(key) {
					var value = false;

					if(hasLimits && limits.hasOwnProperty(key) && limits[key].hasOwnProperty('rate')) {
						value = true;
					}

					return value;
				};

			if(hasLimits) {
				_.each(limits, function(v, k) {
					formattedData[k] = getUIRestrictionValue(k);
				});
			}

			return formattedData;
		},

		// Function used when user updates service plan via update of the account page.
		// If he selects a new service plan we need to automatically turn on/off the limits settings based on the service plan
		updateUIRestrictionsFromServicePlan: function(template, accountData, servicePlan, callback) {
			var self = this,
				servicePlanRestrictions = self.getUIRestrictionForServicePlan(servicePlan),
				getRestrictionValue = function(key) {
					return servicePlanRestrictions.hasOwnProperty(key) ? servicePlanRestrictions[key] : false;
				},
				newUIRestrictions = {
					ui_restrictions: {
						myaccount: {
							inbound: {
								show_tab: getRestrictionValue('inbound_trunks'),
							},
							outbound: {
								show_tab: getRestrictionValue('outbound_trunks')
							},
							twoway: {
								show_tab: getRestrictionValue('twoway_trunks')
							}
						}
					}
				},
				// We'll run this function once we updated the account since we don't re-render the page
				setCheckboxValue = function(key, data) {
					// By default all the checkboxes are checked
					var value = true;
					if(data.data.hasOwnProperty('ui_restrictions') && data.data.ui_restrictions.hasOwnProperty('myaccount') && data.data.ui_restrictions.myaccount.hasOwnProperty(key) && data.data.ui_restrictions.myaccount[key].hasOwnProperty('show_tab')) {
						// we only accept true/false as values, so if value is different than true, we set it to false
						value = data.data.ui_restrictions.myaccount[key].show_tab === true ? true : false;
					}

					template.find('[name="account.ui_restrictions.myaccount.'+ key + '.show_tab"]').prop('checked', value);
				};

			self.updateData(accountData, newUIRestrictions, function(data) {
				setCheckboxValue('inbound', data);
				setCheckboxValue('outbound', data);
				setCheckboxValue('twoway', data);

				callback && callback();
			});
		},

		changeStep: function(stepIndex, maxStep, parent) {
			var self = this;

			parent.find('.step').removeClass('active');
			parent.find('.step[data-step="'+stepIndex+'"]').addClass('active');

			for(var i = stepIndex; i >= 1; --i) {
				parent.find('.step[data-step="'+i+'"]').addClass('completed');
			}

			parent.find('.wizard-content-step').hide();
			parent.find('.wizard-content-step[data-step="'+ stepIndex +'"]').show();

			parent.find('.cancel').hide();
			parent.find('.prev-step').show();
			parent.find('.next-step').show();
			parent.find('.submit-btn').hide();

			if(stepIndex === maxStep) {
				parent.find('.next-step').hide();
				parent.find('.submit-btn').show();
			}

			if(stepIndex === 1) {
				parent.find('.prev-step').hide();
				parent.find('.cancel').show();
			}

			parent.find('.wizard-top-bar').data('active_step', stepIndex);
		},

		renderEditAdminsForm: function(parent, editAccountId) {
			var self = this,
				$settingsItem = parent.find('li.settings-item[data-name="accountsmanager_account_admins"]'),
				closeAdminsSetting = function() {
					$settingsItem.removeClass('open');
					$settingsItem.find('.settings-item-content').hide();
					$settingsItem.find('a.settings-link').show();
				},
				refreshAdminsHeader = function() {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: editAccountId,
							filters: {
								'filter_priv_level': 'admin'
							}
						},
						success: function(data, status) {
							$settingsItem.find('.total-admins').text(data.data.length);
							if(data.data.length > 0) {
								data.data = data.data.sort(function(a,b) {
									return (a.first_name+a.last_name).toLowerCase() > (b.first_name+b.last_name).toLowerCase() ? 1 : -1;
								});
								$settingsItem.find('.first-admin-name').text(data.data[0].first_name + " " + data.data[0].last_name);
								$settingsItem.find('.first-admin-email').text(data.data[0].email);
							} else {
								$settingsItem.find('.first-admin-name').text("-");
								$settingsItem.find('.first-admin-email').empty();
							}
						}
					});
				};

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: editAccountId,
				},
				success: function(data, status) {
					data.data = data.data.sort(function(a,b) {
						return (a.first_name+a.last_name).toLowerCase() > (b.first_name+b.last_name).toLowerCase() ? 1 : -1;
					});
					var admins = $.map(data.data, function(val) {
							return val.priv_level === "admin" ? val : null;
						}),
						regularUsers = $.map(data.data, function(val) {
							return val.priv_level !== "admin" ? val : null;
						}),
						contentTemplate = $(monster.template(self, 'accountsAdminForm', {
							accountAdmins: admins,
							accountUsers: regularUsers
						})),
						$createUserDiv = contentTemplate.find('.create-user-div'),
						$adminElements = contentTemplate.find('.admin-element'),
						$newAdminBtn = contentTemplate.find('#accountsmanager_new_admin_btn'),
						$newAdminElem = contentTemplate.find('.new-admin-element');

					contentTemplate.find('.close-admin-settings').click(function(e) {
						e.preventDefault();
						closeAdminsSetting();
						e.stopPropagation();
					});

					contentTemplate.find('.new-admin-tabs a').click(function(e) {
						e.preventDefault();
						$(this).tab('show');
					});

					$newAdminBtn.click(function(e) {
						e.preventDefault();
						var $this = $(this);
						if(!$this.hasClass('disabled')) {
							if($this.hasClass('active')) {
								$this.find('i').removeClass('fa-caret-up').addClass('fa-caret-down');
								$newAdminElem.slideUp();
								$this.removeClass('active')
							} else {
								$this.find('i').removeClass('fa-caret-down').addClass('fa-caret-up');
								$newAdminElem.slideDown();
								$this.addClass('active')
							}
						} else {
							e.stopPropagation();
						}
					});

					$createUserDiv.find('input[name="extra.autogen_password"]').change(function(e) {
						$(this).val() === "true" ? $createUserDiv.find('.new-admin-password-div').slideUp() : $createUserDiv.find('.new-admin-password-div').slideDown();
					});

					contentTemplate.find('.admin-element-link.delete').click(function(e) {
						e.preventDefault();
						var userId = $(this).parent().parent().data('user_id');
						monster.ui.confirm(self.i18n.active().deleteUserConfirm, function() {
							self.callApi({
								resource: 'user.delete',
								data: {
									accountId: editAccountId,
									userId: userId,
									data: {}
								},
								success: function(data, status) {
									self.renderEditAdminsForm(parent, editAccountId);
									refreshAdminsHeader();
								}
							});
						});
					});

					contentTemplate.find('.admin-element-link.edit').click(function(e) {
						e.preventDefault();
						var $adminElement = $(this).parent().parent(),
							userId = $adminElement.data('user_id');

						contentTemplate.find('.admin-element-edit .admin-cancel-btn').click();

						if($newAdminBtn.hasClass('active')) {
							$newAdminBtn.click();
						}
						$newAdminBtn.addClass('disabled');

						$adminElement.find('.admin-element-display').hide();
						$adminElement.find('.admin-element-edit').show();

					});

					$adminElements.each(function() {
						var $adminElement = $(this),
							userId = $adminElement.data('user_id'),
							$adminPasswordDiv = $adminElement.find('.edit-admin-password-div');

						monster.ui.showPasswordStrength($adminElement.find('input[name="password"]'), {
							container: $adminElement.find('.password-strength-container'),
							display: 'icon'
						});

						$adminPasswordDiv.hide();

						$adminElement.find('.admin-cancel-btn').click(function(e) {
							e.preventDefault();
							$adminElement.find('input').each(function() {
								$(this).val($(this).data('original_value'));
							});
							$adminElement.find('.admin-element-display').show();
							$adminElement.find('.admin-element-edit').hide();
							$newAdminBtn.removeClass('disabled');
						});

						$adminElement.find('input[name="email"]').change(function() { $(this).keyup(); });
						$adminElement.find('input[name="email"]').keyup(function(e) {
							var $this = $(this);
							if($this.val() !== $this.data('original_value')) {
								$adminPasswordDiv.slideDown();
							} else {
								$adminPasswordDiv.slideUp(function() {
									$adminPasswordDiv.find('input[type="password"]').val("");
								});
							}
						})

						$adminElement.find('.admin-save-btn').click(function(e) {
							e.preventDefault();
							var form = $adminElement.find('form'),
								formData = monster.ui.getFormData(form[0]);

							if(monster.ui.valid(form)) {
								formData = self.cleanFormData(formData);
								if(!$adminPasswordDiv.is(":visible")) {
									delete formData.password;
								}
								self.callApi({
									resource: 'user.get',
									data: {
										accountId: editAccountId,
										userId: userId
									},
									success: function(data, status) {
										if(data.data.email !== formData.email) {
											formData.username = formData.email;
										}
										var newData = $.extend(true, {}, data.data, formData);

										self.callApi({
											resource: 'user.update',
											data: {
												accountId: editAccountId,
												userId: userId,
												data: newData
											},
											success: function(data, status) {
												self.renderEditAdminsForm(parent, editAccountId);
												refreshAdminsHeader();
											}
										});
									}
								});
							}
						});

					});

					$newAdminElem.find('.admin-cancel-btn').click(function(e) {
						e.preventDefault();
						$newAdminBtn.click();
					});

					$newAdminElem.find('.admin-add-btn').click(function(e) {
						e.preventDefault();
						if($newAdminElem.find('.tab-pane.active').hasClass('create-user-div')) {
							var formData = monster.ui.getFormData('accountsmanager_add_admin_form'),
								autoGen = ($createUserDiv.find('input[name="extra.autogen_password"]:checked').val() === "true");

							if(monster.ui.valid(contentTemplate.find('#accountsmanager_add_admin_form'))) {
								formData = self.cleanFormData(formData);
								formData.priv_level = "admin";
								formData.username = formData.email;
								if(autoGen) {
									formData.password = self.autoGeneratePassword();
									formData.send_email_on_creation = true;
								}

								self.callApi({
									resource: 'user.create',
									data: {
										accountId: editAccountId,
										data: formData
									},
									success: function(data, status) {
										self.renderEditAdminsForm(parent, editAccountId);
										refreshAdminsHeader();
										if(formData.send_email_on_creation) {
											var popupContent = monster.template(self, '!' + self.i18n.active().sentEmailPopup, { email: data.data.email });
											monster.ui.alert('info', popupContent);
										}
									}
								});
								$newAdminBtn.click();
							}
						} else {
							var userId = contentTemplate.find('#accountsmanager_promote_user_select option:selected').val();
							self.callApi({
								resource: 'user.get',
								data: {
									accountId: editAccountId,
									userId: userId
								},
								success: function(data, status) {
									data.data.priv_level = "admin";
									self.callApi({
										resource: 'user.update',
										data: {
											accountId: editAccountId,
											userId: userId,
											data: data.data
										},
										success: function(data, status) {
											self.renderEditAdminsForm(parent, editAccountId);
											refreshAdminsHeader();
										}
									});
								}
							});
							$newAdminBtn.click();
						}
					});

					parent.find('#form_accountsmanager_account_admins').empty().append(contentTemplate);

					$.each(contentTemplate.find('form'), function() {
						monster.ui.validate($(this), {
							rules: {
								'password': {
									minlength: 6
								},
								'extra.password_confirm': {
									equalTo: $(this).find('input[name="password"]')
								}
							},
							messages: {
								'extra.password_confirm': {
									equalTo: self.i18n.active().validationMessages.invalidPasswordConfirm
								}
							},
							errorPlacement: function(error, element) {
								error.appendTo(element.parent());
							}
						});
					});

					monster.ui.tooltips(contentTemplate);
				}
			});
		},

		edit: function(args) {
			var self = this,
				accountId = args.accountId,
				selectedTab = args.selectedTab,
				parent = args.parent;

			monster.parallel({
					account: function(callback) {
						self.callApi({
							resource: 'account.get',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							}
						});
					},
					users: function(callback) {
						self.callApi({
							resource: 'user.list',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							},
							error: function(data, status) {
								callback(null, {});
							}
						});
					},
					currentServicePlan: function(callback) {
						self.callApi({
							resource: 'servicePlan.listCurrent',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								if(data && data.data) {
									callback(null, data.data);
								}
								else {
									callback(null, {});
								}
							},
							error: function(data, status) {
								callback(null, {});
							}
						});
					},
					limits: function(callback) {
						self.callApi({
							resource: 'limits.get',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							},
							error: function(data, status) {
								callback(null, {});
							}
						});
					},
					classifiers: function(callback) {
						self.callApi({
							resource: 'numbers.listClassifiers',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							},
							error: function(data, status) {
								callback(null, {});
							}
						});
					},
					currentBalance: function(callback) {
						self.getBalance(accountId, function(data, status) {
							callback(null, data.data);
						},
						function(data, status) {
							callback(null, {});
						});
					},
					noMatch: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: accountId,
								filters: {
									filter_numbers: 'no_match'
								}
							},
							success: function(listCallflows) {
								if(listCallflows.data.length === 1) {
									self.callApi({
										resource: 'callflow.get',
										data: {
											callflowId: listCallflows.data[0].id,
											accountId: accountId
										},
										success: function(callflow) {
											callback(null, callflow.data);
										}
									});
								}
								else {
									callback(null, null);
								}
							}
						});
					},
					appsList: function(callback) {
						self.callApi({
							resource: 'appsStore.list',
							data: {
								accountId: self.accountId
							},
							success: function(data, status) {
								var parallelRequest = {};
								_.each(data.data, function(val) {
									parallelRequest[val.id] = function(parallelCallback) {
										//This API is only called to check whether the icon can be loaded, but is not used to load the actual icon
										/*self.callApi({
											resource: 'appsStore.getIcon',
											data: {
												accountId: self.accountId,
												appId: val.id,
												generateError: false
											},
											success: function(data, status) {*/
												val.icon = monster.util.getAppIconPath(val);
												parallelCallback && parallelCallback(null, val);
											/*},
											error: function(data, status) {
												val.icon = null;
												parallelCallback && parallelCallback(null, val);
											}
										});*/
									}
								});

								monster.parallel(parallelRequest, function(err, results) {
									callback(null, results);
								});
							},
							error: function(data, status) {
								callback(null, null);
							}
						});
					},
					appsBlacklist: function(callback) {
						self.callApi({
							resource: 'appsStore.getBlacklist',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data && data.data.blacklist ? data.data.blacklist : null);
							},
							error: function(data, status) {
								callback(null, null);
							}
						});
					},
					listParents: function(callback) {
						self.callApi({
							resource: 'account.listParents',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							}
						});
					}
				},
				function(err, results) {
					var lang = monster.config.whitelabel.language,
						isoFormattedLang = lang.substr(0, 3).concat(lang.substr(lang.length -2, 2).toUpperCase()),
						params = {
							accountData: results.account,
							accountUsers: results.users.sort(function(a,b) {
								return (a.first_name+a.last_name).toLowerCase() > (b.first_name+b.last_name).toLowerCase() ? 1 : -1;
							}),
							currentServicePlan: results.currentServicePlan,
							accountLimits: results.limits,
							classifiers: results.classifiers,
							accountBalance: 'balance' in results.currentBalance ? results.currentBalance.balance : 0,
							parent: parent,
							noMatch: results.noMatch,
							selectedTab: selectedTab,
							appsList: _.map(results.appsList, function(app) {
								var currentLang = app.i18n.hasOwnProperty(isoFormattedLang) ? isoFormattedLang : 'en-US';
								app.description = app.i18n[currentLang].description;
								app.friendlyName = app.i18n[currentLang].label;

								if(results.appsBlacklist && results.appsBlacklist.indexOf(app.id) >= 0) {
									app.blacklisted = true;
								}

								monster.ui.formatIconApp(app);
								return app;
							}),
							appsBlacklist: results.appsBlacklist,
							listParents: results.listParents
						},
						editCallback = function() {
							params = self.formatDataEditAccount(params);
							self.editAccount(params);
						};

					if(!_.isObject(params.noMatch)) {
						self.createNoMatchCallflow({
								accountId: params.accountData.id,
								resellerId: params.accountData.reseller_id
							}, function(data) {
								params.noMatch = data;
								editCallback();
							}
						);
					} else {
						editCallback();
					}
				}
			);
		},

		formatDataEditAccount: function(params) {
			var self = this;

			return params;
		},

		updateBreadCrumbs: function(parents, account, container) {
			var self = this,
				tree = parents,
				previousId;

			tree.push({ id: account.id, name: account.name });

			_.each(tree, function(account) {
				if(previousId) {
					account.parentId = previousId;
				}

				previousId = account.id;
			});

			container.find('.top-bar').empty()
									  .append(monster.template(self, 'accountsBreadcrumbs', { accounts: tree }));
		},

		/** Expected params:
			- accountData
			- accountUsers
			- currentServicePLan
			- accountLimits
			- classifiers (call restriction)
			- parent
			- callback [optional]
		*/
		editAccount: function(params) {
			var self = this,
				accountData = params.accountData,
				accountUsers = params.accountUsers,
				currentServicePlan = params.currentServicePlan,
				accountLimits = params.accountLimits,
				accountBalance = params.accountBalance,
				carrierInfo = params.carrierInfo,
				selectedTab = params.selectedTab,
				appsList = params.appsList,
				parent = params.parent,
				callback = params.callback,
				admins = $.map(accountUsers, function(val) {
					return val.priv_level === "admin" ? val : null;
				}),
				regularUsers = $.map(accountUsers, function(val) {
					return val.priv_level !== "admin" ? val : null;
				}),
				formattedClassifiers = $.map(params.classifiers, function(val, key) {
					var ret = {
						id: key,
						name: (self.i18n.active().classifiers[key] || {}).name || val.friendly_name,
						help: (self.i18n.active().classifiers[key] || {}).help,
						checked: true
					};
					if(accountData.call_restriction && key in accountData.call_restriction && accountData.call_restriction[key].action === "deny") {
						ret.checked = false;
					}
					return ret;
				}),
				templateData = {
					account: $.extend(true, {}, accountData),
					accountAdmins: admins,
					accountUsers: regularUsers,
					currentServicePlan: currentServicePlan,
					isReseller: monster.apps.auth.isReseller,
					carrierInfo: carrierInfo,
					isSuperDuperAdmin: monster.util.isSuperDuper(),
					accountIsReseller: accountData.is_reseller,
					appsList: monster.util.sort(appsList)
				};

			if($.isNumeric(templateData.account.created)) {
				templateData.account.created = monster.util.toFriendlyDate(accountData.created, 'date');
			}

			self.updateBreadCrumbs(params.listParents, accountData, parent);

			var contentTemplate = $(monster.template(self, 'edit', templateData)),
				$liSettings = contentTemplate.find('li.settings-item'),
				$liContent = $liSettings.find('.settings-item-content'),
				$aSettings = $liSettings.find('a.settings-link'),
				closeTabsContent = function() {
					$liSettings.removeClass('open');
					$liContent.slideUp('fast');
					$aSettings.find('.update .text').text(self.i18n.active().editSetting);
					$aSettings.find('.update i').removeClass('fa-times').addClass('fa-cog');
				},
				notesTab = contentTemplate.find('#accountsmanager_notes_tab');

			monster.pub('common.carrierSelector', {
				container: contentTemplate.find('#accountsmanager_carrier_tab'),
				data: params,
				callbackAfterSave: function() {
					self.render({
						selectedId: accountData.id,
						selectedTab: 'tab-carrier'
					});
				}
			});

			contentTemplate.find('.account-tabs a').click(function(e) {
				e.preventDefault();
				if(!$(this).parent().hasClass('disabled')) {
					closeTabsContent();
					$(this).tab('show');
				}
			});

			contentTemplate.find('li.settings-item .settings-link').on('click', function(e) {
				var $this = $(this),
					settingsItem = $this.parents('.settings-item');

				if(!settingsItem.hasClass('disabled')) {
					var isOpen = settingsItem.hasClass('open');
					closeTabsContent();
					if(!isOpen){
						settingsItem.addClass('open');
						$this.find('.update .text').text(self.i18n.active().closeSetting);
						$this.find('.update i').removeClass('fa-cog').addClass('fa-times');
						settingsItem.find('.settings-item-content').slideDown('fast');

						if(settingsItem.data('name') === 'accountsmanager_account_admins') {
							self.renderEditAdminsForm(parent, accountData.id);
						}
					}
				}
			});

			contentTemplate.find('.settings-item .cancel').on('click', function(e) {
				e.preventDefault();
				closeTabsContent();

				$(this).parents('form').first().find('input, select').each(function(k, v) {
					$(v).val($(v).data('original_value'));
				});

				e.stopPropagation();
			});

			contentTemplate.find('#accountsmanager_delete_account_btn').on('click', function(e) {
				self.confirmDeleteDialog(accountData.name, function() {
					self.callApi({
						resource: 'account.delete',
						data: {
							accountId: accountData.id,
							data: {},
							generateError: false
						},
						success: function(data, status) {
							parent.find('.main-content').empty();
							parent.find('.account-list-element[data-id="'+accountData.id+'"]').remove();
						},
						error: function(data, status) {
							if (data.message === 'account_has_descendants') {
								monster.ui.alert('error', self.i18n.active().account_has_descendants);
							}
						}
					});
				});
			});

			contentTemplate.find('.resellerAction').on('click', function(event) {
				event.preventDefault();

				var action = $(this).data('action'),
					node = action === 'promote' ? 'promoteAccount' : 'demoteAccount';

				monster.ui.confirm(self.i18n.active()[node].confirm, function () {
					self.callApi({
						resource: 'account.' + action,
						data: {
							accountId: accountData.id
						},
						success: function(data, status) {
							toastr.success(self.i18n.active()[node].success);
							self.render({
								selectedId: accountData.id
							});
						},
						error: function(data, status) {
							toastr.error(self.i18n.active().promoteDemoteError);
						}
					});
				});
			});

			contentTemplate.find('#accountsmanager_use_account_btn').on('click', function(e) {
				e.preventDefault();

				monster.pub('core.triggerMasquerading', {
					account: accountData,
					callback: function() {
						self.render();
					}
				})

				e.stopPropagation();
			});

			contentTemplate.find('.change').on('click', function(e) {
				e.preventDefault();

				var $this = $(this),
					module = $this.data('module'),
					fieldName = $this.data('field'),
					newData = self.cleanFormData(monster.ui.getFormData('form_'+fieldName));

				if(monster.ui.valid(contentTemplate.find('#form_'+fieldName))) {
					self.updateData(accountData, newData,
						function(data) {
							self.render({
								selectedId: accountData.id
							});
						},
						function(data) {
							if(data && data.data && 'api_error' in data.data && 'message' in data.data.api_error) {
								monster.ui.alert(data.data.api_error.message);
							}
						}
					);
				}
			});

			// If reseller
			if(monster.apps.auth.isReseller) {
				var $btn_change = contentTemplate.find('#accountsmanager_serviceplan_change'),
					$btn_rec = contentTemplate.find('#accountsmanager_serviceplan_reconciliation'),
					$btn_sync = contentTemplate.find('#accountsmanager_serviceplan_synchronization');

				$btn_change.on('click', function() {
					monster.pub('common.servicePlanDetails.getServicePlanTemplate', {
						accountId: accountData.id,
						afterRender: function(template, data) {
							var templatePopup = $(monster.template(self, 'changeServicePlanDialog'));

							templatePopup.find('.common-container')
										 .append(template);

							templatePopup.find('#save_custom_plans').on('click', function() {
								monster.pub('common.servicePlanDetails.customizeSave', {
									previousPlans: data.selectedPlans,
									container: templatePopup.find('.common-container'),
									accountId: accountData.id,
									divResult: contentTemplate.find('.serviceplans-details-container'),
									callback: function() {
										dialog.dialog('close');

										toastr.success(self.i18n.active().changeServicePlanDialog.successUpdate);
									}
								});
							});

							var dialog = monster.ui.dialog(templatePopup, {
								title: self.i18n.active().changeServicePlanDialog.title
							});
						}
					});
				});

				$btn_rec.click(function(e) {
					e.preventDefault();
					if(!$btn_rec.hasClass('disabled') && !$btn_sync.hasClass('disabled')) {
						$btn_rec.addClass('disabled');
						$btn_sync.addClass('disabled');
						self.callApi({
							resource: 'servicePlan.reconciliate',
							data: {
								accountId: accountData.id,
								data: {}
							},
							success: function(data, status) {
								toastr.success(self.i18n.active().toastrMessages.servicePlanReconciliationSuccess, '', {"timeOut": 5000});
								$btn_rec.removeClass('disabled');
								$btn_sync.removeClass('disabled');
							},
							error: function(data, status) {
								toastr.error(self.i18n.active().toastrMessages.servicePlanReconciliationError, '', {"timeOut": 5000});
								$btn_rec.removeClass('disabled');
								$btn_sync.removeClass('disabled');
							}
						});
					}

				});

				$btn_sync.click(function(e) {
					e.preventDefault();
					if(!$btn_rec.hasClass('disabled') && !$btn_sync.hasClass('disabled')) {
						$btn_rec.addClass('disabled');
						$btn_sync.addClass('disabled');
						self.callApi({
							resource: 'servicePlan.synchronize',
							data: {
								accountId: accountData.id,
								data: {}
							},
							success: function(data, status) {
								toastr.success(self.i18n.active().toastrMessages.servicePlanSynchronizationSuccess, '', {"timeOut": 5000});
								$btn_rec.removeClass('disabled');
								$btn_sync.removeClass('disabled');
							},
							error: function(data, status) {
								toastr.error(self.i18n.active().toastrMessages.servicePlanSynchronizationError, '', {"timeOut": 5000});
								$btn_rec.removeClass('disabled');
								$btn_sync.removeClass('disabled');
							}
						});
					}
				});
			}

			timezone.populateDropdown(contentTemplate.find('#accountsmanager_account_timezone'), accountData.timezone);

			contentTemplate.find('#accountsmanager_account_timezone').chosen({search_contains: true, width: "220px"});

			monster.ui.tooltips(contentTemplate);

			if(currentServicePlan) {
				monster.pub('common.servicePlanDetails.render', {
					container: contentTemplate.find('.serviceplans-details-container'),
					accountId: accountData.id,
					servicePlan: currentServicePlan,
					useOwnPlans: accountData.is_reseller
				});
			}

			self.renderLimitsTab({
				accountData: accountData,
				limits: accountLimits,
				balance: accountBalance,
				formattedClassifiers: formattedClassifiers,
				servicePlan: currentServicePlan,
				parent: contentTemplate.find('#accountsmanager_limits_tab')
			});

			self.renderRestrictionsTab({
				accountData: accountData,
				parent: contentTemplate.find('#accountsmanager_restrictions_tab')
			});

			monster.ui.validate(contentTemplate.find('#form_accountsmanager_account_realm'), {
				rules: {
					'realm': {
						'realm': true
					}
				}
			});

			parent.find('.main-content').empty()
										.append(contentTemplate);

			if(selectedTab) {
				contentTemplate.find('.'+selectedTab+' > a').tab('show');
			}

			notesTab.find('div.dropdown-menu input')
					.on('click', function () {
						return false;
					})
					.change(function () {
						$(this).parents('div.dropdown-menu').siblings('a.dropdown-toggle').dropdown('toggle');
					})
					.keydown('esc', function () {
						this.value='';
						$(this).change();
					}
			);
			monster.ui.wysiwyg(notesTab.find('.wysiwyg-container.notes')).html(accountData.custom_notes);

			notesTab.find('#accountsmanager_notes_save').on('click', function() {
				var notesContent = notesTab.find('.notes .wysiwyg-editor').html();
				self.updateData(
					accountData,
					{ custom_notes: notesContent },
					function(data, status) {
						accountData = data.data;
						self.render({
							selectedId: accountData.id,
							selectedTab: 'tab-notes',
							callback: function() {
								toastr.success(self.i18n.active().toastrMessages.notesUpdateSuccess, '', {"timeOut": 5000});
							}
						});
					},
					function(data, status) {
						toastr.error(self.i18n.active().toastrMessages.notesUpdateError, '', {"timeOut": 5000});
					}
				);
			});

			monster.ui.wysiwyg(notesTab.find('.wysiwyg-container.announcement')).html(accountData.announcement);

			var successUpdateAnnouncement = function(data, status) {
					accountData = data.data;
					self.render({
						selectedId: accountData.id,
						selectedTab: 'tab-notes',
						callback: function() {
							toastr.success(self.i18n.active().toastrMessages.notesUpdateSuccess, '', {"timeOut": 5000});
						}
					});
				},
				errorUpdateAnnouncement = function(data, status) {
					toastr.error(self.i18n.active().toastrMessages.notesUpdateError, '', {"timeOut": 5000});
				};

			notesTab.find('#accountsmanager_announcement_delete').on('click', function() {
				delete accountData.announcement;
				self.updateAccount(accountData,successUpdateAnnouncement,errorUpdateAnnouncement);
			});

			notesTab.find('#accountsmanager_announcement_save').on('click', function() {
				var announcementContent = notesTab.find('.announcement .wysiwyg-editor').html();
				self.updateData(accountData,{ announcement: announcementContent },successUpdateAnnouncement,errorUpdateAnnouncement);
			});

			contentTemplate.find('#accountsmanager_appstore_tab .app-toggle').on('change', function() {
				$(this).parents('.app-row').toggleClass('blacklisted');
			});

			contentTemplate.find('#accountsmanager_appstore_tab .app-global-toggle').on('click', function() {
				var isChecked = $(this).is(':checked');

				contentTemplate.find('#accountsmanager_appstore_tab .app-toggle').prop('checked', isChecked);
			});

			contentTemplate.find('#accountsmanager_appstore_tab #accountsmanager_appstore_save').on('click', function() {
				var blacklistData = {
					blacklist: $.map(contentTemplate.find('#accountsmanager_appstore_tab .app-toggle:not(:checked)'), function(toggle) {
						return $(toggle).data('id');
					})
				};

				self.callApi({
					resource: 'appsStore.updateBlacklist',
					data: {
						accountId: accountData.id,
						data: blacklistData
					},
					success: function(data, status) {
						self.render({
							selectedId: accountData.id,
							selectedTab: 'tab-appstore',
							callback: function() {
								toastr.success(self.i18n.active().toastrMessages.appstoreUpdateSuccess, '', {"timeOut": 5000});
							}
						});
					},
					error: function(data, status) {
						toastr.error(self.i18n.active().toastrMessages.appstoreUpdateError, '', {"timeOut": 5000});
					}
				});
			});

			contentTemplate.find('#accountsmanager_numbersfeatures_save').on('click', function() {
				self.callApi({
					resource: 'account.get',
					data: {
						accountId: accountData.id,
					},
					success: function(data, status) {
						self.callApi({
							resource: 'account.update',
							data: {
								accountId: accountData.id,
								data: $.extend(true, {}, data.data, {
									numbers_features: monster.ui.getFormData('accountsmanager_numbersfeatures_form')
								})
							},
							success: function(_data, _status) {
								self.render({
									selectedId: accountData.id,
									selectedTab: 'tab-numbersfeatures',
									callback: function() {
										toastr.success(self.i18n.active().toastrMessages.appstoreUpdateSuccess, '', {"timeOut": 5000});
									}
								});
							}
						});
					}
				});
			});

			// self.adjustTabsWidth(contentTemplate.find('ul.account-tabs > li'));

			$.each(contentTemplate.find('form'), function() {
				var options = {};
				if(this.id === 'accountsmanager_callrestrictions_form') {
					options.rules = {
						'addCreditBalance': {
							number: true,
							min: 5
						}
					};
				}
				monster.ui.validate($(this), options);
			});

			if(typeof callback === 'function') {
				callback(contentTemplate);
			}
		},

		confirmDeleteDialog: function(accountName, callbackSuccess) {
			var self = this,
				deleteKey = self.i18n.active().deleteAccountDialog.deleteKey,
				confirmPopup = monster.ui.confirm(
					monster.template(self, 'deleteAccountDialog', {accountName: accountName}),
					function() {
						callbackSuccess && callbackSuccess();
					},
					null,
					{
						title: self.i18n.active().deleteAccountDialog.title,
						confirmButtonText: self.i18n.active().deleteAccountDialog.deleteAccount,
						htmlContent: true
					}
				);

			confirmPopup.find('#confirm_button').prop('disabled', true);

			confirmPopup.find('#delete_input').on('keyup', function() {
				if($(this).val() === deleteKey) {
					confirmPopup.find('#confirm_button').prop('disabled', false);
				}
				else {
					confirmPopup.find('#confirm_button').prop('disabled', true);
				}
			});
		},

		/** Expected params:
			- accountData
			- limits
			- balance
			- formattedClassifiers
			- parent
		*/
		renderLimitsTab: function(params) {
			var self = this,
				parent = params.parent,
				limits = params.limits,
				balance = params.balance,
				accountData = params.accountData,
				tabContentTemplate = self.getLimitsTabContent(params),
				addCreditInput = tabContentTemplate.find('.add-credit-input'),
				twowayTrunksDiv = tabContentTemplate.find('.trunks-div.twoway'),
				inboundTrunksDiv = tabContentTemplate.find('.trunks-div.inbound'),
				outboundTrunksDiv = tabContentTemplate.find('.trunks-div.outbound');

			tabContentTemplate.find('.change-credits').on('click', function() {
				var dataTemplate = {
						amount: params.balance.toFixed(2)
					},
					template = $(monster.template(self, 'updateCreditsDialog', dataTemplate)),
					popupAmount = template.find('.add-credits-header .value'),
					accountsAppAmount = tabContentTemplate.find('.credit-balance'),
					addValueField = template.find('#amount_add'),
					removeValueField = template.find('#amount_remove'),
					changeValueDisplayed = function(accountId, field) {
						self.getBalance(accountId, function(data) {
							params.balance = data.data.balance;
							var formattedValue = self.i18n.active().currencyUsed + '' + params.balance.toFixed(2);
							popupAmount.html(formattedValue);
							accountsAppAmount.html(formattedValue);
							field.val('');
							toastr.success(self.i18n.active().updateCreditDialog.successfulUpdate);
						});
					},
					addForm = template.find('#add_credit_form'),
					removeForm = template.find('#remove_credit_form'), 
					rulesValidate = {
						rules: {
							'amount': {
								number: true,
								min: 5
							}
						}
					};

				monster.ui.validate(addForm, rulesValidate);
				monster.ui.validate(removeForm, rulesValidate);

				monster.ui.tooltips(template);

				template.find('.add-credit').on('click', function() {
					if(monster.ui.valid(addForm)) {
						self.addCredit(accountData.id, addValueField.val(), function(data) {
							changeValueDisplayed(accountData.id, addValueField);
						});
					}
				});

				template.find('.remove-credit').on('click', function() {
					if(monster.ui.valid(removeForm)) {
						self.removeCredit(accountData.id, removeValueField.val(), function(data) {
							changeValueDisplayed(accountData.id, removeValueField);
						});
					}
				});

				var popup = monster.ui.dialog(template, {
					title: self.i18n.active().updateCreditDialog.title
				});
			});

			parent.find('#accountsmanager_limits_save').click(function(e) {
				e.preventDefault();

				var newTwowayValue = twowayTrunksDiv.find('.slider-div').slider('value'),
					newInboundValue = inboundTrunksDiv.find('.slider-div').slider('value'),
					newOutboundValue = outboundTrunksDiv.find('.slider-div').slider('value'),
					callRestrictions = monster.ui.getFormData('accountsmanager_callrestrictions_form').limits.call_restriction,
					addCredit = addCreditInput.val(),
					allowPrepay = tabContentTemplate.find('.allow-prepay-ckb').is(':checked');

				if(monster.ui.valid(parent.find('#accountsmanager_callrestrictions_form'))) {

					$.each(params.formattedClassifiers, function(k, v) {
						if(!(v.id in callRestrictions) || callRestrictions[v.id].action !== "inherit") {
							callRestrictions[v.id] = {
								action: "deny"
							};
						}
					});
					accountData.call_restriction = callRestrictions;

					monster.parallel({
						limits: function(parallelCallback) {
							self.callApi({
								resource: 'limits.update',
								data: {
									accountId: accountData.id,
									data: $.extend(true, {}, limits, {
										twoway_trunks: newTwowayValue,
										inbound_trunks: newInboundValue,
										outbound_trunks: newOutboundValue,
										allow_prepay: allowPrepay,
										call_restriction: callRestrictions
									})
								},
								success: function(data, status) {
									toastr.success(self.i18n.active().toastrMessages.limitsUpdateSuccess, '', {"timeOut": 5000});
									parallelCallback && parallelCallback(null, data.data);
								},
								error: function(data, status) {
									if(data.error !== 402) {
										toastr.error(self.i18n.active().toastrMessages.limitsUpdateError, '', {"timeOut": 5000});
									}
									parallelCallback && parallelCallback(null, null);
								}
							});
						},
						restrictions: function(parallelCallback) {
							self.callApi({
								resource: 'account.update',
								data: {
									accountId: accountData.id,
									data: accountData
								},
								success: function(data, status) {
									toastr.success(self.i18n.active().toastrMessages.callRestrictionsUpdateSuccess, '', {"timeOut": 5000});
									parallelCallback && parallelCallback(null, data.data);
								},
								error: function(data, status) {
									toastr.error(self.i18n.active().toastrMessages.callRestrictionsUpdateError, '', {"timeOut": 5000});
									parallelCallback && parallelCallback(null, null);
								}
							});
						}
					},
					function(err, results) {
						self.render({
							selectedId: accountData.id,
							selectedTab: 'tab-limits'
						});
					});
				}

			});

			parent.find('#accountsmanager_callrestrictions_form').append(tabContentTemplate);
		},

		/**
		 * This function is shared by both the edition tab and the creation wizard step.
		 */
		getLimitsTabContent: function(params) {
			var self = this,
				formattedClassifiers = params.formattedClassifiers,
				limits = params.limits || {},
				template = $(monster.template(self, 'limitsTabContent', {
					mode: params.hasOwnProperty('accountData') ? 'update' : 'create',
					balance: params.balance || 0,
					classifiers: formattedClassifiers,
					allowPrepay: limits.hasOwnProperty('allow_prepay') ? limits.allow_prepay : true,
					disableBraintree: monster.config.disableBraintree
				})),
				twoway = limits.twoway_trunks || 0,
				twowayTrunksDiv = template.find('.trunks-div.twoway'),
				inbound = limits.inbound_trunks || 0,
				inboundTrunksDiv = template.find('.trunks-div.inbound'),
				outbound = limits.outbound_trunks || 0,
				outboundTrunksDiv = template.find('.trunks-div.outbound'),
				createSlider = function(args) {
					var trunksDiv = args.trunksDiv,
						sliderValue = trunksDiv.find('.slider-value'),
						trunksValue = trunksDiv.find('.trunks-value');
					trunksDiv.find('.slider-div').slider({
						min: args.minValue,
						max: args.maxValue,
						range: 'min',
						value: args.currentValue,
						slide: function(event, ui) {
							sliderValue
								.html(ui.value)
								.css('left', trunksDiv.find('.ui-slider-handle').css('left'));
							trunksValue.val(ui.value);
						},
						change: function(event, ui) {
							sliderValue.css('left', trunksDiv.find('.ui-slider-handle').css('left'));
						}
					});

					sliderValue.css('left', trunksDiv.find('.ui-slider-handle').css('left'));
				};

			createSlider({
				trunksDiv: twowayTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: twoway,
			});

			createSlider({
				trunksDiv: inboundTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: inbound
			});
			
			createSlider({
				trunksDiv: outboundTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: outbound
			});

			twowayTrunksDiv.find('.slider-value').html(twoway);
			inboundTrunksDiv.find('.slider-value').html(inbound);
			outboundTrunksDiv.find('.slider-value').html(outbound);

			monster.ui.tooltips(template);

			return template;
		},

		/** Expected params:
			- accountData
			- parent
		*/
		renderRestrictionsTab: function(params) {
			var self = this,
				parent = params.parent,
				accountData = params.accountData,
				tabContentTemplate = self.getRestrictionsTabContent(params);

			parent.find('#accountsmanager_uirestrictions_form').append(tabContentTemplate);

			monster.ui.tooltips(parent);

			parent.find('#accountsmanager_uirestrictions_save').click(function(event) {
				event.preventDefault();

				var uiRestrictions = monster.ui.getFormData('accountsmanager_uirestrictions_form').account,
					restrictionsList = ['account', 'balance', 'billing', 'inbound', 'outbound', 'service_plan', 'transactions', 'user'];

				if ( accountData.hasOwnProperty('ui_restrictions') ) {
					restrictionsList.forEach(function(element) {
						if ( accountData.ui_restrictions.hasOwnProperty('myaccount') ) {
							delete accountData.ui_restrictions[element];
						}
					});
				}

				self.updateData(accountData, uiRestrictions,
					function(data, status) {
						self.render({
							selectedId: accountData.id,
							selectedTab: 'tab-restrictions',
							callback: function() {
								toastr.success(self.i18n.active().toastrMessages.uiRestrictionsUpdateSuccess, '', {"timeOut": 5000});
							}
						});
					},
					function(data, status) {
						toastr.error(self.i18n.active().toastrMessages.uiRestrictionsUpdateError, '', {"timeOut": 5000});
					}
				);
			});
		},

		getRestrictionsTabContent: function(params) {
			var self = this,
				uiRestrictions = params.hasOwnProperty('accountData') && params.accountData.hasOwnProperty('ui_restrictions') ? params.accountData.ui_restrictions.myaccount || params.accountData.ui_restrictions : {},
				template = $(monster.template(self, 'restrictionsTabContent', {
					ui_restrictions: uiRestrictions
				}));

			template.find('.restrictions-element input').each(function() {
				if ($(this).is(':checked')) {
					$(this).closest('a').addClass('enabled');
				} else {
					$(this).closest('a').removeClass('enabled');
				}
			});

			template.find('.restrictions-element input').on('change', function(e) {
				var $this = $(this),
					restrictionElement = $this.closest('li'),
					restrictionType = (restrictionElement.data('content')) ? restrictionElement.data('content') : false;
				if ($this.is(':checked')) {
					$this.closest('a').addClass('enabled');
					template.find('.restrictions-right .' + restrictionType + ' input').prop('checked', true);
				} else {
					$this.closest('a').removeClass('enabled');
					template.find('.restrictions-right .' + restrictionType + ' input').prop('checked', false);
				}
				restrictionElement.click();
			});

			template.find('.restrictions-element[data-content]').on('click', function() {
				var $this = $(this),
					restrictionType = $this.data('content');

				if ($this.find('input').is(':checked')) {
					template.find('.restrictions-menu .restrictions-element').each(function() {
						$(this).removeClass('active');
					});
					template.find('.restrictions-right > div').each(function() {
						$(this).removeClass('active');
					});

					template.find('.restrictions-right .' + restrictionType).addClass('active');
					$this.addClass('active');
				} else {
					template.find('.restrictions-right .' + restrictionType).removeClass('active');
					$this.removeClass('active');
				}
			});

			template.find('.restrictions-right input').on('change', function(e) {
				var restrictionsContainer = $(this).parents().eq(2),
					isChecked = false;

				if ( restrictionsContainer.data('content') !== 'restrictions-balance' ) {
					restrictionsContainer.find('input').each(function() {
						if ($(this).is(':checked')) {
							isChecked = true;
						}
					});

					if (!isChecked) {
						template.find('.restrictions-menu li[data-content="' + restrictionsContainer.data('content') + '"] input').prop('checked', false);
					}
				}
			});

			return template;
		},

		adjustTabsWidth: function($tabs) {
			var maxWidth = 0;
			$.each($tabs, function() {
				if($(this).width() > maxWidth) { maxWidth = $(this).width(); }
			});
			$tabs.css('min-width',maxWidth+'px');
		},

		cleanMergedData: function(data) {
			var self = this;

			if('reseller' in data) {
				delete data.reseller;
			}

			if('language' in data) {
				if(data.language === 'auto') {
					delete data.language;
				}
			}

			return data;
		},

		cleanFormData: function(formData) {
			if('enabled' in formData) {
				formData.enabled = formData.enabled === 'false' ? false : true;
			}

			delete formData.extra;

			return formData;
		},

		updateData: function(data, newData, success, error) {
			var self = this,
				dataToUpdate = $.extend(true, {}, data, newData);

			dataToUpdate = self.cleanMergedData(dataToUpdate);

			self.updateAccount(dataToUpdate, success, error);
		},

		updateAccount: function(data, success, error) {
			var self = this;

			self.callApi({
				resource: 'account.update',
				data: {
					accountId: data.id,
					data: data
				},
				success: function(_data, status) {
					success && success(_data, status);
				},
				error: function(_data, status) {
					error && error(_data, status);
				}
			});
		},

		autoGeneratePassword: function() {
			return monster.util.randomString(4,'abcdefghjkmnpqrstuvwxyz')+monster.util.randomString(4,'0123456789');
		},

		getDataNoMatchCallflow: function(type, resellerId) {
			var self = this,
				noMatchCallflow = {
					numbers: ['no_match'],
					flow: {
						children: {},
						data: {},
						module: 'offnet'
					}
				};

			if(type !== 'useBlended') {
				noMatchCallflow.flow.module = 'resources';

				if(type === 'useReseller') {
					noMatchCallflow.flow.data.hunt_account_id = resellerId;
				}
			}

			return noMatchCallflow;
		},

		createNoMatchCallflow: function(params, callback) {
			var self = this,
				whitelabelType = monster.config.whitelabel.hasOwnProperty('carrier') ? monster.config.whitelabel.carrier.choices[0] : false,
				type = params.type || whitelabelType || 'useBlended',
				accountId = params.accountId,
				resellerId = params.resellerId,
				noMatchCallflow = self.getDataNoMatchCallflow(type, resellerId);

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: accountId,
					data: noMatchCallflow
				},
				success: function(data, status) {
					callback(data.data);
				},
				error: function(data) {
					callback();
				}
			});
		},

		updateNoMatchCallflow: function(params, callback) {
			var self = this,
				type = params.type,
				accountId = params.accountId,
				callflowId = params.callflowId,
				resellerId = params.resellerId,
				noMatchCallflow = self.getDataNoMatchCallflow(type, resellerId);

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: accountId,
					callflowId: callflowId,
					data: noMatchCallflow
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		addCredit: function(accountId, value, success, error) {
			var self = this,
				apiData = {
					resource: 'balance.add',
					data: {
						accountId: accountId,
						data: {
							amount: parseFloat(value)
						}
					},
					success: function(data, status) {
						success && success(data);
					}
				};

			// We do that so that we don't bypass the generic error helper if there was no error callback defined.
			if(error && typeof error === 'function') {
				apiData.data.generateError = false;

				apiData.error = function(data, status) {
					error && error(data);
				};
			}

			self.callApi(apiData);
		},

		removeCredit: function(accountId, value, success, error) {
			var self = this;

			self.callApi({
				resource: 'balance.remove',
				data: {
					accountId: accountId,
					data: {
						amount: parseFloat(value)
					},
					generateError: false
				},
				success: function(data, status) {
					success && success(data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		},

		getBalance: function(accountId, success, error) {
			var self = this;

			self.callApi({
				resource: 'balance.get',
				data: {
					accountId: accountId
				},
				success: function(data, status) {
					success && success(data);
				},
				error: function(data, status) {
					error && error(data);
				}
			});
		}
	};

	return app;
});
