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
		 * @param  {Number} [args.maxStoredPlans]  Maximum plans to be cached in store
		 * @param  {Function} [args.success]  Optional success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRender: function(args) {
			var self = this,
				planIds = args.planIds,
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
					monster.ui.insertTemplate($container, function(insertTemplateCallback) {
						seriesCallback(null, insertTemplateCallback);
					});
				},
				function(seriesCallback) {
					self.serviceItemsListingGetFormattedServicePlan({
						planIds: planIds,
						success: function(formattedPlanCategories) {
							seriesCallback(null, formattedPlanCategories);
						}
					});
				}
			], function(err, results) {
				if (err) {
					_.has(args, 'error') && args.error(err);
					return;
				}

				var insertTemplateCallback = results[0],
					data = _.get(results, 1);

				insertTemplateCallback(initTemplate(data));
				_.has(args, 'success') && args.success();
			});
		},

		serviceItemsListingGetFormattedServicePlan: function(args) {
			var self = this,
				planIds = args.planIds,
				successCallback = args.success,
				errorCallback = args.error,
				storedPlans,
				formattedPlanCategories;

			// No plan IDs provided
			if (_.isEmpty(planIds)) {
				successCallback([]);
				return;
			}

			// Try to get from stored plans
			planIds = _.sortBy(planIds);
			storedPlans = self.serviceItemsListingGetStore('formattedPlans', []);
			formattedPlanCategories = _
				.chain(storedPlans)
				.find(function(plan) {
					return _.isEqual(plan.planIds, planIds);
				})
				.get('categories')
				.value();

			if (formattedPlanCategories) {
				successCallback(formattedPlanCategories);
				return;
			}

			// Try to get service plan quote from API
			self.serviceItemsListingRequestServiceQuote({
				planIds: planIds,
				success: function(data) {
					// Format plan, and add to store
					var formattedPlanCategories = self.serviceItemsListingFormatQuoteData(data),
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

		serviceItemsListingFormatQuoteData: function(data) {
			var self = this,
				items = _.get(data, 'invoices[0].items', []),
				plan = _.get(data, 'invoices[0].plan', {});

			return _
				.chain(items)
				.groupBy('category')
				.map(function(items, category) {
					return {
						title: monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, category),
						category: category,
						items: _
							.chain(items)
							.flatMap(function(fields) {
								return self.serviceItemsListingFieldsFormatData(plan, category, fields.item);
							})
							.sortBy('name')
							.value()
					};
				})
				.sortBy('title')
				.value();
		},

		serviceItemsListingFieldsFormatData: function(plan, categoryName, subCategoryName) {
			var self = this,
				defaultCategoryItem = _.get(plan, [categoryName, '_all'], {}),
				subCategoryItem = _.get(plan, [categoryName, subCategoryName], {}),
				item = _.merge(defaultCategoryItem, subCategoryItem),
				label = item.name || monster.util.tryI18n(self.i18n.active().accountsApp.serviceItemsListing.keys, subCategoryName),
				defaultItem = {
					name: label,
					label: label,
					subCategory: subCategoryName,
					quantity: null,
					rate: {
						isCascade: _.get(item, 'cascade', false)
					},
					isActivationCharges: false,
					discounts: {}
				},
				itemHasRate = _.has(item, 'rate'),
				mapQuantityRatePair = function(rate, qty) {
					return {
						qty: _.toInteger(qty),
						rate: rate
					};
				},
				getRatesAsLinkedList = function(ratePath, ratesPath) {
					var sortedRates = _
						.chain(item)
						.get(ratesPath, {})
						.map(mapQuantityRatePair)
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
				priceRates = getRatesAsLinkedList('rate', 'rates'),
				singleDiscountRates = getRatesAsLinkedList('discounts.single.rate', 'discounts.single.rates'),
				cumulativeDiscountRates = getRatesAsLinkedList('discounts.cumulative.rate', 'discounts.cumulative.rates'),
				itemRatesQtys = _.map(priceRates.list, 'qty'),
				singleDiscountsQtys = _.map(singleDiscountRates.list, 'qty'),
				cumulativeDiscountsQtys = _.map(cumulativeDiscountRates.list, 'qty'),
				allRateQtys = _
					.chain(itemRatesQtys)
					.union(singleDiscountsQtys, cumulativeDiscountsQtys)
					.sortBy()
					.value(),
				lastQty = 0,
				formattedItemList = [],
				addRow = function(item) {
					// If we add multiple lines for the same item, then we don't want to repeat the label every time
					if (formattedItemList.length > 0) {
						if (!item.isActivationCharges) {
							item.label = '';
						}
					}

					formattedItemList.push(item);
				},
				price = priceRates.head,
				singleDiscount = singleDiscountRates.head,
				cumulativeDiscount = cumulativeDiscountRates.head,
				cumulativeDiscountExtra = _.has(item, 'discounts.cumulative.maximum') ? { maximum: item.discounts.cumulative.maximum } : {};

			_.chain(allRateQtys)
				.map(function(qty, index) {
					var formattedItem = _.cloneDeep(defaultItem),
						priceHasChanged = index === 0 && price;

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
						formattedItem.rate.value = null;	// To tell to the layout template that there is no price
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

					if (!_.isFinite(qty)) {
						formattedItem.quantity = lastQty + ' - ∞';
					} else if (lastQty === qty) {
						formattedItem.quantity = _.toString(qty);
					} else {
						formattedItem.quantity = lastQty + ' - ' + qty;
					}
					lastQty = qty;

					return formattedItem;
				})
				.each(function(formattedItem) {
					addRow(formattedItem);
				})
				.value();

			if (_.has(item, 'activation_charge') && item.activation_charge > 0) {
				var formattedItem = _.cloneDeep(defaultItem);

				formattedItem.isActivationCharges = true;
				formattedItem.name = self.getTemplate({
					name: '!' + self.i18n.active().accountsApp.serviceItemsListing.labels.activationCharge,
					data: {
						itemName: formattedItem.name
					}
				});
				formattedItem.rate.value = item.activation_charge;

				if (itemHasRate) {
					// Remove discounts, because they are already displayed in the rate row
					formattedItem.discounts = {};
				}

				addRow(formattedItem);
			}

			// Else if no lines were added, we still want to add it to the list, so user knows it's in there
			if (_.isEmpty(formattedItemList)) {
				addRow(defaultItem);
			}

			return formattedItemList;
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
