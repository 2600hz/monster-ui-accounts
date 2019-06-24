define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var serviceItemsListing = {

		/**
		 * Renders a service items listing
		 * @param  {Object} args
		 * @param  {jQuery} args.container  Element that will contain the listing
		 * @param  {String[]} args.planIds  Array of plan IDs to be used to generate the listing
		 * @param  {Function} [args.success]  Optional success callback
		 * @param  {Function} [args.error]  Optional error callback
		 */
		serviceItemsListingRender: function(args) {
			var self = this,
				planIds = args.planIds,
				$container = args.container,
				initTemplate = function(data) {
					var categories = self.serviceItemsListingFormatQuoteData(data),
						$template = $(self.getTemplate({
							name: 'layout',
							data: {
								categories: categories
							},
							submodule: 'serviceItemsListing'
						}));

					monster.ui.tooltips($template);

					return $template;
				};

			// An array of functions is used instead of an object, because they need to be
			// executed in an ordered manner
			monster.series([
				function(seriesCallback) {
					monster.ui.insertTemplate($container, function(insertTemplateCallback) {
						seriesCallback(null, insertTemplateCallback);
					});
				},
				function(seriesCallback) {
					if (_.isEmpty(planIds)) {
						seriesCallback(null);
						return;
					}

					self.serviceItemsListingRequestServiceQuote({
						planIds: planIds,
						success: function(listing) {
							seriesCallback(null, listing);
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

		serviceItemsListingFormatQuoteData: function(data) {
			var self = this,
				items = _.get(data, 'invoices[0].items', []),
				plan = _.get(data, 'invoices[0].plan', {});

			console.log(plan);
			console.log(_.chain(plan).flatMap(x => _.toArray(x)).filter(x => x.discounts).value());

			_.merge(plan.users._all, {
				rates: {
					'1': 41.99,
					'5': 19.99
				},
				discounts: {
					single: {
						rate: 1.00,
						rates: {
							'2': 1.10,
							'6': 1.95
						}
					},
					cumulative: {
						rate: 0.25,
						maximum: 10,
						rates: {
							'3': 0.35,
							'10': 0.75
						}
					}
				}
			});

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
						value: null,
						isCascade: _.get(item, 'cascade', false)
					},
					isActivationCharges: false,
					discounts: {}
				},
				itemHasRate = _.has(item, 'rate'),
				itemHasMultipleRates = _.has(item, 'rates'),
				itemHasMultipleSingleDiscounts = _.has(item, 'discounts.single.rates'),
				itemHasMultipleCumulativeDiscounts = _.has(item, 'discounts.cumulative.rates'),
				formattedItemList = [],
				addRow = function(item) {
					// If we add multiple lines for the same item, then we don't want to repeat the name every time.
					if (formattedItemList.length > 0) {
						if (!item.isActivationCharges) {
							item.label = '';
						}
					}

					formattedItemList.push(item);
				};

			if (_.isEmpty(item)) {
				console.log('Item empty for:', categoryName, subCategoryName);
			}

			if (_.has(item, 'discounts.single.rate')) {
				console.log(item);
				_.merge(defaultItem.discounts, {
					single: {
						value: -item.discounts.single.rate
					}
				});
			} else if (_.has(item, 'discounts.cumulative.rate')) {
				_.merge(defaultItem.discounts, {
					cumulative: {
						value: -item.discounts.cumulative.rate,
						maximum: item.discounts.cumulative.maximum
					}
				});
			}

			if (itemHasRate) {
				var formattedItem = _.cloneDeep(defaultItem);

				formattedItem.rate.value = item.rate;

				// If item has both rate and rates, it means the rate is the price for a number of items exceeding the maximum rates
				if (itemHasMultipleRates) {
					formattedItem.quantity = '0 - ∞';
					defaultItem.rate.value = item.rate;
				}
				console.log('Adding normal row', formattedItem);

				addRow(formattedItem);
			}

			if (itemHasMultipleRates || itemHasMultipleSingleDiscounts || itemHasMultipleCumulativeDiscounts) {
				// For each rate or discount quantity limit we want to display a line,
				// grouping the values for each quantity range
				var itemRatesQtys = itemHasMultipleRates ? _.keys(item.rates) : [],
					singleDiscountsQtys = itemHasMultipleSingleDiscounts ? _.keys(item.discounts.single.rates) : [],
					cumulativeDiscountsQtys = itemHasMultipleCumulativeDiscounts ? _.keys(item.discounts.cumulative.rates) : [],
					allRateQtys = _
						.chain(itemRatesQtys)
						.union(singleDiscountsQtys, cumulativeDiscountsQtys)
						.map(_.toInteger)
						.orderBy(_.identity, ['desc'])	// Descending order to work from upper quantity limit downwards
						.value(),
					rateValue = defaultItem.rate.value,
					singleDiscount = _.get(defaultItem.discounts, 'single', {}),
					cumulativeDiscount = _.get(defaultItem.discounts, 'cumulative', {});

				console.log('allRateQtys', allRateQtys);

				_.chain(allRateQtys)
					.map(function(qty, index) {
						var formattedItem = _.cloneDeep(defaultItem),
							nextIndex = index + 1,
							lowQty;

						if (nextIndex < allRateQtys.length) {
							lowQty = allRateQtys[nextIndex] + 1;
							formattedItem.quantity = (lowQty === qty) ? _.toString(qty) : _.join([lowQty, qty], ' - ');
						} else {
							formattedItem.quantity = 0 + ' - ' + qty;
						}

						// Set rate
						if (itemHasMultipleRates) {
							if (_.has(item.rates, qty)) {
								rateValue = item.rates[qty];
							}
							formattedItem.rate.value = rateValue;
						}

						// Set single discount
						if (itemHasMultipleSingleDiscounts) {
							if (_.has(item.discounts.single.rates, qty)) {
								singleDiscount = {
									value: -item.discounts.single.rates[qty]
								};
							}
							formattedItem.discounts.single = singleDiscount;
						}

						// Set cumulative discount
						if (itemHasMultipleCumulativeDiscounts) {
							if (_.has(item.discounts.cumulative.rates, qty)) {
								cumulativeDiscount = {
									value: -item.discounts.cumulative.rates[qty]
								};
							}
							formattedItem.discounts.cumulative = cumulativeDiscount;
						}

						return formattedItem;
					})
					.reverse()
					.each(function(formattedItem) {
						console.log('Adding complex row', formattedItem);
						addRow(formattedItem);
					})
					.value();
			}

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
				console.log('Adding activation charge row', formattedItem);

				addRow(formattedItem);
			}

			// Else if no lines were added, we still want to add it to the list, so user knows it's in there
			if (_.isEmpty(formattedItemList)) {
				var formattedItem = _.cloneDeep(defaultItem);

				console.log('Adding row just "because"', formattedItem);
				addRow(defaultItem);
			}

			return formattedItemList;
		},

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
		}
	};

	return serviceItemsListing;
});
