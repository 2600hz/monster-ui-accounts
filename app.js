define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var appSubmodules = [
		'serviceItemsListing',
		'wizard'
	];

	require(_.map(appSubmodules, function(name) {
		return './submodules/' + name + '/' + name;
	}));

	var app = {
		name: 'accounts',

		subModules: appSubmodules,

		css: [ 'app' ],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false },
			'fr-FR': { customCss: false },
			'ru-RU': { customCss: false },
			'es-ES': { customCss: false }
		},

		requests: {
			'google.geocode.address': {
				apiRoot: '//maps.googleapis.com/',
				url: 'maps/api/geocode/json?address={zipCode}',
				verb: 'GET',
				generateError: false,
				removeHeaders: [
					'X-Kazoo-Cluster-ID',
					'X-Auth-Token',
					'Content-Type'
				]
			}
		},

		subscribe: {
			'accountsManager.activate': '_render'
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

		/**
		 * Store getter
		 * @param  {Array|String} [path]
		 * @param  {*} [defaultValue]
		 * @return {*}
		 */
		getStore: function(path, defaultValue) {
			var self = this,
				store = ['_data', 'store'];
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
		 * @param {Array|String} [path]
		 * @param {*} [value]
		 */
		setStore: function(path, value) {
			var self = this,
				hasValue = _.toArray(arguments).length === 2,
				store = ['_data', 'store'];
			_.set(
				self,
				hasValue
					? _.flatten([store, _.isString(path) ? path.split('.') : path])
					: store,
				hasValue ? value : path
			);
		},

		/* Available args *
		 * `container`: Container of the App, defaults to $('#monster_content')
		 * `parentId`: ID of the parent account used to display the list
		 * `selectedId`: ID of the account to show as selected in the list
		 * `callback`: callback to be executed after the rendering
		 */
		render: function(args) {
			var self = this;

			self._render(args);
		},

		// subscription handlers
		_render: function(pArgs) {
			var self = this,
				args = pArgs || {},
				parentId = args.parentId,
				container = args.container,
				accountsManager = $(self.getTemplate({
					name: 'accountsManager'
				})),
				accountsManagerLanding = $(self.getTemplate({
					name: 'accountsManagerLanding'
				})),
				parent = container || $('#monster_content');

			accountsManager.find('.main-content')
							.append(accountsManagerLanding);

			parent.empty()
					.append(accountsManager);

			self.renderAccountsManager({
				container: accountsManager,
				parentId: parentId,
				selectedId: args.selectedId,
				selectedTab: args.selectedTab,
				callback: args.callback
			});
		},

		renderAccountsManager: function(args) {
			var self = this,
				parent = args.container,
				parentId = args.parentId,
				selectedId = args.selectedId,
				selectedTab = args.selectedTab,
				callback = args.callback,
				$window = $(window);

			monster.pub('common.accountBrowser.render', {
				container: parent.find('.edition-view .left-menu'),
				parentId: parentId,
				selectedId: selectedId,
				addBackButton: true,
				noFocus: true,
				onNewAccountClick: function(parentAccountId) {
					$(window).off('resize.accountsManager');

					monster.pub('accounts.wizard.render', {
						container: parent,
						parentAccountId: parentAccountId || self.accountId
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

			// Adjusting the layout divs height to always fit the window's size
			$window.on('resize.accountsManager', function(e) {
				var $accountListContainer = parent.find('.account-list-container'),
					$mainContent = parent.find('.main-content'),
					listHeight = this.innerHeight - $accountListContainer.position().top + 'px'; //
				$accountListContainer.css('height', listHeight);
				$mainContent.css('height', this.innerHeight - $mainContent.position().top + 'px');
			});

			// give time to the DOM to load all the elements before the resize happens
			setTimeout(function() {
				$window.resize();
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
				dataTemplate = {},
				hasRealmSuffix = !_.isUndefined(monster.util.getRealmSuffix());

			if (hasRealmSuffix) {
				dataTemplate.whitelabeledRealm = monster.util.generateAccountRealm();
			}

			var newAccountWizard = $(self.getTemplate({
					name: 'newAccountWizard',
					data: dataTemplate
				})),
				maxStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('max_step')),
				newAccountWizardForm = newAccountWizard.find('#accountsmanager_new_account_form');

			newAccountWizard.find('.wizard-top-bar').data('active_step', '1');

			newAccountWizard.find('.wizard-content-step').hide();
			newAccountWizard.find('.wizard-content-step[data-step="1"]').show();

			if (!monster.apps.auth.isReseller) {
				newAccountWizard.find('.wizard-top-bar .step[data-step="2"]').hide();
			}

			if (maxStep > 1) {
				newAccountWizard.find('.submit-btn').hide();
			} else {
				newAccountWizard.find('.next-step').hide();
			}

			newAccountWizard.find('.prev-step').hide();

			newAccountWizard.find('.step').on('click', function() {
				var currentStep = newAccountWizard.find('.wizard-top-bar').data('active_step'),
					newStep = $(this).data('step');
				if ($(this).hasClass('completed') && currentStep !== newStep) {
					if (newStep < currentStep) {
						if (!monster.ui.valid(newAccountWizardForm)) {
							newAccountWizard.find('.step:gt(' + newStep + ')').removeClass('completed');
						}
						self.changeStep(newStep, maxStep, newAccountWizard);
					} else if (monster.ui.valid(newAccountWizardForm)) {
						self.changeStep(newStep, maxStep, newAccountWizard);
					}
				}
			});

			newAccountWizard.find('.next-step').on('click', function(ev) {
				ev.preventDefault();

				var currentStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step')),
					newStep = currentStep + 1;
				if (newStep === 2 && !monster.apps.auth.isReseller) {
					newStep++;
				}
				if (monster.ui.valid(newAccountWizardForm)) {
					self.changeStep(newStep, maxStep, newAccountWizard);
				}
			});

			newAccountWizard.find('.prev-step').on('click', function(ev) {
				ev.preventDefault();

				var newStep = parseInt(newAccountWizard.find('.wizard-top-bar').data('active_step')) - 1;
				if (newStep === 2 && !monster.apps.auth.isReseller) {
					newStep--;
				}
				if (!monster.ui.valid(newAccountWizardForm)) {
					newAccountWizard.find('.step:gt(' + newStep + ')').removeClass('completed');
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

				var toggleProcessing = function(show) {
					var stepsDiv = newAccountWizard.find('#accountsmanager_new_account_form'),
						processingDiv = newAccountWizard.find('.processing-div');

					if (show) {
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

				if (monster.ui.valid(newAccountWizardForm)) {
					var formData = monster.ui.getFormData('accountsmanager_new_account_form');

					formData = self.formatAccountCreationData(newAccountWizardForm, formData);

					toggleProcessing(true);

					self.callApi({
						resource: 'account.create',
						data: {
							accountId: parentAccountId,
							data: self.formatAccountData(formData.account)
						},
						success: function(data, status) {
							var newAccountId = data.data.id;
							monster.parallel({
								admin: function(callback) {
									if (formData.user.email) {
										if (formData.extra.autogenPassword) {
											formData.user.password = self.autoGeneratePassword();
											formData.user.send_email_on_creation = true;
										}
										formData.user.username = formData.user.email;
										formData.user.priv_level = 'admin';
										self.callApi({
											resource: 'user.create',
											data: {
												accountId: newAccountId,
												data: formData.user
											},
											success: function(data, status) {
												callback(null, data.data);
												if (formData.user.send_email_on_creation) {
													var popupContent = self.getTemplate({
														name: '!' + self.i18n.active().sentEmailPopup,
														data: {
															email: data.data.email
														}
													});
													monster.ui.alert('info', popupContent);
												}
											},
											error: function(data, status) {
												monster.ui.toast({
													type: 'error',
													message: self.i18n.active().toastrMessages.newAccount.adminError,
													options: {
														timeOut: 10000
													}
												});
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
													if (data.error === 403) {
														monster.ui.toast({
															type: 'info',
															message: self.i18n.active().toastrMessages.newAccount.forbiddenLimitsError,
															options: {
																timeOut: 10000
															}
														});
														callback(null, {});
													} else if (data.error !== 402) { // Only show error if error isn't a 402, because a 402 is handled generically
														monster.ui.toast({
															type: 'info',
															message: self.i18n.active().toastrMessages.newAccount.limitsError,
															options: {
																timeOut: 10000
															}
														});
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
									if (formData.addCreditBalance) {
										self.addCredit(newAccountId, formData.addCreditBalance, function(data, status) {
											callback(null, data.data);
										},
										function(data, status) {
											monster.ui.toast({
												type: 'info',
												message: self.i18n.active().toastrMessages.newAccount.creditError,
												options: {
													timeOut: 10000
												}
											});
											callback(null, {});
										});
									} else {
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
							monster.ui.toast({
								type: 'error',
								message: self.i18n.active().toastrMessages.newAccount.accountError,
								options: {
									timeOut: 5000
								}
							});
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
			}, function(err, results) {
				self.renderAccountInfoStep({
					parent: parent.find('.wizard-content-step[data-step="1"]')
				});

				self.renderLimitsStep({
					parent: parent.find('.wizard-content-step[data-step="2"]'),
					classifiers: results.classifiers
				});

				self.renderRestrictionsStep({
					parent: parent.find('.wizard-content-step[data-step="3"]')
				});
			});
		},

		renderAccountInfoStep: function(params) {
			var self = this,
				parent = params.parent,
				newAdminDiv = parent.find('.new-admin-div'),
				autogenBtn = newAdminDiv.find('.autogen-button'),
				manualBtn = newAdminDiv.find('.manual-button'),
				autogenCheckbox = newAdminDiv.find('.autogen-ckb'),
				pwdToggleDiv = newAdminDiv.find('.password-toggle-div');

			timezone.populateDropdown(parent.find('#accountsmanager_new_account_timezone'), monster.apps.auth.currentAccount.timezone);

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
				if (newAdminDiv.hasClass('active')) {
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
			parent.find('.step[data-step="' + stepIndex + '"]').addClass('active');

			for (var i = stepIndex; i >= 1; --i) {
				parent.find('.step[data-step="' + i + '"]').addClass('completed');
			}

			parent.find('.wizard-content-step').hide();
			parent.find('.wizard-content-step[data-step="' + stepIndex + '"]').show();

			parent.find('.cancel').hide();
			parent.find('.prev-step').show();
			parent.find('.next-step').show();
			parent.find('.submit-btn').hide();

			if (stepIndex === maxStep) {
				parent.find('.next-step').hide();
				parent.find('.submit-btn').show();
			}

			if (stepIndex === 1) {
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
							if (data.data.length > 0) {
								data.data = data.data.sort(function(a, b) {
									return (a.first_name + a.last_name).toLowerCase() > (b.first_name + b.last_name).toLowerCase() ? 1 : -1;
								});
								$settingsItem.find('.first-admin-name').text(data.data[0].first_name + ' ' + data.data[0].last_name);
								$settingsItem.find('.first-admin-email').text(data.data[0].email);
							} else {
								$settingsItem.find('.first-admin-name').text('-');
								$settingsItem.find('.first-admin-email').empty();
							}
						}
					});
				};

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: editAccountId
				},
				success: function(data, status) {
					data.data = data.data.sort(function(a, b) {
						return (a.first_name + a.last_name).toLowerCase() > (b.first_name + b.last_name).toLowerCase() ? 1 : -1;
					});
					var admins = $.map(data.data, function(val) {
							return val.priv_level === 'admin' ? val : null;
						}),
						regularUsers = $.map(data.data, function(val) {
							return val.priv_level !== 'admin' ? val : null;
						}),
						contentTemplate = $(self.getTemplate({
							name: 'accountsAdminForm',
							data: {
								accountAdmins: admins,
								accountUsers: regularUsers
							}
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
						if (!$this.hasClass('disabled')) {
							if ($this.hasClass('active')) {
								$this.find('i').removeClass('fa-caret-up').addClass('fa-caret-down');
								$newAdminElem.slideUp();
								$this.removeClass('active');
							} else {
								$this.find('i').removeClass('fa-caret-down').addClass('fa-caret-up');
								$newAdminElem.slideDown();
								$this.addClass('active');
							}
						} else {
							e.stopPropagation();
						}
					});

					$createUserDiv.find('input[name="extra.autogen_password"]').change(function(e) {
						$(this).val() === 'true' ? $createUserDiv.find('.new-admin-password-div').slideUp() : $createUserDiv.find('.new-admin-password-div').slideDown();
					});

					contentTemplate.find('.admin-element-link.delete').click(function(e) {
						e.preventDefault();
						var $adminElement = $(this).closest('.admin-element'),
							user = {
								id: $adminElement.data('user_id'),
								name: $adminElement.find('.admin-element-name').text(),
								priv_level: 'admin'
							};
						monster.pub('common.deleteSmartUser.renderPopup', {
							accountId: editAccountId,
							user: user,
							callback: function(data) {
								monster.ui.toast({
									type: 'success',
									message: self.getTemplate({
										name: '!' + self.i18n.active().toastrMessages.adminUserDeleted,
										data: {
											name: data.first_name + ' ' + data.last_name
										}
									})
								});
								self.renderEditAdminsForm(parent, editAccountId);
								refreshAdminsHeader();
							}
						});
					});

					contentTemplate.find('.admin-element-link.edit').click(function(e) {
						e.preventDefault();
						var $adminElement = $(this).parent().parent();

						contentTemplate.find('.admin-element-edit .admin-cancel-btn').click();

						if ($newAdminBtn.hasClass('active')) {
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
							if ($this.val() !== $this.data('original_value')) {
								$adminPasswordDiv.slideDown();
							} else {
								$adminPasswordDiv.slideUp(function() {
									$adminPasswordDiv.find('input[type="password"]').val('');
								});
							}
						});

						$adminElement.find('.admin-save-btn').click(function(e) {
							e.preventDefault();
							var form = $adminElement.find('form'),
								formData = monster.ui.getFormData(form[0]);

							if (monster.ui.valid(form)) {
								formData = self.cleanFormData(formData);
								if (!$adminPasswordDiv.is(':visible')) {
									delete formData.password;
								}
								self.callApi({
									resource: 'user.get',
									data: {
										accountId: editAccountId,
										userId: userId
									},
									success: function(data, status) {
										if (data.data.email !== formData.email) {
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
						if ($newAdminElem.find('.tab-pane.active').hasClass('create-user-div')) {
							var formData = monster.ui.getFormData('accountsmanager_add_admin_form'),
								autoGen = ($createUserDiv.find('input[name="extra.autogen_password"]:checked').val() === 'true');

							if (monster.ui.valid(contentTemplate.find('#accountsmanager_add_admin_form'))) {
								formData = self.cleanFormData(formData);
								formData.priv_level = 'admin';
								formData.username = formData.email;
								if (autoGen) {
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
										if (formData.send_email_on_creation) {
											var popupContent = self.getTemplate({
												name: '!' + self.i18n.active().sentEmailPopup,
												data: {
													email: data.data.email
												}
											});
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
									data.data.priv_level = 'admin';
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
				parent = args.parent,
				getNoMatchCallflow = _.partial(function(accountId, callback) {
					monster.waterfall([
						function getNoMatchCallflowId(next) {
							self.callApi({
								resource: 'callflow.list',
								data: {
									accountId: accountId,
									filters: {
										filter_numbers: 'no_match'
									}
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.head,
									_.partial(_.get, _, 'id'),
									_.partial(next, null)
								)
							});
						},
						function getCallflow(callflowId, next) {
							if (_.isUndefined(callflowId)) {
								return next(null);
							}
							self.callApi({
								resource: 'callflow.get',
								data: {
									accountId: accountId,
									callflowId: callflowId
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.partial(next, null)
								),
								error: _.partial(next, null)
							});
						}
					], callback);
				}, accountId),
				mergeResults = function(data) {
					return _.chain(data.metadata).pick(['billing_mode', 'enabled', 'superduper_admin', 'wnm_allow_additions', 'created', 'is_reseller', 'reseller_id']).merge(data.data).value();
				},
				fetchData = function(callback) {
					monster.parallel({
						account: function(next) {
							self.callApi({
								resource: 'account.get',
								data: {
									accountId: accountId
								},
								success: _.flow(
									mergeResults,
									_.partial(next, null)
								)
							});
						},
						users: function(next) {
							self.callApi({
								resource: 'user.list',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.partial(next, null)
								),
								error: _.partial(next, null, {})
							});
						},
						limits: function(next) {
							self.callApi({
								resource: 'limits.get',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.partial(next, null)
								),
								error: _.partial(next, null, {})
							});
						},
						classifiers: function(next) {
							self.callApi({
								resource: 'numbers.listClassifiers',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.partial(next, null)
								),
								error: _.partial(next, null, {})
							});
						},
						currentBalance: function(next) {
							self.callApi({
								resource: 'ledgers.total',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data.amount'),
									_.partial(next, null)
								),
								error: _.partial(next, null, {})
							});
						},
						noMatch: getNoMatchCallflow,
						appsList: function(next) {
							monster.pub('apploader.getAppList', {
								scope: 'all',
								accountId: self.accountId,
								success: _.partial(next, null),
								error: _.partial(next, null, [])
							});
						},
						appsBlacklist: function(next) {
							self.callApi({
								resource: 'appsStore.getBlacklist',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data.blacklist', []),
									_.partial(next, null)
								),
								error: _.partial(next, null, [])
							});
						},
						listParents: function(next) {
							self.callApi({
								resource: 'account.listParents',
								data: {
									accountId: accountId
								},
								success: _.flow(
									_.partial(_.get, _, 'data'),
									_.partial(next, null)
								)
							});
						}
					}, callback);
				},
				fetchResellerUsers = function fetchResellerUsers(data, next) {
					var resellerId = _.find([
						_.get(data.account, 'contract.representative.account_id'),
						_.get(data.account, data.account.is_reseller ? 'id' : 'reseller_id')
					], _.isString);

					self.setStore('edit.reseller.accountId', resellerId);

					self.callApi({
						resource: 'user.list',
						data: {
							generateError: false,
							filters: {
								paginate: false
							},
							accountId: resellerId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.bind(self.setStore, self, 'edit.reseller.userList'),
							_.partial(next, null, data)
						),
						error: _.flow(
							_.bind(self.setStore, self, 'edit.reseller.userList', []),
							_.partial(next, null, data)
						)
					});
				};

			monster.waterfall([
				fetchData,
				fetchResellerUsers
			], function(err, results) {
				var params = {
						accountData: results.account,
						accountUsers: results.users.sort(function(a, b) {
							return (a.first_name + a.last_name).toLowerCase() > (b.first_name + b.last_name).toLowerCase() ? 1 : -1;
						}),
						accountLimits: results.limits,
						classifiers: results.classifiers,
						accountBalance: _.isNumber(results.currentBalance)
							? results.currentBalance
							: 0,
						parent: parent,
						noMatch: results.noMatch,
						selectedTab: selectedTab,
						appsList: _.map(results.appsList, function(app) {
							return _.merge({
								friendlyName: app.label,
								blacklisted: _.includes(results.appsBlacklist, app.id)
							}, _.pick(app, [
								'description',
								'extraCssClass',
								'icon',
								'id'
							]));
						}),
						appsBlacklist: results.appsBlacklist,
						listParents: results.listParents
					},
					editCallback = function(params) {
						params = self.formatDataEditAccount(params);
						self.editAccount(params);
					};

				if (!_.isPlainObject(params.noMatch)) {
					self.createNoMatchCallflow({
						accountId: params.accountData.id,
						resellerId: params.accountData.reseller_id
					}, function(data) {
						params.noMatch = data;
						editCallback(params);
					});
				} else {
					editCallback(params);
				}
			});
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
				if (previousId) {
					account.parentId = previousId;
				}

				previousId = account.id;
			});

			container
				.find('.top-bar')
					.empty()
					.append($(self.getTemplate({
						name: 'accountsBreadcrumbs',
						data: {
							accounts: tree
						}
					})));
		},

		/** Expected params:
			- accountData
			- accountUsers
			- accountLimits
			- classifiers (call restriction)
			- parent
			- callback [optional]
		*/
		editAccount: function(params) {
			var self = this,
				accountData = params.accountData,
				accountUsers = params.accountUsers,
				accountLimits = params.accountLimits,
				accountBalance = params.accountBalance,
				carrierInfo = params.carrierInfo,
				selectedTab = params.selectedTab,
				appsList = params.appsList,
				parent = params.parent,
				callback = params.callback,
				admins = $.map(accountUsers, function(val) {
					return val.priv_level === 'admin' ? val : null;
				}),
				regularUsers = $.map(accountUsers, function(val) {
					return val.priv_level !== 'admin' ? val : null;
				}),
				formattedClassifiers = $.map(params.classifiers, function(val, key) {
					var ret = {
						id: key,
						name: (self.i18n.active().classifiers[key] || {}).name || val.friendly_name,
						help: (self.i18n.active().classifiers[key] || {}).help,
						checked: true
					};
					if (accountData.call_restriction && key in accountData.call_restriction && accountData.call_restriction[key].action === 'deny') {
						ret.checked = false;
					}
					return ret;
				}),
				templateData = {
					resellerUsers: _.sortBy(self.getStore('edit.reseller.userList'), _.flow(
						monster.util.getUserFullName,
						_.toLower
					)),
					disableNumbersFeatures: monster.config.whitelabel.disableNumbersFeatures,
					account: $.extend(true, {}, accountData),
					accountAdmins: admins,
					accountUsers: regularUsers,
					isReseller: monster.apps.auth.isReseller,
					carrierInfo: carrierInfo,
					accountIsReseller: accountData.is_reseller,
					appsList: _.sortBy(appsList, 'name')
				};

			if ($.isNumeric(templateData.account.created)) {
				templateData.account.created = monster.util.toFriendlyDate(accountData.created, 'date');
			}

			self.updateBreadCrumbs(params.listParents, accountData, parent);

			var contentTemplate = $(self.getTemplate({
					name: 'edit',
					data: templateData
				})),
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
				if (!$(this).parent().hasClass('disabled')) {
					closeTabsContent();
					$(this).tab('show');
				}
			});

			contentTemplate.find('li.settings-item .settings-link').on('click', function(e) {
				var $this = $(this),
					settingsItem = $this.parents('.settings-item');

				if (!settingsItem.hasClass('disabled')) {
					var isOpen = settingsItem.hasClass('open');
					closeTabsContent();
					if (!isOpen) {
						settingsItem.addClass('open');
						$this.find('.update .text').text(self.i18n.active().closeSetting);
						$this.find('.update i').removeClass('fa-cog').addClass('fa-times');
						settingsItem.find('.settings-item-content').slideDown('fast');

						if (settingsItem.data('name') === 'accountsmanager_account_admins') {
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
					self.deleteAccount({
						data: {
							accountId: accountData.id,
							generateError: false
						},
						success: function(data, status) {
							parent.find('.main-content').empty();
							parent.find('.account-list-element[data-id="' + accountData.id + '"]').remove();
							parent.find('.account-browser-breadcrumbs .account-browser-breadcrumb').last().remove();
						},
						error: function(parsedError) {
							if (parsedError.message === 'account_has_descendants') {
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

				monster.ui.confirm(self.i18n.active()[node].confirm, function() {
					self.callApi({
						resource: 'account.' + action,
						data: {
							accountId: accountData.id
						},
						success: function(data, status) {
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active()[node].success
							});
							self.render({
								selectedId: accountData.id
							});
						},
						error: function(data, status) {
							monster.ui.toast({
								type: 'error',
								message: self.i18n.active().promoteDemoteError
							});
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
				});

				e.stopPropagation();
			});

			contentTemplate.find('.change').on('click', function(e) {
				e.preventDefault();

				var $this = $(this),
					fieldName = $this.data('field'),
					newData = self.cleanFormData(monster.ui.getFormData('form_' + fieldName));

				if (monster.ui.valid(contentTemplate.find('#form_' + fieldName))) {
					self.updateData(accountData, newData,
						function(data) {
							self.render({
								selectedId: accountData.id
							});
						},
						function(data) {
							if (data && data.data && 'api_error' in data.data && 'message' in data.data.api_error) {
								monster.ui.alert(data.data.api_error.message);
							}
						}
					);
				}
			});

			timezone.populateDropdown(contentTemplate.find('#accountsmanager_account_timezone'), accountData.timezone);

			monster.ui.chosen(contentTemplate.find('#accountsmanager_account_timezone'));
			monster.ui.chosen(contentTemplate.find('#user_language'));

			monster.ui.tooltips(contentTemplate);

			self.renderLimitsTab({
				accountData: accountData,
				limits: accountLimits,
				balance: accountBalance,
				formattedClassifiers: formattedClassifiers,
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

			if (selectedTab) {
				contentTemplate.find('.' + selectedTab + ' > a').tab('show');
			}

			notesTab.find('div.dropdown-menu input')
					.on('click', function() {
						return false;
					})
					.change(function() {
						$(this).parents('div.dropdown-menu').siblings('a.dropdown-toggle').dropdown('toggle');
					})
					.keydown('esc', function() {
						this.value = '';
						$(this).change();
					});

			monster.ui.chosen(notesTab.find('#sales_representative'));

			monster.ui.datepicker(notesTab.find('#sales_end_date'), {
				minDate: new Date()
			});

			if (_.has(accountData, 'contract.end_date')) {
				notesTab.find('#sales_end_date').datepicker('setDate',
					monster.util.toFriendlyDate(
						_.get(accountData, 'contract.end_date'),
						'date',
						undefined,
						true
					)
				);
			}

			notesTab.find('#accountmanager_sales_save').on('click', function(event) {
				event.preventDefault();

				var $button = $(this),
					userId = notesTab.find('#sales_representative').val(),
					gregorianEndDate = monster.util.dateToBeginningOfGregorianDay(
						notesTab.find('#sales_end_date').datepicker('getDate'),
						monster.util.getCurrentTimeZone()
					);

				$button.prop('disabled', 'disabled');

				self.updateData(
					accountData,
					{
						contract: {
							end_date: gregorianEndDate,
							representative: {
								account_id: self.getStore('edit.reseller.accountId'),
								user_id: userId,
								name: _
									.chain(self.getStore('edit.reseller.userList'))
									.find({ id: userId })
									.thru(monster.util.getUserFullName)
									.value()
							}
						}
					},
					function(data, status) {
						accountData = data.data;
						self.render({
							selectedId: accountData.id,
							selectedTab: 'tab-notes',
							callback: function() {
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().toastrMessages.salesContractUpdate.success,
									options: {
										timeOut: 5000
									}
								});
							}
						});
					},
					function(data, status) {
						$button.prop('disabled', false);

						monster.ui.toast({
							type: 'error',
							message: self.i18n.active().toastrMessages.salesContractUpdate.error,
							options: {
								timeOut: 5000
							}
						});
					}
				);
			});

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
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().toastrMessages.notesUpdateSuccess,
									options: {
										timeOut: 5000
									}
								});
							}
						});
					},
					function(data, status) {
						monster.ui.toast({
							type: 'error',
							message: self.i18n.active().toastrMessages.notesUpdateError,
							options: {
								timeOut: 5000
							}
						});
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
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().toastrMessages.notesUpdateSuccess,
								options: {
									timeOut: 5000
								}
							});
						}
					});
				},
				errorUpdateAnnouncement = function(data, status) {
					monster.ui.toast({
						type: 'error',
						message: self.i18n.active().toastrMessages.notesUpdateError,
						options: {
							timeOut: 5000
						}
					});
				};

			notesTab.find('#accountsmanager_announcement_delete').on('click', function() {
				delete accountData.announcement;
				self.updateAccount(accountData, successUpdateAnnouncement, errorUpdateAnnouncement);
			});

			notesTab.find('#accountsmanager_announcement_save').on('click', function() {
				var announcementContent = notesTab.find('.announcement .wysiwyg-editor').html();
				self.updateData(accountData, { announcement: announcementContent }, successUpdateAnnouncement, errorUpdateAnnouncement);
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
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().toastrMessages.appstoreUpdateSuccess,
									options: {
										timeOut: 5000
									}
								});
							}
						});
					},
					error: function(data, status) {
						monster.ui.toast({
							type: 'error',
							message: self.i18n.active().toastrMessages.appstoreUpdateError,
							options: {
								timeOut: 5000
							}
						});
					}
				});
			});

			contentTemplate.find('#accountsmanager_numbersfeatures_save').on('click', function() {
				self.callApi({
					resource: 'account.get',
					data: {
						accountId: accountData.id
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
										monster.ui.toast({
											type: 'success',
											message: self.i18n.active().toastrMessages.appstoreUpdateSuccess,
											options: {
												timeOut: 5000
											}
										});
									}
								});
							}
						});
					}
				});
			});

			contentTemplate.find('#accountsmanager_billing_contact_postalCode').on('change', function(event) {
				var $this = $(this),
					zipCode = $this.val();

				if (zipCode) {
					monster.request({
						resource: 'google.geocode.address',
						data: {
							zipCode: zipCode
						},
						success: function(data, status) {
							if (!_.isEmpty(data.results)) {
								var length = data.results[0].address_components.length;

								contentTemplate.find('#accountsmanager_billing_contact_locality').val(data.results[0].address_components[1].long_name);
								// Last component is country, before last is state, before can be county if exists or city if no county, so we had to change from 3 to length-2.
								contentTemplate.find('#accountsmanager_billing_contact_region').val(data.results[0].address_components[length - 2].short_name);

								contentTemplate.find('#accountsmanager_billing_contact_country').val(_.last(data.results[0].address_components).short_name);
							}
						},
						error: function(errorPayload, data, globalHandler) {
							globalHandler(data, { generateError: true });
						}
					});
				}
			});

			// self.adjustTabsWidth(contentTemplate.find('ul.account-tabs > li'));

			$.each(contentTemplate.find('form'), function() {
				var options = {};
				if (this.id === 'accountsmanager_callrestrictions_form') {
					options.rules = {
						'addCreditBalance': {
							number: true,
							min: 5
						}
					};
				}
				monster.ui.validate($(this), options);
			});

			if (typeof callback === 'function') {
				callback(contentTemplate);
			}
		},

		confirmDeleteDialog: function(accountName, callbackSuccess) {
			var self = this,
				deleteKey = self.i18n.active().deleteAccountDialog.deleteKey,
				confirmPopup = monster.ui.confirm(
					$(self.getTemplate({
						name: 'deleteAccountDialog',
						data: {
							accountName: accountName
						}
					})),
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
				if ($(this).val() === deleteKey) {
					confirmPopup.find('#confirm_button').prop('disabled', false);
				} else {
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
				accountData = params.accountData,
				tabContentTemplate = self.getLimitsTabContent(params),
				twowayTrunksDiv = tabContentTemplate.find('.trunks-div.twoway'),
				inboundTrunksDiv = tabContentTemplate.find('.trunks-div.inbound'),
				outboundTrunksDiv = tabContentTemplate.find('.trunks-div.outbound');

			tabContentTemplate.find('.change-credits').on('click', function() {
				var dataTemplate = {
						currencySymbol: monster.util.getCurrencySymbol(),
						amount: params.balance
					},
					template = $(self.getTemplate({
						name: 'updateCreditsDialog',
						data: dataTemplate
					})),
					popupAmount = template.find('.add-credits-header .value'),
					accountsAppAmount = tabContentTemplate.find('.credit-balance'),
					addValueField = template.find('#amount_add'),
					removeValueField = template.find('#amount_remove'),
					changeValueDisplayed = function(accountId, field) {
						self.callApi({
							resource: 'ledgers.total',
							data: {
								accountId: accountId
							},
							success: function(data, status) {
								params.balance = data.data.amount;
								var formattedValue = monster.util.formatPrice({
									price: params.balance,
									digits: 2
								});
								popupAmount.html(formattedValue);
								accountsAppAmount.html(formattedValue);
								field.val('');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().updateCreditDialog.successfulUpdate
								});
							}
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
					if (monster.ui.valid(addForm)) {
						self.addCredit(accountData.id, addValueField.val(), function(data) {
							changeValueDisplayed(accountData.id, addValueField);
						});
					}
				});

				template.find('.remove-credit').on('click', function() {
					if (monster.ui.valid(removeForm)) {
						self.removeCredit(accountData.id, removeValueField.val(), function(data) {
							changeValueDisplayed(accountData.id, removeValueField);
						});
					}
				});

				monster.ui.dialog(template, {
					title: self.i18n.active().updateCreditDialog.title
				});
			});

			parent.find('#accountsmanager_limits_save').click(function(e) {
				e.preventDefault();

				var newTwowayValue = twowayTrunksDiv.find('.slider-div').slider('value'),
					newInboundValue = inboundTrunksDiv.find('.slider-div').slider('value'),
					newOutboundValue = outboundTrunksDiv.find('.slider-div').slider('value'),
					callRestrictions = monster.ui.getFormData('accountsmanager_callrestrictions_form').limits.call_restriction,
					allowPrepay = tabContentTemplate.find('.allow-prepay-ckb').is(':checked');

				if (monster.ui.valid(parent.find('#accountsmanager_callrestrictions_form'))) {
					$.each(params.formattedClassifiers, function(k, v) {
						if (!(v.id in callRestrictions) || callRestrictions[v.id].action !== 'inherit') {
							callRestrictions[v.id] = {
								action: 'deny'
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
									monster.ui.toast({
										type: 'success',
										message: self.i18n.active().toastrMessages.limitsUpdateSuccess,
										options: {
											timeOut: 5000
										}
									});
									parallelCallback && parallelCallback(null, data.data);
								},
								error: function(data, status) {
									if (data.error !== 402) {
										monster.ui.toast({
											type: 'error',
											message: self.i18n.active().toastrMessages.limitsUpdateError,
											options: {
												timeOut: 5000
											}
										});
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
									data: self.formatAccountData(accountData)
								},
								success: function(data, status) {
									monster.ui.toast({
										type: 'success',
										message: self.i18n.active().toastrMessages.callRestrictionsUpdateSuccess,
										options: {
											timeOut: 5000
										}
									});
									parallelCallback && parallelCallback(null, data.data);
								},
								error: function(data, status) {
									monster.ui.toast({
										type: 'error',
										message: self.i18n.active().toastrMessages.callRestrictionsUpdateError,
										options: {
											timeOut: 5000
										}
									});
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
				template = $(self.getTemplate({
					name: 'limitsTabContent',
					data: {
						mode: params.hasOwnProperty('accountData') ? 'update' : 'create',
						balance: params.balance || 0,
						classifiers: formattedClassifiers,
						allowPrepay: limits.hasOwnProperty('allow_prepay') ? limits.allow_prepay : true,
						disableBraintree: monster.config.disableBraintree
					}
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
						change: function(event) {
							sliderValue.css('left', trunksDiv.find('.ui-slider-handle').css('left'));
						}
					});

					sliderValue.css('left', trunksDiv.find('.ui-slider-handle').css('left'));
				};

			createSlider({
				trunksDiv: twowayTrunksDiv,
				minValue: 0,
				maxValue: 100,
				currentValue: twoway
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

				if (accountData.hasOwnProperty('ui_restrictions')) {
					restrictionsList.forEach(function(element) {
						if (accountData.ui_restrictions.hasOwnProperty('myaccount')) {
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
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().toastrMessages.uiRestrictionsUpdateSuccess,
									options: {
										timeOut: 5000
									}
								});
							}
						});
					},
					function(data, status) {
						monster.ui.toast({
							type: 'error',
							message: self.i18n.active().toastrMessages.uiRestrictionsUpdateError,
							options: {
								timeOut: 5000
							}
						});
					}
				);
			});
		},

		getRestrictionsTabContent: function(params) {
			var self = this,
				uiRestrictions = params.hasOwnProperty('accountData') && params.accountData.hasOwnProperty('ui_restrictions') ? params.accountData.ui_restrictions.myaccount || params.accountData.ui_restrictions : {},
				template = $(self.getTemplate({
					name: 'restrictionsTabContent',
					data: {
						ui_restrictions: uiRestrictions
					}
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

				if (restrictionsContainer.data('content') !== 'restrictions-balance') {
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
				if ($(this).width() > maxWidth) { maxWidth = $(this).width(); }
			});
			$tabs.css('min-width', maxWidth + 'px');
		},

		cleanMergedData: function(data) {
			var self = this;

			if ('reseller' in data) {
				delete data.reseller;
			}

			if ('language' in data) {
				if (data.language === 'auto') {
					delete data.language;
				}
			}

			return data;
		},

		cleanFormData: function(formData) {
			if ('enabled' in formData) {
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
					data: self.formatAccountData(data)
				},
				success: function(_data, status) {
					success && success(_data, status);
				},
				error: function(_data, status) {
					error && error(_data, status);
				}
			});
		},

		formatAccountData: function(data) {
			return _.omit(data, ['billing_mode', 'superduper_admin', 'wnm_allow_additions', 'created', 'is_reseller', 'reseller_id']);
		},

		autoGeneratePassword: function() {
			return monster.util.randomString(4, 'abcdefghjkmnpqrstuvwxyz') + monster.util.randomString(4, '0123456789');
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

			if (type !== 'useBlended') {
				noMatchCallflow.flow.module = 'resources';

				if (type === 'useReseller') {
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
			var description = 'Credit added by administrator';
			var self = this,
				apiData = {
					resource: 'ledgers.credit',
					data: {
						accountId: accountId,
						data: {
							amount: parseFloat(value),
							source: {
								service: 'adjustments',
								id: monster.util.guid()
							},
							usage: {
								type: 'credit',
								quantity: 0,
								unit: monster.config.currencyCode
							},
							description: description,
							metadata: {
								ui_request: true,
								automatic_description: true
							}
						}
					},
					success: function(data, status) {
						success && success(data);
					}
				};

			// We do that so that we don't bypass the generic error helper if there was no error callback defined.
			if (error && typeof error === 'function') {
				apiData.data.generateError = false;

				apiData.error = function(data, status) {
					error && error(data);
				};
			}

			self.callApi(apiData);
		},

		removeCredit: function(accountId, value, success, error) {
			var self = this,
				description = 'Credit removed by adminstrator',
				apiData = {
					resource: 'ledgers.debit',
					data: {
						accountId: accountId,
						data: {
							amount: parseFloat(value),
							source: {
								service: 'adjustments',
								id: monster.util.guid()
							},
							usage: {
								type: 'debit',
								quantity: 0,
								unit: monster.config.currencyCode
							},
							description: description,
							metadata: {
								ui_request: true,
								automatic_description: true
							}
						}
					},
					success: function(data, status) {
						success && success(data);
					}
				};

			// We do that so that we don't bypass the generic error helper if there was no error callback defined.
			if (error && typeof error === 'function') {
				apiData.data.generateError = false;

				apiData.error = function(data, status) {
					error && error(data);
				};
			}

			self.callApi(apiData);
		},

		deleteAccount: function(args) {
			var self = this;

			self.callApi({
				resource: 'account.delete',
				data: args.data,
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		}
	};

	return app;
});
