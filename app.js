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
			'ru-RU': { customCss: false }
		},

		requests: {},

		subscribe: {
			'accountsManager.activate': '_render',
			'accountsManager.restoreMasquerading': '_restoreMasquerading',
			'accountsManager.triggerMasquerading': '_triggerMasquerading'
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
		 * `breadcrumbs`: list of breadcrumbs to display
		 */
		render: function(args){
			var self = this;

			self._render(args);
		},

		// subscription handlers
		_render: function(args) {
			var self = this,
				args = args || {},
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
				parentId: args.parentId,
				selectedId: args.selectedId,
				callback: args.callback,
				breadcrumbs: args.breadcrumbs
			});
		},

		renderAccountsManager: function(args) {
			var self = this,
				parent = args.container,
				parentId = args.parentId,
				selectedId = args.selectedId,
				callback = args.callback,
				breadcrumbsList = args.breadcrumbs;

			monster.pub('common.accountBrowser.render', {
				container: parent.find('.edition-view .left-menu'),
				parentId: parentId,
				selectedId: selectedId,
				breadcrumbsContainer: parent.find('.edition-view .content .top-bar'),
				breadcrumbsList: breadcrumbsList,
				addBackButton: true,
				onNewAccountClick: function(parentAccountId, breadcrumbs) {
					self.renderNewAccountWizard({
						parent: parent,
						accountId: parentAccountId || self.accountId,
						breadcrumbs: breadcrumbs
					});
				},
				onBreadcrumbClick: function(accountId, parentId) {
					if(accountId === self.accountId) {
						parent.find('.main-content')
							  .empty()
							  .append(monster.template(self, 'accountsManagerLanding'));
					} else {
						self.edit(accountId, parent);
					}
				},
				onAccountClick: function(accountId) {
					parent.find('.main-content').empty();
					self.edit(accountId, parent);
				},
				callback: function() {
					callback && callback(parent);
				}
			});

			// Put the focus on the search input
			setTimeout(function() { parent.find('.search-query').focus(); });

			// Adjusting the layout divs height to always fit the window's size
			$(window).resize(function(e) {
				var $accountListContainer = parent.find('.account-list-container'),
					$mainContent = parent.find('.main-content'),
					topBarHeight = $('#topbar').outerHeight(),
					listHeight = this.innerHeight-$accountListContainer.position().top-topBarHeight+'px'; //
				$accountListContainer.css('height', listHeight);
				$mainContent.css('height', this.innerHeight-$mainContent.position().top-topBarHeight+'px');
			});
			$(window).resize();
		},

		renderNewAccountWizard: function(params) {
			var self = this,
				parent = params.parent,
				parentAccountId = params.accountId,
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

			if(!monster.apps['auth'].isReseller) {
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
				if(newStep === 2 && !monster.apps['auth'].isReseller) {
					newStep++;
				}
				if(monster.ui.valid(newAccountWizardForm)) {
					self.changeStep(newStep, maxStep, newAccountWizard);
				}
			});

			newAccountWizard.find('.prev-step').on('click', function(ev) {
				ev.preventDefault();

				var newStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step'))-1;
				if(newStep === 2 && !monster.apps['auth'].isReseller) {
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
							processingDiv.find('i.icon-spinner').addClass('icon-spin');
							newAccountWizard.find('.step').removeClass('completed');
						} else {
							stepsDiv.show();
							processingDiv.hide();
							processingDiv.find('i.icon-spinner').removeClass('icon-spin');
							newAccountWizard.find('.step').addClass('completed');
						}
					};

				if(monster.ui.valid(newAccountWizardForm)) {

					var formData = monster.ui.getFormData('accountsmanager_new_account_form'),
						callRestrictions = {}; // Can't use form data for this since unchecked checkboxes are not retrieved by form2object

					$.each(newAccountWizard.find('.call-restrictions-element input[type="checkbox"]'), function() {
						var $this = $(this);
						callRestrictions[$this.data('id')] = {
							action: $this.is(':checked') ? 'allow' : 'deny'
						};
					});

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
												twoway_trunks: parseInt(formData.limits.twoway_trunks, 10),
												call_restriction: callRestrictions
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
													if(data.error == 403) {
														toastr.info(self.i18n.active().toastrMessages.newAccount.forbiddenLimitsError, '', {"timeOut": 10000});
														callback(null, {});
													}
													// Only show error if error isn't a 402, because a 402 is handled generically
													else if(data.error != 402) {
														toastr.info(self.i18n.active().toastrMessages.newAccount.limitsError, '', {"timeOut": 10000});
														callback(null, {});
													}
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
										self.callApi({
											resource: 'balance.add',
											data: {
												accountId: newAccountId,
												data: {
													amount: parseFloat(formData.addCreditBalance)
												},
												generateError: false
											},
											success: function(data, status) {
												callback(null, data.data);
											},
											error: function(data, status) {
												callback(null, {});
												toastr.info(self.i18n.active().toastrMessages.newAccount.creditError, '', {"timeOut": 10000});
											}
										});
									} else {
										callback();
									}
								},
								servicePlans: function(callback) {
									if(formData.servicePlan) {
										self.callApi({
											resource: 'servicePlan.add',
											data: {
												accountId: newAccountId,
												planId: formData.servicePlan,
												data: {}
											},
											success: function(data, status) {
												callback(null, data.data);
											},
											error: function(data, status) {
												callback(null, {});
												toastr.error(self.i18n.active().toastrMessages.newAccount.servicePlanError, '', {"timeOut": 10000});
											}
										});
									} else {
										callback();
									}
								}
							},
							function(err, results) {
								self.render({
									parentId: parentAccountId,
									selectedId: newAccountId,
									callback: function(container) {
										self.edit(newAccountId, container);
									},
									breadcrumbs: params.breadcrumbs
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
			parent.find('.creation-view').append(newAccountWizard);
		},

		renderWizardSteps: function(parent) {
			var self = this;

			monster.parallel({
					servicePlans: function(callback) {
						if(monster.apps['auth'].isReseller) {
							self.callApi({
								resource: 'servicePlan.list',
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
						} else {
							callback(null, {});
						}
					},
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
						parent: parent.find('.wizard-content-step[data-step="2"]'),
						servicePlans: results.servicePlans
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
			});

			autogenBtn.on('click', function(e) {
				autogenCheckbox.prop('checked', true);
				pwdToggleDiv.find('input[type=password]').val('');
				pwdToggleDiv.slideUp();
			});

			monster.ui.tooltips(parent);
		},

		renderServicePlanStep: function(params) {
			var self = this,
				parent = params.parent,
				stepTemplate = $(monster.template(self, 'servicePlanWizardStep', {
					servicePlans: params.servicePlans,
					isReseller: monster.apps['auth'].isReseller
				}));

				stepTemplate.find('.service-plan-select').on('change', function(e) {
					var servicePlanId = $(this).val();
						twowayTrunksDiv = parent.parents('#accountsmanager_new_account_form').find('.limits-tab-container .trunks-div.twoway'),
						inboundTrunksDiv = parent.parents('#accountsmanager_new_account_form').find('.limits-tab-container .trunks-div.inbound'),
						outboundTrunksDiv = parent.parents('#accountsmanager_new_account_form').find('.limits-tab-container .trunks-div.outbound'),
						setTrunksPrice = function(trunksDiv, price) {
							var trunksSlider = trunksDiv.find('.slider-div');
							if(price && price > 0) {
								trunksDiv.data('price', price);
								trunksDiv.find('.total-amount').show();
							} else {
								trunksDiv.removeData('price');
								trunksDiv.find('.total-amount').hide();
							}
							
							trunksSlider.slider('option', 'slide').call(trunksSlider, null, {value: trunksSlider.slider('value')});
						};

					if(servicePlanId) {
						self.callApi({
							resource: 'servicePlan.get',
							data: {
								accountId: self.accountId,
								planId: servicePlanId
							},
							success: function(data, status) {
								var plan = data.data.plan;
								if(plan.limits && plan.limits && plan.limits.inbound_trunks && plan.limits.inbound_trunks.rate) {
									setTrunksPrice(inboundTrunksDiv, plan.limits.inbound_trunks.rate);
								} else {
									setTrunksPrice(inboundTrunksDiv, 0);
								}

								if(plan.limits && plan.limits && plan.limits.outbound_trunks && plan.limits.outbound_trunks.rate) {
									setTrunksPrice(outboundTrunksDiv, plan.limits.outbound_trunks.rate);
								} else {
									setTrunksPrice(outboundTrunksDiv, 0);
								}

								if(plan.limits && plan.limits && plan.limits.twoway_trunks && plan.limits.twoway_trunks.rate) {
									setTrunksPrice(twowayTrunksDiv, plan.limits.twoway_trunks.rate);
								} else {
									setTrunksPrice(twowayTrunksDiv, 0);
								}

								monster.pub('common.servicePlanDetails.render', {
									container: stepTemplate.find('.serviceplans-details-container'),
									useOwnPlans: true,
									servicePlan: data.data
								});
							},
							error: function(data, status) {
								setTrunksPrice(inboundTrunksDiv, 0);
								setTrunksPrice(outboundTrunksDiv, 0);
								setTrunksPrice(twowayTrunksDiv, 0);
							}
						});
					} else {
						setTrunksPrice(inboundTrunksDiv, 0);
						setTrunksPrice(outboundTrunksDiv, 0);
						setTrunksPrice(twowayTrunksDiv, 0);
						stepTemplate.find('.serviceplans-details-container').empty();
					}
				});

				parent.append(stepTemplate);
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
				editAccountId = editAccountId;
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
						contentHtml = $(monster.template(self, 'accountsAdminForm', {
							accountAdmins: admins,
							accountUsers: regularUsers
						})),
						$createUserDiv = contentHtml.find('.create-user-div'),
						$adminElements = contentHtml.find('.admin-element'),
						$newAdminBtn = contentHtml.find('#accountsmanager_new_admin_btn'),
						$newAdminElem = contentHtml.find('.new-admin-element');

					contentHtml.find('.close-admin-settings').click(function(e) {
						e.preventDefault();
						closeAdminsSetting();
						e.stopPropagation();
					});

					contentHtml.find('.new-admin-tabs a').click(function(e) {
						e.preventDefault();
						$(this).tab('show');
					});

					$newAdminBtn.click(function(e) {
						e.preventDefault();
						var $this = $(this);
						if(!$this.hasClass('disabled')) {
							if($this.hasClass('active')) {
								$this.find('i').removeClass('icon-caret-up').addClass('icon-caret-down');
								$newAdminElem.slideUp();
							} else {
								$this.find('i').removeClass('icon-caret-down').addClass('icon-caret-up');
								$newAdminElem.slideDown();
							}
						} else {
							e.stopPropagation();
						}
					});

					$createUserDiv.find('input[name="extra.autogen_password"]').change(function(e) {
						$(this).val() === "true" ? $createUserDiv.find('.new-admin-password-div').slideUp() : $createUserDiv.find('.new-admin-password-div').slideDown();
					});

					contentHtml.find('.admin-element-link.delete').click(function(e) {
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

					contentHtml.find('.admin-element-link.edit').click(function(e) {
						e.preventDefault();
						var $adminElement = $(this).parent().parent(),
							userId = $adminElement.data('user_id');

						contentHtml.find('.admin-element-edit .admin-cancel-btn').click();

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

							if(monster.ui.valid(contentHtml.find('#accountsmanager_add_admin_form'))) {
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
							var userId = contentHtml.find('#accountsmanager_promote_user_select option:selected').val();
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

					parent.find('#form_accountsmanager_account_admins').empty().append(contentHtml);

					$.each(contentHtml.find('form'), function() {
						monster.ui.validate($(this), {
							rules: {
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

					monster.ui.tooltips(contentHtml);
				}
			});
		},

		edit: function(accountId, parent) {
			var self = this;

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
					listServicePlans: function(callback) {
						self.callApi({
							resource: 'servicePlan.listAvailable',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								callback(null, data.data);
							},
							error: function(data, status) {
								callback(null, []);
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
								if(!$.isEmptyObject(data.data.plans)) {
									self.callApi({
										resource: 'servicePlan.getAvailable',
										data: {
											accountId: accountId,
											planId: Object.keys(data.data.plans)[0]
										},
										success: function(data, status) {
											callback(null, data.data);
										},
										error: function(data, status) {
											callback(null, {});
										}
									});
								} else {
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
						self.callApi({
							resource: 'balance.get',
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
					}
				},
				function(err, results) {
					var servicePlans = {
							current: results.currentServicePlan,
							list: results.listServicePlans
						},
						params = {
							accountData: results.account,
							accountUsers: results.users.sort(function(a,b) {
								return (a.first_name+a.last_name).toLowerCase() > (b.first_name+b.last_name).toLowerCase() ? 1 : -1;
							}),
							servicePlans: servicePlans,
							accountLimits: results.limits,
							classifiers: results.classifiers,
							accountBalance: 'balance' in results.currentBalance ? results.currentBalance.balance : 0,
							parent: parent,
							noMatch: results.noMatch
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

		/** Expected params:
			- accountData
			- accountUsers
			- servicePlans
			- accountLimits
			- classifiers (call restriction)
			- parent
			- callback [optional]
		*/
		editAccount: function(params) {
			var self = this,
				accountData = params.accountData,
				accountUsers = params.accountUsers,
				servicePlans = params.servicePlans,
				accountLimits = params.accountLimits,
				accountBalance = params.accountBalance,
				carrierInfo = params.carrierInfo,
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
					if(accountLimits.call_restriction
						&& key in accountLimits.call_restriction
						&& accountLimits.call_restriction[key].action === "deny") {
						ret.checked = false;
					}
					return ret;
				}),
				templateData = {
					account: $.extend(true, {}, accountData),
					accountAdmins: admins,
					accountUsers: regularUsers,
					accountServicePlans: servicePlans,
					isReseller: monster.apps['auth'].isReseller,
					carrierInfo: carrierInfo,
					isSuperDuperAdmin: monster.apps.auth.currentAccount.superduper_admin,
					accountIsReseller: accountData.is_reseller
				};

			if($.isNumeric(templateData.account.created)) {
				templateData.account.created = monster.util.toFriendlyDate(accountData.created, "short");
			}

			var contentHtml = $(monster.template(self, 'edit', templateData)),
				$liSettings = contentHtml.find('li.settings-item'),
				$liContent = $liSettings.find('.settings-item-content'),
				$aSettings = $liSettings.find('a.settings-link'),
				closeTabsContent = function() {
					$liSettings.removeClass('open');
					$liContent.slideUp('fast');
					$aSettings.find('.update .text').text(self.i18n.active().editSetting);
					$aSettings.find('.update i').removeClass('icon-remove').addClass('icon-cog');
				},
				notesTab = contentHtml.find('#accountsmanager_notes_tab');

			monster.pub('common.carrierSelector', {
				container: contentHtml.find('#accountsmanager_carrier_tab'),
				data: params
			});

			contentHtml.find('.account-tabs a').click(function(e) {
				e.preventDefault();
				if(!$(this).parent().hasClass('disabled')) {
					closeTabsContent();
					$(this).tab('show');
				}
			});

			contentHtml.find('li.settings-item .settings-link').on('click', function(e) {
				var $this = $(this),
					settingsItem = $this.parents('.settings-item');

				if(!settingsItem.hasClass('disabled')) {
					var isOpen = settingsItem.hasClass('open');
					closeTabsContent();
					if(!isOpen){
						settingsItem.addClass('open');
						$this.find('.update .text').text(self.i18n.active().closeSetting);
						$this.find('.update i').removeClass('icon-cog').addClass('icon-remove');
						settingsItem.find('.settings-item-content').slideDown('fast');

						if(settingsItem.data('name') === 'accountsmanager_account_admins') {
							self.renderEditAdminsForm(parent, accountData.id);
						}
					}
				}
			});

			contentHtml.find('.settings-item .cancel').on('click', function(e) {
				e.preventDefault();
				closeTabsContent();

				$(this).parents('form').first().find('input, select').each(function(k, v) {
					$(v).val($(v).data('original_value'));
				});

				e.stopPropagation();
			});

			contentHtml.find('#accountsmanager_delete_account_btn').on('click', function(e) {
				self.confirmDeleteDialog(accountData.name, function() {
					self.callApi({
						resource: 'account.delete',
						data: {
							accountId: accountData.id,
							data: {}
						},
						success: function(data, status) {
							parent.find('.main-content').empty();
							parent.find('.account-list-element[data-id="'+accountData.id+'"]').remove();
						}
					});
				});
			});

			contentHtml.find('#accountsmanager_use_account_btn').on('click', function(e) {
				e.preventDefault();

				self._triggerMasquerading(accountData);

				e.stopPropagation();
			});

			contentHtml.find('.change').on('click', function(e) {
				e.preventDefault();

				var $this = $(this),
					module = $this.data('module'),
					fieldName = $this.data('field'),
					newData = self.cleanFormData(monster.ui.getFormData('form_'+fieldName));

				if(monster.ui.valid(contentHtml.find('#form_'+fieldName))) {
					self.updateData(accountData, newData,
						function(data) {
							params.accountData = data.data;
							params.callback = function(parent) {
								var $link = parent.find('li[data-name='+fieldName+']');

								$link.find('.update').hide();
								$link.find('.changes-saved').show()
														  .fadeOut(1500, function() {
															  $link.find('.update').fadeIn(500);
														  });

								$link.css('background-color', '#22a5ff')
									   .animate({
										backgroundColor: '#eee'
									}, 2000
								);

								parent.find('.settings-item-content').hide();
								parent.find('a.settings-link').show();
							};

							self.editAccount(params);
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
			if(monster.apps['auth'].isReseller) {
				var $btn_save = contentHtml.find('#accountsmanager_serviceplan_save'),
					$btn_rec = contentHtml.find('#accountsmanager_serviceplan_reconciliation'),
					$btn_sync = contentHtml.find('#accountsmanager_serviceplan_synchronization');

				contentHtml.find('#accountsmanager_serviceplan_select').on('change', function() {
					var planId = $(this).val();

					if(planId) {
						monster.pub('common.servicePlanDetails.render', {
							container: contentHtml.find('.serviceplans-details-container'),
							accountId: accountData.id,
							servicePlan: planId
						});
					} else {
						contentHtml.find('.serviceplans-details-container').empty();
					}
				});

				$btn_save.click(function(e) {
					e.preventDefault();
					if(!$btn_save.hasClass('disabled')) {
						$btn_save.addClass('disabled');
						var newPlanId = contentHtml.find('#accountsmanager_serviceplan_select').val(),
							success = function() {
								toastr.success(self.i18n.active().toastrMessages.servicePlanUpdateSuccess, '', {"timeOut": 5000});
								$btn_save.removeClass('disabled');
							},
							error = function() {
								toastr.error(self.i18n.active().toastrMessages.servicePlanUpdateError, '', {"timeOut": 5000});
								$btn_save.removeClass('disabled');
							};
						if(servicePlans.current.id) {
							self.callApi({
								resource: 'servicePlan.remove',
								data: {
									accountId: accountData.id,
									planId: servicePlans.current.id,
									data: {}
								},
								success: function(data, status) {
									if (newPlanId) {
										self.callApi({
											resource: 'servicePlan.add',
											data: {
												accountId: accountData.id,
												planId: newPlanId,
												data: {}
											},
											success: function(data, status) {
												success();
											},
											error: function(data, status) {
												error();
											}
										});
									} else {
										success();
									}
								},
								error: function(data, status) {
									error();
								}
							});
						} else if (newPlanId) {
							self.callApi({
								resource: 'servicePlan.add',
								data: {
									accountId: accountData.id,
									planId: newPlanId,
									data: {}
								},
								success: function(data, status) {
									success();
								},
								error: function(data, status) {
									error();
								}
							});
						} else {
							$btn_save.removeClass('disabled');
						}
					}
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

			timezone.populateDropdown(contentHtml.find('#accountsmanager_account_timezone'), accountData.timezone);

			contentHtml.find('#accountsmanager_account_timezone').chosen({search_contains: true, width: "100%"});

			monster.ui.tooltips(contentHtml);

			if(servicePlans.current.id) {
				monster.pub('common.servicePlanDetails.render', {
					container: contentHtml.find('.serviceplans-details-container'),
					accountId: accountData.id,
					servicePlan: servicePlans.current.id
				});
			}

			self.renderLimitsTab({
				accountData: accountData,
				limits: accountLimits,
				balance: accountBalance,
				formattedClassifiers: formattedClassifiers,
				servicePlan: servicePlans.current,
				parent: contentHtml.find('#accountsmanager_limits_tab')
			});

			self.renderRestrictionsTab({
				accountData: accountData,
				parent: contentHtml.find('#accountsmanager_restrictions_tab')
			});

			monster.ui.validate(contentHtml.find('#form_accountsmanager_account_realm'), {
				rules: {
					'realm': {
						'realm': true
					}
				}
			});

			parent.find('.main-content').empty()
										.append(contentHtml);

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
			monster.ui.wysiwyg(notesTab.find('.wysiwyg-container')).html(accountData.custom_notes);
			notesTab.find('#accountsmanager_notes_save').on('click', function() {
				var notesContent = notesTab.find('.wysiwyg-editor').html();
				self.updateData(
					accountData,
					{ custom_notes: notesContent },
					function(data, status) {
						accountData = data.data;
						toastr.success(self.i18n.active().toastrMessages.notesUpdateSuccess, '', {"timeOut": 5000});
					},
					function(data, status) {
						toastr.error(self.i18n.active().toastrMessages.notesUpdateError, '', {"timeOut": 5000});
					}
				);
			});

			// self.adjustTabsWidth(contentHtml.find('ul.account-tabs > li'));

			$.each(contentHtml.find('form'), function() {
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
				callback(contentHtml);
			}
		},

		confirmDeleteDialog: function(accountName, callbackSuccess) {
			var self = this,
				template = $(monster.template(self, 'deleteAccountDialog', {accountName: accountName})),
				optionsPopup = {
					position: ['center', 20],
					title: self.i18n.active().deleteAccountDialog.title
				},
				deleteKey = self.i18n.active().deleteAccountDialog.deleteKey;

				template.find('#delete_account').on('click', function() {
					if(!$(this).hasClass('disabled')) {
						popup.dialog('close').remove();
						callbackSuccess && callbackSuccess();
					}
				});

				template.find('#delete_input').on('keyup', function() {
					if($(this).val() === deleteKey) {
						template.find('#delete_account').removeClass('disabled');
					}
					else {
						template.find('#delete_account').addClass('disabled');
					}
				});

				template.find('#cancel').on('click', function() {
					popup.dialog('close').remove();
				});

				popup = monster.ui.dialog(template, optionsPopup);
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
				creditBalanceSpan = tabContentTemplate.find('.manage-credit-div .credit-balance'),
				addCreditInput = tabContentTemplate.find('.add-credit-input');

			creditBalanceSpan.html(self.i18n.active().currencyUsed+balance);
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
						if(!(v.id in callRestrictions) || callRestrictions[v.id].action !== "allow") {
							callRestrictions[v.id] = {
								action: "deny"
							};
						}
					});

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
						},
						error: function(data, status) {
							if(data.error != 402) {
								toastr.error(self.i18n.active().toastrMessages.limitsUpdateError, '', {"timeOut": 5000});
							}
						}
					});

					if(addCredit) {
						self.callApi({
							resource: 'balance.add',
							data: {
								accountId: accountData.id,
								data: {
									amount: parseFloat(addCredit)
								},
								generateError: false
							},
							success: function(data, status) {
								balance += parseFloat(addCredit);
								creditBalanceSpan.html(self.i18n.active().currencyUsed+balance);
								addCreditInput.val('');
								toastr.success(self.i18n.active().toastrMessages.creditAddSuccess, '', {"timeOut": 5000});
							},
							error: function(data, status) {
								toastr.error(self.i18n.active().toastrMessages.creditAddError, '', {"timeOut": 5000});
							}
						});
					}

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
				servicePlan = params.servicePlan || {},
				limits = params.limits || {};
				template = $(monster.template(self, 'limitsTabContent', {
					classifiers: formattedClassifiers,
					allowPrepay: limits.allow_prepay,
					disableBraintree: monster.config.disableBraintree
				})),
				amountTwoway = (servicePlan.plan && servicePlan.plan.limits && servicePlan.plan.limits.twoway_trunks) ? servicePlan.plan.limits.twoway_trunks.rate : 0,
				twoway = limits.twoway_trunks || 0,
				totalAmountTwoway = amountTwoway * twoway,
				twowayTrunksDiv = template.find('.trunks-div.twoway'),
				amountInbound = (servicePlan.plan && servicePlan.plan.limits && servicePlan.plan.limits.inbound_trunks) ? servicePlan.plan.limits.inbound_trunks.rate : 0,
				inbound = limits.inbound_trunks || 0,
				totalAmountInbound = amountInbound * inbound,
				inboundTrunksDiv = template.find('.trunks-div.inbound'),
				amountOutbound = (servicePlan.plan && servicePlan.plan.limits && servicePlan.plan.limits.outbound_trunks) ? servicePlan.plan.limits.outbound_trunks.rate : 0,
				outbound = limits.outbound_trunks || 0,
				totalAmountOutbound = amountOutbound * outbound,
				outboundTrunksDiv = template.find('.trunks-div.outbound'),
				createSlider = function(args) {
					var trunksDiv = args.trunksDiv,
						sliderValue = trunksDiv.find('.slider-value'),
						totalAmountValue = trunksDiv.find('.total-amount .total-amount-value'),
						trunksValue = trunksDiv.find('.trunks-value');
					trunksDiv.find('.slider-div').slider({
						min: args.minValue,
						max: args.maxValue,
						range: 'min',
						value: args.currentValue,
						slide: function(event, ui) {
							var amount = (trunksDiv.data('price') ? parseFloat(trunksDiv.data('price')) : args.amount) || args.amount,
								totalAmount = ui.value * amount;
							sliderValue.html(ui.value);
							totalAmountValue.html(totalAmount.toFixed(2));
							trunksValue.val(ui.value);
						}
					});

					if(args.amount <= 0) {
						trunksDiv.find('.total-amount').hide();
					}
				};

			createSlider({
				trunksDiv: twowayTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: twoway,
				amount: amountTwoway
			});

			createSlider({
				trunksDiv: inboundTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: inbound,
				amount: amountInbound
			});
			
			createSlider({
				trunksDiv: outboundTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: outbound,
				amount: amountOutbound
			});

			twowayTrunksDiv.find('.slider-value').html(twoway);
			twowayTrunksDiv.find('.total-amount .total-amount-value').html(totalAmountTwoway.toFixed(2));
			inboundTrunksDiv.find('.slider-value').html(inbound);
			inboundTrunksDiv.find('.total-amount .total-amount-value').html(totalAmountInbound.toFixed(2));
			outboundTrunksDiv.find('.slider-value').html(outbound);
			outboundTrunksDiv.find('.total-amount .total-amount-value').html(totalAmountOutbound.toFixed(2));
			$.each(template.find('.trunks-div'), function() {
				var $this = $(this);
				$this.find('.ui-slider-handle').append($this.find('.section-slider-value'));
			});

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
						toastr.success(self.i18n.active().toastrMessages.uiRestrictionsUpdateSuccess, '', {"timeOut": 5000});
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
				};
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
				};
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

				if ( restrictionsContainer.data('content') != 'restrictions-balance' ) {
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

			self.callApi({
				resource: 'account.update',
				data: {
					accountId: data.id,
					data: dataToUpdate
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

		_triggerMasquerading: function(account) {
			var self = this;

			monster.apps['auth'].currentAccount = $.extend(true, {}, account);
			self.updateApps(account.id);

			self.callApi({
				resource: 'account.listParents',
				data: {
					accountId: account.id
				},
				success: function(data, status) {
					data.data.shift();

					monster.pub('myaccount.renderNavLinks', {
						name: account.name,
						isMasquerading: true,
						parentsList: data.data
					});

					self.render();
					toastr.info(monster.template(self, '!' + self.i18n.active().toastrMessages.triggerMasquerading, { accountName: account.name }));
				}
			});
		},

		updateApps: function(accountId) {
			$.each(monster.apps, function(key, val) {
				if( (val.isMasqueradable && val.apiUrl === monster.apps['accounts'].apiUrl) || key === 'auth' ) {
					val.accountId = accountId;
				}
			});
		},

		_restoreMasquerading: function() {
			var self = this;

			monster.apps['auth'].currentAccount = $.extend(true, {}, monster.apps['auth'].originalAccount);
			self.updateApps(monster.apps['auth'].originalAccount.id);

			monster.pub('myaccount.renderNavLinks');

			self.render();

			toastr.info(self.i18n.active().toastrMessages.restoreMasquerading);
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
		}
	};

	return app;
});
