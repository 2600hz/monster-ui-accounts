define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var serviceItemsListing = {

		appFlags: {
			serviceItemsListing: {
				maxStoredPlans: 5
			}
		},

		/**
		 * Renders a service items listing
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the listing
		 * @param  {String[]} args.planIds  Array of plan IDs to be used to generate the listing
		 * @param  {Boolean} [args.showProgressPanel=true]  Whether or not to display the
		 *                                                      progress panel while loading data
		 * @param  {Number} [args.maxStoredPlans]  Maximum plans to be cached in store
		 * @param  {Function} [args.success]  Optional success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRender: function(args) {
			var self = this,
				planIds = args.planIds,
				showProgressPanel = _.get(args, 'showProgressPanel', true),
				$container = args.container,
				initTemplate = function(formattedPlanCategories) {
					var $template = $(self.getTemplate({
						name: 'layout',
						data: {
							categories: formattedPlanCategories
						},
						submodule: 'serviceItemsListing'
					}));

					monster.ui.tooltips($template);

					return $template;
				};

			self.appFlags.serviceItemsListing.maxStoredPlans = _.get(args, 'maxStoredPlans', self.appFlags.serviceItemsListing.maxStoredPlans);

			// An array of functions is used instead of an object, because they need to be
			// executed in an ordered manner
			monster.series([
				function(seriesCallback) {
					if (!showProgressPanel) {
						seriesCallback(null);
						return;
					}

					monster.ui.insertTemplate($container, function(insertTemplateCallback) {
						seriesCallback(null, insertTemplateCallback);
					});
				},
				function(seriesCallback) {
					self.serviceItemsListingGetFormattedServicePlanCategories({
						planIds: planIds,
						success: function(formattedPlanCategories) {
							seriesCallback(null, formattedPlanCategories);
						},
						error: function() {
							seriesCallback(null, []);
						}
					});
				}
			], function(err, results) {
				if (err) {
					_.has(args, 'error') && args.error(err);
					return;
				}
				var data = _.get(results, 1),
					$template = initTemplate(data);

				if (showProgressPanel) {
					var insertTemplateCallback = results[0];
					_.defer(function() {
						// Defer, to ensure that the loading template does not replace the step template
						insertTemplateCallback($template);
					});
				} else {
					$container.empty().append($template);
				}

				_.has(args, 'success') && args.success();
			});
		},

		/**
		 * Gets the categories for a group of plans, already formatted to be rendered
		 * @param  {Object} args
		 * @param  {String[]} args.planIds  Plan IDs for which the categories will be obtained
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingGetFormattedServicePlanCategories: function(args) {
			var self = this,
				planIds = args.planIds,
				successCallback = args.success,
				errorCallback = args.error,
				storedPlans,
				formattedPlan;

			// No plan IDs provided
			if (_.isEmpty(planIds)) {
				successCallback([]);
				return;
			}

			// Try to get plan categories from plans already stored
			planIds = _.sortBy(planIds);
			storedPlans = self.serviceItemsListingGetStore('formattedPlans', []);
			formattedPlan = _
				.chain(storedPlans)
				.find(function(plan) {
					return _.isEqual(plan.planIds, planIds);
				})
				.value();

			if (formattedPlan) {
				// Plans are stored like a queue, so we move the found plan to the top
				// as it gained relevance for being a "cache hit"
				storedPlans = _
					.chain(storedPlans)
					.reject(function(plan) {
						return _.isEqual(plan.planIds, planIds);
					})
					.concat(formattedPlan)
					.value();

				self.serviceItemsListingSetStore('formattedPlans', storedPlans);

				successCallback(formattedPlan.categories);
				return;
			}

			// Try to get service plan quote from API
			self.serviceItemsListingRequestServiceQuote({
				planIds: planIds,
				success: function(serviceQuote) {
					// Format plan, and add to store
					var formattedPlanCategories = self.serviceItemsListingFormatServiceQuote({
							serviceQuote: serviceQuote
						}),
						formattedPlan = {
							planIds: planIds,
							categories: formattedPlanCategories
						},
						storeSizeDiff = storedPlans.length - self.appFlags.serviceItemsListing.maxStoredPlans;

					// Plans are stored like a queue with a maximum size of self.appFlags.serviceItemsListing.storeSize
					if (storeSizeDiff >= 0) {
						storedPlans = _.drop(storedPlans, storeSizeDiff + 1);
					} else {
						storedPlans = _.clone(storedPlans);	// Clone array in order to not to modify the stored one
					}
					storedPlans.push(formattedPlan);
					self.serviceItemsListingSetStore('formattedPlans', storedPlans);

					successCallback(formattedPlanCategories);
				},
				error: errorCallback
			});
		},

		/**
		 * Formats a service plan quote into collections of items grouped by category
		 * @param  {Object} args
		 * @param  {Object} args.serviceQuote  Service quote to be formatted
		 */
		serviceItemsListingFormatServiceQuote: function(args) {
			var self = this,
				serviceQuote = args.serviceQuote,
				invoicePlan = _.get(serviceQuote, 'invoices[0].plan', {});

			return _
				.chain(invoicePlan)
				.map(function(categoryItems, categoryKey) {
					return {
						title: monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, categoryKey),
						items: _
							.chain(categoryItems)
							.keys()
							.flatMap(function(itemKey) {
								return self.serviceItemsListingFormatItemData({
									categoryItems: categoryItems,
									itemKey: itemKey
								});
							})
							.sortBy('label')
							.value()
					};
				})
				.sortBy('title')
				.value();
		},

		/**
		 * Formats an item's data into a list of one or more data rows
		 * @param  {Object} args
		 * @param  {Object} args.categoryItems  Category items
		 * @param  {String} args.itemKey  Current item key
		 */
		serviceItemsListingFormatItemData: function(args) {
			var self = this,
				categoryItems = args.categoryItems,
				itemKey = args.itemKey,
				currentItem = _.get(categoryItems, itemKey, {}),
				item = _
					.chain(categoryItems)
					.get('_all', {})	// Get default category item
					.cloneDeep()	// Clone, to not alter the original one for future use
					.merge(currentItem)	// Merge the specific sub-category item
					.value(),
				itemLabel = currentItem.name || monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, itemKey),
				defaultFormattedItem = {
					label: itemLabel,
					subCategory: itemKey,
					quantity: null,
					rate: {
						isCascade: _.get(item, 'cascade', false)
					},
					isActivationCharges: false,
					discounts: {}
				},
				priceRates = self.serviceItemsListingGetRatesAsLinkedList({
					item: item,
					ratePath: 'rate',
					ratesPath: 'rates'
				}),
				singleDiscountRates = self.serviceItemsListingGetRatesAsLinkedList({
					item: item,
					ratePath: 'discounts.single.rate',
					ratesPath: 'discounts.single.rates'
				}),
				cumulativeDiscountRates = self.serviceItemsListingGetRatesAsLinkedList({
					item: item,
					ratePath: 'discounts.cumulative.rate',
					ratesPath: 'discounts.cumulative.rates'
				}),
				itemRatesQtys = _.map(priceRates.list, 'qty'),
				singleDiscountsQtys = _.map(singleDiscountRates.list, 'qty'),
				cumulativeDiscountsQtys = _.map(cumulativeDiscountRates.list, 'qty'),
				allRateQtys = _
					.chain(itemRatesQtys)
					.union(singleDiscountsQtys, cumulativeDiscountsQtys)
					.sortBy()
					.value(),
				price = priceRates.head,
				singleDiscount = singleDiscountRates.head,
				cumulativeDiscount = cumulativeDiscountRates.head,
				cumulativeDiscountExtra = _.has(item, 'discounts.cumulative.maximum') ? { maximum: item.discounts.cumulative.maximum } : {},
				formattedItemList = _.map(allRateQtys, function(qty, index) {
					var formattedItem = _.merge({}, defaultFormattedItem, {
							quantity: _.isFinite(qty) ? '0 - ' + qty : '0 - ∞'
						}),
						priceHasChanged = index === 0 && price;

					if (index > 0) {
						// If we add multiple lines for the same item, then we don't want to repeat the label every time
						formattedItem.label = '';
					}

					if (price && price.qty < qty) {
						price = price.next;
						priceHasChanged = !_.isNil(price);
					}
					if (singleDiscount && singleDiscount.qty < qty) {
						singleDiscount = singleDiscount.next;
					}
					if (cumulativeDiscount && cumulativeDiscount.qty < qty) {
						cumulativeDiscount = cumulativeDiscount.next;
					}

					if (priceHasChanged) {
						formattedItem.rate.value = price.rate;
					} else if (price === null) {
						formattedItem.rate.value = null;	// Set to null to let the layout template know that there is no price
					} else {
						formattedItem.rate.isCascade = false;
					}

					if (singleDiscount) {
						formattedItem.discounts.single = {
							value: singleDiscount.rate
						};
					}
					if (cumulativeDiscount) {
						formattedItem.discounts.cumulative = _.merge({
							value: cumulativeDiscount.rate
						}, cumulativeDiscountExtra);
					}

					return formattedItem;
				});

			if (_.has(item, 'activation_charge') && item.activation_charge > 0) {
				var formattedItem = _.cloneDeep(defaultFormattedItem);

				formattedItem.isActivationCharges = true;
				formattedItem.label = self.getTemplate({
					name: '!' + self.i18n.active().accountsApp.serviceItemsListing.labels.activationCharge,
					data: {
						itemName: formattedItem.label
					}
				});
				formattedItem.rate.value = item.activation_charge;

				formattedItemList.push(formattedItem);
			}

			// If no lines were added, we still want to add it to the list, so user knows it's in there
			if (_.isEmpty(formattedItemList)) {
				formattedItemList.push(defaultFormattedItem);
			}

			return formattedItemList;
		},

		/* UTILITY FUNCTIONS */

		/**
		 * Collect item rates as a linked list
		 * @param  {Object} args
		 * @param  {Object} args.item  Sub-category item
		 * @param  {String} args.ratePath  Path to the property that contains the item's main rate
		 * @param  {String} args.ratesPath  Path to the property that contains the item's quantity rates
		 */
		serviceItemsListingGetRatesAsLinkedList: function(args) {
			var item = args.item,
				ratePath = args.ratePath,
				ratesPath = args.ratesPath,
				sortedRates = _
					.chain(item)
					.get(ratesPath, {})
					.map(function(rate, qty) {
						return {
							qty: _.toInteger(qty),
							rate: rate
						};
					})
					.sortBy('qty')
					.value();

			if (_.has(item, ratePath)) {
				sortedRates.push({
					qty: Number.POSITIVE_INFINITY,
					rate: _.get(item, ratePath)
				});
			}

			return	_
				.reduceRight(sortedRates, function(accum, value) {
					if (_.has(accum, 'head')) {
						_.merge(value, {
							next: accum.head
						});
					}

					accum.head = value;
					accum.list.unshift(value);

					return accum;
				},
				{
					list: []
				});
		},

		/* API REQUESTS */

		/**
		 * Request the aggregate or "quote" for a set of plans
		 * @param  {Object} args
		 * @param  {String[]} args.planIds  List of plans to be included for the quote
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRequestServiceQuote: function(args) {
			var self = this;

			self.callApi({
				resource: 'services.quote',
				data: {
					accountId: self.accountId,
					data: {
						plans: args.planIds
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

		/* STORE FUNCTIONS */

		/**
		 * Store getter
		 * @param  {Array|String} [path]
		 * @param  {*} [defaultValue]
		 * @return {*}
		 */
		serviceItemsListingGetStore: function(path, defaultValue) {
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
		 * @param  {Array|String|*} path  Path or value
		 * @param  {*} [value]  Value, if {path} was provided
		 */
		serviceItemsListingSetStore: function(path, value) {
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

	return serviceItemsListing;
});
